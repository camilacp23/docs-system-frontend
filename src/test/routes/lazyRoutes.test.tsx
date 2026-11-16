// The lazy routes inside the real shell (NFR-11): /audit, /search and /dependency-map load their page when opened.
// When the code of a page cannot be fetched (the network, or a deploy that removed the old file) the shell stays and the
// page area shows the existing server-error page with "Try again"; the retry makes a new import() and shows the page
// without reloading the document. The failure is simulated by a module factory that throws until the test lets it through.
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderAudit } from '../helpers/renderAudit';
import { expectConsoleError } from '../helpers/expectConsoleError';
import { renderSearch } from '../helpers/renderSearch';

const chunk = vi.hoisted(() => ({ fail: true, imports: 0 }));

vi.mock('../../modules/audit/AuditLogPage', async (importOriginal) => {
  chunk.imports += 1;
  if (chunk.fail) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

afterEach(() => {
  chunk.fail = true;
  chunk.imports = 0;
  vi.restoreAllMocks();
});

describe('a page whose code cannot be loaded', () => {
  it('keeps the shell and shows the server-error page with a retry, then loads the page on retry', async () => {
    const logged = expectConsoleError(
      /ChunkLoadError: The code of the page could not be loaded\./,
      /The above error occurred in the <\w+> component/,
    );
    await renderAudit({ path: '/audit' });

    // The shell is there (sidebar and top bar) and so is the way out: nothing is blank.
    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Quick search' })).toBeInTheDocument();
    const importsBefore = chunk.imports;

    chunk.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Audit log', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
    // A new import was made (not the cached rejection).
    expect(chunk.imports).toBeGreaterThan(importsBefore);
    expect(logged.matched.length).toBeGreaterThan(0);
  });
});

describe('the pages that load fine', () => {
  it('opens /search from the shell without an error', async () => {
    await renderSearch({ path: '/search' });
    expect(await screen.findByRole('searchbox', { name: 'Search text' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong on our side')).not.toBeInTheDocument();
  });
});
