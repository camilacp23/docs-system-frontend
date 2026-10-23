# Prompts para Claude Code — Bitácora 6 (18–20 oct 2026)

Cada prompt va en una sesión limpia de Claude Code (`/clear`), abierta en la carpeta del repo
indicado. Copia **todo** el bloque. Debajo de cada prompt están las verificaciones que haces tú
antes de pasar al siguiente.

Orden: **B-00, F-00** (domingo) · **B-01, B-02, B-03, B-04, F-01, F-02** (lunes) ·
**B-05, B-07, B-06, B-08, F-03, F-04** (martes).

---

# BACKEND — repo `docs-system-backend`

## B-00 · Adaptar la base a la Fase 3 y reproducir las 153 verificaciones (domingo)

Rama: `feature/platform-setup` (ya creada en la guía).

```text
Tarea B-00 (Fase 3, Bitácora 6). Repo: docs-system-backend. Rama: feature/platform-setup.

Contexto: este repo contiene la base del backend verificada en la Fase 2 (antes en 03_backend/,
04_api/ y 05_diagramas/; ahora en la raíz, api/ y docs/diagrams/). Lee primero, completos:
CLAUDE.md, docs/phase3/PLAN_SEMANA6.md, docs/phase3/DECISIONS_FASE3.md, README.md,
TODO_FASE3.md, docs/guides/00_LEEME_fase2.md (secciones 4, 5, 6 y 9) y test-results/RESUMEN.md.

Objetivo: dejar la base funcionando con la nueva estructura, sin cambiar su comportamiento, y
demostrar que las 153 verificaciones siguen en PASS en esta máquina.

Haz, en este orden:
1. Inventario: confirma con `git ls-files` que no están versionados `.env`, `node_modules/` ni
   `src/generated/`, y que `prisma/migrations/` tiene sus 6 migraciones con LF
   (`git ls-files --eol prisma/migrations`). Si algo falla, detente y avísame.
2. `package.json`: version "0.12.0", description de la Fase 3, "engines": { "node": ">=22.22.0" }.
   NO cambies versiones de dependencias. Verifica que `node -v` sea >= 22.22.0; si no, detente.
3. Actualiza las referencias de rutas en documentación viva: README.md (reescríbelo para la
   estructura nueva: qué hay en cada carpeta y comandos básicos, enlazando a CLAUDE.md y a
   docs/), y agrega al inicio de docs/guides/00_LEEME_fase2.md y docs/guides/GUIA_CAMBIOS_CP01-CP11.md
   una nota de una línea: "Guía de la Fase 2. En este repositorio: 03_backend/ → raíz,
   04_api/ → api/, 05_diagramas/ → docs/diagrams/." No modifiques nada más de esas guías.
   No toques tests/, test-results/, prisma/migrations/ ni src/.
4. Instala y prepara: `npm ci`, `npx prisma generate`, `npx prisma migrate status` (debe indicar 6
   migraciones aplicadas y base al día en docs_system) y `npm run db:drift` (debe decir
   "No difference detected").
5. Ejecuta la suite de la Fase 2 exactamente como indica docs/guides/00_LEEME_fase2.md §5, con
   las rutas nuevas (OPENAPI=api/openapi.yaml), usando bases desechables t01…t10 creadas con
   `createdb -T docs_system` y borradas al final. Las credenciales están en pgpass.conf y en .env:
   no escribas contraseñas en comandos, archivos ni en tu salida. Para JWT_KEYS de la prueba 07 usa
   una llave temporal generada al vuelo. Esperado: 01=37, 02=22, 03=3, 04=11, 05=9, 06=15, 07=35,
   08=14, 09=7 PASS (153) y la tabla de la prueba 10 igual a test-results/10.txt.
6. Contrato: `npx @redocly/cli@2.11.1 lint api/openapi.yaml --extends recommended` (válido, 0
   advertencias) y `python api/check_contract_vs_db.py api/openapi.yaml "-h localhost -U postgres -d docs_system"`
   (ALL CONSISTENT).
7. Commit: "chore: adapt Phase 2 baseline to the Phase 3 repository layout".

Reglas: las de CLAUDE.md (migraciones inmutables, nada contra docs_system salvo lectura y
`migrate status`/`db:drift`, sin push). Si algún paso falla o algo no coincide con lo esperado,
NO lo corrijas por tu cuenta: detente y muéstrame la salida.

Criterios de aceptación: pasos 1–6 con el resultado esperado; diff limitado a package.json,
README.md y las dos notas de las guías.

Entrega: tabla con cada verificación (esperado vs obtenido), versión de node, salida resumida de
migrate status y db:drift, y archivos cambiados.
```

**Tus verificaciones B-00**
1. En el reporte: 153/153 PASS, prueba 10 igual a la referencia, `No difference detected`, contrato válido y `ALL CONSISTENT`.
2. `git log --oneline -3` muestra el commit `chore: adapt…`; `git show --stat HEAD` solo toca `package.json`, `README.md` y las 2 guías.
3. `psql -U postgres -l | grep -E '^ *t0|^ *t1'` no muestra bases `t01…t10` sobrantes.
4. Guarda el reporte de Claude Code (lo usaremos en el cierre). `test-results/RESUMEN.md` no se edita: es evidencia de la Fase 2.

---

## B-01 · Herramientas de calidad, scripts y bases de prueba (lunes)

```text
Tarea B-01 (Fase 3). Repo: docs-system-backend. Rama: feature/platform-setup.

Lee primero: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md; docs/design/SDD_v1.0.md §6.5.2 (regla
R-1) y Tabla 70 (D-20); docs/requirements/SRS_v1.3.md §3.7; package.json; los archivos actuales
de src/ y tests/.

Objetivo: dejar la base de herramientas profesional del backend, sin cambiar comportamiento.

Antes de escribir código preséntame un plan breve (archivos, dependencias con versión exacta y
por qué) y espera mi aprobación.

Alcance:
1. TypeScript: tsconfig.json estricto (strict, noUncheckedIndexedAccess, module/moduleResolution
   NodeNext, target ES2023, incluye src/ y tests/) y tsconfig.build.json (solo src/ → dist/).
   Los archivos existentes de src/ deben compilar; si alguno de referencia falla por tipos, haz la
   corrección mínima SIN cambiar comportamiento y lístala. No modifiques tests/01…10 (si no compilan
   con strict, exclúyelos del typecheck y dímelo).
2. ESLint (flat config) con typescript-eslint con información de tipos; reglas obligatorias como
   error: @typescript-eslint/no-floating-promises, no-misused-promises, await-thenable (R-1, D-20).
   Ignora src/generated, dist, coverage, test-results. Verifica la compatibilidad de versiones
   (ESLint y typescript-eslint); si la última de ESLint no es compatible, usa la última compatible
   y explícalo.
3. Prettier (+ eslint-config-prettier). .prettierignore: prisma/migrations, src/generated,
   test-results, tests/*.sql, docs, api/openapi.yaml.
4. husky + lint-staged (eslint + prettier sobre archivos staged) + commitlint con
   @commitlint/config-conventional (hook commit-msg). Debe funcionar en Git Bash (Windows).
5. Scripts npm: dev (tsx watch src/server.ts — el archivo se crea en B-02; deja el script listo),
   build, start (node dist/server.js), typecheck, lint, lint:fix, format, format:check,
   test (unit + integration), test:unit, test:integration, test:legacy, db:test:template.
   Conserva los scripts existentes.
6. Pruebas nuevas con node:test + supertest (ya instalado), ejecutadas con tsx:
   tests/unit/** y tests/integration/** (*.test.ts). Utilidad tests/helpers/testDb.ts:
   - crea (o reutiliza si las migraciones no cambiaron: guarda un hash de prisma/migrations en el
     COMMENT de la base) una plantilla `docs_test_template` aplicando `prisma migrate deploy` como
     docs_owner;
   - por archivo de prueba crea una base `docs_test_<aleatorio>` desde la plantilla, devuelve las
     URL para docs_app (la que usará la app) y docs_owner, y la borra al terminar;
   - nunca toca docs_system; credenciales derivadas de .env / pgpass, nunca impresas.
   Incluye una prueba de humo que demuestre que la utilidad funciona y que docs_app no puede
   escribir audit_log.
7. scripts/test-legacy.sh (bash, debe correr en Git Bash y en Linux para el CI): automatiza la suite
   de la Fase 2 (tests 01–10) sobre copias desechables de una base indicada por variable
   (por defecto docs_system), compara los conteos de PASS con los esperados
   (37/22/3/11/9/15/35/14/7 y la tabla de la 10), limpia siempre (trap) y sale con código ≠ 0 si
   algo difiere. No modifica los archivos de prueba. Sin contraseñas en el script.
8. Archivo .env.test.example si la utilidad de pruebas necesita variables propias (solo marcadores).

Reglas: CLAUDE.md. Versiones exactas (npm i -E). No cambies lógica de src/. Sin push.

Criterios de aceptación: `npm run lint`, `npm run typecheck`, `npm test` y `npm run test:legacy`
en verde; un commit con mensaje no convencional es rechazado por commitlint; `npm run build`
compila src/ (aunque server.ts aún no exista, ajusta para que el build no falle o explícame).

Verificación: ejecuta todo lo anterior y muéstrame la salida resumida. Commits en Conventional
Commits (p. ej. "chore: add TypeScript, ESLint, Prettier and commit hooks",
"test: add disposable test database helper and legacy suite runner").
Si algo no está definido en CLAUDE.md o en los documentos, pregúntame antes de asumir.
```

**Tus verificaciones B-01**
1. `npm run lint && npm run typecheck && npm test && npm run test:legacy` → todo verde, legacy 153.
2. Prueba el hook: `git commit --allow-empty -m "cambios"` debe **fallar**; `git commit --allow-empty -m "chore: test hook"` debe pasar (luego `git reset --soft HEAD~1`).
3. `git diff develop --stat -- src/` → solo correcciones mínimas de tipos (si hubo), listadas en el reporte.
4. `psql -U postgres -l | grep docs_test_` → solo `docs_test_template` (ninguna base aleatoria sobrante).

---

## B-02 · Esqueleto de la API: middlewares, RBAC desde el contrato y manejo de errores (lunes)

```text
Tarea B-02 (Fase 3). Repo: docs-system-backend. Rama: feature/platform-setup.

Lee primero, completos: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md; docs/design/SDD_v1.0.md §4.1
(Tabla 6 y Figura 3), §7.1 (Tablas 44 y 45 y su nota sobre errores de PostgreSQL), §7.3.6 (Tabla 59),
§11 (Tablas 64–68) y D-25, D-39, D-42, D-43; docs/diagrams/03_backend_layers.mmd; api/openapi.yaml
(info.description con el catálogo de errores, components, x-roles/x-rule/x-error-codes);
src/security/* (incluido testApp.ts como referencia de montaje), src/db/prisma.ts;
tests/08_request_validation.test.mjs (configuración probada del validador); TODO_FASE3.md #4;
prisma/migrations/* (nombres de constraints y excepciones de triggers).

Objetivo: la aplicación Express real (no el arnés), con la cadena horizontal del SDD y las 50
operaciones montadas desde el contrato, lista para que cada módulo agregue su lógica.

Antes de programar: (a) preséntame tu plan de archivos; (b) preséntame la TABLA DE TRADUCCIÓN DE
ERRORES DE BASE DE DATOS: cada constraint UNIQUE/CHECK/FK y cada excepción de trigger definida en
las 6 migraciones → código del catálogo (Tabla 45) y HTTP. Si alguna no tiene un código claro en el
catálogo, márcala y pregúntame. Espera mi aprobación de ambos.

Alcance:
1. src/config/: carga y valida al arrancar todas las variables de .env.example (tipos, rangos,
   formato de JWT_KEYS ≥ 256 bits, URL, correo). Las de Jira son opcionales hasta su módulo.
   Error claro y salida si falta algo. Reutiliza/integra src/security/config.ts sin romper el arnés.
2. src/app.ts exporta buildApp({ config, db }) (para pruebas) y src/server.ts arranca, escucha en
   PORT y hace apagado ordenado (SIGINT/SIGTERM: deja de aceptar, cierra Prisma).
3. Cadena en este orden (SDD §4.1): helmet (API JSON: CSP default-src 'none' y frame-ancestors
   'none') → CORS con lista blanca exacta FRONTEND_ORIGIN, credentials, métodos GET/POST/PUT/DELETE,
   cabeceras Authorization/Content-Type/If-Match, expone ETag/Location/Retry-After/X-Request-Id →
   express.json límite 1 MB (excepto la ruta del webhook de Jira, que más adelante usará
   express.raw; déjalo preparado) → requestId (X-Request-Id) + logging pino/pino-http con redacción
   (decisiones Fase 3) → rate limit en /api/v1/auth/* (el detalle de límites se implementa en B-04;
   deja el punto de montaje) → authenticate → authorize (x-roles/x-rule, D-39) → validación de la
   solicitud con express-openapi-validator 5.6.2 (misma configuración que la prueba 08:
   validateSecurity false, ignoreUndocumented false) → router → errorHandler.
   El orden debe ser observable: sin token → 401 antes que 400; rol incorrecto → 403 antes que 400.
4. Registro de operaciones: a partir de loadPolicies(api/openapi.yaml) se montan las 50 operaciones;
   cada operationId se vincula a un handler del módulo si existe; si no, a un stub que responde 404
   NOT_FOUND con details.reason "NOT_IMPLEMENTED" (después de auth/authorize/validación). Al arrancar
   se registra en el log la lista de operaciones no implementadas. login/refresh/logout y el webhook
   (x-roles vacío) siguen la cadena pública del arnés. Si una operación no tiene x-roles, el servidor
   no arranca.
5. Ruta o método inexistente → 404 NOT_FOUND con details.reason "ROUTE_NOT_FOUND".
6. errorHandler completo, siempre { code, message, details }, mensajes exactos del catálogo:
   ApiError; errores del validador → 400 VALIDATION_ERROR con details.fields [{ field, rule,
   message }]; JSON malformado → 400 VALIDATION_ERROR; cuerpo > 1 MB → 413 PAYLOAD_TOO_LARGE;
   errores de Prisma / driver adapter / PostgreSQL según la tabla aprobada (incluye 23505 → 409,
   23503 → 404 o 422, 23514 y triggers → 422, y context_screen_mismatch → 422
   CONTEXT_SCREEN_MISMATCH con details a partir del JSON de detail, TODO_FASE3 #4); cualquier otro
   → 500 INTERNAL_ERROR con requestId (el mismo del log), sin stack ni SQL. ANTES de escribir la
   traducción, provoca cada clase de error en una base de prueba e inspecciona la forma real del
   error que entrega Prisma 7.10 con @prisma/adapter-pg; programa contra esa forma.
7. src/http/: utilidades compartidas que usarán los módulos (respuesta paginada { data, page,
   pageSize, total }, parseo de page/pageSize/sort con lista blanca del contrato, ETag fuerte a
   partir de la representación JSON, verificación de If-Match → 412 PRECONDITION_FAILED con
   details.currentETag, Location en 201).
8. No elimines ni cambies src/security/testApp.ts ni authService.ts (la prueba 07 los usa).

Pruebas (tests/integration, base desechable): arranque falla si una operación pierde x-roles (copia
temporal del contrato); matriz completa de autorización: las 44 operaciones protegidas × 3 roles
devuelven 403 o pasan (equivalente de A23 contra la app real); orden 401/403/400; 404 ROUTE_NOT_FOUND;
NOT_IMPLEMENTED; 413; JSON malformado; CORS (origen permitido vs. otro); cabeceras de helmet;
X-Request-Id; 500 sin filtrar detalles; cada fila de la tabla de traducción de errores de BD.

Criterios de aceptación: `npm run dev` arranca y lista las operaciones no implementadas;
`npm run lint`, `typecheck`, `test`, `test:legacy` en verde.

Verificación: muéstrame salida resumida de las cuatro órdenes y un `curl -i` de
`GET http://localhost:3000/api/v1/users` sin token (401 con el formato uniforme).
Commits convencionales (p. ej. "feat: add Express app skeleton with contract-driven RBAC",
"feat: add uniform error handling and database error translation").
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-02**
1. Revisa y aprueba la **tabla de traducción de errores** antes de que programe (tráemela si dudas).
2. `npm run dev` → en el log aparece la lista de operaciones no implementadas; luego:
   `curl -i http://localhost:3000/api/v1/users` → `401`, cuerpo `{"code":"UNAUTHENTICATED",…}`, cabecera `X-Request-Id`.
   `curl -i http://localhost:3000/api/v1/nada` → `404` con `"reason":"ROUTE_NOT_FOUND"`.
3. `npm run lint && npm run typecheck && npm test && npm run test:legacy` → verde.
4. El log de pino no muestra `authorization` ni cookies (prueba con `curl -H "Authorization: Bearer x" …` y revisa la línea del log).

---

## B-03 · Conexión `docs_app`, siembra y verificación de la cuenta reservada (lunes)

```text
Tarea B-03 (Fase 3). Repo: docs-system-backend. Rama: feature/platform-setup.

Lee primero: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md (filas "Siembra" y "Arranque");
docs/requirements/SRS_v1.3.md FR-26, NFR-02, NFR-20; docs/design/SDD_v1.0.md §6.5 (auditoría),
§6.7 (roles), §11.4 (Tabla 68) y D-09, D-31, D-40, D-51; TODO_FASE3.md #3; api/openapi.yaml
(schema Password); src/db/prisma.ts, src/security/passwords.ts, src/config/.

Objetivo: que el API use siempre docs_app, que exista un mecanismo profesional de siembra inicial
y que el servidor se niegue a arrancar sin la cuenta reservada.

Alcance:
1. src/db/: un único cliente creado con createPrisma(APP_DATABASE_URL) e inyectado en la app;
   cierre ordenado. El API nunca usa DATABASE_URL.
2. `npm run db:seed` (src/scripts/seed.ts), conectado como docs_app (auditado con actor NULL y
   db_role docs_app, como exige NFR-20), idempotente:
   - Administrador inicial con SEED_ADMIN_NAME / SEED_ADMIN_EMAIL (minúsculas) /
     SEED_ADMIN_PASSWORD (validada contra el patrón Password del contrato; bcrypt con BCRYPT_COST).
     Si el correo ya existe, no modifica nada e informa.
   - Cuenta reservada "Integración Jira" con INTEGRATION_USER_EMAIL, rol READER, estado INACTIVE,
     password_hash = bcrypt de 32 bytes aleatorios descartados (inutilizable). Si existe con rol o
     estado distintos, falla con un mensaje claro y no la modifica.
   - Falla si SEED_ADMIN_EMAIL = INTEGRATION_USER_EMAIL o si falta una variable.
   - Nunca imprime contraseñas ni hashes. Al terminar recuerda borrar SEED_ADMIN_PASSWORD del .env.
   - NO crea aplicaciones ni datos de SAR (eso es la carga inicial, FR-26, al final de la Fase 3).
3. Arranque: tras validar la configuración, el servidor verifica que la cuenta reservada exista y
   sea READER/INACTIVE; si no, termina con "Run npm run db:seed" (TODO_FASE3 #3).

Pruebas (base desechable): siembra dos veces → exactamente 2 usuarios; contraseña fuera de política
→ error; correos iguales → error; reservada alterada → error sin modificarla; filas de audit_log con
actor NULL y db_role docs_app; arranque falla sin la reservada y funciona con ella.

Criterios de aceptación: `npm run db:seed` en docs_system crea tu administradora y la reservada;
segunda ejecución sin cambios; `npm run dev` arranca; lint/typecheck/test/test:legacy en verde.

Verificación: muéstrame la salida de las dos ejecuciones de la siembra y de
`psql -U postgres -d docs_system -c "select id,name,email,role,status from app_user order by id"`.

Al terminar (fin de la rama feature/platform-setup): entrégame el título y la descripción del PR
hacia develop (resumen, tareas B-00 a B-03, requisitos: FR-26, NFR-02, NFR-03, NFR-04, NFR-05,
NFR-06, NFR-08, NFR-17, NFR-20; decisiones aplicadas; cómo probar). Commits convencionales.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-03**
1. `npm run db:seed` dos veces: la primera crea 2 usuarios, la segunda no cambia nada.
2. `psql -U postgres -d docs_system -c "select id,email,role,status from app_user"` → tu Gmail `ADMINISTRATOR/ACTIVE` y `integracion.jira@system.local` `READER/INACTIVE`.
3. **Borra `SEED_ADMIN_PASSWORD` de tu `.env`.**
4. `psql -U postgres -d docs_system -c "select actor_user_id, db_role, action, entity_label from audit_log order by id desc limit 3"` → actor vacío, `docs_app`, `CREATE`.
5. Verde: `npm run lint && npm run typecheck && npm test && npm run test:legacy`.
6. **PR 1:** `git push -u origin feature/platform-setup`, abre el PR hacia `develop` con el texto que te dio, revisa el diff y fusiónalo. Luego: `git checkout develop && git pull && git checkout -b feature/module-1-auth`.

---

## B-04 · Módulo 1 — autenticación por capas, contrato 0.3.1 (lunes)

Rama: `feature/module-1-auth` (créala desde `develop` actualizado).

```text
Tarea B-04 (Fase 3, Módulo 1). Repo: docs-system-backend. Rama: feature/module-1-auth.

Lee primero, completos: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md (D-60 y D-61);
docs/requirements/SRS_v1.3.md FR-01, NFR-01, NFR-02, NFR-05; docs/design/SDD_v1.0.md §7.2.1
(Tabla 46 y su nota), §8.3, §11.1–11.3 (Tablas 64–65), D-27, D-36, D-37, D-38;
docs/diagrams/08_seq_login_refresh.mmd; api/openapi.yaml (/auth/login, /auth/refresh,
/auth/logout, SessionResponse, LoginRequest, respuestas 401/429); src/security/* (authService.ts,
tokens.ts, passwords.ts, middleware.ts, config.ts) y tests/07_auth_rbac.test.ts como especificación
ejecutable.

Objetivo: el módulo de autenticación real, en src/modules/auth/{routes,controller,service,repository}.ts,
con el comportamiento verificado en A01–A35, más D-60 y D-61.

Antes de programar preséntame tu plan y espera mi aprobación.

Alcance:
1. Contrato 0.3.1 (D-61), PRIMERO: en SessionResponse.data agrega `sessionExpiresIn` (integer,
   segundos hasta el fin absoluto de la sesión, required, con descripción y ejemplo), sube
   info.version a 0.3.1 y añade "Changes in 0.3.1" en info.description (D-61; sin operaciones nuevas).
   Verifica que refresh y logout declaren la respuesta 429 (D-60); si no la declaran, detente y
   pregúntame. Valida con redocly 2.11.1 y check_contract_vs_db.py.
2. Login (POST /auth/login): correo en minúsculas; cuenta reservada → 401 INVALID_CREDENTIALS tras
   bcrypt de tiempo constante; correo inexistente, clave incorrecta o usuario inactivo → el mismo 401
   (D-27); éxito → access token JWT HS256 con kid, iss, aud, sub, jti, exp 8 h, sin rol (D-25,
   D-36); refresh token opaco (solo su SHA-256 en refresh_token) en cookie rt HttpOnly, Secure,
   SameSite=Strict, Path=/api/v1/auth, Expires = fin de sesión (12 h, SESSION_MAX_SECONDS);
   last_login_at actualizado dentro del contexto de auditoría con el propio usuario como actor.
   Respuesta 200 { data: { accessToken, tokenType: "Bearer", expiresIn, sessionExpiresIn, user } }.
3. Refresh (POST /auth/refresh): solo con Origin = FRONTEND_ORIGIN; rotación de un solo uso (update
   condicional); reutilización de un token rotado → revoca toda la familia; expiración, revocación,
   usuario inactivo → 401 REFRESH_INVALID; la nueva cookie conserva el fin de sesión original
   (nunca lo extiende); sessionExpiresIn calculado contra ese fin.
4. Logout (POST /auth/logout): solo con Origin permitido; revoca la familia; 204; limpia la cookie.
5. Límites: login 5 fallos por IP + correo cada 15 min (skipSuccessfulRequests), 429 RATE_LIMITED
   con Retry-After y details.minutes; refresh/logout según D-60 (30 por 15 min por IP + huella de la
   cookie, configurable). Montados en el punto preparado en B-02.
6. Capas: el controller solo traduce HTTP y cookies; el service tiene las reglas; el repository las
   consultas Prisma. Reutiliza tokens.ts y passwords.ts. No modifiques authService.ts ni testApp.ts
   (siguen sirviendo a la prueba 07).

Pruebas (tests/integration contra la app real, base desechable): equivalentes de A01–A22 y A26–A30
(login, cookie, claims, 401 uniformes, cuenta reservada, inactivo, tokens inválidos/"none"/aud
incorrecta/kid desconocido, rotación, reutilización, Origin, logout, fin de sesión de 12 h, rate limit
de login); sessionExpiresIn presente, ≤ 43200, y no aumenta tras varios refresh; límite D-60 (31.ª
solicitud → 429); un usuario desactivado directamente en la BD recibe 401 en la siguiente llamada.

Criterios de aceptación: contrato 0.3.1 válido y consistente; lint/typecheck/test/test:legacy en
verde (la prueba 07 sigue 35/35).

Verificación: muéstrame la salida resumida y un flujo manual con curl contra `npm run dev`
(login con tu cuenta → refresh con `-H "Origin: http://localhost:5173"` → logout), mostrando
cabeceras Set-Cookie (sin imprimir tokens completos).
Commits: "feat(api): add sessionExpiresIn to SessionResponse (contract 0.3.1, D-61)",
"feat(auth): implement login, refresh rotation and logout (FR-01, NFR-01, NFR-02)", etc.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-04**
1. `git diff develop -- api/openapi.yaml` → solo `sessionExpiresIn`, versión `0.3.1` y el changelog.
2. Con `npm run dev`:
   ```bash
   curl -i -c /tmp/c.txt -H "Content-Type: application/json" -d '{"email":"camilacastilloporras23@gmail.com","password":"<tu clave>"}' http://localhost:3000/api/v1/auth/login
   ```
   → `200`, `sessionExpiresIn` ≈ 43200, `Set-Cookie: rt=…; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict`.
   `curl -i -b /tmp/c.txt -X POST http://localhost:3000/api/v1/auth/refresh` (sin Origin) → `403`.
   Con `-H "Origin: http://localhost:5173"` → `200` y `sessionExpiresIn` un poco menor.
3. Seis intentos con clave incorrecta → el sexto responde `429` con `Retry-After`.
4. Verde: `npm run lint && npm run typecheck && npm test && npm run test:legacy` (la 07 en 35/35).
5. Haz push de la rama (aún **sin** PR: el PR del Módulo 1 va después de B-05 y B-07).

---

## B-05 · Módulo 1 — usuarios (martes)

```text
Tarea B-05 (Fase 3, Módulo 1). Repo: docs-system-backend. Rama: feature/module-1-auth.

Lee primero, completos: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md; docs/requirements/SRS_v1.3.md
FR-02, FR-03, FR-04, NFR-02, NFR-03 y Tabla 26; docs/design/SDD_v1.0.md §7.1 (Tabla 44),
§7.2.1 (Tabla 46 y nota), Tabla 62 (app_user), §11.3 (Tablas 66–67), D-09, D-24, D-25, D-38, D-51;
api/openapi.yaml (todas las operaciones /users*, User, UserCreate, UserUpdate, Password,
parámetros page/pageSize/q/role/status/sort, cabeceras ETag/If-Match/Location, x-error-codes);
TODO_FASE3.md #2; src/http/ (utilidades de B-02); src/modules/auth/ (para revocar sesiones).

Objetivo: src/modules/users/{routes,controller,service,repository}.ts con las 6 operaciones del
contrato y todas sus reglas.

Antes de programar preséntame tu plan (incluida tu estrategia de concurrencia para la regla del
último administrador) y espera mi aprobación.

Reglas a implementar:
1. GET /users (Admin): filtros q (nombre o correo), role, status; sort con la lista blanca del
   contrato; paginación estándar; nunca incluye la cuenta reservada (ni en total).
2. POST /users (Admin): correo en minúsculas; contraseña validada por el contrato y guardada con
   bcrypt; 409 EMAIL_TAKEN; 201 + Location + ETag; nunca devuelve passwordHash.
3. GET /users/:id: Admin o el propio usuario (SELF_OR_ROLE, ya en el middleware); la reservada → 404
   para todos; ETag.
4. PUT /users/:id (Admin): reemplazo de name, email, status y password opcional; If-Match opcional →
   412 PRECONDITION_FAILED si no coincide; reservada → 422 RESERVED_ACCOUNT; EMAIL_TAKEN;
   desactivarse a sí mismo → 422 CANNOT_DEACTIVATE_SELF; desactivar al último administrador activo
   → 422 LAST_ACTIVE_ADMIN; cambio de contraseña o paso a INACTIVE → revoca todas sus sesiones;
   reactivar está permitido.
5. DELETE /users/:id (Admin): desactivación lógica (D-09) → 204; mismas reglas (reservada,
   a sí mismo, último administrador); revoca sesiones. Nunca borra filas.
6. PUT /users/:id/role (Admin): reservada → 422; degradar al último administrador activo → 422
   LAST_ACTIVE_ADMIN; revoca sesiones del usuario (D-38). Aplica If-Match solo si el contrato lo
   declara para esta operación.
7. La regla del último administrador debe ser segura ante concurrencia (transacción con bloqueo de
   filas usando auditedTransaction; dos administradores degradándose a la vez no pueden dejar cero).
8. Todas las escrituras quedan auditadas con el actor (R-1/R-2).

Pruebas (tests/integration): A30–A35 contra el servicio real; cada regla y código anterior; matriz
de roles de las 6 operaciones (Developer/Reader 403 salvo GET de sí mismos → 200); 412 con ETag
viejo; ETag cambia tras PUT; la desactivación invalida un access token vigente (401) y el refresh
(401); concurrencia del último administrador; ninguna respuesta contiene passwordHash; audit_log
registra password_hash solo como nombre de campo.

Criterios de aceptación: lint/typecheck/test/test:legacy en verde; las 6 operaciones ya no aparecen
como NOT_IMPLEMENTED en el log de arranque.

Verificación: salida resumida y tabla "regla → prueba que la cubre".
Commits: "feat(users): implement user management with logical deactivation (FR-02, FR-03, FR-04)", etc.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-05**
1. `npm run dev`: el log ya no lista `listUsers, createUser, getUser, updateUser, deactivateUser, changeUserRole` como no implementadas.
2. Con tu token (del login de B-04): `GET /api/v1/users` → tu usuario, **sin** la cuenta reservada, `total` = 1.
3. Intenta `DELETE /api/v1/users/<tu id>` → `422 CANNOT_DEACTIVATE_SELF`; `PUT /api/v1/users/<tu id>/role` a `DEVELOPER` → `422 LAST_ACTIVE_ADMIN`.
4. Verde: `npm run lint && npm run typecheck && npm test && npm run test:legacy`.

---

## B-07 · Colección Bruno — base aislada, Auth y Users (martes)

**Antes del prompt (tú, en la app Bruno 4.2.1):** *Create Collection* → nombre `docs-system-api` →
ubicación: la carpeta `bruno` **dentro** del repo (`~/projects/docs-system-backend/bruno`). Ciérrala
sin agregar nada. Así queda en el formato nativo de tu versión.

```text
Tarea B-07 (Fase 3). Repo: docs-system-backend. Rama: feature/module-1-auth.

Lee primero: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md (fila Bruno); docs/requirements/SRS_v1.3.md
§3.7 (cada endpoint con su colección de pruebas en Bruno, versionada, carpetas por módulo) y la
sección Bruno de la descripción del proyecto; api/openapi.yaml (/auth/*, /users*); la carpeta
bruno/ (colección vacía creada por la autora con Bruno 4.2.1: respeta exactamente su formato de
archivos); src/modules/auth y src/modules/users.

Objetivo: colección Bruno versionada que verifique Auth y Users contra una base aislada, ejecutable
desde la app y desde la terminal.

Alcance:
1. Base aislada para pruebas manuales/API: scripts `npm run sandbox:db` (recrea `docs_sandbox` desde
   docs_test_template y siembra un administrador con credenciales de un archivo local ignorado) y
   `npm run sandbox:api` (levanta el API en el puerto 3001 contra docs_sandbox, mismo FRONTEND_ORIGIN).
   Nunca usa docs_system.
2. Colección: entorno `sandbox` (baseUrl http://localhost:3001/api/v1, origin
   http://localhost:5173) con secretos (correo/contraseña del administrador de sandbox) tomados de
   un archivo .env de la colección o de variables secretas de Bruno, ignorado por Git
   (actualiza .gitignore). Carpetas Auth y Users, en orden de ejecución, cada solicitud con
   aserciones de código, cuerpo y cabeceras relevantes. Debe cubrir como mínimo: 200, 201, 204, 400,
   401, 403, 404, 409, 412, 413, 422 (RESERVED_ACCOUNT, CANNOT_DEACTIVATE_SELF, LAST_ACTIVE_ADMIN),
   429 (con un correo aleatorio para no bloquear al administrador). Crea los usuarios Developer y
   Reader que necesite durante la corrida. Las solicitudes de refresh/logout envían la cabecera
   Origin y usan las cookies de Bruno.
3. Ejecución en terminal: agrega @usebruno/cli (versión exacta compatible con colecciones de Bruno
   4.2.1; verifica en su documentación que lea el formato de la colección; si no, detente y avísame)
   y el script `npm run test:api` que recrea la sandbox, levanta el API, corre la colección y
   detiene el API.
4. bruno/README.md: cómo ejecutarla desde la app y desde la terminal.

Criterios de aceptación: `npm run test:api` termina con todas las aserciones en verde; la colección
abre en Bruno 4.2.1 sin errores; ningún secreto versionado (`git ls-files bruno`).

Verificación: salida de `npm run test:api` y lista de archivos agregados.

Al terminar (fin de la rama feature/module-1-auth): entrégame el título y la descripción del PR hacia
develop (B-04, B-05, B-07; FR-01, FR-02, FR-03, FR-04, FR-26, NFR-01, NFR-02, NFR-03, NFR-05, NFR-08;
D-60, D-61, contrato 0.3.1; cómo probar). Commits convencionales.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-07**
1. `npm run test:api` → todo verde.
2. Abre la colección en Bruno 4.2.1, elige el entorno `sandbox` (con `npm run sandbox:db` y `npm run sandbox:api` corriendo) y ejecútala con *Run* → verde.
3. `git ls-files bruno | grep -i env` → no hay archivos con secretos.
4. **PR 2:** push y PR `feature/module-1-auth` → `develop`; revisa y fusiona. Luego `git checkout develop && git pull && git checkout -b feature/applications`.

---

## B-06 · Aplicaciones y guarda de aplicación archivada (martes)

Rama: `feature/applications`.

```text
Tarea B-06 (Fase 3). Repo: docs-system-backend. Rama: feature/applications.

Lee primero, completos: CLAUDE.md; docs/requirements/SRS_v1.3.md FR-27, NFR-16 y Tabla 26 (Manage
applications); docs/design/SDD_v1.0.md Tabla 11 (application), Tabla 33 (create_app_context_screen),
§7.2.2 (Tabla 47 y nota), Tabla 62 (application), D-03, D-28, D-47; api/openapi.yaml (/applications*,
Application, ApplicationWrite, ApplicationCreate, ejemplos y x-error-codes); TODO_FASE3.md #1;
prisma/migrations (trigger create_app_context_screen y CHECK de jira_project_key); src/http/.

Objetivo: src/modules/applications/{routes,controller,service,repository}.ts con las 4 operaciones
y la guarda compartida de aplicación archivada.

Antes de programar preséntame tu plan y espera mi aprobación.

Alcance:
1. GET /applications (todos los roles): q, status, paginación, orden según el contrato.
2. POST /applications (Admin): createdBy = usuario actual; el trigger crea la pantalla App (OnStart);
   la respuesta 201 incluye appContextScreen y createdBy como Ref, Location y ETag; nombre duplicado
   → 409 DUPLICATE_NAME con el mensaje del catálogo. Para los marcadores <type>/<name>/<application>
   aplicados a una aplicación, sigue el ejemplo del contrato; si no hay uno inequívoco, pregúntame.
3. GET /applications/:id (todos): ETag; 404.
4. PUT /applications/:id (Admin): reemplazo completo incluido status (archivar/desarchivar);
   If-Match → 412; DUPLICATE_NAME; jiraProjectKey con el formato del CHECK (null = proyecto por
   defecto TECHEA).
5. Guarda `assertApplicationActive(tx, applicationId)` exportada por el servicio de aplicaciones
   (los demás módulos la usarán a través del servicio, D-42): dentro de la misma transacción lee el
   estado con bloqueo compartido (evita la carrera con un archivado simultáneo); ARCHIVED → 422
   APPLICATION_ARCHIVED con details.applicationId; inexistente → 404. Documenta con JSDoc que la
   deben llamar todas las escrituras de variables, colecciones, pantallas, estados, revisiones,
   tickets de Jira y comentarios, y que los reportes quedan exentos (D-47). Esta semana no existe
   ningún módulo que la consuma: NO inventes endpoints para probarla.
6. Bruno: carpeta Applications en la colección existente (crear SAR, listar, obtener, 409, 412,
   archivar, desarchivar, Developer/Reader 403 en POST/PUT, 200 en GET), incluida en `npm run test:api`.

Pruebas (tests/integration): CRUD; App (OnStart) creada y devuelta; matriz de roles; 409; 412;
archivar/desarchivar; la guarda lanza 422 dentro de una auditedTransaction para una aplicación
archivada y deja pasar una activa; carrera archivado vs. escritura protegida por el bloqueo;
escrituras auditadas con actor.

Criterios de aceptación: lint/typecheck/test/test:legacy/test:api en verde.

Al terminar: título y descripción del PR (FR-27, NFR-16, D-28, D-47, TODO_FASE3 #1; explica que la
guarda se aplicará en cada módulo a medida que exista). Commits convencionales.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-06**
1. Con `npm run dev` y tu token: `POST /api/v1/applications` con `{"name":"SAR","platform":"Power Apps"}` → `201`, la respuesta trae `appContextScreen`. Repetir → `409 DUPLICATE_NAME`.
2. `psql -U postgres -d docs_system -c "select id,name,is_app_context from screen"` → aparece `App (OnStart)` de SAR. *(Esto crea SAR en tu base de desarrollo; es correcto: FR-27 dice que SAR es la primera aplicación.)*
3. Verde: `npm run lint && npm run typecheck && npm test && npm run test:legacy && npm run test:api`.
4. **PR 3:** push y PR `feature/applications` → `develop`; fusiona. Luego `git checkout develop && git pull && git checkout -b feature/ci-pipeline`.

---

## B-08 · Integración continua del backend (martes)

Rama: `feature/ci-pipeline`.

```text
Tarea B-08 (Fase 3). Repo: docs-system-backend. Rama: feature/ci-pipeline.

Lee primero: CLAUDE.md; docs/design/SDD_v1.0.md Tabla 5 (GitHub: CI, migrate deploy), §6.7,
Tabla 74; bootstrap/01_roles_and_database.sql; package.json (scripts); scripts/test-legacy.sh;
tests/helpers/testDb.ts; api/check_contract_vs_db.py.

Objetivo: workflow de GitHub Actions que reproduzca en limpio toda la verificación del backend en
cada push y pull request a develop y main.

Alcance (.github/workflows/ci.yml):
1. Disparadores: push y pull_request hacia develop y main; concurrency que cancela corridas viejas
   de la misma rama; permisos mínimos (contents: read).
2. Servicio PostgreSQL 18.3 (verifica que exista la etiqueta de imagen exacta; si no, usa la de la
   línea 18 más cercana y dímelo) con healthcheck.
3. Node 22.22.x con caché de npm; `npm ci`.
4. Bootstrap igual que en desarrollo: roles docs_owner/docs_app con contraseñas aleatorias generadas
   en la corrida (enmascaradas), base docs_system, CREATEDB para docs_owner, base docs_shadow; .env
   construido en la corrida (nunca secretos versionados).
5. `prisma migrate deploy` (como docs_owner), `prisma generate`, `npm run db:drift`.
6. `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:legacy`,
   `npm run test:api`.
7. Contrato: redocly 2.11.1 lint y check_contract_vs_db.py (Python 3 + PyYAML).
8. Acciones de terceros fijadas por versión mayor estable verificada (o SHA) — indícame cuáles.
9. Insignia de estado en README.md.

Criterios de aceptación: el workflow es válido (actionlint si está disponible); todos los pasos
corresponden a scripts que ya pasan en local. No puedo ver GitHub desde aquí: deja claro qué debo
revisar yo cuando haga push.

Al terminar: título y descripción del PR (NFR-17, SDD Tabla 5). Commit: "ci: add backend pipeline
with migrations, drift check, tests and contract validation".
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones B-08**
1. Push de la rama y PR a `develop`: en la pestaña **Actions** la corrida termina en verde (todos los pasos). Si falla, copia el log del paso y tráemelo.
2. Fusiona el PR. En GitHub → *Settings → Branches*: agrega una regla de protección para `develop` y `main` que exija el check de CI y PR antes de fusionar.

---

# FRONTEND — repo `docs-system-frontend`

## F-00 · Inicializar el proyecto (domingo)

Rama: `feature/frontend-foundation` (creada en la guía).

```text
Tarea F-00 (Fase 3). Repo: docs-system-frontend. Rama: feature/frontend-foundation.

Lee primero: CLAUDE.md; docs/phase3/PLAN_SEMANA6.md y DECISIONS_FASE3.md; docs/design/SDD_v1.0.md
§4.2 (Figura 4), Tabla 7 y D-57; docs/requirements/SRS_v1.3.md §3.3 y §3.7.

Objetivo: el esqueleto profesional del frontend, sin pantallas todavía.

Antes de crear archivos preséntame el plan (estructura de carpetas y lista de dependencias con
versión exacta) y espera mi aprobación.

Alcance:
1. Proyecto Vite + React + TypeScript creado a mano (no uses asistentes interactivos), con versiones
   exactas: vite 8.3.2, react y react-dom 19.3.0, react-router 8.4.0, tailwindcss y @tailwindcss/vite
   4.3.3, lucide-react 1.59.0, typescript 5.9.3; @vitejs/plugin-react y los @types en la última
   versión compatible. "engines": { "node": ">=22.22.0" } (ya hay .npmrc con save-exact y engine-strict).
2. index.html: lang="en", título "Documentación técnica".
3. vite.config.ts: puerto 5173 estricto; proxy de "/api" a process.env.API_PROXY_TARGET
   (por defecto http://localhost:3000) — así el navegador ve un solo origen.
4. Estructura (SDD §4.2): src/main.tsx; src/app/ (providers, router); src/api/ (cliente, mensajes,
   schema.d.ts generado); src/session/; src/application/; src/components/ui/; src/layout/;
   src/modules/<módulo>/ (auth, users, applications, dashboard, screens, variables, collections,
   dependency-map, search, reports, review, audit, onboarding); src/styles/; src/test/.
   App mínima que renderiza "Documentación técnica" (se reemplaza en F-03).
5. Contrato: scripts/sync-contract.mjs copia ../docs-system-backend/api/openapi.yaml (ruta
   configurable con CONTRACT_SOURCE) a contract/openapi.yaml y escribe contract/SOURCE.md con la
   versión del contrato y el commit del backend (git rev-parse en el repo origen). Scripts:
   contract:sync, contract:types (openapi-typescript → src/api/schema.d.ts) y contract:check
   (regenera en temporal y falla si difiere). Ejecuta contract:sync y contract:types ahora.
6. Calidad: ESLint (flat) con typescript-eslint con tipos, react-hooks y react-refresh (verifica
   compatibilidad de versiones; si un plugin aún no soporta la última ESLint, usa la última
   compatible y explícalo); Prettier (+ plugin de Tailwind); husky + lint-staged + commitlint
   (Conventional Commits).
7. Pruebas: Vitest + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom
   + jsdom; una prueba de humo.
8. Scripts: dev, build (tsc -b && vite build), preview, typecheck, lint, lint:fix, format,
   format:check, test, test:watch, contract:*.
9. README.md: requisitos, cómo correr con el backend, scripts.

Criterios de aceptación: npm run lint, typecheck, test, build y contract:check en verde; npm run dev
sirve http://localhost:5173.

Commits convencionales ("chore: scaffold Vite React TypeScript app", "chore: add contract sync and
type generation", ...). Sin push.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones F-00**
1. `npm run lint && npm run typecheck && npm test && npm run build && npm run contract:check` → verde.
2. `npm run dev` → abre http://localhost:5173 y ves "Documentación técnica".
3. `cat contract/SOURCE.md` → versión `0.3.0` y el commit del backend. *(Después de B-04 harás `npm run contract:sync && npm run contract:types` para pasar a 0.3.1; F-02 lo incluye.)*
4. `cat package.json` → todas las versiones sin `^` ni `~`.

---

## F-01 · Sistema de diseño: tokens y componentes base (lunes)

```text
Tarea F-01 (Fase 3). Repo: docs-system-frontend. Rama: feature/frontend-foundation.

Lee primero, completos: CLAUDE.md; docs/design/DESIGN_REFERENCE.md; las imágenes de
docs/design/frames/ (en especial S-47, S-01a–c, S-39a, S-40a, S-41a–c, S-42, S-44); docs/design/
SDD_v1.0.md §7.3.2 (Tabla 54), §7.3.6 (Tablas 58 y 59) y §7.3.7. Si el servidor MCP de Figma está
conectado, usa get_design_context sobre los node ids de DESIGN_REFERENCE.md para confirmar valores
(archivo zZNDo3yEXP6UubLzEWAHe5); la referencia escrita prevalece salvo error evidente, que me
reportarás.

Objetivo: el sistema de diseño implementado, para que todas las pantallas compartan lenguaje visual
(NFR-07).

Antes de programar preséntame la lista de tokens y componentes con su API (props) y espera mi
aprobación.

Alcance:
1. src/styles/theme.css con Tailwind 4 `@theme`: todos los colores, tipografías, tamaños, radios y
   sombras de DESIGN_REFERENCE.md con nombres semánticos; los 5 colores de estado de documentación.
   Ningún color fuera de los tokens.
2. Fuentes autoalojadas con @fontsource (Plus Jakarta Sans 400/500/600/700/800, IBM Plex Mono
   400/600), sin CDN.
3. src/components/ui/ (cada componente con comentario de cabecera: propósito y props, SRS §3.7):
   Button (primary con degradado, secondary, ghost, danger; tamaños sm 30 / md 36 / lg 40; loading;
   disabled), TextField, PasswordField (Show/Hide accesible), FormField (label, * requerido en danger,
   ayuda y error con icono), Banner (info/success/warning/danger, palabra inicial en negrita,
   acciones opcionales), Toast + ToastProvider (oscuro, acción opcional, auto-cierre), Modal
   (sm/md/lg, foco atrapado, Esc, retorno del foco, aria-modal), Skeleton + hook de "mostrar tras
   300 ms" y aviso a los 10 s (S-39a), EmptyState, ErrorState (variantes S-41a/b/c), StatusTag
   (5 estados), Avatar (iniciales), Spinner, ElementTypeIcon (monitor/braces/database/box).
4. Accesibilidad: foco visible con el color accent, roles y etiquetas, navegación por teclado.
5. Página de muestra solo en desarrollo (/dev/ui, protegida por import.meta.env.DEV) que reproduzca
   S-47 para comparación visual.

Pruebas Vitest: comportamiento de cada componente interactivo (PasswordField, Modal, Toast, Button
loading, Skeleton con temporizadores falsos, FormField con aria-invalid/aria-describedby).

Criterios de aceptación: lint/typecheck/test/build en verde; /dev/ui coincide visualmente con S-47.
Entrega: capturas o descripción de la comparación con S-47 y cualquier valor que no encontraste.
Commits convencionales. Sin push.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones F-01**
1. `npm run dev` → http://localhost:5173/dev/ui: compárala lado a lado con `docs/design/frames/S-47_feedback-components.png` (colores de banners, toast oscuro, empty state, skeleton, botón primario).
2. Navega la página con **Tab**: el foco se ve en cada control; el modal se cierra con Esc y devuelve el foco.
3. `grep -rnE "#[0-9a-fA-F]{6}" src --include=*.tsx` → sin colores sueltos en componentes (solo en `theme.css`).
4. Verde: `npm run lint && npm run typecheck && npm test && npm run build`.

---

## F-02 · Cliente HTTP, sesión y aplicación seleccionada (lunes, después de B-04)

```text
Tarea F-02 (Fase 3). Repo: docs-system-frontend. Rama: feature/frontend-foundation.

Prerrequisito: el backend ya tiene el contrato 0.3.1 (B-04). Ejecuta primero `npm run contract:sync`
y `npm run contract:types` y verifica que SessionResponse incluya sessionExpiresIn.

Lee primero, completos: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md (D-61); docs/design/SDD_v1.0.md
§4.2, §7.1 (Tablas 44–45), §7.3.6 (Tabla 59 y nota), §8.3, §11.1–11.2 (Tablas 64–65), D-37, D-38,
D-49 y la regla R-4; docs/diagrams/04_frontend.mmd y 08_seq_login_refresh.mmd (las rutas de la
Figura 4 están obsoletas: valen las de D-57); contract/openapi.yaml (/auth/*, /applications,
Error, SessionResponse, User, Application).

Objetivo: la capa de datos y sesión del SPA, segura y probada.

Antes de programar preséntame el diseño (módulos, estados de sesión, estrategia entre pestañas) y
espera mi aprobación.

Alcance:
1. src/api/client.ts: base "/api/v1"; tipado con src/api/schema.d.ts; añade Authorization: Bearer
   con el token en memoria; ante 401 con code TOKEN_EXPIRED o UNAUTHENTICATED hace UN refresh y
   reintenta UNA vez; si el refresh responde REFRESH_INVALID, la sesión termina; los errores se
   exponen como ApiError { status, code, details, requestId } a partir de { code, message, details }.
2. src/api/messages.ts: catálogo de mensajes exacto de la Tabla 59 indexado por code, con
   rellenado de marcadores desde details; UNAUTHENTICATED, TOKEN_EXPIRED e INVALID_SIGNATURE no se
   muestran (nota de la Tabla 59). La interfaz nunca muestra el message del servidor.
3. src/session/: SessionProvider con el access token SOLO en memoria (ni localStorage ni
   sessionStorage); al cargar la página intenta POST /auth/refresh para recuperar la sesión;
   login(email, password), logout() (POST /auth/logout y limpieza), usuario actual y rol.
   Un solo refresh en curso a la vez **entre pestañas** (R-4): Web Locks API + BroadcastChannel para
   compartir el token nuevo y los eventos de cierre de sesión, de modo que nunca se envíe dos veces
   el mismo refresh token (provocaría la revocación de la familia, D-38). Fin de sesión con
   sessionExpiresIn: estado "ending soon" 10 minutos antes (S-43a) y "expired" al llegar (S-43b);
   la UI de esos estados se hace en F-03.
4. src/application/: ApplicationProvider: carga GET /applications, guarda solo el id seleccionado
   en localStorage (dato no sensible), elige la primera ACTIVE si no hay selección válida, expone la
   aplicación actual (incluido si está ARCHIVED) y su id para enviarlo como applicationId.
5. Estado de conexión: hook de online/offline (para S-46 en F-03).

Pruebas Vitest (fetch simulado): Bearer presente; 401 → un refresh y un reintento; varias
solicitudes con 401 simultáneas → un solo refresh; REFRESH_INVALID termina la sesión; coordinación
entre pestañas simulada (locks/BroadcastChannel); temporizadores de fin de sesión con relojes falsos;
mensajes del catálogo con marcadores; el token nunca llega a localStorage/sessionStorage;
ApplicationProvider elige y recuerda la aplicación.

Criterios de aceptación: lint/typecheck/test/build/contract:check en verde.

Al terminar (fin de la rama feature/frontend-foundation): título y descripción del PR (F-00 a F-02;
NFR-01, NFR-05, NFR-07, NFR-08, NFR-17; SDD 4.2, 7.3.2, 11.2, R-4, D-37, D-61). Commits
convencionales. Sin push.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones F-02**
1. `cat contract/SOURCE.md` → contrato `0.3.1`.
2. `grep -rn "localStorage\|sessionStorage" src` → solo en ApplicationProvider (id de la aplicación) y en pruebas.
3. Verde: `npm run lint && npm run typecheck && npm test && npm run build && npm run contract:check`.
4. **PR front 1:** push y PR `feature/frontend-foundation` → `develop`; fusiona. Luego `git checkout develop && git pull && git checkout -b feature/module-1-auth`.

---

## F-03 · Rutas, guardia por rol, shell, inicio de sesión y estados (martes)

Rama: `feature/module-1-auth` (repo frontend). **Prerrequisito:** B-06 terminado (la tarjeta de aplicación usa `GET /applications`) y SAR creada en tu base de desarrollo (verificación 1 de B-06).

```text
Tarea F-03 (Fase 3, Módulo 1 · interfaz). Repo: docs-system-frontend. Rama: feature/module-1-auth.

Lee primero, completos: CLAUDE.md; docs/design/DESIGN_REFERENCE.md (§4 y §5); las imágenes
S-01a, S-01b, S-01c, S-31, S-31r, S-31j, S-41a, S-41b, S-41c, S-43a, S-43b, S-46 y S-09b de
docs/design/frames/; docs/design/SDD_v1.0.md §4.2, §7.3.1, §7.3.3 (Figura 9 y su texto), §7.3.4
(Tabla 56), §7.3.5, §7.3.6, §7.3.7, D-27, D-51, D-57; docs/requirements/SRS_v1.3.md FR-01, FR-04,
NFR-07, NFR-08, NFR-18, NFR-19. Si el MCP de Figma está conectado, usa get_design_context en los
node ids (7:2, 2:52, 2:103, 2:15799, 2:16187, 2:16489, 2:22248, 2:22419, 2:22556, 2:22963, 2:23159,
2:23556, 2:4289) para medidas exactas e íconos Lucide de la barra lateral; adapta a los componentes
de src/components/ui (no copies el código generado tal cual).

Objetivo: navegación completa por rol, inicio de sesión y estados transversales, conectados a la
capa de F-02.

Antes de programar preséntame tu plan y espera mi aprobación.

Alcance:
1. Rutas exactas de D-57: /login, /dashboard, /screens, /screens/:id (pestañas en la URL),
   /variables, /variables/:id, /collections, /collections/:id, /dependency-map, /search, /reports,
   /review, /audit, /onboarding, /admin/users, /admin/applications; "/" → /dashboard; desconocida →
   S-41a. Las páginas de módulos que aún no existen son marcadores mínimos: título del módulo y el
   texto "This module is not available yet." (no inventes datos ni indicadores).
2. Guardia: sin sesión → /login (recordando el destino); /login con sesión → /dashboard; rol sin
   acceso → S-41b dentro del shell. Acceso por rol según Tabla 56: Administrator todo; Developer
   sin /admin/*; Reader sin /review, /audit ni /admin/*. Recuerda: la API es quien protege (NFR-03).
3. Shell (S-31): barra lateral de 268 px con los grupos e ítems exactos por rol (12/10/8, Tabla 56,
   S-31, S-31j, S-31r), tarjeta de aplicación (iniciales, nombre, plataforma; selector que usa
   ApplicationProvider; chip "Archived · read-only" si aplica), ítem activo según la ruta; barra
   superior de 68 px con breadcrumb (aplicación / página) y bloque de usuario (iniciales, nombre, rol)
   con menú "Sign out". Elementos que dependen de módulos aún inexistentes NO se muestran todavía:
   píldora de estado de Jira, búsqueda rápida (Módulo 6), contador de Review (Módulo 10), número de
   pantallas en la tarjeta (Módulo 4), botón de ayuda y "Collapse". Lístalos en tu reporte como
   pendientes. Pie de la barra: versión del package.json.
4. Banners bajo la barra superior: aplicación archivada (S-09b; botón "Unarchive" solo para
   Administrator, que llama PUT /applications/:id con status ACTIVE e If-Match) y sin conexión (S-46).
   Si no hay ninguna aplicación registrada, muestra un EmptyState neutro y pregúntame el texto exacto
   antes de fijarlo.
5. Inicio de sesión (S-01a/b/c): diseño exacto de la referencia; validación en el cliente (correo
   requerido y válido, contraseña requerida) con los textos de S-01c; 401 → banner de S-01b;
   429 → banner de advertencia con los minutos de details y botón deshabilitado con cuenta regresiva
   "Try again in mm:ss"; botón con estado de carga; mostrar/ocultar contraseña; al entrar vuelve al
   destino recordado o /dashboard. Por debajo de 1280 px el panel izquierdo se oculta (SDD §7.3.7).
6. Estados: S-41a/b/c como páginas dentro del shell (S-41c muestra "Reference: <requestId>");
   S-43a toast de advertencia descartable con la hora local de fin de sesión; S-43b modal "Your
   session ended" con "Sign in" que vuelve a la misma página tras autenticarse.
7. Página /dashboard: marcador (el Módulo 7 llega después).

Pruebas Vitest: guardia por rol (los 3 roles sobre las rutas protegidas); conteo de ítems de la
barra lateral 12/10/8; flujo de login (validación, 401, 429 con cuenta regresiva, éxito y
redirección); sign out; S-43a/S-43b con relojes falsos; banner de archivada y Unarchive solo para
Administrator; S-46.

Criterios de aceptación: lint/typecheck/test/build en verde; comparación visual con S-01a, S-01b,
S-01c, S-31, S-31r, S-31j, S-41a–c, S-43a–b.
Entrega: lista de pendientes del punto 3 y cualquier diferencia visual que no pudiste resolver.
Commits convencionales. Sin push.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones F-03**
1. Con el backend corriendo (`npm run dev` en el backend) y el frontend (`npm run dev`): abre http://localhost:5173 → te manda a `/login`; compara con S-01a.
2. Correo mal escrito → errores de S-01c; clave incorrecta → banner de S-01b; seis intentos fallidos → banner amarillo y cuenta regresiva.
3. Inicia sesión con tu cuenta → `/dashboard` con el shell de Administrador (12 ítems) y la aplicación SAR en la tarjeta. Compara con S-31 (sin Jira, búsqueda ni contadores, como se acordó).
4. Escribe `/nada` en la barra → S-41a. Cierra sesión desde el menú del usuario → vuelve a `/login`.
5. Verde: `npm run lint && npm run typecheck && npm test && npm run build`.

---

## F-04 · Integración real con la API, verificación de la cookie y CI del frontend (martes)

```text
Tarea F-04 (Fase 3). Repo: docs-system-frontend. Rama: feature/module-1-auth.

Lee primero: CLAUDE.md; docs/phase3/DECISIONS_FASE3.md (Desarrollo local, CI);
docs/requirements/SRS_v1.3.md NFR-01, NFR-18; docs/design/SDD_v1.0.md §11.2 (Tabla 65); README.md;
package.json.

Objetivo: comprobar el Módulo 1 de punta a punta contra el backend real y dejar el CI del frontend.

Alcance:
1. Guía de verificación manual docs/phase3/VERIFICACION_E2E_MODULO1.md (pasos y resultado esperado)
   para Chrome y Edge actuales: login; en DevTools → Application → Cookies, la cookie rt con
   HttpOnly, Secure, SameSite=Strict y Path=/api/v1/auth; el access token NO aparece en
   localStorage/sessionStorage; recarga de página mantiene la sesión (refresh); dos pestañas
   abiertas y recarga simultánea no cierran la sesión (R-4); logout invalida la sesión en ambas
   pestañas; usuario Developer y Reader ven 10 y 8 ítems; ruta /admin/users como Reader → S-41b.
   Si la cookie Secure no se guarda en http://localhost en algún navegador, detente y repórtamelo
   (no quites Secure).
2. Ejecuta tú lo que sea automatizable de esa guía (p. ej. con las pruebas existentes o un script
   contra el API local) y deja el resto marcado para la autora.
3. .github/workflows/ci.yml: push y pull_request a develop y main; Node 22.22.x con caché npm;
   npm ci; lint; typecheck; test; build; contract:check (sobre la copia versionada de contract/);
   concurrency y permisos mínimos; insignia en README.md.

Criterios de aceptación: lint/typecheck/test/build/contract:check en verde; guía E2E completa.

Al terminar (fin de la rama feature/module-1-auth del frontend): título y descripción del PR (F-03,
F-04; FR-01, FR-04, NFR-01, NFR-03 (solo usabilidad), NFR-07, NFR-08, NFR-18, NFR-19; D-57; S-01a–c,
S-31, S-41a–c, S-43a–b, S-46, S-09b). Commits convencionales. Sin push.
Si algo no está definido, pregúntame antes de asumir.
```

**Tus verificaciones F-04**
1. Sigue `docs/phase3/VERIFICACION_E2E_MODULO1.md` en **Chrome** y en **Edge** y anota el resultado de cada paso (lo usaremos en la Bitácora).
2. Crea un Developer y un Reader con Bruno o `curl` (en tu base de desarrollo) y comprueba 10 y 8 ítems y la página S-41b.
3. **PR front 2:** push y PR `feature/module-1-auth` → `develop`: el CI del frontend en verde; fusiona. Protege `develop` y `main` igual que en el backend.

---

## Después de cada prompt, tráeme

Para el cierre (PASO 6) guarda de cada prompt: el reporte final de Claude Code, las preguntas que te
hizo y lo que respondiste, y el resultado de tus verificaciones (✓/✗). Con eso redacto el registro
real de la Bitácora 6. No registraré nada que no me confirmes.
