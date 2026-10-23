# docs-system-frontend

[![CI](https://github.com/camilacp23/docs-system-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/camilacp23/docs-system-frontend/actions/workflows/ci.yml)

React SPA of **Documentación técnica**, the technical documentation management system of the
Enterprise Architecture Department. It consumes the REST API of `docs-system-backend`.

## Requirements

- Node.js `>= 22.22.2` (see `.nvmrc`; `engine-strict` is enabled, so `npm install` fails on older versions).
- npm 10+.
- The backend repository (`docs-system-backend`) cloned next to this one, to sync the API contract
  and to run the API locally.

All dependencies are pinned to exact versions (`save-exact`); do not add `^` or `~`.

## Running with the backend

1. Start the backend (`http://localhost:3000`) with `FRONTEND_ORIGIN=http://localhost:5173`.
2. Install and start the frontend:

   ```bash
   npm install
   npm run dev
   ```

3. Open <http://localhost:5173>. The port is strict: if it is taken, Vite fails instead of moving.

The Vite dev server proxies `/api` to the backend (`API_PROXY_TARGET`, default
`http://localhost:3000`), so the browser sees a single origin. The proxy is deliberately transparent:
it does not rewrite the `Origin` header (the backend requires `Origin: http://localhost:5173` on
`POST /auth/refresh` and `/auth/logout`, otherwise 403) nor `Set-Cookie` (the HttpOnly `rt` cookie is
`Secure; SameSite=Strict; Path=/api/v1/auth` and works on `localhost` in Chrome and Edge).

To point at another backend: `API_PROXY_TARGET=http://host:port npm run dev`.

## Scripts

| Script                   | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `npm run dev`            | Vite dev server on `:5173`                                                       |
| `npm run build`          | Type-check (`tsc -b`) and production build                                       |
| `npm run preview`        | Serve the production build                                                       |
| `npm run typecheck`      | TypeScript project check                                                         |
| `npm run lint`           | ESLint (type-aware, react-hooks, jsx-a11y)                                       |
| `npm run lint:fix`       | ESLint with autofix                                                              |
| `npm run format`         | Prettier write                                                                   |
| `npm run format:check`   | Prettier check                                                                   |
| `npm test`               | Vitest, single run                                                               |
| `npm run test:watch`     | Vitest watch mode                                                                |
| `npm run contract:sync`  | Copy `../docs-system-backend/api/openapi.yaml` (override with `CONTRACT_SOURCE`) |
| `npm run contract:types` | Generate `src/api/schema.d.ts` from `contract/openapi.yaml`                      |
| `npm run contract:check` | Fail if `schema.d.ts` is stale; does not need the backend (CI-safe)              |
| `npm run e2e:auth`       | Session checks against a running API through the Vite proxy (see below)          |

`contract:sync` refuses to copy when the backend is not on `develop` or when `api/openapi.yaml` has
uncommitted changes. It records the contract version, branch and commit in `contract/SOURCE.md`.
Never edit `src/api/schema.d.ts` by hand.

## Quality tooling

ESLint (flat config) with typescript-eslint type-checked rules (including
`no-floating-promises`), `react-hooks`, `react-refresh` and `jsx-a11y`; Prettier with the Tailwind
plugin; husky + lint-staged + commitlint (Conventional Commits).

> **ESLint version:** the project stays on ESLint 9.x because `eslint-plugin-jsx-a11y` (6.10.2) does
> not yet declare ESLint 10 support. It will be upgraded to ESLint 10 once jsx-a11y supports it.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `develop` and `main` (older runs of the
same ref are cancelled). One job on `ubuntu-24.04`, Node from `.nvmrc`, with minimal permissions
(`contents: read`): `npm ci`, `npm audit --audit-level=high` (blocking), `format:check`, `lint`,
`typecheck`, `test`, `build` and `contract:check` (on the versioned copy in `contract/`; no backend or
database needed). Locally, run the same scripts before pushing.

## End-to-end session check

The manual checklist is `docs/phase3/VERIFICACION_E2E_MODULO1.md`. Its automatable part is
`npm run e2e:auth`: it checks login, the `rt` cookie attributes, the `Origin` rule, refresh rotation,
concurrent refresh and logout, and never prints tokens or cookie values. It uses the backend **sandbox**
(isolated `docs_sandbox` database, not your development data):

1. In `docs-system-backend`: `npm run sandbox:db`, then `npm run sandbox:api` (API on `http://localhost:3001`).
2. Here: `API_PROXY_TARGET=http://localhost:3001 npm run dev` (Vite on `:5173`).
3. In a third terminal: `npm run e2e:auth`.

The administrator password comes from the git-ignored file written by `sandbox:db`
(`../docs-system-backend/bruno/docs-system-api/.env`; override with `SANDBOX_ENV_FILE`).

To stop: `Ctrl+C` in each terminal. If you started them in the background, stop them by PID, never by
process name (other Node processes, such as the development backend, may be running):
`Stop-Process -Id <PID>` in PowerShell or `taskkill //PID <PID> //F` in Git Bash.

## Structure

See SDD §4.2: `src/app` (providers, router), `src/api`, `src/session`, `src/application`,
`src/components/ui`, `src/layout`, `src/modules/<module>`, `src/styles`, `src/test`.
