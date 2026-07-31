# BaseModel Explorer

A single-page application for browsing, filtering, and comparing AI language models with their pricing intelligence and suggested alternatives.

## Quick Start

### Prerequisites

- Node.js 20+
- npm (or pnpm)

### Installation

```bash
git clone https://github.com/ngodingsendiri/BaseModel.git
cd BaseModel
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173/BaseModel/`.

### Build

```bash
npm run build
```

Produces optimized output in `dist/`. Preview locally with:

```bash
npm run preview
```

### Testing

```bash
npm run test         # Unit tests (vitest)
npm run test:e2e     # E2E tests (Playwright + Chromium)
```

### Linting

```bash
npm run lint         # oxlint (React + TypeScript + OXC rules)
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design document.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript 6 |
| Bundler | Vite 8 |
| Routing | react-router 8 (URL-synced filter state) |
| Virtualization | @tanstack/react-virtual 3 |
| Schema Validation | Zod 4 |
| Unit Testing | Vitest 4 + @testing-library/react 16 |
| E2E Testing | Playwright 1.62 |
| Linting | oxlint (not ESLint) |

### Project Structure

```
src/
├── App.tsx                          # Root component: layout, state, SWR, URL sync
├── main.tsx                         # Entry point: providers, router, top-level ErrorBoundary
├── index.css                        # Global styles (CSS custom properties, design tokens)
├── types.ts                         # Public type re-exports from schemas
│
├── schemas/
│   ├── api.ts                       # Zod schemas + derived types (Model, Provider, IntelligenceRecord, etc.)
│   └── validation.ts                # Parse / safeParse wrappers for API responses
│
├── domain/
│   ├── branded.ts                   # Branded types (ModelId, ProviderId) + assertion helpers
│   └── models/
│       ├── index.ts                 # ModelRepository/ModelService interfaces, sort logic
│       └── ModelServiceImpl.ts      # Business logic: filtering, tier mapping, data orchestration
│
├── infrastructure/
│   └── data/github/
│       ├── GitHubModelRepository.ts # Network layer: fetch, retry, circuit breaker, cache
│       └── GitHubModelRepository.test.ts
│
├── context/
│   └── modelRegistry/
│       ├── ModelRegistryContext.ts   # React Context for repository + service
│       ├── ModelRegistryProvider.tsx  # Provider: instantiates GitHubModelRepository + ModelServiceImpl
│       └── useModelRegistry.ts       # Hooks: useModelRepository(), useModelService()
│
├── components/
│   ├── AlternativesModal.tsx        # Deep-linkable modal with focus trap + copy
│   ├── ErrorBoundary.tsx            # Class component with resetKey, onRetry, per-region fallbacks
│   ├── icons.tsx                    # Inline SVG icon components (no emojis)
│   ├── ModelCard.tsx                # Card with copy buttons, tier badge, modality chips
│   ├── SkeletonCard.tsx             # Loading placeholder
│   ├── VirtualizedModelList.tsx     # @tanstack/react-virtual with dynamic measurement
│   └── ui/
│       └── constants.ts             # TIER_CLASS, MODALITY_LABEL lookup maps
│
├── hooks/
│   ├── useAlternativesModal.ts      # Modal state: open/close, originalModel, selectedAlternatives
│   ├── useDebouncedValue.ts         # Generic debounce hook (150ms default)
│   ├── useFilteredModels.ts         # Filtering + sorting via memoized tier map
│   └── useFocusTrap.ts             # Keyboard focus trap for modals
│
├── types/
│   └── filters.ts                   # SortKey, ProviderFilter, parseSortKey, parseBoolean
│
├── utils/
│   ├── errorReporting.ts            # reportError() integration point (Sentry/LogRocket-ready)
│   ├── format.ts                    # formatCtx(), formatReleaseDate()
│   └── sanitize.ts                  # HTML entity escaping for all dynamic text content
│
└── test/
    └── setup.ts                     # Vitest setup: jest-dom, clipboard mock, cleanup
```

## Features

### Data Display

- **Model cards** with name, ID, context window, release date, output tokens, modalities, and cost tier badge
- **Virtualized list** using `@tanstack/react-virtual` with dynamic height measurement for smooth scrolling through large model catalogs
- **Skeleton loading** placeholders during initial data fetch
- **Empty state** with icon when no models match the current filters

### Filtering & Search

- **Provider sidebar** with model counts per provider (sorted by count descending)
- **Search input** with 150ms debounce (avoids recomputing filters on every keystroke)
- **Free-only toggle** to show only zero-cost models
- **Sort dropdown**: Name (A-Z), Context (descending), Newest first
- **Clear filters** button visible when any filter is active
- **URL sync**: all filters are reflected in URL search params (`?provider=openai&free=true&sort=context&q=gpt`)

### Alternatives Modal

- **Click any model card** to open a detailed modal with up to 3 suggested alternatives
- **Deep-linkable**: navigate directly via `?alt=<model_id>` URL parameter
- **Focus trap** with Tab/Shift+Tab cycling and Escape to close
- **Copy buttons** with clipboard API + fallback (`document.execCommand`), tooltip, and visual feedback
- **Close-race protection**: closing the modal never causes a stale re-open

### Accessibility

- **Roving tabindex** on provider sidebar tabs (Arrow keys, Home/End navigate and auto-select)
- **ARIA attributes**: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="dialog"`, `aria-modal`, `aria-label` on all interactive elements
- **Focus-visible** outlines on all interactive elements
- **Screen reader support**: hidden labels, live region for filter count, copy button announcements

### Security

- **Content Security Policy** in `index.html`: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`, `object-src 'none'`
- **Input sanitization**: all dynamic text (model names, IDs, provider names, error messages, reasons) escaped via `src/utils/sanitize.ts`
- **Dev server filesystem**: restricted to `.` only (no parent directory traversal)
- **No `wasm-unsafe-eval`** in CSP

### Resilience

- **Stale-While-Revalidate**: cached data served immediately, background refresh
- **Circuit breaker**: opens after 5 consecutive failures, auto-resets after 60s
- **Exponential backoff retry**: 3 attempts per mirror with jitter
- **Mirror fallback**: primary GitHub raw → jsDelivr CDN → custom mirrors (`VITE_DATA_MIRRORS` env)
- **Request timeout**: 10s per fetch with AbortController support
- **Rate limiting**: 30s minimum interval between requests under failure pressure only
- **Referential integrity**: orphaned intelligence records filtered out at load time
- **Self-referential alternatives**: Zod refinement rejects `model_id` equal to its parent record
- **Abort handling**: in-flight requests cancelled on unmount, abort errors silently ignored

### Error Handling

- **Per-region Error Boundaries**: sidebar, content header, model list, modal — each with a fallback UI
- **resetKey pattern**: `getDerivedStateFromProps` resets the boundary when the retry counter increments
- **onRetry callback**: boundaries trigger the parent's retry flow
- **Centralized error reporting**: `reportError()` in `src/utils/errorReporting.ts` — ready for Sentry/LogRocket integration

### Provider Integration

- **API key links** in sidebar footer for 18 providers (OpenAI, Anthropic, Google, etc.)
- Typed as `ReadonlyMap<ProviderId, string>` in `src/schemas/api.ts`

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `/BaseModel/` | Base path for deployment (overridden per PR preview) |
| `VITE_DATA_MIRRORS` | _(empty)_ | Comma-separated list of additional CDN mirror base URLs |

### TypeScript

- Target: ES2023
- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- JSX: react-jsx (automatic runtime)
- Module resolution: bundler

### Vite

- React plugin (`@vitejs/plugin-react`)
- Manual chunk splitting: `vendor-react`, `vendor-virtual`, `vendor-zod`, `vendor`, `modal`
- `chunkSizeWarningLimit: 200` (the vendor-react chunk is ~215 KB gzipped to ~69 KB — acceptable for React runtime)

### Testing

- **Unit**: vitest with jsdom, `@testing-library/react`, `@testing-library/jest-dom`
- **E2E**: Playwright with Chromium, builds and serves via `vite preview` on port 4173
- **Setup**: `src/test/setup.ts` — clipboard mock, matchMedia mock, cleanup after each test

## CI/CD

All workflows are in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main | lint → typecheck → test → build → e2e → security audit → dependency review |
| `deploy.yml` | push to main | Build + deploy to `gh-pages` branch |
| `preview.yml` | PR open/sync/close | Deploy PR preview to `gh-pages/pr-preview/` |
| `codeql.yml` | push/PR + weekly | CodeQL security analysis |
| `secret-scanning.yml` | push/PR | TruffleHog secret scan |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

Private repository. All rights reserved.
