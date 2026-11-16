// The generate dialog is code of the reports page and the dashboard loads it when "Generate report" is pressed (so the main
// bundle does not carry it). When that code cannot be fetched the dashboard stays as it was and a warning toast says so; a
// second press tries again.
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderDashboard } from '../helpers/renderDashboard';
import { setupUser } from '../helpers/setupUser';

const chunk = vi.hoisted(() => ({ fail: true, imports: 0 }));

vi.mock('../../modules/reports/GenerateReportModal', async (importOriginal) => {
  chunk.imports += 1;
  if (chunk.fail) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

afterEach(() => {
  chunk.fail = true;
  chunk.imports = 0;
  vi.restoreAllMocks();
});

describe('dashboard: the dialog code cannot be loaded', () => {
  it('shows a warning toast, keeps the page, and opens the dialog on the next press', async () => {
    const user = setupUser();
    await renderDashboard({ reports: {} });

    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(
      await screen.findByText(
        "The dialog couldn't be opened. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeEnabled();

    chunk.fail = false;
    await user.click(screen.getByRole('button', { name: 'Generate report' }));

    expect(await screen.findByRole('dialog', { name: 'Generate report' })).toBeInTheDocument();
    expect(chunk.imports).toBeGreaterThan(1);
  });
});
