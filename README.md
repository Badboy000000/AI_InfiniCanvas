# AI Infinite Canvas Platform

AI Infinite Canvas Platform is a Bun-based monorepo for an AI-native infinite-canvas workflow system.

The repository is organized so that product apps stay thin and reusable workflow / canvas rules live in shared packages.

## Repository layout

```txt
apps/
  web/                 React + Vite front-end shell

packages/
  node-protocol/       Node definition types and schemas
  workflow-core/       Workflow validation and execution-plan compilation
  canvas-engine/       Canvas viewport and interaction logic
  event-core/          Run-event and state-reduction logic

scripts/               Cross-workspace tests and cleanup utilities
```

## Requirements

- Use **Bun** for package management and scripts.
- Do not add `package-lock.json`.
- Do not use npm as the routine package manager.
- Treat `dist/`, `node_modules/`, logs, and other generated outputs as disposable artifacts.

## Common commands

Install dependencies:

```bash
bun install
```

Start the web app:

```bash
bun run dev
```

Run the monorepo type checks:

```bash
bun run typecheck
```

Build all current workspaces:

```bash
bun run build
```

Clean temporary verification artifacts:

```bash
bun run cleanup:temp
```

## Notes for contributors

- `apps/` contains runnable application shells.
- `packages/` contains reusable framework-agnostic core logic.
- The root `package.json` is the main orchestration entrypoint for workspace commands.
- The root `tsconfig.json` is a TypeScript project-reference graph, not a standalone source package.
- Build outputs such as `apps/web/dist` and `packages/*/dist` are generated artifacts and should not be treated as source files.

## Validation

For normal repository validation, use:

```bash
bun run typecheck
bun run build
```
