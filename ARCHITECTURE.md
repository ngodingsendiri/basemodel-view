# Architecture

BaseModel Explorer follows a layered architecture that separates concerns into domain, infrastructure, context, and presentation layers.

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Presentation                       │
│  App.tsx · Components · Hooks (useExplorerData,      │
│  useFilters, useFilteredModels, useModelDetailModal) │
├─────────────────────────────────────────────────────┤
│                 Context (DI)                         │
│  ModelRegistryProvider → ModelRegistryContext         │
│  useModelRepository() · useModelService()            │
├─────────────────────────────────────────────────────┤
│                   Domain                             │
│  ModelServiceImpl · ModelRepository interface        │
│  Branded types (ModelId, ProviderId)                 │
├─────────────────────────────────────────────────────┤
│                Infrastructure                        │
│  GitHubModelRepository (fetch, retry, circuit        │
│  breaker, cache, rate limiting, mirror fallback)     │
│  Zod schemas (CanonicalModel, Offering, RankingEntry)│
└─────────────────────────────────────────────────────┘
```

## Dependency Flow

```
App.tsx
  ├── useExplorerData()  → data loading (SWR, retry, lookup maps)
  ├── useFilters()       → filter state + URL sync
  ├── useFilteredModels() → pure filter/sort hook
  ├── useModelDetailModal() → modal state hook
  └── useCompare()       → compare selection state

main.tsx
  └── <ModelRegistryProvider>
        ├── new GitHubModelRepository()
        └── new ModelServiceImpl(repository)
```

All dependencies flow inward: presentation → context → domain → infrastructure. The domain layer has zero React dependencies.

## Data Flow

The explorer consumes the **v2 pipeline datasets** from the BaseModel registry:

| File | Content |
|------|---------|
| `v2/models.json` | Canonical (deduplicated) models — provider-less slugs, aliases, optional `quality` |
| `v2/offerings.json` | Provider serves of canonical models — offering id `{provider}/{slug}`, cost tier, blended price |
| `v2/intelligence.json` | Pareto ranking — quality score, cheapest offering, `pareto_optimal` flag |
| `changes.json` | Registry delta feed (added/removed/status-changed offering ids) |
| `providers.json` / `benchmarks.json` | Provider names and leaderboard records (v1) |

### 1. Initial Load (SWR Pattern)

```
App mounts
  → useExplorerData()
    → repository.getCachedData(ignoreTTL: true)  // serve stale cache instantly (SWR)
    → loadData()
    → Promise.allSettled([getExplorerData, getRanking, getChanges, getBenchmarkRecords])
    → graceful degradation: ranking/changes/benchmarks failures keep the catalog usable
    → ranking entries with unknown model ids are filtered out
    → repository.writeCache(newData)      // update cache for next load
```

Derived lookup maps (all memoized in `useExplorerData`):

- `modelsById` — canonical model lookup
- `offeringsByModel` — canonical model → all provider offerings
- `pricingByModel` — resolved price/tier per model (`resolvePricing`: cheapest priced offering, else Free offering, else Unknown)
- `modelIdsByProvider` / `providerCounts` — sidebar counts + provider filter
- `rankingByModel` — Pareto ranking entry per model
- `modelByOfferingId` — offering id → canonical id (legacy deep-link support)
- `newModelIds` — canonical models that gained an offering in `changes.added`
- `benchmarksByModel` — leaderboard records matched by last path segment of model id or any alias

### 2. Filter Pipeline

```
User changes filter (provider, search, free-only, sort)
  → useFilters() updates state + URL params (functional update, debounce 150ms)
  → useFilteredModels receives new deps
    → filters: provider (via modelIdsByProvider) → free-only (resolved tier)
      → search query (name, canonical id, aliases, provider names serving the model)
    → sorts: name | quality (desc, unscored last) | context (desc) | date (desc)
      | price (asc) | rank:<benchmark> (score desc)
    → returns { filtered, getTierForModel, getPriceForModel, getOfferingsForModel, getProviderCount }
  → VirtualizedModelList re-renders only visible rows
```

### 3. Modal Open/Close

```
User clicks model card
  → handleModelClick(modelId)
    → looks up model in modelsById map (O(1))
    → looks up offerings in offeringsByModel map (O(1))
    → open(model, offerings)
  → URL updated: ?alt=<model_id>
  → ModelDetailModal renders with focus trap (quality, aliases, offerings table)

User closes modal (Escape / overlay click)
  → close()
  → setIsOpen(false), setOfferings([])
  → URL param `alt` removed

Deep link: user navigates to ?alt=<model_id>
  → useEffect detects alt param
  → resolves canonical ids directly; legacy offering ids (provider/slug) via modelByOfferingId
  → waits for model data to load
  → opens modal with matching model
```

## Branded Types

`ModelId` and `ProviderId` are TypeScript branded types that prevent accidental misuse at the type level:

```ts
type ModelId = string & { readonly __brand: unique symbol };
type ProviderId = string & { readonly __brand: unique symbol };
```

All data flowing through domain boundaries uses these branded types. The Zod schemas in `src/schemas/api.ts` transform raw strings into branded types at the validation boundary:

```ts
const ModelIdSchema = z.string().min(1).transform(modelId);
```

## Resilience Patterns

### Circuit Breaker

Located in `GitHubModelRepository`:

- Tracks consecutive failures (`circuitFailureCount`)
- Opens after `MAX_FAILURES_BEFORE_CIRCUIT_OPEN` (5) failures
- Auto-resets after `CIRCUIT_RESET_TIMEOUT` (60s)
- When open, all fetch calls are immediately rejected with "Circuit breaker open"

### Mirror Fallback

Each `fetchJson()` call iterates through mirrors in order:

1. `API_BASE` — `https://raw.githubusercontent.com/ngodingsendiri/BaseModel/main/dist`
2. `CDN_FALLBACK` — `https://cdn.jsdelivr.net/gh/ngodingsendiri/BaseModel@main/dist`
3. Any additional mirrors from `VITE_DATA_MIRRORS` env var

If one mirror fails after all retries, the next mirror is tried.

### Retry with Exponential Backoff

Each mirror gets up to 3 retries with:

- Base delay: 1000ms, doubled per attempt (1s, 2s, 4s)
- Random jitter: +0-200ms
- Abort errors are never retried

### Rate Limiting

Only active under failure pressure (`circuitFailureCount > 0`). When active, enforces a 30s minimum between requests. Healthy parallel loads are never throttled.

### Cache

- **Key**: `basemodel:explorer-data:v5`
- **TTL**: 10 minutes
- **Storage**: localStorage (best-effort, quota errors ignored)
- **Content**: `{ data: ExplorerData, ranking: RankingEntry[], changes: ChangesFeed | null, benchmarkRecords: Benchmark[], timestamp: number }`
- **SWR reads**: `getCachedData(ignoreTTL: true)` serves stale cache instantly while a background refresh runs

## Error Boundaries

The app uses per-region error boundaries with a `resetKey` pattern:

```tsx
<ErrorBoundary fallback={<SidebarFallback />} resetKey={retryCount}>
  <Sidebar />
</ErrorBoundary>
```

- `getDerivedStateFromError` catches render errors
- `getDerivedStateFromProps` resets the boundary when `resetKey` changes
- `componentDidCatch` reports to `reportError()` for external tracking
- Each region has a custom fallback component with a retry button

## Schema Validation

All external data is validated at the fetch boundary using Zod:

- `CanonicalModelsResponseSchema` → `{ models: CanonicalModel[] }`
- `ProvidersResponseSchema` → `{ providers: Provider[] }`
- `OfferingsResponseSchema` → `{ offerings: Offering[] }`
- `RankingResponseSchema` → `{ ranking: RankingEntry[] }`
- `ChangesFeedSchema` → `{ generated_at?, added, removed, status_changed }`
- `BenchmarksResponseSchema` → `{ benchmarks: Benchmark[] }`

Schemas are deliberately lenient (`.default()` on optional collections and flags, unknown fields stripped) so additive pipeline changes never break the explorer.

## Text Rendering Safety

React's JSX escaping is the single defense for dynamic text: any value rendered as
text content or an attribute is escaped automatically, so no manual sanitizer layer
is needed. A previous `src/utils/sanitize.ts` layer was removed because it
double-escaped legitimate data (e.g. `AT&T` rendered literally as `AT&amp;T`).

## Keyboard Navigation

### Provider Sidebar

- The sidebar is a `role="navigation"` landmark containing plain buttons (not a tablist)
- The active provider is marked with `aria-current="page"`
- Each provider row includes an API-key link (`rel="noopener noreferrer"`)

### Modal

- Tab/Shift+Tab: cycles through focusable elements (focus trap)
- Escape: closes the modal
- Focus is restored to the previously active element on close

### Model Cards

- The card body is a real `<button>` hit area (`.model-card-hitarea`) — Enter/Space open the detail modal natively
- Copy and compare actions are sibling buttons, so keyboard focus lands on each action separately

## Performance Optimizations

| Optimization | Implementation |
|-------------|---------------|
| Virtualized list | `@tanstack/react-virtual` with dynamic `measureElement` + `overscan: 5` |
| Debounced search | `useDebouncedValue(searchQuery, 150)` — one recompute per 150ms |
| Memoized pricing map | `useMemo(() => Map<ModelId, ModelPricing>, [offeringsByModel])` |
| Memoized model lookup | `useMemo(() => Map<ModelId, CanonicalModel>, [data])` |
| Memoized provider counts | `useMemo(() => Map<ProviderId, count>, [modelIdsByProvider])` |
| Functional URL updates | `setSearchParams(prev => ...)` avoids stale closure bugs |
| Code splitting | Manual chunks: `vendor-react`, `vendor-virtual`, `vendor-zod`, `modal` |
| CSS containment | `.virtualized-item` uses `position: absolute` for layout isolation |

## Build Output

```
dist/
  index.html                    2.34 kB
  assets/index-*.css           38.29 kB  (gzip: 7.14 kB)
  assets/rolldown-runtime-*.js  0.58 kB  (gzip: 0.36 kB)
  assets/modal-*.js            21.30 kB  (gzip: 7.25 kB)
  assets/vendor-*.js           25.16 kB  (gzip: 7.80 kB)
  assets/index-*.js            49.66 kB  (gzip: 14.34 kB)
  assets/vendor-zod-*.js       64.60 kB  (gzip: 17.37 kB)
  assets/vendor-react-*.js    215.48 kB  (gzip: 69.05 kB)
```

Total gzipped: ~124 KB. The vendor-react chunk (69 KB gzipped) is the React runtime and is preloaded by default.
