// Automated part of docs/phase3/VERIFICACION_E2E_MODULO1.md: checks the session endpoints through the
// Vite proxy (http://localhost:5173 -> sandbox API on :3001). It checks the Set-Cookie attributes of `rt`,
// the Origin rule on refresh/logout, token rotation, the concurrent-refresh outcome (R-4, server side) and
// logout. It never prints tokens or cookie values.
//
// Prerequisites: sandbox API on :3001 (`npm run sandbox:db`, `npm run sandbox:api` in the backend) and
// `API_PROXY_TARGET=http://localhost:3001 npm run dev` here. Credentials of the sandbox administrator are
// read from the git-ignored file written by `sandbox:db` (override the path with SANDBOX_ENV_FILE).
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:5173');
const ORIGIN = 'http://localhost:5173';
const FOREIGN_ORIGIN = 'http://evil.example';
const ENV_FILE =
  process.env.SANDBOX_ENV_FILE ??
  resolve(root, '../docs-system-backend/bruno/docs-system-api/.env');

const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function readCredentials() {
  const values = Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  const email = values.SANDBOX_ADMIN_EMAIL;
  const password = values.SANDBOX_ADMIN_PASSWORD;
  if (!email || !password) throw new Error(`SANDBOX_ADMIN_EMAIL/PASSWORD missing in ${ENV_FILE}`);
  return { email, password };
}

// node:http (not fetch) so that `Origin` can be set freely and Set-Cookie arrives as a list.
function send(method, path, { origin, cookie, token, body } = {}) {
  return new Promise((resolveResponse, reject) => {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = request(
      { hostname: BASE.hostname, port: BASE.port, path: `/api/v1${path}`, method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            // non-JSON body: leave json null
          }
          resolveResponse({
            status: res.statusCode ?? 0,
            setCookie: res.headers['set-cookie'] ?? [],
            json,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// "rt=<value>; Path=...; HttpOnly" -> { value, attrs: Map(lowercase name -> value) }
function parseRt(setCookie) {
  const line = setCookie.find((c) => c.startsWith('rt='));
  if (!line) return null;
  const [pair, ...rest] = line.split(';').map((part) => part.trim());
  const attrs = new Map(
    rest.map((part) => {
      const i = part.indexOf('=');
      return i === -1
        ? [part.toLowerCase(), '']
        : [part.slice(0, i).toLowerCase(), part.slice(i + 1)];
    }),
  );
  return { value: pair.slice(3), attrs };
}

const cookieHeader = (rt) => `rt=${rt.value}`;
const errorCode = (res) => res.json?.code ?? 'none';

async function login(creds) {
  const res = await send('POST', '/auth/login', { body: creds });
  return { res, rt: parseRt(res.setCookie) };
}

async function main() {
  const creds = readCredentials();

  // 1. Login and cookie attributes
  const { res: loginRes, rt: rt1 } = await login(creds);
  check('login returns 200', loginRes.status === 200, `status ${loginRes.status}`);
  if (loginRes.status !== 200 || !rt1) {
    check('login sets the rt cookie', false);
    return;
  }
  const token1 = loginRes.json?.data?.accessToken;
  check('login body carries an access token', typeof token1 === 'string' && token1.length > 20);
  check('rt is HttpOnly', rt1.attrs.has('httponly'));
  check('rt is Secure', rt1.attrs.has('secure'));
  check('rt is SameSite=Strict', rt1.attrs.get('samesite')?.toLowerCase() === 'strict');
  check(
    'rt Path=/api/v1/auth',
    rt1.attrs.get('path') === '/api/v1/auth',
    `path ${rt1.attrs.get('path')}`,
  );
  check('rt expires with the session', rt1.attrs.has('expires') || rt1.attrs.has('max-age'));
  check('rt value is not the access token', rt1.value !== token1);
  const sessionExpiresIn = loginRes.json?.data?.sessionExpiresIn;
  check(
    'sessionExpiresIn is close to 12 h',
    Number.isInteger(sessionExpiresIn) && sessionExpiresIn > 43000 && sessionExpiresIn <= 43200,
    `${sessionExpiresIn} s`,
  );

  // 2. Refresh with the allowed Origin: 200 and rotation
  const refresh1 = await send('POST', '/auth/refresh', {
    origin: ORIGIN,
    cookie: cookieHeader(rt1),
  });
  const rt2 = parseRt(refresh1.setCookie);
  check(
    'refresh with Origin http://localhost:5173 returns 200',
    refresh1.status === 200,
    `status ${refresh1.status}`,
  );
  if (refresh1.status !== 200 || !rt2) {
    check('refresh rotates the rt cookie', false);
    return;
  }
  check('refresh rotates the rt cookie', rt2.value !== rt1.value);
  check(
    'rotated cookie keeps the attributes',
    rt2.attrs.has('httponly') &&
      rt2.attrs.has('secure') &&
      rt2.attrs.get('samesite')?.toLowerCase() === 'strict' &&
      rt2.attrs.get('path') === '/api/v1/auth',
  );
  check(
    'refresh returns a new access token and a decreasing session end',
    typeof refresh1.json?.data?.accessToken === 'string' &&
      refresh1.json.data.sessionExpiresIn <= sessionExpiresIn,
  );

  // 3. Origin rule (rejections must not consume the cookie)
  const foreign = await send('POST', '/auth/refresh', {
    origin: FOREIGN_ORIGIN,
    cookie: cookieHeader(rt2),
  });
  check(
    'refresh with a foreign Origin returns 403',
    foreign.status === 403,
    `status ${foreign.status}`,
  );
  const noOrigin = await send('POST', '/auth/refresh', { cookie: cookieHeader(rt2) });
  check('refresh without Origin returns 403', noOrigin.status === 403, `status ${noOrigin.status}`);
  const logoutForeign = await send('POST', '/auth/logout', {
    origin: FOREIGN_ORIGIN,
    cookie: cookieHeader(rt2),
  });
  check(
    'logout with a foreign Origin returns 403',
    logoutForeign.status === 403,
    `status ${logoutForeign.status}`,
  );

  // 4. Concurrent refresh with the same cookie: exactly one 200 and one 401 REFRESH_INVALID (R-4, server side)
  const [a, b] = await Promise.all([
    send('POST', '/auth/refresh', { origin: ORIGIN, cookie: cookieHeader(rt2) }),
    send('POST', '/auth/refresh', { origin: ORIGIN, cookie: cookieHeader(rt2) }),
  ]);
  const statuses = [a.status, b.status].sort((x, y) => x - y);
  const winner = a.status === 200 ? a : b.status === 200 ? b : null;
  const loser = winner === a ? b : a;
  check(
    'concurrent refresh with one cookie: one 200 and one 401 REFRESH_INVALID',
    statuses[0] === 200 && statuses[1] === 401 && errorCode(loser) === 'REFRESH_INVALID',
    `statuses ${statuses.join('/')}, loser code ${errorCode(loser)}`,
  );
  const rt3 = winner ? parseRt(winner.setCookie) : null;
  if (rt3) {
    const afterReuse = await send('POST', '/auth/refresh', {
      origin: ORIGIN,
      cookie: cookieHeader(rt3),
    });
    check(
      'after the reuse, the new cookie also returns 401 (session revoked)',
      afterReuse.status === 401,
      `status ${afterReuse.status}, code ${errorCode(afterReuse)}`,
    );
  } else {
    check(
      'after the reuse, the new cookie also returns 401 (session revoked)',
      false,
      'no winner cookie',
    );
  }

  // 5. Logout invalidates the session
  const { rt: rtOut, res: loginOut } = await login(creds);
  if (!rtOut) {
    check('logout scenario: login', false, `status ${loginOut.status}`);
    return;
  }
  const out = await send('POST', '/auth/logout', { origin: ORIGIN, cookie: cookieHeader(rtOut) });
  check('logout with Origin returns 204', out.status === 204, `status ${out.status}`);
  const cleared = parseRt(out.setCookie);
  check(
    'logout clears the cookie',
    cleared !== null &&
      (cleared.value === '' || cleared.attrs.has('max-age') || cleared.attrs.has('expires')),
  );
  const afterLogout = await send('POST', '/auth/refresh', {
    origin: ORIGIN,
    cookie: cookieHeader(rtOut),
  });
  check(
    'refresh after logout returns 401',
    afterLogout.status === 401,
    `status ${afterLogout.status}, code ${errorCode(afterLogout)}`,
  );
}

try {
  await main();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  console.error(`\nCould not run the checks: ${code} ${reason}`.trimEnd());
  console.error(
    'Is the sandbox API on :3001 and Vite running with API_PROXY_TARGET=http://localhost:3001? See README.',
  );
  process.exitCode = 2;
}

if (results.length > 0) {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}
