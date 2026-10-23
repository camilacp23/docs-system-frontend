// Verifies src/api/schema.d.ts is up to date with contract/openapi.yaml. Regenerates into a temporary
// directory and fails on any difference. Does not depend on the backend repository, so it runs in CI.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'contract-check-'));
const generated = join(tmp, 'schema.d.ts');

try {
  const cli = resolve(root, 'node_modules/openapi-typescript/bin/cli.js');
  execFileSync(process.execPath, [cli, 'contract/openapi.yaml', '-o', generated], {
    cwd: root,
    stdio: 'pipe',
  });
  const normalize = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (normalize(generated) !== normalize(resolve(root, 'src/api/schema.d.ts'))) {
    console.error(
      'contract:check — src/api/schema.d.ts is out of date; run `npm run contract:types`',
    );
    process.exitCode = 1;
  } else {
    console.log('contract:check — src/api/schema.d.ts matches contract/openapi.yaml');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
