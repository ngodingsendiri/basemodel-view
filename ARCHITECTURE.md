# Architecture

BaseModel Explorer follows a layered architecture that separates concerns into domain, infrastructure, context, and presentation layers.

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Presentation                       │
│  App.tsx · Components · Hooks (useFilteredModels,   │
│  useAlternativesModal, useDebouncedValue)             │
├─────────────────────────────────────────────────────┤
│                 Context (DI)                         │
│  ModelRegistryProvider → ModelRegistryContext         │
│  useModelRepository() · useModelService()            │
├─────────────────────────────────────────────────────┤
│                   Domain                             │
│  ModelServiceImpl · ModelRepository interface        │
│  Branded types (ModelId, ProviderId)                 │
│  FilterOptions · FilteredResult · sortModels()       │
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
  ├── useModelService()    → ModelServiceImpl
  ├── useModelRepository() → GitHubModelRepository
  ├── useFilteredModels()  → pure filter/sort hook
  ├── useAlternativesModal() → modal state hook
  └── useDebouncedValue()  → generic debounce hook

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
  → loadData()
    → repository.getCachedData()          // serve stale cache instantly
    → setData(cached)                     // render immediately
    → service.getExplorerData()           // fetch fresh data in background
    → service.getIntelligenceRecords()
    → filter orphaned intelligence records
    → repository.writeCache(newData)      // update cache for next load
```

### 2. Filter Pipeline

```
User changes filter (provider, search, free-only, sort)
  → URL params updated (useSearchParams, functional update)
  → useDebouncedValue (150ms) for search input
  → useFilteredModels receives new deps
    → builds tierMap (Map<ModelId, tier>) once per intelligenceByModel change
    → filters: provider → free-only → search query
    → sorts: name | context (desc) | date (desc)
    → returns { filtered, getTierForModel }
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

## Sanitization

All dynamic text rendered in the DOM goes through `src/utils/sanitize.ts`:

- `sanitizeText()` — escapes `&`, `<`, `>`, `"`, `'`
- Applied to: model names, model IDs, provider names, alternative reasons, error messages

## Keyboard Navigation

### Provider Sidebar (Roving Tabindex)

- Arrow Down/Right: move to next tab, auto-select
- Arrow Up/Left: move to previous tab, auto-select
- Home: move to first tab
- End: move to last tab
- Only the active tab has `tabIndex={0}`; all others have `tabIndex={-1}`

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
  index.html                    1.75 kB
  assets/index-*.css           15.04 kB  (gzip: 3.40 kB)
  assets/rolldown-runtime-*.js  0.58 kB  (gzip: 0.36 kB)
  assets/modal-*.js            11.52 kB  (gzip: 4.27 kB)
  assets/vendor-*.js           25.16 kB  (gzip: 7.80 kB)
  assets/index-*.js            29.62 kB  (gzip: 9.04 kB)
  assets/vendor-zod-*.js       64.09 kB  (gzip: 17.27 kB)
  assets/vendor-react-*.js    215.49 kB  (gzip: 69.06 kB)
```

Total gzipped: ~112 KB. The vendor-react chunk (69 KB gzipped) is the React runtime and is preloaded by default.
