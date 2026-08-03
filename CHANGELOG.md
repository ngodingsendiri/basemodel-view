# Changelog

All notable changes to BaseModel Explorer are documented here.

## [Unreleased] — 2026-08-03

### Refactor & Architecture

- **`useExplorerData` hook**: extracted data loading (SWR cache seeding, background revalidate, retry, graceful degradation, lookup maps) out of `App.tsx`
- **`useFilters` hook**: extracted filter state + URL search-param sync out of `App.tsx`
- **`App.tsx` simplification**: removed ~174 lines of inline data-loading/filter logic; now composes `useExplorerData`, `useFilters`, and `useFilteredModels`
- **Removed `filterModels`/`sortModels` from domain**: filter/sort logic lives solely in `useFilteredModels`; `ModelRepository` interface trimmed to data access
- **`PROVIDER_LINKS` relocated**: from `src/schemas/api.ts` to `src/config/providers.ts` — provider links no longer live in the validation layer
- **CSS modularization**: monolithic `index.css` split into per-component files (`Sidebar.css`, `ModelCard.css`, `VirtualizedModelList.css`, `AlternativesModal.css`, `CompareModal.css`, `CompareBar.css`, `SkeletonCard.css`) imported in cascade order from `index.css`
- **Modal focus trap**: `AlternativesModal` and `CompareModal` now share the `useFocusTrap` hook (removed duplicated trap code)

### Features

- **Provider-name search**: search query now matches provider names in addition to model names/IDs

### Testing

- **50 unit tests** (+12: `useExplorerData`, `useFilters`, provider-name search)
- **15 E2E tests** (unchanged, all passing)

## [1.1.0] — 2026-08-01

### Features

- **Pricing display**: blended cost per 1M tokens now shown on model cards, in the alternatives modal, and in the compare table (`formatCost`); unknown costs render as an em dash
- **Price sort**: new "Sort: Price ↑" option — ascending by cost, models without pricing sorted last; URL-synced via `sort=price`
- **Clickable alternatives**: each suggested alternative in the modal is now a button that opens that model's own details; the `?alt=` deep link stays in sync
- **Compare side-by-side**: per-card compare toggle (`aria-pressed`), floating compare bar with live count, and a compare modal with an attribute table (provider, tier, price, context, max output, modalities, release, description)
- **`useCompare` hook**: selection survives filtering/search; stale selections pruned against the current dataset

### Polish

- **Chip hierarchy**: stat chips (context/output/date/price) visually distinguished from modality chips
- **Search input**: no longer expands on focus, removing the header layout shift
- **Responsive stack layout**: on ≤768px the sidebar becomes a horizontal tab strip above the content
- **Type scale**: base tokens raised (`--fs-xs` 0.72rem, `--fs-sm` 0.8rem, `--fs-base` 0.875rem); hardcoded tiny font sizes bumped to ≥0.68rem
- **Header controls**: consistent wrapping and row gaps

### Fixes & Cleanup

- **Valid HTML in alternatives**: the "copy model ID" control is no longer nested inside the navigation button; copy and navigate are sibling controls with distinct hit areas
- **CSS deduplication**: removed duplicated modal, skeleton, copy-button, and error-state rules plus dead selectors (~170 lines)
- **CSP cleanup**: dropped `frame-ancestors` from the `<meta>` policy — it is ignored when delivered via `<meta>` and only produced console noise; frame protection belongs in HTTP headers
- **Browser Back closes the modal**: opening an alternative now pushes history, so Back dismisses it and the URL stays clean; deep links are applied without extra history
- **Expandable alternatives**: the list shows up to 3 by default with a "Show N more" toggle (inline, no page nav) and resets when switching models
- **Compare persisted to the URL**: the compare selection is mirrored in the `?compare=` parameter (comma-separated, validated against the dataset) and survives reloads
- **Compare table polish**: first column is sticky while scrolling and the best value per row is highlighted (green, bold)
- **Free pricing in compare**: a $0 blended cost renders as "Free" (not an em dash), matching the cards
- **Accessible tab headings**: section titles inside the tab list are marked `role="presentation"` so only the tab buttons remain in the tab order
- **Empty-state icon**: the compare and alternatives empty states get a proper inline SVG icon instead of a bare glyph

### Testing

- **38 unit tests** (+9: `formatCost`, price sort, `getPriceForModel`, `useCompare`)
- **15 E2E tests** (+7: price display, alternative navigation, compare flow, Back-to-close, "Show N more", compare URL persistence, best-value highlight)

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

- **Content Security Policy**: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `object-src 'none'`, `form-action 'none'`
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
