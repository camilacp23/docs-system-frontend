// Add to-do from the Future to do tab (S-24a, S-24b, S-24c, P-04): a Story that exists or a new one, the client checks of the
// summaries, the answer in the tree with the notice and the link, every refusal with its text (STORY_NOT_IN_SCREEN,
// JIRA_UNAVAILABLE, JIRA_PARTIAL_FAILURE in its cases), the retry that never duplicates, a screen in review, and the reasons
// that disable the action (archived application, no connection, Jira not responding, a Reader). Jira is the state of the
// fake API (fakeScreenJira): nothing here calls Jira.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Role } from '../../app/router/routes';
import { sampleJiraTickets, type FakeJira } from '../helpers/fakeScreenJira';
import type { makeScreensApi } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const ARCHIVED_REASON = 'Read-only: the application is archived.';
const OFFLINE_REASON = "You're offline. Changes can't be saved until the connection is back.";
const JIRA_DOWN_REASON = "Jira isn't responding. You can add to-dos when it's back.";
const STORY_NOT_IN_SCREEN_TEXT =
  "That story doesn't belong to this screen. Refresh the list and pick again.";
const JIRA_UNAVAILABLE_TEXT =
  "Jira isn't responding. The to-do wasn't created. Try again in a few minutes.";

afterEach(() => {
  vi.restoreAllMocks();
});

type Api = ReturnType<typeof makeScreensApi>;

interface OpenOptions {
  role?: Role;
  /** false: no tickets at all (no Epic). */
  tickets?: boolean;
  archived?: boolean;
  jira?: Partial<FakeJira>;
  prepare?: (api: Api) => void;
}

/** Detalle (12, In review) on its Future to do tab. New issues start at TECHEA-108 when the sample tree exists. */
async function open(options: OpenOptions = {}) {
  const view = await renderScreens({
    role: options.role,
    path: '/screens/12?tab=todo',
    applications: options.archived
      ? [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })]
      : undefined,
    prepare: (api) => {
      if (options.tickets !== false) {
        api.jira.tickets = sampleJiraTickets(12);
        api.jira.nextKeyNumber = 108;
      }
      api.jira.nextId = 100;
      Object.assign(api.jira, options.jira);
      options.prepare?.(api);
    },
  });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

const addButton = () => screen.findByRole('button', { name: 'Add to-do' });

async function openModal(user: ReturnType<typeof setupUser>) {
  await user.click(await addButton());
  return screen.findByRole('dialog', { name: 'Add to-do' });
}

const posts = (api: Api) => api.callsTo('POST /screens/{id}/jira-ticket');
const reads = (api: Api) => api.callsTo('GET /screens/{id}/jira-tickets');

describe('Add to-do: the roles and the reasons that disable it', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER'] as const)('%s can add a to-do', async (role) => {
    await open({ role });

    expect(await addButton()).toBeEnabled();
  });

  it('a Reader has no Add to-do', async () => {
    await open({ role: 'READER' });
    await screen.findByRole('table');

    expect(screen.queryByRole('button', { name: 'Add to-do' })).not.toBeInTheDocument();
  });

  it('a Reader has no Add to-do in the empty state either', async () => {
    await open({ role: 'READER', tickets: false });

    expect(await screen.findByRole('heading', { name: 'No to-dos yet' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add to-do' })).not.toBeInTheDocument();
  });

  it('is allowed on a screen in review', async () => {
    await open();

    // Detalle is In review (the sample data); the status is not drawn on this tab, the page is the screen of that name.
    expect(await screen.findByRole('heading', { name: 'Detalle', level: 1 })).toBeInTheDocument();
    expect(await addButton()).toBeEnabled();
  });

  it('is disabled with the reason when the application is archived', async () => {
    await open({ archived: true });

    const button = await addButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', ARCHIVED_REASON);
    expect(button).toHaveAccessibleDescription(ARCHIVED_REASON);
  });

  it('is disabled with the reason when there is no connection', async () => {
    await open();
    await screen.findByRole('table');

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const button = await addButton();
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(button).toHaveAttribute('title', OFFLINE_REASON);
  });

  it('is disabled with the reason when Jira is not responding, and the rest of the tab works', async () => {
    await open({ jira: { available: false } });

    await waitFor(async () => {
      expect(await addButton()).toBeDisabled();
    });
    const button = await addButton();
    expect(button).toHaveAttribute('title', JIRA_DOWN_REASON);
    expect(button).toHaveAccessibleDescription(JIRA_DOWN_REASON);
    expect(screen.getByRole('button', { name: 'Refresh from Jira' })).toBeEnabled();
    expect(screen.getByRole('table')).toBeVisible();
  });

  it('the archived reason wins over Jira not responding, as the server would answer', async () => {
    await open({ archived: true, jira: { available: false } });

    await waitFor(async () => {
      expect(await addButton()).toHaveAttribute('title', ARCHIVED_REASON);
    });
  });

  it('is enabled again after a refresh that finds Jira back', async () => {
    const user = setupUser();
    const { api } = await open({ jira: { available: false } });
    await waitFor(async () => {
      expect(await addButton()).toBeDisabled();
    });

    api.jira.available = true;
    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));

    await waitFor(async () => {
      expect(await addButton()).toBeEnabled();
    });
    expect(screen.getByText('Jira connected')).toBeVisible();
  });
});

describe('Add to-do: the modal', () => {
  it('names the screen and the project of its Epic, and starts on the first Story', async () => {
    const user = setupUser();
    await open();
    const dialog = await openModal(user);

    expect(within(dialog).getByText('Screen Detalle · project TECHEA')).toBeVisible();
    const stories = within(dialog).getByRole('radiogroup', { name: 'Existing stories' });
    expect(within(stories).getByRole('radio', { name: /TECHEA-102/ })).toBeChecked();
    expect(within(stories).getByRole('radio', { name: /TECHEA-105/ })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Add to an existing story' })).toBeChecked();
    expect(within(dialog).getByText('Becomes a Subtask in Jira.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Create in Jira' })).toBeEnabled();
    expect(within(dialog).queryByText(/Epic is created in Jira/)).not.toBeInTheDocument();
  });

  it('puts the focus on the first control and gives it back to the button on Cancel and on Escape', async () => {
    const user = setupUser();
    const { api } = await open();
    const opener = await addButton();
    const dialog = await openModal(user);

    expect(within(dialog).getByRole('radio', { name: 'Add to an existing story' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await openModal(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(posts(api)).toHaveLength(0);
  });

  it('keeps the focus inside while it is open', async () => {
    const user = setupUser();
    await open();
    const dialog = await openModal(user);

    for (let index = 0; index < 12; index += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('offers only a new Story, and says so, when the screen has no Epic yet', async () => {
    const user = setupUser();
    await open({ tickets: false });
    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to-do' });

    expect(
      within(dialog).getByText("This screen's Epic is created in Jira with this first to-do."),
    ).toBeVisible();
    expect(within(dialog).getByText('Screen Detalle')).toBeVisible();
    expect(
      within(dialog).queryByRole('radio', { name: 'Add to an existing story' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Create a new story' })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: /Story summary/ })).toBeVisible();
  });
});

describe('Add to-do: creating', () => {
  it('adds the to-do to an existing Story: the tree gets it, the notice links to Jira and the focus returns', async () => {
    const user = setupUser();
    const { api } = await open();
    const opener = await addButton();
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('radio', { name: /TECHEA-105/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Add confirmation before leaving',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Description' }),
      'Unsaved changes',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await screen.findByText('TECHEA-108 created.')).toBeVisible();
    const link = screen.getByRole('link', { name: /Open in Jira$/ });
    expect(link).toHaveAttribute('href', 'https://jira.example.test/browse/TECHEA-108');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(posts(api)[0]?.options.body).toEqual({
      storyId: 5,
      subtask: { summary: 'Add confirmation before leaving', description: 'Unsaved changes' },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    // The new Subtask is in the tree, under the Story that was chosen, drawn as just created.
    const row = (
      await screen.findByRole('rowheader', { name: /Subtask of TECHEA-105:\s*TECHEA-108/ })
    ).closest('tr');
    expect(row).toHaveAttribute('data-just-created', 'true');
    expect(within(row as HTMLElement).getByText('Add confirmation before leaving')).toBeVisible();
    // 4 pending to-dos now, in the footer and in the badge; the tree is read again in the background.
    expect(await screen.findByText(/^4 pending to-dos/)).toBeVisible();
    expect(screen.getByRole('tab', { name: /^Future to do\s*4$/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(reads(api).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('leaves the description out of the request when it is empty', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    await screen.findByText('TECHEA-108 created.');
    expect(posts(api)[0]?.options.body).toEqual({ storyId: 2, subtask: { summary: 'A to-do' } });
  });

  it('creates a new Story with its description and the to-do under it', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Create a new story' }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Story summary/ }),
      'Accessibility',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Story description' }),
      'Keyboard and focus',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Label the gallery',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    // The Story is TECHEA-108 and the Subtask TECHEA-109 (the Epic already exists).
    expect(await screen.findByText('TECHEA-109 created.')).toBeVisible();
    expect(posts(api)[0]?.options.body).toEqual({
      newStory: { summary: 'Accessibility', description: 'Keyboard and focus' },
      subtask: { summary: 'Label the gallery' },
    });
    const grid = await screen.findByRole('table');
    expect(within(grid).getByText('Accessibility')).toBeVisible();
    expect(
      within(grid).getByRole('rowheader', { name: /Subtask of TECHEA-108:\s*TECHEA-109/ }),
    ).toBeVisible();
    expect(api.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC')).toHaveLength(1);
  });

  it('creates the Epic with the first to-do and shows it in the tree', async () => {
    const user = setupUser();
    const { api } = await open({ tickets: false });
    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to-do' });
    await user.type(
      within(dialog).getByRole('textbox', { name: /Story summary/ }),
      'Initial documentation',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Document OnStart',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await screen.findByText('TECHEA-103 created.')).toBeVisible();
    expect(await screen.findByText('TECHEA-101')).toBeVisible();
    expect(screen.getByText(/Detalle \(SAR\)/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No to-dos yet' })).not.toBeInTheDocument();
    expect(api.jira.tickets.map((t) => t.hierarchyLevel)).toEqual(['EPIC', 'STANDARD', 'SUBTASK']);
    expect(screen.getByRole('button', { name: 'Add to-do' })).toBeEnabled();
  });

  it('shows the success notice as a status region, once', async () => {
    const user = setupUser();
    await open();
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    const notice = await screen.findByText('TECHEA-108 created.');
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.getAllByText('TECHEA-108 created.')).toHaveLength(1);
  });

  it('blocks the button while it sends', async () => {
    const user = setupUser();
    const { api } = await open();
    const gate = api.hold((call) => call.method === 'POST' && call.path.endsWith('/jira-ticket'));
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(within(dialog).getByRole('button', { name: 'Create in Jira' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      gate.release();
      await Promise.resolve();
    });
    await screen.findByText('TECHEA-108 created.');
    expect(posts(api)).toHaveLength(1);
  });
});

describe('Add to-do: what the client checks', () => {
  it('asks for the summary and sends nothing when it is empty or only spaces', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    const field = within(dialog).getByRole('textbox', { name: /To-do summary/ });

    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await within(dialog).findByText('To-do summary is required.')).toBeVisible();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');

    await user.type(field, '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(within(dialog).getByText('To-do summary is required.')).toBeVisible();
    expect(posts(api)).toHaveLength(0);

    await user.type(field, 'x');
    expect(within(dialog).queryByText('To-do summary is required.')).not.toBeInTheDocument();
  });

  it('asks for the summary of a new Story too', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Create a new story' }));
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByText('Story summary is required.')).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: /Story summary/ })).toHaveFocus();
    expect(posts(api)).toHaveLength(0);
  });

  it('counts the length as Jira does: 255 UTF-16 units are enough, an emoji is 2', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    const field = within(dialog).getByRole('textbox', { name: /To-do summary/ });

    fireEvent.change(field, { target: { value: '😀'.repeat(128) } });
    expect(within(dialog).getByText('256/255', { selector: 'span' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await within(dialog).findByText('To-do summary is too long.')).toBeVisible();
    expect(posts(api)).toHaveLength(0);

    fireEvent.change(field, { target: { value: `${'😀'.repeat(127)}x` } });
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    await screen.findByText('TECHEA-108 created.');
    expect(posts(api)).toHaveLength(1);
  });

  it('shows the field message of a 400 of the API on the field and keeps what was typed', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.failNext(
          'POST /screens/{id}/jira-ticket',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'subtask.summary', rule: 'singleLine', message: 'x' }] },
          }),
        );
      },
    });
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByText('To-do summary must be a single line.')).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue('A to-do');
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveFocus();
    });
    expect(posts(api)).toHaveLength(1);
  });
});

describe('Add to-do: refusals', () => {
  it('STORY_NOT_IN_SCREEN: its message, the Stories are read again and the choice is repaired', async () => {
    const user = setupUser();
    const { api } = await open();
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    // The chosen Story (TECHEA-102) disappears from the screen meanwhile.
    api.jira.tickets = api.jira.tickets.filter((t) => t.id !== 2 && t.parentId !== 2);
    const before = reads(api).length;
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByText(STORY_NOT_IN_SCREEN_TEXT)).toBeVisible();
    await waitFor(() => {
      expect(reads(api).length).toBe(before + 1);
    });
    const stories = within(dialog).getByRole('radiogroup', { name: 'Existing stories' });
    await waitFor(() => {
      expect(within(stories).queryByRole('radio', { name: /TECHEA-102/ })).not.toBeInTheDocument();
    });
    expect(within(stories).getByRole('radio', { name: /TECHEA-105/ })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue('A to-do');

    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await screen.findByText('TECHEA-108 created.')).toBeVisible();
    expect(posts(api)[1]?.options.body).toMatchObject({ storyId: 5 });
  });

  it('STORY_NOT_IN_SCREEN with no Story left switches to a new Story', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.jira.tickets = sampleJiraTickets(12).slice(0, 2);
      },
    });
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    api.jira.tickets = api.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByText(STORY_NOT_IN_SCREEN_TEXT)).toBeVisible();
    expect(await within(dialog).findByRole('radio', { name: 'Create a new story' })).toBeChecked();
    expect(
      within(dialog).queryByRole('radio', { name: 'Add to an existing story' }),
    ).not.toBeInTheDocument();
  });

  it('JIRA_UNAVAILABLE: its message, everything typed stays, the pill says so and the retry works', async () => {
    const user = setupUser();
    const { api } = await open();
    await screen.findByText('Jira connected');
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Some detail');
    api.jira.available = false;
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByText(JIRA_UNAVAILABLE_TEXT)).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue('A to-do');
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toHaveValue('Some detail');
    expect(screen.getByText('Jira unavailable')).toBeVisible();
    expect(api.jira.tickets).toHaveLength(7);

    // Jira is back: the same form is sent again, from the same modal.
    api.jira.available = true;
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await screen.findByText('TECHEA-108 created.')).toBeVisible();
    expect(posts(api)).toHaveLength(2);
    // The read that follows tells the shell that Jira is available again.
    expect(await screen.findByText('Jira connected')).toBeVisible();
  });

  it('JIRA_UNAVAILABLE closes into a disabled Add to-do with the reason, and Refresh brings it back', async () => {
    const user = setupUser();
    const { api } = await open();
    await screen.findByText('Jira connected');
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    api.jira.available = false;
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    await within(dialog).findByText(JIRA_UNAVAILABLE_TEXT);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const button = await addButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', JIRA_DOWN_REASON);

    api.jira.available = true;
    await user.click(screen.getByRole('button', { name: 'Refresh from Jira' }));
    await waitFor(async () => {
      expect(await addButton()).toBeEnabled();
    });
  });

  it('JIRA_PARTIAL_FAILURE with the Story: it is chosen as just created and the retry adds only the Subtask', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.jira.createFailure = { kind: 'partial', after: 'story' };
      },
    });
    await screen.findByText('Jira connected');
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Create a new story' }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Story summary/ }),
      'Accessibility',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Label the gallery',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(
      await within(dialog).findByText(
        "The story TECHEA-108 was created, but the to-do wasn't. Try again to add it to that story.",
      ),
    ).toBeVisible();
    const stories = within(dialog).getByRole('radiogroup', { name: 'Existing stories' });
    const created = within(stories).getByRole('radio', { name: /TECHEA-108/ });
    expect(created).toBeChecked();
    expect(within(stories).getByText('Just created')).toBeVisible();
    expect(within(dialog).getByRole('radio', { name: 'Add to an existing story' })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue(
      'Label the gallery',
    );
    // The failure of Jira does not change what the pill knows.
    expect(screen.getByText('Jira connected')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await screen.findByText('TECHEA-109 created.')).toBeVisible();
    expect(posts(api)[1]?.options.body).toEqual({
      storyId: api.jira.tickets.find((t) => t.jiraIssueKey === 'TECHEA-108')?.id,
      subtask: { summary: 'Label the gallery' },
    });
    // Nothing was duplicated: one Story named like the one that was typed, one Epic.
    expect(api.jira.tickets.filter((t) => t.summary === 'Accessibility')).toHaveLength(1);
    expect(api.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC')).toHaveLength(1);
    const grid = await screen.findByRole('table');
    expect(
      within(grid).getByRole('rowheader', { name: /Subtask of TECHEA-108:\s*TECHEA-109/ }),
    ).toBeVisible();
  });

  it('JIRA_PARTIAL_FAILURE with only the Epic: the same form is sent again and reuses it', async () => {
    const user = setupUser();
    const { api } = await open({
      tickets: false,
      prepare: (a) => {
        a.jira.createFailure = { kind: 'partial', after: 'epic' };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to-do' });
    await user.type(
      within(dialog).getByRole('textbox', { name: /Story summary/ }),
      'Initial documentation',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Document OnStart',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(
      await within(dialog).findByText(
        "The epic TECHEA-101 was created, but the story and the to-do weren't. Try again to add them to that epic.",
      ),
    ).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: /Story summary/ })).toHaveValue(
      'Initial documentation',
    );
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue(
      'Document OnStart',
    );
    // The tree is read again: the Epic exists now, so the first-to-do notice goes away.
    await waitFor(() => {
      expect(within(dialog).queryByText(/Epic is created in Jira/)).not.toBeInTheDocument();
    });
    expect(within(dialog).getByText('Screen Detalle · project TECHEA')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));
    expect(await screen.findByText('TECHEA-103 created.')).toBeVisible();
    expect(api.jira.tickets.filter((t) => t.hierarchyLevel === 'EPIC')).toHaveLength(1);
    expect(posts(api)[1]?.options.body).toEqual({
      newStory: { summary: 'Initial documentation' },
      subtask: { summary: 'Document OnStart' },
    });
  });

  it('JIRA_PARTIAL_FAILURE with issues that were not saved: the message lists the keys and nothing typed is lost', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (a) => {
        a.jira.createFailure = { kind: 'unsaved', reason: 'SAVE_FAILED' };
      },
    });
    const dialog = await openModal(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Create a new story' }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Story summary/ }),
      'Accessibility',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /To-do summary/ }),
      'Label the gallery',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    const banner = await within(dialog).findByRole('alert');
    expect(banner).toHaveTextContent(
      "These Jira issues were created but couldn't be saved here: TECHEA-108. Delete them in Jira, then try again.",
    );
    expect(within(dialog).getByRole('textbox', { name: /Story summary/ })).toHaveValue(
      'Accessibility',
    );
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue(
      'Label the gallery',
    );
    expect(posts(api)).toHaveLength(1);
  });

  it('JIRA_PARTIAL_FAILURE because the screen was deleted: the message lists every key', async () => {
    const user = setupUser();
    await open({
      tickets: false,
      prepare: (a) => {
        a.jira.createFailure = { kind: 'unsaved', reason: 'SCREEN_DELETED' };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Add to-do' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add to-do' });
    await user.type(within(dialog).getByRole('textbox', { name: /Story summary/ }), 'A story');
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "The screen was deleted while the tickets were being created. These Jira issues weren't saved here: TECHEA-101, TECHEA-102. Delete them in Jira if you don't need them.",
    );
  });

  it('shows the catalog text of any other refusal in the modal and keeps what was typed', async () => {
    const user = setupUser();
    await open({
      prepare: (a) => {
        a.failNext(
          'POST /screens/{id}/jira-ticket',
          new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }),
        );
      },
    });
    const dialog = await openModal(user);
    await user.type(within(dialog).getByRole('textbox', { name: /To-do summary/ }), 'A to-do');
    await user.click(within(dialog).getByRole('button', { name: 'Create in Jira' }));

    expect(
      await within(dialog).findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: /To-do summary/ })).toHaveValue('A to-do');
  });

  it('disables Create in Jira with the reason when the connection goes away while the modal is open', async () => {
    const user = setupUser();
    await open();
    const dialog = await openModal(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Create in Jira' })).toBeDisabled();
    });
    expect(within(dialog).getByText(OFFLINE_REASON)).toBeVisible();
  });
});
