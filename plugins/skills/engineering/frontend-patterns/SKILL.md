---
name: frontend-patterns
description: Professional frontend coding and architecture rules. Covers structure, components & design systems, state management, data fetching, forms, WCAG 2.2 AA accessibility, Core Web Vitals performance, security (XSS/CSP), i18n, error monitoring, and testing. Use when writing, changing, or designing web UI/components/pages (React/Next.js/Vue/Svelte).
---

# Frontend Patterns

This is a set of **default decisions** for things the project hasn't settled, not a tutorial. Conventions in the existing codebase **always win**. Don't add a library or pattern from here to a project that doesn't already use it, unless the spec asks for it: a pattern inconsistent with its surroundings costs more than a less-than-ideal one.

## 1. Structure

```
src/
├── app/ or pages/       # thin routing: composes feature components
├── features/<feature>/  # components/, hooks/, api.ts, schemas.ts (zod), types.ts
├── components/ui/       # generic components (Button, Input, Modal): the design system
├── lib/                 # api client, utils, config
└── styles/              # design tokens, global CSS
```

Dependency direction: `app` → `features` → `components/ui` / `lib`. Generic components don't depend on features, and one feature doesn't import another feature's internals.

## 2. Components

- Use design tokens (color, spacing, radius, typography, shadow); don't hardcode hex or px.
- Logic in hooks, presentation in components. A component that fetches data, manages a form, and renders a table all at once is split into container + presentational. A component past ~200 lines gets split.
- Components call the API through the feature module (`wishlistApi.list()`), not `fetch()` directly.
- Props are small and specific (don't pass a whole object for two fields). Variants via composition (`<Card><Card.Footer/></Card>`), not a pile of boolean props. Prop drilling deeper than 2 levels → composition or context.
- **The YAGNI brake:** a generic component is created once there are **≥2 real usages**. Project uses Storybook → generic UI components are documented there.
- Every data view handles loading (skeleton), empty (with a call to action), error (a human message + retry), success, and disabled/submitting, plus long text, large data sets, and images that fail to load.

## 3. State

| Kind of state | Where it lives |
|---|---|
| Server state (API data) | TanStack Query / SWR / RTK Query, **never copied into a global store** |
| URL state (filters, page, tab) | Query params, so it can be shared and the back button works |
| Form state | A form library |
| Local UI | `useState` / `useReducer` |
| Global client (theme, session, cart) | Zustand/Context, sparingly |

Derived values are computed, not stored. One source of truth per piece of data.

## 4. Data fetching

- One central API client: base URL, auth, timeouts, RFC 9457 error parsing, and token refresh.
- Types generated from the OpenAPI schema or validated with zod at the boundary.
- Errors: 401 → login · 403 → a "not authorized" page · 404 → a not-found page · 422 → per-field errors · 5xx → a generic message + retry.
- Search is debounced, and requests that are no longer relevant are cancelled (AbortController). Optimistic updates only for actions that rarely fail, with a rollback on failure.
- Next.js/SSR: fetch on the server where possible; server-only data must never leak into a client component.

## 5. Forms

React Hook Form + zod (or equivalent), with the schema shared with the backend wherever possible. The server remains the source of truth, and its errors are shown per field. Visible labels (not just a placeholder), focus moves to the first errored field on submit, the submit button is disabled while submitting, destructive actions are confirmed, and input `type`/`autocomplete` are correct (`email`, `tel`, `one-time-code`, `current-password`).

## 6. Responsiveness

Mobile-first, tested from **360px** wide with no horizontal scroll. Text in `rem`. Dark mode and `prefers-reduced-motion` if the design system supports them.

## 7. Accessibility (WCAG 2.2 AA)

What gets missed most often: inputs without a `label` and icon buttons without an `aria-label` · actions use `button`, navigation uses `a` · focus is visible and **not hidden** behind a sticky header · modals trap focus, close on Esc, then return focus to their trigger · text contrast 4.5:1 (large text and UI components 3:1) · touch targets at least 24×24px · information never conveyed by color alone · dynamic changes (toasts, errors, search results) announced via `aria-live`. ARIA only where native HTML isn't enough. Check with axe and keyboard navigation.

## 8. Performance

p75 targets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Code splitting per route and lazy-loading heavy components (charts, editors, maps) · modern image formats with `width`/`height`, `loading="lazy"` below the fold, high priority for the LCP image · font `swap` + preload the primary font · check the bundle impact before adding a dependency · `memo`/`useMemo`/`useCallback` only for a **measured** re-render problem · lists over ~100 items are virtualised.

## 9. Security

User-supplied HTML is sanitised (DOMPurify); avoid `dangerouslySetInnerHTML`/`v-html` · no secrets in client code, only public env vars (`NEXT_PUBLIC_*`, `VITE_*`) · session tokens in an `HttpOnly; Secure; SameSite` cookie, not localStorage · a Content Security Policy with no inline scripts · URLs validated before use in `href`/redirects (prevents `javascript:` and open redirects) · keys from user input/the URL used for object lookup go through `Map`/`Set` or `Object.hasOwn`, not a plain `obj[key]` (`__proto__`, `constructor`) · authorization in the UI is only a convenience; the real security lives on the server.

## 10. i18n, analytics & privacy

User-facing text is centralised in translation files if the project is multilingual · dates, numbers, and money formatted via `Intl` (e.g. `Rp 150.000`) · analytics event names are consistent (`checkout_started`), carry no PII, and respect consent (Indonesia's UU PDP/GDPR).

## 11. Errors & monitoring

An error boundary at the route/feature level · errors sent to monitoring (Sentry, etc.) with the route, release, and a safe user ID, plus source maps · error messages for users are human and actionable.

## 12. Testing

The testing trophy: the bulk of the effort in component/integration tests with Testing Library (query by role/label, not class/test-id); unit tests for utils, hooks, and pure logic; E2E (Playwright) for critical flows. Mock the API with MSW, not by mocking the fetch function internally. Test behavior, not implementation details.
