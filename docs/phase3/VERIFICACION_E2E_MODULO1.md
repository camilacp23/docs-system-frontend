# Verificación E2E del Módulo 1 (autenticación, sesión y navegación)

Guía para comprobar el Módulo 1 de punta a punta contra el backend real, en **Chrome y Edge actuales**
(NFR-18). Cada paso indica su resultado esperado. La marca de cada paso dice quién lo ejecuta:

- **[AUTO]** lo cubre `npm run e2e:auth` (sección 1). Se ejecutó contra la sandbox del backend; ver el
  registro al final.
- **[MANUAL]** lo hace la autora en el navegador. Los pasos manuales usan la base de desarrollo
  (`docs_system`, backend en `:3000`).

> Si en algún navegador la cookie `rt` **no se guarda** en `http://localhost`, **detente y repórtalo**.
> No se quita el atributo `Secure`.

## 0. Prerrequisitos

| Qué                     | Detalle                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Node                    | `>= 22.22.2` (ver `.nvmrc`)                                                             |
| Backend de desarrollo   | `http://localhost:3000`, con `FRONTEND_ORIGIN=http://localhost:5173` (pasos manuales)   |
| Frontend                | `npm install` y `npm run dev` (Vite en `http://localhost:5173`, puerto estricto)        |
| Chrome y Edge           | Versiones actuales, sin extensiones que modifiquen cookies o cabeceras                  |
| Cuentas en la base dev  | Administrador (la tuya), un Developer y un Reader (sección 3.1)                         |
| Sandbox (solo para AUTO) | Ver sección 1.                                                                          |

## 1. Parte automatizada (`npm run e2e:auth`)

Usa la **sandbox del backend** (base aislada `docs_sandbox`; nunca toca `docs_system` ni usa tus
credenciales) a través del proxy de Vite.

### 1.1 Levantar

En `docs-system-backend` (necesita su `.env` de desarrollo para el host y el rol `docs_app` de PostgreSQL):

```bash
npm run sandbox:db     # recrea y siembra docs_sandbox; escribe la credencial en un archivo ignorado por git
npm run sandbox:api    # API en http://localhost:3001 (primer plano)
```

En `docs-system-frontend`, en otra terminal:

```bash
API_PROXY_TARGET=http://localhost:3001 npm run dev    # PowerShell: $env:API_PROXY_TARGET='http://localhost:3001'; npm run dev
```

En una tercera terminal:

```bash
npm run e2e:auth
```

El script lee la contraseña del administrador de la sandbox del archivo
`../docs-system-backend/bruno/docs-system-api/.env` (otra ruta: variable `SANDBOX_ENV_FILE`). **Nunca
imprime tokens ni valores de cookies**: solo atributos y estados.

### 1.2 Detener

- `Ctrl+C` en la terminal de cada proceso (`sandbox:api` y `dev`).
- Si los lanzaste en segundo plano, detenlos **por PID**, no por nombre (hay otros procesos Node, p. ej. el
  backend de desarrollo):
  - PowerShell: `Stop-Process -Id <PID>`
  - Git Bash: `taskkill //PID <PID> //F`
  - Para encontrar el PID del puerto: `Get-NetTCPConnection -LocalPort 3001,5173 -State Listen | Select OwningProcess`
- Opcional: `npm run sandbox:db -- --drop` en el backend elimina `docs_sandbox`.

### 1.3 Qué comprueba

| #   | Comprobación                                                                                             | Resultado esperado                                  |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A1  | `POST /auth/login`                                                                                       | 200; cuerpo con `accessToken`; `sessionExpiresIn` ≈ 43200 s |
| A2  | Atributos de `Set-Cookie` de `rt`                                                                        | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`, con expiración |
| A3  | El valor de `rt` no es el access token                                                                   | Distintos                                           |
| A4  | `POST /auth/refresh` con `Origin: http://localhost:5173`                                                 | 200; cookie rotada con los mismos atributos; nuevo access token |
| A5  | `POST /auth/refresh` con otro `Origin` y sin `Origin`; `POST /auth/logout` con otro `Origin`             | 403 en los tres                                     |
| A6  | Dos refresh simultáneos con la misma cookie (R-4, lado servidor)                                         | Uno 200 y otro 401 `REFRESH_INVALID`                |
| A7  | Después de A6, refresh con la cookie nueva                                                               | 401 (sesión revocada)                               |
| A8  | `POST /auth/logout` con `Origin` correcto                                                                | 204 y la cookie se borra                            |
| A9  | Refresh con la cookie anterior al logout                                                                 | 401 `REFRESH_INVALID`                               |

Cualquier otro resultado es un fallo (el script termina con código 1).

## 2. Lo que solo se puede ver en el navegador

El script comprueba el servidor con las mismas reglas de `Origin` y cookie, pero no puede ver DevTools, el
almacenamiento del navegador ni las pestañas: eso queda en los pasos manuales M2 a M8.

## 3. Parte manual (Chrome y luego Edge)

Repite toda la sección en cada navegador. Usa una ventana normal (no InPrivate) y limpia las cookies de
`localhost` antes de empezar.

### 3.1 Preparar usuarios y una aplicación archivada en la base de desarrollo

La contraseña se lee con `read -s`: **no queda escrita en el comando ni en el historial**. Ejecuta en Git
Bash, con el backend de desarrollo en `:3000`. Las contraseñas deben tener 12–128 caracteres con letras y
dígitos.

```bash
API=http://localhost:3000/api/v1
read -r -p "Admin e-mail: " ADMIN_EMAIL
read -r -s -p "Admin password: " ADMIN_PWD; echo

# Access token del administrador (se guarda solo en esta variable de shell; no se imprime)
TOKEN=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PWD" \
  | curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' --data @- \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data.accessToken))')
unset ADMIN_PWD
[ -n "$TOKEN" ] && echo "login OK" || echo "login failed"

# Developer
read -r -s -p "Password for the Developer: " DEV_PWD; echo
printf '{"name":"E2E Developer","email":"e2e.developer@dept.local","password":"%s","role":"DEVELOPER"}' "$DEV_PWD" \
  | curl -s -o /dev/null -w "developer: HTTP %{http_code}\n" -X POST "$API/users" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data @-
unset DEV_PWD

# Reader
read -r -s -p "Password for the Reader: " RDR_PWD; echo
printf '{"name":"E2E Reader","email":"e2e.reader@dept.local","password":"%s","role":"READER"}' "$RDR_PWD" \
  | curl -s -o /dev/null -w "reader: HTTP %{http_code}\n" -X POST "$API/users" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data @-
unset RDR_PWD
```

Resultado esperado: `login OK`, `developer: HTTP 201`, `reader: HTTP 201` (409 si ya existen: no es un
problema).

Aplicación para el paso de Unarchive. Se crea con descripción y proyecto de Jira, y se archiva:

```bash
# Crear (guarda el id)
APP_ID=$(curl -s -X POST "$API/applications" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"E2E Archived App","platform":"Web","description":"Description that must survive Unarchive","jiraProjectKey":"E2EKEY"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).data.id)))')
echo "app id: $APP_ID"

# Archivar: PUT con If-Match (ETag actual) y el estado ARCHIVED, conservando los demás campos
ETAG=$(curl -s -D - -o /dev/null "$API/applications/$APP_ID" -H "Authorization: Bearer $TOKEN" | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
curl -s -o /dev/null -w "archive: HTTP %{http_code}\n" -X PUT "$API/applications/$APP_ID" \
  -H "Authorization: Bearer $TOKEN" -H "If-Match: $ETAG" -H 'Content-Type: application/json' \
  -d '{"name":"E2E Archived App","platform":"Web","description":"Description that must survive Unarchive","jiraProjectKey":"E2EKEY","status":"ARCHIVED"}'
unset TOKEN
```

Resultado esperado: `archive: HTTP 200`. Si el `PUT` respondiera 400/422 por el campo `status`, repórtalo (la
interfaz de Unarchive envía el mismo cuerpo con `status: "ACTIVE"`).

### 3.2 Pasos

| #   | Pasos                                                                                                                                                      | Resultado esperado                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Abre `http://localhost:5173`. Inicia sesión como **Administrator**.                                                                                         | Llega a `/dashboard` con la barra lateral y el nombre y rol en la barra superior.                                                                              |
| M2  | DevTools (`F12`) → **Application** → **Cookies** → `http://localhost:5173`. Busca `rt`.                                                                     | Existe `rt` con **HttpOnly ✔**, **Secure ✔**, **SameSite = Strict**, **Path = `/api/v1/auth`** y expiración ≈ 12 h. **Si no aparece, detente y repórtalo.**    |
| M3  | **Application** → **Local storage** y **Session storage** de `http://localhost:5173`; además, en la consola: `Object.keys(localStorage)`, `Object.keys(sessionStorage)`, `document.cookie`. | Ningún token (ni access ni refresh) en ningún almacenamiento. `document.cookie` **no** muestra `rt` (HttpOnly). No hay IndexedDB con tokens.                    |
| M4  | **Network** → marca *Preserve log* → recarga la página (`F5`). Selecciona la solicitud `POST …/api/v1/auth/refresh` → **Headers**.                          | **Request Headers** incluye `Origin: http://localhost:5173`; **Status 200** (no 403). La respuesta trae `Set-Cookie` con `rt` rotada (en *Cookies* de la solicitud aparece la nueva). |
| M5  | Tras la recarga, observa la pantalla.                                                                                                                      | La sesión **se mantiene** (sigues en la misma ruta, sin ir a `/login`).                                                                                        |
| M6  | Abre una **segunda pestaña** con `http://localhost:5173` (ya con sesión). Con ambas abiertas, recárgalas **a la vez** (`F5` en una y enseguida en la otra). | Ambas conservan la sesión (R-4: como máximo un refresh en vuelo entre pestañas). En *Network* de cada una, los refresh no devuelven 401; no aparece el diálogo de sesión terminada. |
| M7  | En la pestaña A, abre el menú del usuario → **Sign out**.                                                                                                  | La pestaña A va a `/login`. La pestaña B también queda sin sesión y es redirigida a `/login` (el aviso "Your session ended" no aparece tras un cierre voluntario). En *Cookies*, `rt` desaparece.    |
| M8  | Intenta volver con "Atrás" o recarga la pestaña B.                                                                                                         | No recupera la sesión; queda en `/login`.                                                                                                                      |
| M9  | Inicia sesión como **Developer** (`e2e.developer@dept.local`). Cuenta los ítems de la barra lateral.                                                        | **10 ítems**: Dashboard; Screens, Variables, Collections, Dependency map; Advanced search, Reports, Onboarding; Review, Audit log. Sin sección Administration. |
| M10 | Cierra sesión. Inicia sesión como **Reader** (`e2e.reader@dept.local`). Cuenta los ítems.                                                                   | **8 ítems**: los mismos que Developer **sin** Review ni Audit log.                                                                                             |
| M11 | Como **Reader**, escribe en la barra de direcciones `http://localhost:5173/admin/users`.                                                                    | Pantalla de **acceso denegado** dentro del shell (`S-41b`): menciona el rol actual (Reader) y ofrece volver al inicio. No se carga ninguna lista de usuarios.    |
| M12 | Cierra sesión e inicia como **Administrator**. Selecciona la aplicación **E2E Archived App** (tarjeta de aplicación en la parte superior de la barra lateral).               | Aparece la franja **"This application is archived."** con el texto "Its documentation is read-only." y el botón **Unarchive**.                                 |
| M13 | Pulsa **Unarchive**.                                                                                                                                       | La franja desaparece (la aplicación pasa a Active). En *Network*: `GET /applications/{id}` y `PUT /applications/{id}` con `If-Match`; el `PUT` envía el cuerpo completo (name, platform, description, jiraProjectKey) más `status: "ACTIVE"` y responde 200. |
| M14 | Verifica que no se perdieron datos: en DevTools → *Network* → `GET /api/v1/applications/<id>` (o `curl` con tu token) y revisa la respuesta.               | `description` = "Description that must survive Unarchive" y `jiraProjectKey` = "E2EKEY" **siguen presentes**, con `status` = `ACTIVE`.                          |
| M15 | (Opcional) Pon el navegador en modo sin conexión (*Network* → *Offline*).                                                                                    | Aparece la franja "You're offline." con "Changes can't be saved until the connection is back."; al volver en línea, desaparece.                                |

### 3.3 Limpieza

- Las cuentas `e2e.*@dept.local` y la aplicación "E2E Archived App" quedan en tu base de desarrollo. Elimínalas
  o desactívalas desde la administración cuando existan esas pantallas, o déjalas si te sirven para pruebas.
- Borra las cookies de `localhost` al terminar.

## 4. Registro de ejecución

### 4.1 Parte automatizada

| Fecha      | Entorno                                                    | Resultado                                |
| ---------- | ---------------------------------------------------------- | ---------------------------------------- |
| 2026-10-23 | Sandbox del backend `:3001`, Vite `:5173` con proxy, Node 22.23.3 | **21/21 comprobaciones correctas** (A1–A9) |

### 4.2 Parte manual (a completar por la autora)

| Paso   | Chrome (versión) | Edge (versión) | Observaciones |
| ------ | ---------------- | -------------- | ------------- |
| M1–M2  | ☐                | ☐              |               |
| M3     | ☐                | ☐              |               |
| M4     | ☐                | ☐              |               |
| M5     | ☐                | ☐              |               |
| M6     | ☐                | ☐              |               |
| M7–M8  | ☐                | ☐              |               |
| M9     | ☐                | ☐              |               |
| M10    | ☐                | ☐              |               |
| M11    | ☐                | ☐              |               |
| M12–M14 | ☐               | ☐              |               |
| M15    | ☐                | ☐              |               |
