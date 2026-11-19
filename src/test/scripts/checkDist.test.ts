// scripts/check-dist.mjs (npm run check:dist): the step of the CI that fails when the production build contains code of the
// /dev pages. It runs on fake build folders: one clean, one with the markers (as a development-mode build has them), an
// empty one and a missing one.
import { afterAll, describe, expect, it } from 'vitest';

// The app's tsconfig has no Node types: Node comes through a typed view of the runtime.
const runtime = globalThis as unknown as {
  process: { getBuiltinModule: (id: string) => unknown; cwd: () => string };
};
const fs = runtime.process.getBuiltinModule('node:fs') as {
  mkdtempSync: (prefix: string) => string;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  writeFileSync: (path: string, text: string) => void;
  rmSync: (path: string, options: { recursive: boolean; force: boolean }) => void;
};
const os = runtime.process.getBuiltinModule('node:os') as { tmpdir: () => string };
const childProcess = runtime.process.getBuiltinModule('node:child_process') as {
  spawnSync: (
    command: string,
    args: string[],
    options: { encoding: 'utf8' },
  ) => { status: number | null; stdout: string; stderr: string };
};

const workDir = fs.mkdtempSync(`${os.tmpdir()}/check-dist-`);
afterAll(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

function fakeDist(name: string, files: Record<string, string>): string {
  const dir = `${workDir}/${name}`;
  fs.mkdirSync(`${dir}/assets`, { recursive: true });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(`${dir}/${file}`, text);
  return dir;
}

function check(dir: string) {
  return childProcess.spawnSync('node', [`${runtime.process.cwd()}/scripts/check-dist.mjs`, dir], {
    encoding: 'utf8',
  });
}

describe('check:dist', () => {
  it('passes on a build without /dev page code', () => {
    const dir = fakeDist('clean', {
      'index.html': '<div id="root"></div>',
      'assets/index-abc.js': 'export const route = "/variables"; function Dashboard() {}',
    });
    const result = check(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no /dev page code');
  });

  it('fails and names the marker and the file when a /dev component is in the build', () => {
    const dir = fakeDist('component', {
      'index.html': '<div id="root"></div>',
      'assets/MapPreview-x1.js': 'export function MapPreview() {}',
    });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('MapPreview');
    expect(result.stderr).toContain('MapPreview-x1.js');
  });

  it('fails when only a /dev route path is in the build', () => {
    const dir = fakeDist('path', { 'assets/index-abc.js': 'path:"/dev/quick-search"' });
    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('/dev/quick-search');
  });

  it('fails when the folder is missing or empty', () => {
    expect(check(`${workDir}/missing`).status).toBe(1);
    fs.mkdirSync(`${workDir}/empty`, { recursive: true });
    expect(check(`${workDir}/empty`).status).toBe(1);
  });
});
