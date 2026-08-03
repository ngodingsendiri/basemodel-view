# Architecture

BaseModel Explorer follows a layered architecture that separates concerns into domain, infrastructure, context, and presentation layers.

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Presentation                       │
│  App.tsx · Components · Hooks (useExplorerData,      │
│  useFilters, useFilteredModels, useAlternativesModal) │
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
│  Zod schemas (Model, Provider, IntelligenceRecord)   │
└─────────────────────────────────────────────────────┘
```

## Dependency Flow

```
App.tsx
  ├── useExplorerData()  → data loading (SWR, retry, lookup maps)
  ├── useFilters()       → filter state + URL sync
  ├── useFilteredModels() → pure filter/sort hook
  ├── useAlternativesModal() → modal state hook
  └── useCompare()       → compare selection state

main.tsx
  └── <ModelRegistryProvider>
        ├── new GitHubModelRepository()
        └── new ModelServiceImpl(repository)
```

All dependencies flow inward: presentation → context → domain → infrastructure. The domain layer has zero React dependencies.

## Data Flow

### 1. Initial Load (SWR Pattern)

```
App mounts
  → useExplorerData()
    → repository.getCachedData(ignoreTTL: true)  // serve stale cache instantly (SWR)
    → loadData()
    → service.getExplorerData() + getIntelligenceRecords()   // Promise.allSettled
    → graceful degradation: intelligence failure keeps catalog usable
    → filter orphaned intelligence records
    → repository.writeCache(newData)      // update cache for next load
```

### 2. Filter Pipeline

```
User changes filter (provider, search, free-only, sort)
  → useFilters() updates state + URL params (functional update, debounce 150ms)
  → useFilteredModels receives new deps
    → builds tierMap/priceMap (Map<ModelId, ...>) once per intelligenceByModel change
    → filters: provider → free-only → search query (name, model id, provider name)
    → sorts: name | context (desc) | date (desc) | price (asc)
    → returns { filtered, getTierForModel, getPriceForModel }
  → VirtualizedModelList re-renders only visible rows
```

### 3. Modal Open/Close

```
User clicks model card
  → handleModelClick(modelId)
    → looks up model in modelsById map (O(1))
    → looks up intelligence in intelligenceByModel map (O(1))
    → open(model, alternatives.slice(0, 3))
  → URL updated: ?alt=<model_id>
  → AlternativesModal renders with focus trap

User closes modal (Escape / overlay click)
  → close()
  → setIsOpen(false), setSelectedAlternatives([])
  → URL param `alt` removed
  → originalModel ref preserved (prevents stale re-open)

Deep link: user navigates to ?alt=<model_id>
  → useEffect detects alt param
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

- **Key**: `basemodel:explorer-data:v3`
- **TTL**: 10 minutes
- **Storage**: localStorage (best-effort, quota errors ignored)
- **Content**: `{ data: ExplorerData, intelligenceRecords: IntelligenceRecord[], timestamp: number }`
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

- `ModelsResponseSchema` → `{ models: Model[] }`
- `ProvidersResponseSchema` → `{ providers: Provider[] }`
- `IntelligenceResponseSchema` → `{ intelligence: IntelligenceRecord[] }`

The `IntelligenceRecordSchema` includes a refinement that rejects self-referential alternatives:

```ts
.refine(
  (record) => !record.alternatives.some((a) => a.model_id === record.model_id),
  { message: 'Alternatives must not reference the same model as the record' }
)
```

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

- Enter or Space: opens the alternatives modal
- Cards have `role="button"` and `tabIndex={0}`

## Performance Optimizations

| Optimization | Implementation |
|-------------|---------------|
| Virtualized list | `@tanstack/react-virtual` with dynamic `measureElement` + `overscan: 5` |
| Debounced search | `useDebouncedValue(searchQuery, 150)` — one recompute per 150ms |
| Memoized tier map | `useMemo(() => Map<ModelId, tier>, [intelligenceByModel])` |
| Memoized model lookup | `useMemo(() => Map<ModelId, Model>, [data])` |
| Memoized provider counts | `useMemo(() => Map<ProviderId, count>, [data])` |
| Functional URL updates | `setSearchParams(prev => ...)` avoids stale closure bugs |
| Code splitting | Manual chunks: `vendor-react`, `vendor-virtual`, `vendor-zod`, `modal` |
| CSS containment | `.virtualized-item` uses `position: absolute` for layout isolation |

## Build Output

```
dist/
  index.html                    1.64 kB
  assets/index-*.css           20.78 kB  (gzip: 4.43 kB)
  assets/rolldown-runtime-*.js  0.56 kB  (gzip: 0.36 kB)
  assets/modal-*.js            15.00 kB  (gzip: 5.46 kB)
  assets/vendor-*.js           25.19 kB  (gzip: 7.81 kB)
  assets/index-*.js            35.45 kB  (gzip: 10.44 kB)
  assets/vendor-zod-*.js       64.17 kB  (gzip: 17.30 kB)
  assets/vendor-react-*.js    218.97 kB  (gzip: 70.16 kB)
```

Total gzipped: ~115 KB. The vendor-react chunk (70 KB gzipped) is the React runtime and is preloaded by default.
