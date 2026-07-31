# Changelog

All notable changes to BaseModel Explorer are documented here.

## [1.0.0] — 2026-07-31

### Architecture

- **Domain layer extraction**: separated `ModelRepository` interface and `ModelServiceImpl` from UI hooks into `src/domain/`
- **Branded types**: `ModelId` and `ProviderId` enforced throughout domain and schema boundaries via `src/domain/branded.ts`
- **Context-based DI**: `ModelRegistryProvider` instantiates `GitHubModelRepository` + `ModelServiceImpl` and injects via React Context
- **Repository pattern**: `GitHubModelRepository` implements `ModelRepository` with infrastructure concerns (fetch, retry, cache, circuit breaker)
- **Zod schema validation**: all external JSON validated at fetch boundary in `src/schemas/api.ts`
- **Type re-exports**: `src/types.ts` re-exports all public types from `src/schemas/api.ts`

### Resilience

- **Stale-While-Revalidate**: cached data served immediately, background refresh via localStorage (`basemodel:explorer-data:v3`, 10min TTL)
- **Circuit breaker**: opens after 5 consecutive failures, auto-resets after 60s
- **Exponential backoff retry**: 3 attempts per mirror with jitter (1s base, doubled, +200ms random)
- **Mirror fallback**: primary GitHub raw → jsDelivr CDN → custom mirrors (`VITE_DATA_MIRRORS` env)
- **Request timeout**: 10s per fetch via nested AbortController
- **Rate limiting**: 30s minimum interval under failure pressure only; healthy loads never throttled
- **Abort on unmount**: in-flight requests cancelled; abort errors silently ignored
- **Referential integrity**: orphaned intelligence records filtered at load time
- **Self-referential alternatives**: Zod refinement rejects `model_id` equal to parent record

### Features

- **URL-synced filters**: provider, search query, free-only, sort key all reflected in URL search params
- **Debounced search**: 150ms debounce via `useDebouncedValue` hook
- **Clear filters button**: visible when any filter is active, resets all filters to defaults
- **Deep-linkable modal**: `?alt=<model_id>` URL parameter opens modal directly; close-race protection prevents stale re-opens
- **Sort options**: Name (A-Z), Context (descending), Newest first
- **Provider sidebar**: model counts per provider, sorted by count descending; API key links for 18 providers
- **Last updated indicator**: timestamp in sidebar footer

### Accessibility

- **Roving tabindex** on provider sidebar tabs: Arrow Down/Right, Arrow Up/Left, Home, End — auto-selects the focused tab
- **ARIA attributes**: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="dialog"`, `aria-modal="true"`, `aria-label` on all interactive elements
- **Focus trap** in modal: Tab/Shift+Tab cycling, Escape to close
- **Focus restoration**: previous active element refocused on modal close
- **Focus-visible outlines** on all interactive elements
- **Hidden labels** for search input and sort dropdown

### Security

- **Content Security Policy**: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'none'`
- **Input sanitization**: all dynamic text escaped via `src/utils/sanitize.ts` (HTML entity encoding for `&`, `<`, `>`, `"`, `'`)
- **Dev server filesystem**: restricted to `.` only (removed `fs.allow: ['../../..']`)
- **No `wasm-unsafe-eval`** in CSP

### Error Handling

- **Per-region Error Boundaries**: sidebar, content header, model list, modal — each with custom fallback UI
- **resetKey pattern**: `getDerivedStateFromProps` resets boundary when retry counter changes
- **onRetry callback**: boundaries trigger parent retry flow
- **Centralized error reporting**: `reportError()` in `src/utils/errorReporting.ts` — ready for Sentry/LogRocket
- **Abort errors ignored**: never surfaced as user-facing errors

### Components

- **ModelCard**: card with copy buttons (name + ID), tier badge, modality chips, stat chips (context, date, output tokens)
- **SkeletonCard**: loading placeholder with pulsing animation
- **VirtualizedModelList**: `@tanstack/react-virtual` with dynamic `measureElement`, `overscan: 5`, empty state
- **AlternativesModal**: deep-linkable, focus trap, copy buttons with clipboard fallback + visual feedback
- **ErrorBoundary**: class component with `getDerivedStateFromProps` reset, `componentDidCatch` reporting, per-region fallbacks
- **Icons**: inline SVG components (`IconWarning`, `IconClipboard`, `IconWrench`, `IconStar`, `IconBox`) — no emoji dependency

### Testing

- **24 unit tests** across 5 test files:
  - `GitHubModelRepository.test.ts`: 7 tests (fetch, failover, schema validation, circuit breaker, cache, healthy-load throttle)
  - `useFilteredModels.test.ts`: 6 tests (provider filter, free-only, search, sort by context/date, tier lookup)
  - `useDebouncedValue.test.ts`: 3 tests (initial value, delayed update, coalescing)
  - `filters.test.ts`: 2 tests (parseSortKey, parseBoolean)
  - `format.test.ts`: 6 tests (formatCtx millions/thousands/small, formatReleaseDate valid/undefined/empty)
- **8 E2E tests** via Playwright:
  - Sidebar and model list rendering
  - Provider filtering from sidebar
  - Search query filtering
  - Free-only toggle
  - Modal open on click + Escape to close
  - Modal deep-link via URL
  - Clear filters button
  - Arrow-key navigation between provider tabs

### CI/CD

- **ci.yml**: lint → typecheck → test → build → e2e → security audit → dependency review
- **deploy.yml**: build + deploy to gh-pages on push to main
- **preview.yml**: PR preview deployment on open/sync/close
- **codeql.yml**: CodeQL security analysis (push/PR + weekly)
- **secret-scanning.yml**: TruffleHog secret scan (push/PR)
- **dependency-review.yml**: fail on high-severity vulnerabilities

### Build

- **Vite 8** with manual chunk splitting: `vendor-react` (~215 KB), `vendor-zod` (~64 KB), `vendor` (~25 KB), `modal` (~11 KB)
- **TypeScript 6**: ES2023 target, strict linting, no unused locals/parameters
- **oxlint**: React + TypeScript + OXC rules (not ESLint)
- **chunkSizeWarningLimit**: 200 KB
