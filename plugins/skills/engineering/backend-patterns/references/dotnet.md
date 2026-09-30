# .NET / C# Backend Rules

These rules **override** the base rules in `SKILL.md` for .NET projects (ASP.NET Core + EF Core). If an existing project follows a different pattern, follow the project.

## 1. Layer flow

```
Controller  →  IXxxService (interface)  →  XxxService (implementation)  →  AppDbContext
```

- **The controller** handles HTTP only: it accepts the request DTO, calls the service interface, and returns an `ActionResult`. No business logic, and it must never touch `AppDbContext`.
- **The controller depends on the interface**, never on the service class directly.
- **The service** holds the business logic and uses `AppDbContext` directly. **There is no repository layer**, because `DbContext` already acts as both unit of work and repository.
- Services return DTOs, not entities, so entities never leak into the API response.

## 2. Solution structure

Each layer is a separate project. Replace `<App>` with the application's name.

```
<App>.sln
src/
├── <App>.Api/                      # ASP.NET Core Web API (entry point)
│   ├── Controllers/
│   │   └── OrdersController.cs
│   ├── Middlewares/
│   │   ├── ExceptionHandlingMiddleware.cs
│   │   └── RequestLoggingMiddleware.cs
│   ├── Extensions/                 # DI, auth, swagger registration, etc.
│   │   └── ServiceCollectionExtensions.cs
│   ├── Filters/                    # action filters (optional)
│   ├── appsettings.json
│   └── Program.cs
│
├── <App>.Core/                     # business logic & data access
│   ├── Data/
│   │   ├── AppDbContext.cs
│   │   ├── Configurations/         # one IEntityTypeConfiguration<T> per entity
│   │   │   └── OrderConfiguration.cs
│   │   └── Migrations/
│   ├── Interfaces/
│   │   └── IOrderService.cs
│   ├── Services/
│   │   └── OrderService.cs
│   ├── Validators/                 # FluentValidation
│   │   └── CreateOrderRequestValidator.cs
│   ├── Mappings/                   # entity <-> DTO
│   ├── Exceptions/                 # NotFoundException, BusinessException, etc.
│   └── DependencyInjection.cs      # AddCore(): registers AppDbContext & services
│
└── <App>.Model/                    # entities & contracts (no logic)
    ├── Entities/
    │   ├── BaseEntity.cs
    │   └── Order.cs
    ├── Dtos/
    │   └── Orders/
    │       ├── CreateOrderRequest.cs
    │       └── OrderResponse.cs
    └── Enums/
tests/
├── <App>.Core.Tests/               # service unit tests
└── <App>.Api.Tests/                # integration tests (WebApplicationFactory)
```

### Project references (one direction)

```
<App>.Api  →  <App>.Core  →  <App>.Model
```

- `.Api` references `.Core` (and `.Model` for the DTOs).
- `.Core` references `.Model`, and holds the EF Core packages (the DB provider, `Microsoft.EntityFrameworkCore.Design`).
- `.Model` references no other project and does **not** depend on EF Core. It contains pure POCOs.
- **No reverse references** (e.g. `.Model` → `.Core`).

### Solution setup (root files)

- **Target framework:** the latest LTS version (.NET 10), unless the project already uses another.
- **`Directory.Build.props`** holds the settings shared by every project:
  ```xml
  <Project>
    <PropertyGroup>
      <TargetFramework>net10.0</TargetFramework>
      <Nullable>enable</Nullable>
      <ImplicitUsings>enable</ImplicitUsings>
      <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
      <AnalysisLevel>latest-recommended</AnalysisLevel>
      <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    </PropertyGroup>
  </Project>
  ```
- **`Directory.Packages.props`** enables Central Package Management (`<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>`), so NuGet versions are managed in one place.
- **`.editorconfig`** holds the style and naming rules. Formatting is checked in CI with `dotnet format --verify-no-changes`.
- **`global.json`** pins the SDK version so builds are identical on every machine and in CI.

## 3. Code examples

### Entity (`.Model/Entities`)

```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = default!;
    public Guid CustomerId { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
```

### AppDbContext (`.Core/Data`)

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = DateTime.UtcNow;
            if (entry.State == EntityState.Modified) entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
```

### Entity configuration (`.Core/Data/Configurations`)

Configure with the Fluent API, not with data annotations on the entity.

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
        builder.HasIndex(x => x.OrderNumber).IsUnique();
        builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
    }
}
```

### DTO (`.Model/Dtos`)

```csharp
public record CreateOrderRequest(Guid CustomerId, List<CreateOrderItemRequest> Items);
public record OrderResponse(Guid Id, string OrderNumber, decimal TotalAmount, string Status, DateTime CreatedAt);
```

### Interface (`.Core/Interfaces`)

```csharp
public interface IOrderService
{
    Task<OrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<OrderResponse>> GetListAsync(int page, int pageSize, CancellationToken ct = default);
    Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken ct = default);
}
```

### Service (`.Core/Services`)

```csharp
public class OrderService(AppDbContext db, ILogger<OrderService> logger) : IOrderService
{
    public async Task<OrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await db.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException($"Order {id} not found");

        return order.ToResponse();
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken ct = default)
    {
        var order = new Order { /* ... */ };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);   // a single SaveChanges is already atomic; manual transactions: see §4

        logger.LogInformation("Order {OrderId} created", order.Id);
        return order.ToResponse();
    }
}
```

### Controller (`.Api/Controllers`)

```csharp
[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController(IOrderService orderService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await orderService.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<OrderResponse>> Create(CreateOrderRequest request, CancellationToken ct)
    {
        var result = await orderService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
}
```

### DI registration

```csharp
// <App>.Core/DependencyInjection.cs
public static IServiceCollection AddCore(this IServiceCollection services, IConfiguration config)
{
    services.AddDbContext<AppDbContext>(opt =>
        opt.UseSqlServer(config.GetConnectionString("Default")));   // or UseNpgsql

    services.AddScoped<IOrderService, OrderService>();
    services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
    return services;
}

// <App>.Api/Program.cs
builder.Services.AddCore(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddProblemDetails();                 // RFC 9457 error format
builder.Services.AddOpenApi();                        // API contract documentation
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddRateLimiter(/* policies for login/OTP & expensive endpoints */);
// OpenTelemetry: tracing + metrics for ASP.NET Core, HttpClient, EF Core

var app = builder.Build();
app.UseMiddleware<ExceptionHandlingMiddleware>();     // first in the pipeline
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready");
app.Run();
```

### Error middleware (`.Api/Middlewares`)

A single place that maps exceptions to HTTP statuses with a `ProblemDetails` response (RFC 9457, `application/problem+json`). The response always includes a `traceId` (`Activity.Current?.Id ?? HttpContext.TraceIdentifier`) and a stable error `code`. Validation errors include `errors` per field.

| Exception | Status |
|---|---|
| `ValidationException` | 400 |
| `UnauthorizedAccessException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `BusinessException` | 422 |
| anything else | 500 (generic message, details go to the log only) |

Controllers and services do **not** use try/catch merely to turn an exception into a response.

## 4. C# coding rules

- **Async all the way:** I/O methods use `async`/`await` with an `Async` suffix, and pass the `CancellationToken` through. Don't use `.Result` or `.Wait()`.
- **DI lifetimes:** services and `DbContext` = `Scoped`. Don't inject a scoped service into a singleton.
- **EF queries:**
  - `AsNoTracking()` for read queries.
  - `Select` straight into the DTO when you don't need the whole entity.
  - Avoid N+1: use `Include` or a projection, and never query inside a loop.
  - Pagination uses `Skip`/`Take` with an explicit `OrderBy`.
  - Don't call `ToList()` before filtering.
- **Migrations** are created with
  `dotnet ef migrations add <Name> -p src/<App>.Core -s src/<App>.Api -o Data/Migrations`.
  Don't edit a migration that has already been applied.
- **Validation** uses FluentValidation in `.Core/Validators`, run automatically before reaching the service.
- **Mapping** uses hand-written extension methods (`ToResponse()`) in `.Core/Mappings`, unless the project already uses AutoMapper/Mapster.
- **Config** uses the Options pattern (`IOptions<T>`) with `ValidateOnStart()`. Secrets come from User Secrets (dev) or env/a secret manager (prod), never from `appsettings.json`.
- **Nullable reference types** are enabled (`<Nullable>enable</Nullable>`), and nullable warnings are taken seriously.
- **Naming:**
  - PascalCase for classes, methods, and properties.
  - `_camelCase` for private fields.
  - Interfaces are prefixed with `I`.
  - DTOs are suffixed `Request`/`Response`.
  - One class per file, with the namespace following the folder (file-scoped namespace).
- **Logging** uses `ILogger<T>` with a structured template (`"Order {OrderId}"`), not string interpolation.
- **Money** uses `decimal` with `HasPrecision(18, 2)`.
- **Time** is stored in UTC. Inject `TimeProvider` (don't call `DateTime.UtcNow` directly in a service) so time can be mocked in tests.
- **Concurrency:** entities that can be modified concurrently get a version token (`[Timestamp] byte[] RowVersion` / `IsRowVersion()`), and `DbUpdateConcurrencyException` is mapped to 409.
- **Manual transactions** only for several `SaveChangesAsync` calls/raw SQL that must be atomic. With `EnableRetryOnFailure` enabled, calling `BeginTransactionAsync` directly throws `InvalidOperationException`; wrap it in `db.Database.CreateExecutionStrategy().ExecuteAsync(async () => { /* BeginTransactionAsync … CommitAsync */ })`. The lambda's body must be safe to replay from the start.
- **Pagination:** `page` ≥ 1 and `pageSize` 1–100 are validated (400 when out of bounds), so a client can't request the whole table. The upper bound on `page` is validated too, so `(page - 1) * pageSize` for `Skip` doesn't overflow an `int`.
- **HttpClient** to external services goes through `IHttpClientFactory` (a typed client) with a timeout and a resilience handler (`AddStandardResilienceHandler()`). Never `new HttpClient()` per request.
- **API versioning** uses `Asp.Versioning.Mvc` when more than one version has to be live. The route stays `/api/v{version}/...`.
- **Authorization** uses policies (`[Authorize(Policy = "...")]`), and the resource-ownership check happens in the service (filtering by `userId`/`tenantId` in the query), not only in the controller.
- **Local secrets** use `dotnet user-secrets`. `appsettings.json` holds only non-secret values.

## 5. Testing

- **`<App>.Core.Tests`:** service unit tests with xUnit and an `AppDbContext` backed by in-memory SQLite (closer to a real DB than the InMemory provider).
- **`<App>.Api.Tests`:** integration tests with `WebApplicationFactory<Program>` and Testcontainers for a real DB.
- Test names: `MethodName_Condition_ExpectedResult`.
- Assertions use xUnit's built-in asserts or Shouldly. Mocking uses NSubstitute/Moq, only for external dependencies (HTTP clients, email, `TimeProvider`).
- CI runs `dotnet build -warnaserror`, `dotnet format --verify-no-changes`, `dotnet test`, and `dotnet list package --vulnerable --include-transitive`.

## 6. New feature checklist

1. The entity in `.Model/Entities`
2. The entity configuration in `.Core/Data/Configurations`, the `DbSet` in `AppDbContext`, then create the migration
3. Request/response DTOs in `.Model/Dtos/<Feature>`
4. The interface in `.Core/Interfaces`
5. The service in `.Core/Services`, then register it in `AddCore()`
6. The validator in `.Core/Validators` and the mapping in `.Core/Mappings`
7. The controller in `.Api/Controllers`
8. Tests in `tests/`
