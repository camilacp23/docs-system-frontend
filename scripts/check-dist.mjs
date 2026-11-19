// Fails when the production build contains code of the /dev pages (src/dev/). Those pages exist only in development:
// `import.meta.env.DEV` folds to false in the build and the dynamic imports of devRoutes.ts are dropped, so none of the
// markers below may appear in the output. They are the names of the /dev components and their route paths, which a
// build that kept the pages does contain (checked against a development-mode build).
// Usage: node scripts/check-dist.mjs [directory]   (default: dist)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKERS = [
  'UiShowcase',
  'DashboardPreview',
  'ReportsPreview',
  'QuickSearchPreview',
  'LazyPreview',
  'MapPreview',
  'MockShell',
  '/dev/ui',
  '/dev/dashboard',
  '/dev/reports',
  '/dev/quick-search',
  '/dev/lazy',
  '/dev/map',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, process.argv[2] ?? 'dist');

function filesOf(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOf(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

let files;
try {
  files = filesOf(target);
} catch {
  console.error(`check:dist — cannot read ${target}; run the build first`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`check:dist — ${target} is empty`);
  process.exit(1);
}

const found = [];
for (const file of files) {
  if (!/\.(js|mjs|css|html|map)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const marker of MARKERS) {
    if (text.includes(marker)) found.push(`${marker}  in  ${file.slice(target.length + 1)}`);
  }
}

if (found.length > 0) {
  console.error('check:dist — the build contains code of the /dev pages:');
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`check:dist — ${files.length} files checked, no /dev page code in ${target}`);
