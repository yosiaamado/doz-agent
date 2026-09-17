# .NET / C# Backend Rules

Aturan ini **menimpa** aturan dasar di `SKILL.md` untuk project .NET (ASP.NET Core + EF Core). Kalau project yang sudah ada punya pola berbeda, ikuti project-nya.

## 1. Alur layer

```
Controller  →  IXxxService (interface)  →  XxxService (implementasi)  →  AppDbContext
```

- **Controller** hanya urusan HTTP: menerima request DTO, memanggil interface service, dan mengembalikan `ActionResult`. Tidak ada business logic, dan tidak boleh menyentuh `AppDbContext`.
- **Controller bergantung pada interface**, tidak pernah pada class service secara langsung.
- **Service** berisi business logic dan memakai `AppDbContext` langsung. **Tidak ada layer repository**, karena `DbContext` sudah berperan sebagai unit of work dan repository.
- Service mengembalikan DTO, bukan entity, supaya entity tidak bocor ke response API.

## 2. Struktur solution

Setiap layer adalah project terpisah. `<App>` diganti nama aplikasinya.

```
<App>.sln
src/
├── <App>.Api/                      # ASP.NET Core Web API (entry point)
│   ├── Controllers/
│   │   └── OrdersController.cs
│   ├── Middlewares/
│   │   ├── ExceptionHandlingMiddleware.cs
│   │   └── RequestLoggingMiddleware.cs
│   ├── Extensions/                 # registrasi DI, auth, swagger, dll.
│   │   └── ServiceCollectionExtensions.cs
│   ├── Filters/                    # action filter (opsional)
│   ├── appsettings.json
│   └── Program.cs
│
├── <App>.Core/                     # business logic & akses data
│   ├── Data/
│   │   ├── AppDbContext.cs
│   │   ├── Configurations/         # IEntityTypeConfiguration<T> per entity
│   │   │   └── OrderConfiguration.cs
│   │   └── Migrations/
│   ├── Interfaces/
│   │   └── IOrderService.cs
│   ├── Services/
│   │   └── OrderService.cs
│   ├── Validators/                 # FluentValidation
│   │   └── CreateOrderRequestValidator.cs
│   ├── Mappings/                   # entity <-> DTO
│   ├── Exceptions/                 # NotFoundException, BusinessException, dll.
│   └── DependencyInjection.cs      # AddCore(): registrasi AppDbContext & service
│
└── <App>.Model/                    # entity & kontrak (tanpa logic)
    ├── Entities/
    │   ├── BaseEntity.cs
    │   └── Order.cs
    ├── Dtos/
    │   └── Orders/
    │       ├── CreateOrderRequest.cs
    │       └── OrderResponse.cs
    └── Enums/
tests/
├── <App>.Core.Tests/               # unit test service
└── <App>.Api.Tests/                # integration test (WebApplicationFactory)
```

### Project reference (satu arah)

```
<App>.Api  →  <App>.Core  →  <App>.Model
```

- `.Api` me-reference `.Core` (dan `.Model` untuk DTO).
- `.Core` me-reference `.Model`, dan memegang package EF Core (provider DB, `Microsoft.EntityFrameworkCore.Design`).
- `.Model` tidak me-reference project lain dan **tidak** bergantung pada EF Core. Isinya POCO murni.
- **Tidak boleh ada reference terbalik** (misalnya `.Model` → `.Core`).

## 3. Contoh kode

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

### Konfigurasi entity (`.Core/Data/Configurations`)

Konfigurasi pakai Fluent API, bukan data annotation di entity.

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
            ?? throw new NotFoundException($"Order {id} tidak ditemukan");

        return order.ToResponse();
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest request, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var order = new Order { /* ... */ };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        logger.LogInformation("Order {OrderId} dibuat", order.Id);
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

### Registrasi DI

```csharp
// <App>.Core/DependencyInjection.cs
public static IServiceCollection AddCore(this IServiceCollection services, IConfiguration config)
{
    services.AddDbContext<AppDbContext>(opt =>
        opt.UseSqlServer(config.GetConnectionString("Default")));   // atau UseNpgsql

    services.AddScoped<IOrderService, OrderService>();
    services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
    return services;
}

// <App>.Api/Program.cs
builder.Services.AddCore(builder.Configuration);
app.UseMiddleware<ExceptionHandlingMiddleware>();
```

### Middleware error (`.Api/Middlewares`)

Satu tempat untuk memetakan exception ke HTTP status dengan response `ProblemDetails`:

| Exception | Status |
|---|---|
| `ValidationException` | 400 |
| `UnauthorizedAccessException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `BusinessException` | 422 |
| lainnya | 500 (pesan generik, detail hanya masuk log) |

Controller dan service **tidak** memakai try/catch hanya untuk mengubah exception jadi response.

## 4. Aturan coding C#

- **Async sampai ujung:** method I/O pakai `async`/`await` dengan suffix `Async`, dan meneruskan `CancellationToken`. Jangan pakai `.Result` atau `.Wait()`.
- **Lifetime DI:** service dan `DbContext` = `Scoped`. Jangan inject service scoped ke singleton.
- **Query EF:**
  - `AsNoTracking()` untuk query baca.
  - Pakai `Select` langsung ke DTO kalau tidak butuh entity utuh.
  - Hindari N+1: pakai `Include` atau proyeksi, dan jangan query di dalam loop.
  - Pagination pakai `Skip`/`Take` dengan `OrderBy` yang jelas.
  - Jangan panggil `ToList()` sebelum filter.
- **Migration** dibuat dengan
  `dotnet ef migrations add <Nama> -p src/<App>.Core -s src/<App>.Api -o Data/Migrations`.
  Jangan edit migration yang sudah di-apply.
- **Validasi** pakai FluentValidation di `.Core/Validators`, dan dijalankan otomatis sebelum masuk service.
- **Mapping** pakai extension method manual (`ToResponse()`) di `.Core/Mappings`, kecuali project sudah memakai AutoMapper/Mapster.
- **Config** memakai Options pattern (`IOptions<T>`) dengan `ValidateOnStart()`. Secret diambil dari User Secrets (dev) atau env/secret manager (prod), tidak pernah dari `appsettings.json`.
- **Nullable reference types** diaktifkan (`<Nullable>enable</Nullable>`), dan warning nullable diperlakukan serius.
- **Penamaan:**
  - PascalCase untuk class, method, dan property.
  - `_camelCase` untuk private field.
  - Interface diawali `I`.
  - DTO berakhiran `Request`/`Response`.
  - Satu class per file, dengan namespace mengikuti folder (file-scoped namespace).
- **Logging** memakai `ILogger<T>` dengan structured template (`"Order {OrderId}"`), bukan string interpolation.
- **Uang** memakai `decimal` dengan `HasPrecision(18, 2)`.
- **Waktu** disimpan dalam UTC (`DateTime.UtcNow`, atau `DateTimeOffset`).

## 5. Testing

- **`<App>.Core.Tests`:** unit test service dengan xUnit dan `AppDbContext` memakai SQLite in-memory (lebih mirip DB asli dibanding provider InMemory).
- **`<App>.Api.Tests`:** integration test dengan `WebApplicationFactory<Program>` dan Testcontainers untuk DB asli.
- Nama test: `MethodName_Kondisi_HasilYangDiharapkan`.

## 6. Checklist fitur baru

1. Entity di `.Model/Entities`
2. Konfigurasi entity di `.Core/Data/Configurations`, `DbSet` di `AppDbContext`, lalu buat migration
3. DTO request/response di `.Model/Dtos/<Fitur>`
4. Interface di `.Core/Interfaces`
5. Service di `.Core/Services`, lalu daftarkan di `AddCore()`
6. Validator di `.Core/Validators` dan mapping di `.Core/Mappings`
7. Controller di `.Api/Controllers`
8. Test di `tests/`
