// The generate dialog (S-34, flow 5; FR-22, D-115, D-134, D-139, D-140): the form, what it makes impossible, the request it
// sends, the 202 (the dialog closes and the new report is on screen as PENDING, P-05), the 400 and 404 of the API shown in
// their field with the position, the archived application (generating stays allowed, D-47) and the accessibility of the dialog.
import { act, screen, within, type BoundFunctions, type queries } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { makeFailed, makeReport } from '../helpers/fakeReportsApi';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { renderReports } from '../helpers/renderReports';
import { controlSearchTimers } from '../helpers/searchPause';
import { setupUser } from '../helpers/setupUser';

type Scoped = BoundFunctions<typeof queries>;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const openDialog = async (user: ReturnType<typeof setupUser>) => {
  await user.click(await screen.findByRole('button', { name: 'Generate report' }));
  return screen.getByRole('dialog', { name: 'Generate report' });
};
const chip = (dialog: Scoped, name: string) => dialog.getByRole('button', { name });

describe('generate dialog: the form', () => {
  it('opens with the title, the format cards, the chips, the options and the footer of the frame', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });

    const dialog = within(await openDialog(user));

    expect(
      dialog.getByText("SAR · PDF or Excel of the application's documentation"),
    ).toBeInTheDocument();
    expect(dialog.getByRole('textbox', { name: /Title/ })).toHaveFocus();
    expect(dialog.getByRole('radiogroup', { name: /Format/ })).toBeInTheDocument();
    expect(dialog.getByRole('radio', { name: /PDF/ })).toBeChecked();
    expect(dialog.getByRole('radio', { name: /Excel/ })).not.toBeChecked();
    expect(dialog.getByText('Formatted document to read and share')).toBeInTheDocument();
    for (const name of ['Screens', 'Variables', 'Collections', 'Components']) {
      expect(chip(dialog, name)).toHaveAttribute('aria-pressed', 'false');
    }
    for (const name of ['Undocumented', 'Draft', 'In progress', 'In review', 'Approved']) {
      expect(chip(dialog, name)).toBeDisabled();
    }
    expect(dialog.getByRole('switch', { name: 'Include status summary' })).not.toBeChecked();
    expect(dialog.getByRole('switch', { name: 'Include dependencies' })).not.toBeChecked();
    expect(dialog.getByRole('switch', { name: 'Publish when ready' })).not.toBeChecked();
    expect(dialog.getByText('0/200')).toBeInTheDocument();
    expect(dialog.getByText('Nothing selected yet', { exact: false })).toBeInTheDocument();
    expect(dialog.getByText('Built in the background — you can keep working.')).toBeInTheDocument();
  });

  it('sums up the choice like the frame: "PDF · Screens, Variables · all statuses · with dependencies"', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));

    await user.click(chip(dialog, 'Screens'));
    await user.click(chip(dialog, 'Variables'));
    await user.click(dialog.getByRole('switch', { name: 'Include dependencies' }));

    expect(
      dialog.getByText('PDF · Screens, Variables · all statuses · with dependencies'),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: /Excel/ }));
    await user.click(chip(dialog, 'Approved'));
    expect(
      dialog.getByText('Excel · Screens, Variables · Approved · with dependencies'),
    ).toBeInTheDocument();
  });

  it('counts the characters of the title and stops at 200', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));
    const title = dialog.getByRole('textbox', { name: /Title/ });

    await user.type(title, 'SAR documentation status');

    expect(dialog.getByText('24/200')).toBeInTheDocument();
    expect(title).toHaveAttribute('maxlength', '200');
  });

  it('turns the status chips and the screen selector on only with Screens or Components, and clears them when they go', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [],
      screens: [makeScreenDetail(21, 'Inicio'), makeScreenDetail(22, 'Detalle')],
    });
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Only variables');

    await user.click(chip(dialog, 'Variables'));
    expect(chip(dialog, 'Approved')).toBeDisabled();
    expect(dialog.getByRole('button', { name: /All screens/ })).toBeDisabled();
    // The status filter and the screen selector both say why they are off.
    expect(dialog.getAllByText('Applies when Screens or Components is included.')).toHaveLength(2);

    await user.click(chip(dialog, 'Components'));
    expect(chip(dialog, 'Approved')).toBeEnabled();
    expect(dialog.getByRole('button', { name: /All screens/ })).toBeEnabled();
    await user.click(chip(dialog, 'Approved'));
    await user.click(dialog.getByRole('button', { name: /All screens/ }));
    await user.click(await dialog.findByRole('checkbox', { name: 'Inicio' }));
    expect(dialog.getByRole('button', { name: /1 screen selected/ })).toBeInTheDocument();

    // Without Screens and Components the filter and the selection go, and the request sends neither.
    await user.click(chip(dialog, 'Components'));
    expect(chip(dialog, 'Approved')).toBeDisabled();
    expect(dialog.getByRole('button', { name: /All screens/ })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(api.callsTo('POST /reports/pdf')[0]?.options.body).toEqual({
      applicationId: 1,
      title: 'Only variables',
      scope: {
        elementTypes: ['VARIABLE'],
        includeStatusSummary: false,
        includeDependencies: false,
      },
      publish: false,
    });
  });
});

describe('generate dialog: what it sends', () => {
  it('sends a PDF request with the chosen scope, closes, and shows the new PENDING report first (P-05)', async () => {
    const user = setupUser();
    const { api, router } = await renderReports({
      reports: [makeReport(3, { title: 'Old one' })],
      path: '/reports?published=true&page=1',
    });
    const dialog = within(await openDialog(user));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'SAR documentation status');
    await user.click(chip(dialog, 'Variables'));
    await user.click(chip(dialog, 'Screens'));
    await user.click(dialog.getByRole('switch', { name: 'Include dependencies' }));
    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    const posts = api.callsTo('POST /reports/pdf');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.options.body).toEqual({
      applicationId: 1,
      title: 'SAR documentation status',
      scope: {
        elementTypes: ['SCREEN', 'VARIABLE'],
        includeStatusSummary: false,
        includeDependencies: true,
      },
      publish: false,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // All reports, first page: the new report shows although the Published filter was on.
    const first = (await screen.findAllByRole('heading', { level: 3 }))[0];
    expect(first).toHaveTextContent('SAR documentation status');
    expect(screen.getByText('Generating')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('sends Excel with the statuses in order, "publish when ready" and the title as typed', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), '  Status  ');
    await user.click(dialog.getByRole('radio', { name: /Excel/ }));
    await user.click(chip(dialog, 'Components'));
    await user.click(chip(dialog, 'Approved'));
    await user.click(chip(dialog, 'Draft'));
    await user.click(dialog.getByRole('switch', { name: 'Publish when ready' }));
    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(api.callsTo('POST /reports/pdf')).toHaveLength(0);
    expect(api.callsTo('POST /reports/excel')[0]?.options.body).toEqual({
      applicationId: 1,
      title: '  Status  ',
      scope: {
        elementTypes: ['COMPONENT'],
        includeStatusSummary: false,
        includeDependencies: false,
        documentationStatus: ['DRAFT', 'APPROVED'],
      },
      publish: true,
    });
  });

  it('accepts no element type when only the status summary is included (D-115)', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Overall status');
    await user.click(dialog.getByRole('switch', { name: 'Include status summary' }));
    expect(dialog.getByText('PDF · Status summary', { exact: false })).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(api.callsTo('POST /reports/pdf')[0]?.options.body).toMatchObject({
      scope: { elementTypes: [], includeStatusSummary: true },
    });
  });

  it('sends the screens that were chosen, in the order they were chosen', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [],
      screens: [makeScreenDetail(21, 'Inicio'), makeScreenDetail(22, 'Detalle')],
    });
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Two screens');
    await user.click(chip(dialog, 'Screens'));
    await user.click(dialog.getByRole('button', { name: /All screens/ }));
    await user.click(await dialog.findByRole('checkbox', { name: 'Detalle' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Inicio' }));

    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(api.callsTo('POST /reports/pdf')[0]?.options.body).toMatchObject({
      scope: { elementTypes: ['SCREEN'], screenIds: [22, 21] },
    });
  });

  it('starts following the new report: it is asked for every 3 seconds until it is ready', async () => {
    // The clock follows the real one (so user-event works) and is advanced by hand for the polling.
    controlSearchTimers();
    const user = setupUser();
    const { api } = await renderReports({ reports: [makeFailed(2, { title: 'Older' })] });
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Follow me');
    await user.click(chip(dialog, 'Variables'));
    await user.click(dialog.getByRole('button', { name: 'Create report' }));
    expect(await screen.findByText('Generating')).toBeInTheDocument();
    const created = api.state.nextId - 1;
    api.settle(created, 'READY');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(api.callsTo('GET /reports/{id}').map((call) => call.options.path?.id)).toContain(
      created,
    );
    expect(screen.queryByText('Generating')).not.toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});

describe('generate dialog: what it refuses before asking', () => {
  it('says what is missing, summarizes it with links, focuses the first field and sends nothing', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));

    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(dialog.getByText('2 fields need attention.')).toBeInTheDocument();
    const title = dialog.getByRole('textbox', { name: /Title/ });
    expect(title).toHaveFocus();
    expect(title).toBeInvalid();
    expect(title).toHaveAccessibleDescription(/Title is required\./);
    const include = dialog.getByRole('group', { name: /Include/ });
    expect(include).toHaveAttribute('aria-invalid', 'true');
    expect(include).toHaveAccessibleDescription(
      'Choose at least one element, or include the status summary.',
    );
    expect(api.callsTo('POST /reports/pdf')).toHaveLength(0);

    await user.click(dialog.getByRole('button', { name: 'Include' }));
    expect(chip(dialog, 'Screens')).toHaveFocus();
  });

  it('does not accept a title of only spaces', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), '   ');
    await user.click(chip(dialog, 'Variables'));

    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(dialog.getByText('Title is required.')).toBeInTheDocument();
    expect(api.callsTo('POST /reports/pdf')).toHaveLength(0);
  });

  it('clears the message of a field when that field changes', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));
    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'x');
    await user.click(chip(dialog, 'Collections'));

    expect(dialog.queryByText('Title is required.')).not.toBeInTheDocument();
    expect(dialog.queryByText(/Choose at least one element/)).not.toBeInTheDocument();
  });
});

describe('generate dialog: what the API refuses (400 and 404)', () => {
  async function submitWith(
    failure: ApiError,
    fill?: (dialog: Scoped, user: ReturnType<typeof setupUser>) => Promise<void>,
  ) {
    const user = setupUser();
    const view = await renderReports({
      reports: [],
      screens: [makeScreenDetail(21, 'Inicio'), makeScreenDetail(22, 'Detalle')],
      prepare: (api) => {
        api.failNext('POST /reports/pdf', failure);
      },
    });
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Whatever');
    await user.click(chip(dialog, 'Screens'));
    await fill?.(dialog, user);
    await user.click(dialog.getByRole('button', { name: 'Create report' }));
    return { dialog, user, ...view };
  }

  const pickTwo = async (dialog: Scoped, user: ReturnType<typeof setupUser>) => {
    await user.click(dialog.getByRole('button', { name: /All screens/ }));
    await user.click(await dialog.findByRole('checkbox', { name: 'Inicio' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Detalle' }));
  };

  it('puts a 400 in its field with the position: the second screen, marked, and the title', async () => {
    const { dialog, api } = await submitWith(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [
            { field: 'scope.screenIds[1]', rule: 'unique', message: 'server text' },
            { field: 'title', rule: 'maxLength', message: 'server text' },
          ],
        },
      }),
      pickTwo,
    );

    expect(api.callsTo('POST /reports/pdf')).toHaveLength(1);
    expect(
      await dialog.findByText('Screens has repeated values. Each one must be unique.'),
    ).toBeInTheDocument();
    expect(dialog.getByText('Title is too long.')).toBeInTheDocument();
    expect(dialog.getByText('2 fields need attention.')).toBeInTheDocument();
    const selected = within(dialog.getByRole('list', { name: 'Selected screens' }));
    const [first, second] = selected.getAllByRole('listitem');
    expect(second).toHaveClass('border-danger');
    expect(first).not.toHaveClass('border-danger');
    // The dialog stays open and what was typed is kept.
    expect(screen.getByRole('dialog', { name: 'Generate report' })).toBeInTheDocument();
    expect(dialog.getByRole('textbox', { name: /Title/ })).toHaveValue('Whatever');
    expect(screen.queryByText('server text')).not.toBeInTheDocument();
  });

  it('marks the status of its position and uses the notApplicable text', async () => {
    const { dialog } = await submitWith(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [
            {
              field: 'scope.documentationStatus[0]',
              rule: 'notApplicable',
              message: 'server text',
            },
          ],
        },
      }),
      async (d, user) => {
        await user.click(chip(d, 'Draft'));
      },
    );

    expect(
      await dialog.findByText(
        'Documentation status only applies when Screens or Components is included.',
      ),
    ).toBeInTheDocument();
    expect(chip(dialog, 'Draft')).toHaveClass('border-danger');
  });

  it('uses the "choose at least one" text for a required element type', async () => {
    const { dialog } = await submitWith(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: {
          fields: [{ field: 'scope.elementTypes', rule: 'required', message: 'server text' }],
        },
      }),
    );

    expect(
      await dialog.findByText('Choose at least one element, or include the status summary.'),
    ).toBeInTheDocument();
  });

  it('points a 404 for a screen at its position in the selector', async () => {
    const { dialog } = await submitWith(
      new ApiError({
        status: 404,
        code: 'NOT_FOUND',
        details: { element: 'screen', id: 22, field: 'scope.screenIds[1]' },
      }),
      pickTwo,
    );

    expect(
      await dialog.findByText("This screen doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    const selected = within(dialog.getByRole('list', { name: 'Selected screens' }));
    expect(selected.getAllByRole('listitem')[1]).toHaveClass('border-danger');
  });

  it('shows the 404 of the application and any other refusal in a banner, with the catalog text', async () => {
    const { dialog } = await submitWith(
      new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'application', id: 1 } }),
    );

    expect(
      await dialog.findByText("This application doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    expect(dialog.queryByText('2 fields need attention.')).not.toBeInTheDocument();
  });

  it('shows a server error with its reference and keeps the dialog open to try again', async () => {
    const { dialog } = await submitWith(
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-77' }),
    );

    expect(
      await dialog.findByText(
        'Something went wrong on our side. Try again in a moment. Reference: req-77.',
      ),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Create report' })).toBeEnabled();
  });

  it('takes a 400 with a field it does not know to the banner, never the server text', async () => {
    const { dialog } = await submitWith(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'somethingNew', rule: 'weird', message: 'server text' }] },
      }),
    );

    expect(await dialog.findByText("This value isn't valid.")).toBeInTheDocument();
    expect(screen.queryByText('server text')).not.toBeInTheDocument();
  });
});

describe('generate dialog: archived application, roles and connection', () => {
  it('shows the read-only notice and still generates', async () => {
    const user = setupUser();
    const { api } = await renderReports({
      reports: [],
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    expect(await screen.findByText('This application is archived.')).toBeInTheDocument();
    const dialog = within(await openDialog(user));
    await user.type(dialog.getByRole('textbox', { name: /Title/ }), 'Archived report');
    await user.click(chip(dialog, 'Variables'));

    await user.click(dialog.getByRole('button', { name: 'Create report' }));

    expect(api.callsTo('POST /reports/pdf')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Generating')).toBeInTheDocument();
  });

  it('gives a Developer the button and the Reader none', async () => {
    await renderReports({ role: 'DEVELOPER', reports: [] });
    expect(await screen.findByRole('button', { name: 'Generate report' })).toBeEnabled();
  });

  it('gives the Reader no Generate report button, not even in the empty state', async () => {
    await renderReports({ role: 'READER', reports: [] });
    expect(await screen.findByText('No published reports yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate report' })).not.toBeInTheDocument();
  });

  it('keeps the one Generate report button of the header in the empty state of a writer', async () => {
    await renderReports({ reports: [] });
    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Generate report' })).toHaveLength(1);
  });

  it('disables Generate with the reason while offline', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));

    expect(
      await dialog.findByText(
        "You're offline. Changes can't be saved until the connection is back.",
      ),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Create report' })).toBeDisabled();
  });
});

describe('generate dialog: accessibility', () => {
  it('is a modal dialog named by its title, traps the focus and returns it to the button on Escape', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const opener = (await screen.findAllByRole('button', { name: 'Generate report' }))[0];
    if (opener === undefined) throw new Error('No button');
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Generate report' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      "SAR · PDF or Excel of the application's documentation",
    );

    // Tab never leaves the dialog: after the last control comes the first one.
    const inside = within(dialog);
    inside.getByRole('button', { name: 'Close' }).focus();
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    inside.getByRole('button', { name: 'Create report' }).focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('operates every control with the keyboard: the cards with arrows, the chips and the switches with Space', async () => {
    const user = setupUser();
    await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));

    dialog.getByRole('radio', { name: /PDF/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(dialog.getByRole('radio', { name: /Excel/ })).toBeChecked();

    chip(dialog, 'Collections').focus();
    await user.keyboard(' ');
    expect(chip(dialog, 'Collections')).toHaveAttribute('aria-pressed', 'true');

    dialog.getByRole('switch', { name: 'Publish when ready' }).focus();
    await user.keyboard('{Enter}');
    expect(dialog.getByRole('switch', { name: 'Publish when ready' })).toBeChecked();
  });

  it('closes with Cancel and with the Close button without sending anything', async () => {
    const user = setupUser();
    const { api } = await renderReports({ reports: [] });
    const dialog = within(await openDialog(user));
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const again = within(await openDialog(user));
    await user.click(again.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('POST /reports/pdf')).toHaveLength(0);
  });
});
