// /reports loads its code when the route is opened (NFR-11, lazyPage): the page is not part of the main bundle, a failed load
// leaves the shell with the server-error page and a "Try again" that makes a new import(), and the route is listed for
// preloading. Same pattern and same simulation as the audit log (lazyRoutes.test.tsx).
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { preloadPage } from '../../app/router/preloadPage';
import { ReportsPage } from '../../app/router/lazyPages';
import { expectConsoleError } from '../helpers/expectConsoleError';
import { makeReport } from '../helpers/fakeReportsApi';
import { renderReports } from '../helpers/renderReports';

const chunk = vi.hoisted(() => ({ fail: true, imports: 0 }));

vi.mock('../../modules/reports/ReportsPage', async (importOriginal) => {
  chunk.imports += 1;
  if (chunk.fail) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

afterEach(() => {
  chunk.fail = true;
  chunk.imports = 0;
  vi.restoreAllMocks();
});

describe('/reports is a lazy route', () => {
  // The failing load goes first: once the module has loaded, lazyPage keeps it for the rest of the file.
  it('keeps the shell and shows the server-error page with a retry when its code cannot be loaded', async () => {
    const logged = expectConsoleError(
      /ChunkLoadError: The code of the page could not be loaded\./,
      /The above error occurred in the <\w+> component/,
    );
    await renderReports({ reports: [makeReport(1, { title: 'Status' })] });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    const importsBefore = chunk.imports;

    chunk.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Status', level: 3 })).toBeInTheDocument();
    expect(chunk.imports).toBeGreaterThan(importsBefore);
    expect(logged.matched.length).toBeGreaterThan(0);
  });

  it('is listed for preloading and has the lazy page API', async () => {
    chunk.fail = false;
    expect(typeof ReportsPage.preload).toBe('function');
    // Listed in LAZY_ROUTES: preloading by path loads the page module (a failed load would be swallowed, not thrown).
    expect(typeof (await preloadPage('/reports'))).toBe('object');
    expect(typeof (await ReportsPage.preload())).toBe('object');
  });
});
