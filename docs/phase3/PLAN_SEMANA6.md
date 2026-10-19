# Plan aprobado — Bitácora 6 (Fase 3, inicio) · 18 al 20 de octubre de 2026

Fuentes de verdad: SRS v1.3 y SDD v1.0. Decisiones posteriores: `DECISIONS_FASE3.md`.
INF = repositorio/infraestructura · BE = backend · FE = frontend.

## Domingo 18 — preparación
| ID | Tipo | Tarea | Rama |
|---|---|---|---|
| D-1 | INF | Node ≥ 22.22, verificar `docs_system` (6 migraciones), `docs_shadow`, `db:drift`, Bruno 4.2.1 | — |
| D-2 / B-00 | INF | Repo backend: importar la base verificada (sin `.env`, `node_modules`, `src/generated`), docs, `CLAUDE.md`, `.gitattributes`; `main` + `develop`; reproducir las 153 verificaciones; actualizar README/LEEME/paquete a la Fase 3 | `main`, luego `feature/platform-setup` |
| D-3 / F-00 | INF/FE | Repo frontend: Vite 8.3.2 + React 19.3.0 + TS + Tailwind 4.3.3 + react-router 8.4.0, ESLint, Prettier, Vitest, `CLAUDE.md`, docs, `contract/` | `main`, luego `feature/frontend-foundation` |

## Lunes 19 — núcleo backend y fundamentos frontend
| ID | Tipo | Tarea | SRS / SDD | Rama |
|---|---|---|---|---|
| B-01 | BE | Herramientas: tsconfig, ESLint (`no-floating-promises`), Prettier, husky/commitlint, scripts, `test:legacy`, bases de prueba desechables | R-1, D-20, SRS 3.7 | `feature/platform-setup` |
| B-02 | BE | Esqueleto de la app: config validada, cadena de middlewares del SDD §4.1, 50 operaciones montadas con RBAC desde `x-roles`, validador, errorHandler completo (validador, Prisma, PostgreSQL, CP-07), logging, apagado ordenado | SDD 4.1, 7.1, 11; NFR-03/04/05/08 | `feature/platform-setup` |
| B-03 | BE | Conexión `docs_app`, siembra idempotente, verificación de la cuenta reservada al arrancar | FR-26, D-51, TODO #3 | `feature/platform-setup` |
| B-04 | BE | Módulo 1 · autenticación por capas, contrato 0.3.1 (`sessionExpiresIn`, D-61), límites D-60 | FR-01, NFR-01/02/05, SDD 7.2.1, 8.3, 11.2 | `feature/module-1-auth` |
| F-01 | FE | Sistema de diseño: tokens de Figma, fuentes, componentes base | NFR-07, SDD 7.3.2, 7.3.6 | `feature/frontend-foundation` |
| F-02 | FE | Cliente HTTP, sesión (R-4), catálogo de mensajes, ApplicationProvider | NFR-01/05/08, SDD 4.2, 8.3, 11.2 | `feature/frontend-foundation` |

## Martes 20 — usuarios, aplicaciones, Bruno, frontend Módulo 1, CI
| ID | Tipo | Tarea | SRS / SDD | Rama |
|---|---|---|---|---|
| B-05 | BE | Usuarios: CRUD, desactivación lógica, ETag/If-Match, reglas del administrador, cuenta reservada | FR-02/03/04, SDD 7.2.1, D-09, D-51, TODO #2 | `feature/module-1-auth` |
| B-07 | BE | Bruno: base aislada (`docs_sandbox`), carpetas Auth y Users | SRS 3.7 | `feature/module-1-auth` |
| B-06 | BE | Aplicaciones: CRUD + archivado, `assertApplicationActive`, carpeta Bruno Applications | FR-27, NFR-16, SDD 7.2.2, D-47, TODO #1 | `feature/applications` |
| B-08 | INF | CI backend (GitHub Actions) | SDD Tabla 5, 6.7, Tabla 74 | `feature/ci-pipeline` |
| F-03 | FE | Rutas D-57, guardia por rol, shell (S-31), login (S-01a–c), errores (S-41a–c), sesión (S-43a–b), banners (S-09b, S-46) | FR-01, FR-04, NFR-07/08/18/19, SDD 7.3 | `feature/module-1-auth` (front) |
| F-04 | INF/FE | Integración real login ↔ API, verificación de cookie en Chrome/Edge, CI frontend | NFR-01, NFR-18 | `feature/module-1-auth` (front) |

Orden de PR hacia `develop` (los abre la autora): backend `feature/platform-setup` → `feature/module-1-auth` → `feature/applications` → `feature/ci-pipeline`; frontend `feature/frontend-foundation` → `feature/module-1-auth`.
