// Comments tab (S-35), the thread: the tab in the URL with its badge, the three roles, the order of the API, the initials
// and the tags that are only drawn when true (D-143), the "edited" mark, the review entries that cannot be edited (D-56),
// the side panel (status, count, last activity, participants), the empty and failed reads, and the markup (a labelled list).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import {
  ANA,
  CAMILA,
  DEV_A,
  makeComment,
  openComments,
  sampleComments,
} from '../helpers/openComments';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const thread = () => screen.getByRole('list', { name: 'Comments of this screen' });
const entries = () =>
  within(thread())
    .getAllByRole('listitem')
    .filter((li) => li.querySelector('article'));

describe('the Comments tab in the detail', () => {
  it('is the fifth tab, with the count as a badge, and lives in the URL as ?tab=comments', async () => {
    const view = await openComments();

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs[4]).toBe('Comments4');
    expect(view.router.state.location.search).toBe('?tab=comments');

    const user = setupUser();
    await user.click(screen.getByRole('tab', { name: /^Template/ }));
    expect(view.router.state.location.search).toBe('');
    await user.click(screen.getByRole('tab', { name: /^Comments/ }));
    expect(view.router.state.location.search).toBe('?tab=comments');
    expect(await screen.findByRole('list', { name: 'Comments of this screen' })).toBeVisible();
  });

  it('leaves the badge out when there are no comments, and says so in the thread', async () => {
    await openComments({ comments: [] });

    expect(screen.getByRole('tab', { name: 'Comments' })).toBeVisible();
    expect(await screen.findByText('No comments yet')).toBeVisible();
    expect(screen.getByText('Be the first to comment on this screen.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Comments of this screen' })).not.toBeInTheDocument();
  });

  it('shows the count of the comments in the Template side card, as P-01 draws it', async () => {
    await renderScreens({ role: 'DEVELOPER', path: '/screens/12' });

    const row = (await screen.findByText('Comments', { selector: 'dt' })).closest('div');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('2')).toBeVisible();
  });
});

describe('the thread, for the three roles', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    '%s reads the whole thread',
    async (role) => {
      await openComments({ role });

      expect(
        await screen.findByText('Template ready except Risks; adding them tomorrow.'),
      ).toBeVisible();
      expect(entries()).toHaveLength(4);
      expect(screen.getByLabelText('Add a comment')).toBeEnabled();
    },
  );

  it('lists the comments oldest first, in the order of the API, not by anything the client chooses', async () => {
    // The API returns them oldest first (createdAt, then id): the ids and dates here are not in order of text.
    const comments = [
      makeComment(5, { text: 'first by date', createdAt: '2026-10-01T08:00:00' }),
      makeComment(2, { text: 'second by date', createdAt: '2026-10-01T09:00:00' }),
      makeComment(9, { text: 'third by date', createdAt: '2026-10-01T09:00:00' }),
    ];
    await openComments({ comments });

    await screen.findByText('first by date');
    const texts = entries().map((entry) => within(entry).getByText(/by date/).textContent);
    expect(texts).toEqual(['first by date', 'second by date', 'third by date']);
  });

  it('labels the list, so a screen reader announces what it is', async () => {
    await openComments();

    const list = await screen.findByRole('list', { name: 'Comments of this screen' });
    expect(list.tagName).toBe('OL');
  });
});

describe('author, tags and time', () => {
  it('draws the initials of the author (also for someone who is inactive: the API gives no status)', async () => {
    await openComments({
      comments: [makeComment(1, { author: { id: 40, name: 'María del Carmen Pérez' } })],
    });

    const entry = entries()[0] as HTMLElement;
    expect(within(entry).getByText('María del Carmen Pérez')).toBeVisible();
    // The initials are decorative (the name is next to them), so they are hidden from assistive technology.
    expect(entry.querySelector('[aria-hidden="true"]')?.textContent).toBe('MP');
  });

  it('tags only what is true: "Screen author" for the author of the screen, "Reviewer" on a review, nothing else', async () => {
    await openComments();

    const [first, review, again, reader] = entries() as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(within(first).getByText('Screen author')).toBeVisible();
    expect(within(review).getByText('Reviewer')).toBeVisible();
    expect(within(again).getByText('Screen author')).toBeVisible();
    // The Reader has no tag: the API does not say who is a Reader (D-143).
    expect(within(reader).queryByText(/^(Screen author|Reviewer|Reader|Author)$/)).toBeNull();
    expect(within(reader).getByText('Sample Reader')).toBeVisible();
  });

  it('writes the time as "Oct 2 · 11:05" and marks only the edited comment as "edited"', async () => {
    await openComments();

    const [first, , again] = entries() as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(first).getByText('Oct 2 · 11:05 · edited')).toBeVisible();
    expect(within(again).getByText(/Oct 4 · 16:02/)).toBeVisible();
    expect(within(again).queryByText(/edited/)).toBeNull();
  });

  it('keeps the text as it was written: line breaks and spaces', async () => {
    await openComments({ comments: [makeComment(1, { text: 'line one\n  line two' })] });

    const text = await screen.findByText(/line one/);
    expect(text.textContent).toBe('line one\n  line two');
    expect(text).toHaveClass('whitespace-pre-wrap');
  });
});

describe('review decisions in the thread (D-56)', () => {
  it('shows a returned review as its own entry, "Returned for changes", locked, without an Edit action', async () => {
    await openComments({
      role: 'ADMINISTRATOR',
      comments: [makeComment(1, { author: ANA, reviewDecision: 'RETURN', text: 'Fix the risks.' })],
    });

    const entry = entries()[0] as HTMLElement;
    expect(within(entry).getByText('Returned for changes')).toBeVisible();
    expect(within(entry).getByText('Reviewer')).toBeVisible();
    expect(within(entry).getByText("Can't be edited")).toBeVisible();
    expect(within(entry).getByText('Fix the risks.')).toBeVisible();
    // Ana wrote it, so she would have Edit on an ordinary comment: a review has none.
    expect(within(entry).queryByRole('button', { name: /^Edit comment/ })).toBeNull();
  });

  it('shows an approval with a comment as "Approved", also locked', async () => {
    await openComments({
      comments: [
        makeComment(1, { author: CAMILA, reviewDecision: 'APPROVE', text: 'Looks good.' }),
      ],
    });

    const entry = entries()[0] as HTMLElement;
    expect(within(entry).getByText('Approved')).toBeVisible();
    expect(within(entry).getByText("Can't be edited")).toBeVisible();
    expect(within(entry).queryByRole('button', { name: /^Edit comment/ })).toBeNull();
  });

  it('draws an ordinary comment and a review comment differently (the review has no avatar bubble)', async () => {
    await openComments();

    const [ordinary, review] = entries() as [HTMLElement, HTMLElement];
    expect(within(ordinary).queryByText("Can't be edited")).toBeNull();
    expect(within(review).queryByText('Oct 2 · 11:05')).toBeNull();
  });
});

describe('the side panel "About this discussion"', () => {
  it('shows the status, the count, the last activity and the participants with the tags that are true', async () => {
    await openComments();

    const panel = await screen.findByRole('complementary', { name: 'About this discussion' });
    expect(within(panel).getByText('In review')).toBeVisible();
    expect(within(panel).getByText('Comments').nextElementSibling?.textContent).toBe('4');
    expect(within(panel).getByText('Last activity').nextElementSibling?.textContent).toBe(
      'Oct 4 · 17:15',
    );

    const people = within(within(panel).getByRole('list')).getAllByRole('listitem');
    expect(people.map((person) => person.textContent)).toEqual([
      'SASample Developer AScreen author',
      'CCCamila CastilloReviewer',
      'SRSample Reader',
    ]);
    expect(
      within(panel).getByText(
        'Everyone with access to the screen can read and comment. Only your own comments can be edited.',
      ),
    ).toBeVisible();
  });

  it('counts the screen author as a participant even before anyone has commented', async () => {
    await openComments({ comments: [] });

    const panel = await screen.findByRole('complementary', { name: 'About this discussion' });
    expect(within(panel).getByText('Last activity').nextElementSibling?.textContent).toBe('—');
    expect(within(panel).getByText(DEV_A.name)).toBeVisible();
  });
});

describe('a failed read of the thread', () => {
  it('shows its own error and a retry in the tab, without breaking the page, and recovers', async () => {
    const view = await openComments({
      prepare: (api) => {
        api.failNext(
          'GET /screens/{id}/comments',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side');
    expect(screen.getByRole('heading', { name: 'Detalle', level: 1 })).toBeVisible();
    expect(screen.getByLabelText('Add a comment')).toBeVisible();

    const user = setupUser();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Template ready except Risks; adding them tomorrow.'),
    ).toBeVisible();
    expect(view.api.callsTo('GET /screens/{id}/comments')).toHaveLength(2);
  });
});

describe('the sample thread', () => {
  it('has the four comments of the frame', () => {
    expect(sampleComments().map((comment) => comment.id)).toEqual([31, 32, 33, 34]);
  });
});
