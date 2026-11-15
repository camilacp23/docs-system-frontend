// Workflow actions of the screen detail (S-19, S-25b, P-01, P-02): which actions each role sees in each status, every
// transition of /status with its result (the status, the new ETag used by the next call, the notice and the focus), the
// refusals of the API (412, INVALID_TRANSITION, APPLICATION_ARCHIVED, a screen that no longer exists) and the disabled
// cases (archived application, no connection).
// Every action runs through setupUser (inside act), so what it caused is rendered when the call returns: the
// checks do not depend on when React decides to render under load.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Role } from '../../app/router/routes';
import type { Screen } from '../../modules/screens/screenTypes';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { setupUser, type User } from '../helpers/setupUser';

type Status = Screen['documentationStatus'];

const FULL_TEMPLATE: Screen['template'] = {
  onStart: 'Set(gUsuario, User())',
  workingProcess: 'The user opens the screen.',
  architecture: 'A header and a form.',
  dataModel: 'Reads colClientes.',
  requirements: 'Show the record.',
  knownIssues: 'None known.',
  risks: 'Low.',
};

const ARCHIVED_REASON = 'Read-only: the application is archived.';
const OFFLINE_REASON = "You're offline. Changes can't be saved until the connection is back.";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Detalle (12) in the given status, with the full template unless told otherwise, opened as `role`. */
async function open(
  status: Status,
  role: Role = 'DEVELOPER',
  options: { template?: Screen['template']; archived?: boolean } = {},
) {
  const view = await renderScreens({
    role,
    path: '/screens/12',
    applications: options.archived
      ? [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })]
      : undefined,
    screens: sampleScreens().map((s) =>
      s.id === 12
        ? { ...s, documentationStatus: status, template: options.template ?? FULL_TEMPLATE }
        : s,
    ),
  });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

const serverStatus = (view: Awaited<ReturnType<typeof open>>) =>
  view.api.state.screens.find((s) => s.id === 12)?.documentationStatus;

const button = (name: string) => screen.queryByRole('button', { name });

async function menuItems(user: User): Promise<string[]> {
  const trigger = screen.queryByRole('button', { name: 'More actions' });
  if (trigger === null) return [];
  await user.click(trigger);
  const items = within(await screen.findByRole('menu')).getAllByRole('menuitem');
  const names = items.map((item) => item.textContent ?? '');
  await user.keyboard('{Escape}');
  return names;
}

// What the decisions do is in screenReview.test.tsx; here only who sees them.
const WORKFLOW_BUTTONS = [
  'Start draft',
  'Mark in progress',
  'Submit for review',
  'Withdraw from review',
  'Return',
  'Approve',
];

describe('workflow actions by status and role', () => {
  const CASES: Array<{
    status: Status;
    role: Role;
    buttons: string[];
    menu: string[];
  }> = [
    { status: 'UNDOCUMENTED', role: 'ADMINISTRATOR', buttons: ['Start draft'], menu: [] },
    { status: 'UNDOCUMENTED', role: 'DEVELOPER', buttons: ['Start draft'], menu: [] },
    { status: 'UNDOCUMENTED', role: 'READER', buttons: [], menu: [] },
    {
      status: 'DRAFT',
      role: 'ADMINISTRATOR',
      buttons: ['Mark in progress'],
      menu: ['Back to undocumented'],
    },
    {
      status: 'DRAFT',
      role: 'DEVELOPER',
      buttons: ['Mark in progress'],
      menu: ['Back to undocumented'],
    },
    { status: 'DRAFT', role: 'READER', buttons: [], menu: [] },
    {
      status: 'IN_PROGRESS',
      role: 'ADMINISTRATOR',
      buttons: ['Submit for review'],
      menu: ['Back to draft'],
    },
    {
      status: 'IN_PROGRESS',
      role: 'DEVELOPER',
      buttons: ['Submit for review'],
      menu: ['Back to draft'],
    },
    { status: 'IN_PROGRESS', role: 'READER', buttons: [], menu: [] },
    {
      status: 'IN_REVIEW',
      role: 'ADMINISTRATOR',
      buttons: ['Return', 'Approve'],
      menu: ['Withdraw from review'],
    },
    {
      status: 'IN_REVIEW',
      role: 'DEVELOPER',
      buttons: ['Withdraw from review'],
      menu: [],
    },
    { status: 'IN_REVIEW', role: 'READER', buttons: [], menu: [] },
    { status: 'APPROVED', role: 'ADMINISTRATOR', buttons: [], menu: ['Reopen'] },
    { status: 'APPROVED', role: 'DEVELOPER', buttons: [], menu: ['Reopen'] },
    { status: 'APPROVED', role: 'READER', buttons: [], menu: [] },
  ];

  for (const { status, role, buttons, menu } of CASES) {
    it(`${status} as ${role}`, async () => {
      const user = setupUser();
      await open(status, role);

      const visible = WORKFLOW_BUTTONS.filter((name) => button(name) !== null);
      expect(visible).toEqual(buttons);
      expect(await menuItems(user)).toEqual(menu);
    });
  }

  it('keeps Edit disabled, with its reason, in review for the Developer (P-01)', async () => {
    await open('IN_REVIEW', 'DEVELOPER');

    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute(
      'title',
      'This screen is in review. Edit it after the review, or withdraw it from review.',
    );
  });

  it('draws no workflow control for a Reader', async () => {
    await open('IN_PROGRESS', 'READER');

    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    expect(button('Submit for review')).not.toBeInTheDocument();
    expect(button('Edit')).not.toBeInTheDocument();
  });

  it('follows the same flow for App (OnStart)', async () => {
    await renderScreens({ role: 'DEVELOPER', path: '/screens/10' });
    await screen.findByRole('heading', { name: 'App (OnStart)', level: 1 });

    expect(button('Submit for review')).toBeInTheDocument();
  });
});

describe('transitions of /status', () => {
  it('Start draft: UNDOCUMENTED -> DRAFT, with the notice and the focus on the title', async () => {
    const user = setupUser();
    const view = await open('UNDOCUMENTED');

    await user.click(screen.getByRole('button', { name: 'Start draft' }));

    expect(await screen.findByText('Detalle is now Draft.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('DRAFT');
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(button('Mark in progress')).toBeInTheDocument();
    expect(button('Start draft')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detalle', level: 1 })).toHaveFocus();
  });

  it('Mark in progress: DRAFT -> IN_PROGRESS', async () => {
    const user = setupUser();
    const view = await open('DRAFT');

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    expect(await screen.findByText('Detalle is now In progress.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('IN_PROGRESS');
    expect(button('Submit for review')).toBeInTheDocument();
  });

  it('Back to undocumented: DRAFT -> UNDOCUMENTED, from the menu', async () => {
    const user = setupUser();
    const view = await open('DRAFT');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Back to undocumented' }));

    expect(await screen.findByText('Detalle is now Undocumented.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('UNDOCUMENTED');
    expect(button('Start draft')).toBeInTheDocument();
  });

  it('Back to draft: IN_PROGRESS -> DRAFT, from the menu', async () => {
    const user = setupUser();
    const view = await open('IN_PROGRESS');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Back to draft' }));

    expect(await screen.findByText('Detalle is now Draft.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('DRAFT');
  });

  it('Submit for review: IN_PROGRESS -> IN_REVIEW, and Edit is disabled with its reason (P-01)', async () => {
    const user = setupUser();
    const view = await open('IN_PROGRESS');

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Detalle submitted for review.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('IN_REVIEW');
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(button('Withdraw from review')).toBeInTheDocument();
  });

  it('Withdraw from review: IN_REVIEW -> IN_PROGRESS, as the Developer (button)', async () => {
    const user = setupUser();
    const view = await open('IN_REVIEW', 'DEVELOPER');

    await user.click(screen.getByRole('button', { name: 'Withdraw from review' }));

    expect(await screen.findByText('Detalle withdrawn from review.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('IN_PROGRESS');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
  });

  it('Withdraw from review: as the Administrator (menu)', async () => {
    const user = setupUser();
    const view = await open('IN_REVIEW', 'ADMINISTRATOR');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Withdraw from review' }));

    expect(await screen.findByText('Detalle withdrawn from review.')).toBeInTheDocument();
    expect(serverStatus(view)).toBe('IN_PROGRESS');
  });

  it('Reopen: APPROVED -> IN_PROGRESS', async () => {
    const user = setupUser();
    const view = await open('APPROVED');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reopen' }));

    expect(
      await screen.findByText('Detalle reopened. Its status is now In progress.'),
    ).toBeVisible();
    expect(serverStatus(view)).toBe('IN_PROGRESS');
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
  });

  it('sends If-Match with the ETag of the detail and uses the new one for the next change', async () => {
    const user = setupUser();
    const view = await open('UNDOCUMENTED');
    const first = view.api.etagOf(12);

    await user.click(screen.getByRole('button', { name: 'Start draft' }));
    await screen.findByText('Detalle is now Draft.');
    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));
    await screen.findByText('Detalle is now In progress.');

    const puts = view.api.callsTo('PUT /screens/{id}/status');
    expect(puts).toHaveLength(2);
    expect(puts[0]?.options.ifMatch).toBe(first);
    expect(puts[0]?.options.body).toEqual({ status: 'DRAFT' });
    expect(puts[1]?.options.ifMatch).not.toBe(first);
    // No second read of the screen was needed.
    expect(view.api.callsTo('GET /screens/{id}')).toHaveLength(1);
  });

  it('shows the new status in the list when the user goes back (D-72)', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));
    await screen.findByText('Detalle is now In progress.');

    await act(async () => {
      await view.router.navigate('/screens');
    });

    const row = (await screen.findByRole('link', { name: 'Detalle' })).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('In progress')).toBeInTheDocument();
  });

  it('disables every action while one is in flight, and sends it once', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    const hold = view.api.hold((call) => call.path === '/screens/{id}/status');

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));
    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Back to undocumented' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    hold.release();

    expect(await screen.findByText('Detalle is now In progress.')).toBeInTheDocument();
    expect(view.api.callsTo('PUT /screens/{id}/status')).toHaveLength(1);
  });
});

describe('errors of /status', () => {
  it('412: shows S-44 with the catalog text and Reload loads the other version', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    // Someone else saved the screen: its ETag moved and it is now In progress.
    view.api.state.versions.set(12, 7);
    view.api.state.screens = view.api.state.screens.map((s) =>
      s.id === 12 ? { ...s, documentationStatus: 'IN_PROGRESS' as const } : s,
    );

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    // Found by its text, not as "the" alert: other alerts of the shell must not be mistaken for it.
    const text = await screen.findByText(
      'Someone else saved changes to this screen after you opened it. Reload to see their version.',
    );
    const banner = text.closest<HTMLElement>('[role="alert"]');
    expect(banner).not.toBeNull();
    await user.click(within(banner as HTMLElement).getByRole('button', { name: 'Reload' }));

    await waitFor(() => {
      expect(button('Submit for review')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Someone else saved changes/)).not.toBeInTheDocument();
  });

  it('INVALID_TRANSITION: shows its text and reads the screen again', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    // The status changed on the server with no change of ETag the page knows about.
    view.api.state.screens = view.api.state.screens.map((s) =>
      s.id === 12 ? { ...s, documentationStatus: 'UNDOCUMENTED' as const } : s,
    );

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    expect(
      await screen.findByText(
        'This screen changed status meanwhile. Reload to see its current status.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(button('Start draft')).toBeInTheDocument();
    });
    expect(view.api.callsTo('GET /screens/{id}').length).toBeGreaterThanOrEqual(2);
  });

  it('APPLICATION_ARCHIVED: shows its text when the application was archived meanwhile', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    view.apps.state.applications = view.apps.state.applications.map((a) => ({
      ...a,
      status: 'ARCHIVED' as const,
    }));

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    expect(
      await screen.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
    expect(serverStatus(view)).toBe('DRAFT');
  });

  it('shows "This screen doesn\'t exist" when it was deleted by someone else', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    view.api.state.screens = view.api.state.screens.filter((s) => s.id !== 12);

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    expect(await screen.findByText("This screen doesn't exist")).toBeInTheDocument();
  });

  it('shows the catalog text of any other refusal and lets the user dismiss it', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    view.api.failNext('PUT /screens/{id}/status', new ApiError({ status: 403, code: 'FORBIDDEN' }));

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent("Your role doesn't allow this action.");
    await user.click(within(banner).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the message when the next change starts', async () => {
    const user = setupUser();
    const view = await open('DRAFT');
    view.api.failNext(
      'PUT /screens/{id}/status',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
    );

    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Mark in progress' }));

    expect(await screen.findByText('Detalle is now In progress.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('disabled cases', () => {
  it('disables the actions, with the reason, when the application is archived', async () => {
    const user = setupUser();
    await open('IN_PROGRESS', 'DEVELOPER', { archived: true });

    const submit = screen.getByRole('button', { name: 'Submit for review' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('title', ARCHIVED_REASON);
    expect(submit).toHaveAccessibleDescription(ARCHIVED_REASON);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const item = await screen.findByRole('menuitem', { name: 'Back to draft' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('title', ARCHIVED_REASON);
  });

  it('disables the actions, with the reason, while the browser is offline', async () => {
    await open('DRAFT');

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const mark = await screen.findByRole('button', { name: 'Mark in progress' });
    await waitFor(() => {
      expect(mark).toBeDisabled();
    });
    expect(mark).toHaveAttribute('title', OFFLINE_REASON);
  });

  it('enables them again when the connection is back', async () => {
    await open('DRAFT');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark in progress' })).toBeDisabled();
    });

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark in progress' })).toBeEnabled();
    });
  });
});
