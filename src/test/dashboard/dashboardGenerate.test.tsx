// The "Generate report" button of the dashboard (S-31, flow 5): the same dialog as the reports page (one component), for the
// Administrator and the Developer (also in an archived application, D-47) and never for the Reader; after the 202 it goes to
// /reports with the new report PENDING.
import { screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { makeApplication } from '../helpers/renderApp';
import { renderDashboard } from '../helpers/renderDashboard';
import { setupUser } from '../helpers/setupUser';

// The dialog is loaded when the button is pressed; the module is warmed here so a cold worker is not waited for against the clock.
beforeAll(async () => {
  await import('../../modules/reports/GenerateReportModal');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dashboard: Generate report', () => {
  it('is in the header next to Refresh for the Administrator', async () => {
    await renderDashboard({ role: 'ADMINISTRATOR', reports: {} });
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    const generate = screen.getByRole('button', { name: 'Generate report' });
    expect(generate).toBeEnabled();
    expect(generate.parentElement).toBe(refresh.parentElement);
  });

  it('is there for a Developer', async () => {
    await renderDashboard({ role: 'DEVELOPER', reports: {} });
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeEnabled();
  });

  it('does not appear for the Reader', async () => {
    await renderDashboard({ role: 'READER', reports: {} });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate report' })).not.toBeInTheDocument();
  });

  it('opens the same dialog, and Escape closes it and gives the focus back to the button', async () => {
    const user = setupUser();
    await renderDashboard({ reports: {} });
    const button = screen.getByRole('button', { name: 'Generate report' });

    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Generate report' });
    expect(within(dialog).getByRole('textbox', { name: /Title/ })).toHaveFocus();
    expect(
      within(dialog).getByText("SAR · PDF or Excel of the application's documentation"),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('sends the request, goes to /reports and shows the new report as Generating', async () => {
    const user = setupUser();
    const { router, reportsApi } = await renderDashboard({ reports: {} });
    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Generate report' }));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'SAR documentation status');
    await user.click(dialog.getByRole('button', { name: 'Variables' }));
    await user.click(dialog.getByRole('button', { name: 'Generate' }));

    expect(reportsApi?.callsTo('POST /reports/pdf')).toHaveLength(1);
    expect(reportsApi?.callsTo('POST /reports/pdf')[0]?.options.body).toMatchObject({
      applicationId: 1,
      title: 'SAR documentation status',
    });
    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reports');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'SAR documentation status', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Generating')).toBeInTheDocument();
  });

  it('stays on the dashboard with the dialog open when the API refuses', async () => {
    const user = setupUser();
    const { router } = await renderDashboard({
      reports: {},
      prepare: () => undefined,
    });
    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Generate report' }));

    await user.click(dialog.getByRole('button', { name: 'Generate' }));

    expect(dialog.getByText('2 fields need attention.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('is enabled in an archived application, with the read-only notice on screen', async () => {
    const user = setupUser();
    const { reportsApi } = await renderDashboard({
      reports: {},
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    expect(await screen.findByText('This application is archived.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Generate report' }));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Archived');
    await user.click(dialog.getByRole('button', { name: 'Collections' }));
    await user.click(dialog.getByRole('button', { name: 'Generate' }));

    expect(reportsApi?.callsTo('POST /reports/pdf')).toHaveLength(1);
    expect(await screen.findByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
  });

  it('is off with the reason while offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await renderDashboard({ reports: {} });
    window.dispatchEvent(new Event('offline'));

    const button = await screen.findByRole('button', { name: 'Generate report' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });
});
