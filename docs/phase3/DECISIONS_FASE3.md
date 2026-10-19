# Decisiones de la Fase 3 (posteriores al SDD v1.0)

Aprobadas por la autora el 18 de octubre de 2026. Deben incorporarse al SDD v1.1 (Tabla 70).

## Decisiones de diseño

| ID | Decisión | Justificación | Req. |
|---|---|---|---|
| D-60 | Límite de solicitudes para `POST /auth/refresh` y `POST /auth/logout`: 30 solicitudes por ventana de 15 minutos, por clave = IP + huella SHA-256 (16 hex) de la cookie `rt` (solo IP si no hay cookie). Respuesta 429 `RATE_LIMITED` con `Retry-After`. Valores configurables (`RATE_LIMIT_SESSION_MAX`, `RATE_LIMIT_SESSION_WINDOW_MINUTES`). El login mantiene el límite del SDD (5 fallos / 15 min por IP + correo). | El contrato declara 429 en ambas operaciones pero el SDD no fijaba el límite. Una clave solo por IP bloquearía a todo un departamento detrás del mismo NAT. | NFR-05 |
| D-61 | `SessionResponse.data.sessionExpiresIn` (entero, segundos, obligatorio): segundos que faltan hasta el fin absoluto de la sesión de 12 h. Lo devuelven login y refresh. Contrato 0.3.0 → **0.3.1** (sin operaciones nuevas, sin cambios en la base). | El frontend necesita el fin de sesión para el aviso S-43a (10 min antes) y no puede leerlo de la cookie HttpOnly. Relativo en segundos, coherente con `expiresIn` e inmune al desfase del reloj del cliente. | NFR-01 |

## Decisiones técnicas y de proceso (no cambian requisitos ni modelo)

| Tema | Decisión |
|---|---|
| Node | ≥ 22.22.0 (lo exigen react-router 8.4.0 y Vite 8.3.2). Sigue siendo Node 22 (SDD Tabla 7). |
| Lenguaje | TypeScript en backend (como la base) y frontend (`.tsx`, Figura 4). |
| Rutas frontend | Las planas de D-57 (la Figura 4 con `/apps/:appId` queda obsoleta). |
| Calidad | ESLint (typescript-eslint, `no-floating-promises` = R-1/D-20), Prettier, husky + lint-staged + commitlint (Conventional Commits). |
| Pruebas | Backend: `node:test` + supertest sobre bases desechables (rol `docs_app`). Frontend: Vitest + Testing Library. Las 153 verificaciones de la Fase 2 se conservan sin cambios como regresión. |
| Logging | `pino` + `pino-http`, JSON, `requestId` (también en `X-Request-Id` y en `INTERNAL_ERROR`), con redacción de `authorization`, `cookie`, `set-cookie`, `password`, `passwordHash`. |
| Siembra | `npm run db:seed` idempotente, ejecutado como `docs_app` (queda auditado con actor NULL y `db_role = docs_app`): primer administrador (`SEED_ADMIN_*`) y cuenta reservada "Integración Jira" (`INTEGRATION_USER_EMAIL`, READER, INACTIVE, hash inutilizable). No modifica cuentas existentes; si la reservada existe con datos distintos, falla. |
| Arranque | El API falla al arrancar si la cuenta reservada no existe o no es READER/INACTIVE (TODO_FASE3 #3). |
| Operaciones aún no implementadas | Pasan por autenticación, autorización y validación; responden 404 `NOT_FOUND` con `details.reason = "NOT_IMPLEMENTED"` y se listan en el log de arranque. Solo durante el desarrollo. |
| Ruta inexistente | 404 `NOT_FOUND` con `details.reason = "ROUTE_NOT_FOUND"`. |
| Desarrollo local | HTTP en `localhost`; frontend en `:5173` con proxy de Vite `/api` → `:3000`; `FRONTEND_ORIGIN=http://localhost:5173`. La cookie conserva `Secure` (Chrome/Edge la aceptan en localhost). HTTPS en el despliegue (NFR-04). |
| Contrato en el frontend | Copia en `contract/openapi.yaml` + `contract/SOURCE.md` (commit del backend), tipos con `openapi-typescript`, verificación en CI. |
| Fuentes | Plus Jakarta Sans e IBM Plex Mono autoalojadas (`@fontsource`), sin CDN. |
| Bruno | Versión 4.2.1; la colección la crea la autora en la app (formato nativo) dentro de `bruno/`; secretos en archivos ignorados. Se ejecuta contra una base aislada (`docs_sandbox`). |
| Git | `main` / `develop` / `feature/<nombre>`; Claude Code hace commits locales; push y PR los hace la autora. |
| CI | GitHub Actions en ambos repositorios. |
| Cuentas | Administrador inicial: `camilacastilloporras23@gmail.com`. Cuenta reservada: `integracion.jira@system.local`. |

## Pendiente para el SDD v1.1

D-60, D-61; Tabla 7 (helmet/cors marcados "Verified" sin estar en la base; Node 22.22); Figura 4
(rutas `/apps/:appId` → rutas de D-57); §7.3.2 (el archivo de Figma no tiene página "Design system"
ni variables; los tokens viven en `docs/design/DESIGN_REFERENCE.md` del frontend).
