# Contributing

## Design Constraints

Before contributing, understand these non-negotiable constraints:

- **No cameras.** Sentira is camera-free by design. No image types, no video pipeline, no camera API surfaces.
- **Supplemental only.** Every alert must be hedged ("possible X detected — please check on [name]"). Vitals are trend estimates, never clinical readouts.
- **No autonomous calls.** All alerts require human acknowledgment before any external action. No auto-dialling emergency services.
- **Single-household scope.** 1–3 rooms, 1–2 residents, 2–4 caregivers. No multi-tenant, no RBAC.

## Development Setup

```bash
# Clone
git clone https://github.com/subhxroy/sentira.git
cd sentira/sentira

# Prerequisites
node >= 20
pnpm >= 9
Docker Desktop (or Docker Compose v2)

# Install
pnpm install --ignore-scripts

# Type-check immediately
pnpm typecheck
```

## Project Structure

```
sentira/
├── packages/
│   ├── types/          Shared types — single source of truth
│   ├── middleware/     Rules engine + API server
│   ├── dashboard/     Next.js caregiver UI
│   └── mock-ruview/   Hardware stand-in for testing
├── infrastructure/    Dockerfiles, Mosquitto config
├── docs/              Documentation
└── docker-compose.yml
```

## Workflow

### 1. Choose a Package

| Package | Build tool | Test command | Dev command |
|---------|-----------|-------------|-------------|
| `types` | tsc | `pnpm --filter @sentira/types run typecheck` | — |
| `middleware` | tsc | — | `pnpm --filter @sentira/middleware start` |
| `dashboard` | Next.js 15 | `pnpm --filter @sentira/dashboard run typecheck` | `pnpm --filter @sentira/dashboard dev` |
| `mock-ruview` | tsc | — | `pnpm --filter @sentira/mock-ruview start` |

### 2. Start the Stack

```bash
# Terminal 1: MQTT
docker compose up -d mosquitto

# Terminal 2: Middleware (restarts on change)
pnpm --filter @sentira/middleware dev

# Terminal 3: Dashboard (HMR)
pnpm --filter @sentira/dashboard dev
```

Or use the root script:

```bash
pnpm local:up
```

### 3. Generate Test Data

```bash
# Normal baseline (runs 2s ticks)
pnpm --filter @sentira/mock-ruview start

# Fall scenario (1s ticks for faster alert generation)
pnpm --filter @sentira/mock-ruview start -- --scenario fall --interval 1000

# Inactivity scenario
pnpm --filter @sentira/mock-ruview start -- --scenario inactivity
```

### 4. Verify

```bash
# Dashboard
open http://localhost:4300

# API
curl http://localhost:4400/health
curl http://localhost:4400/api/overview
```

## Coding Standards

### TypeScript

- Strict mode. No `any` unless absolutely necessary (MQTT raw payloads, JSON.parse).
- Use the types package for shared types. Don't define types locally that exist in `@sentira/types`.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and aliases.
- Import extensions: `.js` for ESM compatibility.

### Naming

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Formatting

- No Prettier config yet — match existing file style
- 2-space indentation
- Semicolons required
- Single quotes preferred

### Commit Messages

Conventional Commits format:

```
<type>: <description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `security`

Examples:
```
feat: add breathing trend detection rule
fix: fall rule triggers false positive on book drop
docs: update API reference with SSE event types
security: flush to null on token comparison
```

## Package Guidelines

### `@sentira/types`

Central type definitions only. No runtime code. No dependencies.

### `@sentira/middleware`

- Pure functions for rules. Testable without MQTT or HTTP.
- Store mutations go through the store interface, not direct array manipulation.
- Alert lifecycle transitions in `alert-manager.ts`, not scattered across files.
- Add new detection rules in `rules.ts` and register in the `RULES` array.

### `@sentira/dashboard`

- Pages in `app/` directory, shared components in `components/`.
- API calls through `lib/middleware-api.ts` (typed wrapper).
- Real-time updates through `lib/use-sse.ts`.
- No client-side state management library needed — SSE + React state is sufficient.

### `@sentira/mock-ruview`

- Scenarios are plain data factories returning arrays of `MockReading`.
- Add new scenarios in `scenarios.ts` without modifying the publisher or CLI.
- Each scenario should simulate a real-world pattern, not random noise.

## Adding a Detection Rule

1. Define the rule function in `packages/middleware/src/rules.ts`
2. Register in the `RULES` array
3. Define alert type/severity in `packages/types/src/index.ts`
4. Add threshold to config if rule needs tunable parameters
5. Add a test scenario in `packages/mock-ruview/src/scenarios.ts`

## Before Submitting

- [ ] `pnpm typecheck` passes for the relevant package
- [ ] No `console.log` — use the pino logger (`logger.info`, `logger.warn`, `logger.error`)
- [ ] Alert messages use hedged language ("possible ...", "trend flag")
- [ ] No camera-related code added
- [ ] MEDIUM alerts don't trigger SMS (anti alert-fatigue)
- [ ] `.env.example` updated if new env vars added
