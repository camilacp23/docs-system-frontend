// Send to review with an incomplete template (S-25a, flow 3a): the API answers TEMPLATE_INCOMPLETE and the detail opens
// the edit page with `?tab=template&submit=1`. The edit page works out what is missing from the screen's own data (so
// the banner and the red fields survive a reload), puts the focus on the first missing field, and sends nothing to review
// by itself: the user saves, goes back to the detail and sends it again (the frame has only Cancel and Save changes).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Screen } from '../../modules/screens/screenTypes';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { replaceText } from '../helpers/screenEditHelpers';
import { setupUser } from '../helpers/setupUser';

const BANNER =
  'Complete all seven template fields to submit for review. Missing: Known issues, Risks.';
const REQUIRED = 'Required to submit for review.';

/** Detalle (12) In progress; its template lacks Known issues (null) and Risks (spaces only). */
function detalle(status: Screen['documentationStatus'] = 'IN_PROGRESS') {
  return sampleScreens().map((s) => (s.id === 12 ? { ...s, documentationStatus: status } : s));
}

async function openDetail() {
  const view = await renderScreens({ path: '/screens/12', screens: detalle() });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

async function openEditAt(search: string, status: Screen['documentationStatus'] = 'IN_PROGRESS') {
  const view = await renderScreens({ path: `/screens/12/edit${search}`, screens: detalle(status) });
  await screen.findByRole('heading', { name: /^Edit /, level: 1 });
  return view;
}

const field = (name: string) => screen.getByRole('textbox', { name });

describe('send to review with an incomplete template', () => {
  it('opens the edit page on the template with the signal in the URL, and nothing else', async () => {
    const user = setupUser();
    const view = await openDetail();

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    await screen.findByRole('heading', { name: /^Edit /, level: 1 });
    expect(view.router.state.location.pathname).toBe('/screens/12/edit');
    expect(view.router.state.location.search).toBe('?tab=template&submit=1');
    expect(view.router.state.location.state).toBeNull();
    // The screen stays In progress and nothing but the one refused call was sent.
    expect(view.api.state.screens.find((s) => s.id === 12)?.documentationStatus).toBe(
      'IN_PROGRESS',
    );
    expect(view.api.callsTo('PUT /screens/{id}/status')).toHaveLength(1);
    expect(view.api.callsTo('PUT /screens/{id}')).toHaveLength(0);
  });

  it('shows the banner with the readable names in template order', async () => {
    await openEditAt('?tab=template&submit=1');

    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(BANNER);
  });

  it('marks each missing field, and only those, with the text of the frame', async () => {
    await openEditAt('?tab=template&submit=1');

    for (const name of ['Known issues', 'Risks']) {
      expect(field(name)).toBeInvalid();
      expect(field(name)).toHaveAccessibleDescription(new RegExp(REQUIRED));
    }
    for (const name of [
      'OnStart',
      'Working process',
      'Architecture',
      'Data model',
      'Requirements',
    ]) {
      expect(field(name)).toBeValid();
    }
    expect(screen.getAllByText(REQUIRED)).toHaveLength(2);
  });

  it('puts the focus on the first missing field', async () => {
    await openEditAt('?tab=template&submit=1');

    await waitFor(() => {
      expect(field('Known issues')).toHaveFocus();
    });
  });

  it('computes it from the data, so a reload of the page shows the same', async () => {
    const first = await openEditAt('?tab=template&submit=1');
    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    first.unmount();

    await openEditAt('?tab=template&submit=1');

    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(field('Risks')).toBeInvalid();
  });

  it('counts a field of only spaces as missing', async () => {
    await openEditAt('?tab=template&submit=1');

    expect(field('Risks')).toHaveValue('   ');
    expect(field('Risks')).toBeInvalid();
  });

  it('takes the marks off a field as it is filled, and the banner when none is left', async () => {
    const user = setupUser();
    await openEditAt('?tab=template&submit=1');
    await screen.findByText(BANNER);

    await replaceText(user, field('Known issues'), 'Double save under load.');

    expect(field('Known issues')).toBeValid();
    expect(
      await screen.findByText(
        'Complete all seven template fields to submit for review. Missing: Risks.',
      ),
    ).toBeInTheDocument();

    await replaceText(user, field('Risks'), 'Medium.');

    await waitFor(() => {
      expect(screen.queryByText(/Complete all seven template fields/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
  });

  it('saves and goes back to the detail, where the user sends it again', async () => {
    const user = setupUser();
    const view = await openEditAt('?tab=template&submit=1');
    await screen.findByText(BANNER);
    await replaceText(user, field('Known issues'), 'Double save under load.');
    await replaceText(user, field('Risks'), 'Medium.');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Screen saved.')).toBeVisible();
    await screen.findByRole('heading', { name: 'Detalle', level: 1 });
    expect(view.router.state.location.pathname).toBe('/screens/12');
    // Saving did not send it to review: that is for the user to ask on the detail.
    expect(view.api.callsTo('PUT /screens/{id}/status')).toHaveLength(0);
    expect(view.api.state.screens.find((s) => s.id === 12)?.documentationStatus).toBe(
      'IN_PROGRESS',
    );

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Detalle submitted for review.')).toBeInTheDocument();
    expect(view.api.state.screens.find((s) => s.id === 12)?.documentationStatus).toBe('IN_REVIEW');
    expect(view.api.callsTo('PUT /screens/{id}/status')).toHaveLength(1);
  });

  it('lets the user save with fields still missing, and sends nothing to review', async () => {
    const user = setupUser();
    const view = await openEditAt('?tab=template&submit=1');
    await replaceText(user, field('Known issues'), 'Double save under load.');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Screen saved.')).toBeVisible();
    expect(view.api.callsTo('PUT /screens/{id}/status')).toHaveLength(0);
  });

  it('shows the S-44 banner of the edit page if someone else saved meanwhile', async () => {
    const user = setupUser();
    const view = await openEditAt('?tab=template&submit=1');
    await screen.findByText(BANNER);
    view.api.state.versions.set(12, 9);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      (await screen.findAllByText(/Someone else saved changes to this screen after you opened it/))
        .length,
    ).toBeGreaterThan(0);
  });

  it('keeps working when the tab is changed: the URL keeps the signal', async () => {
    const user = setupUser();
    const view = await openEditAt('?tab=template&submit=1');
    await screen.findByText(BANNER);

    await user.click(screen.getByRole('tab', { name: 'Components & navigation' }));

    expect(view.router.state.location.search).toContain('submit=1');
    expect(view.router.state.location.search).toContain('tab=components');
    await user.click(screen.getByRole('tab', { name: 'Template' }));
    expect(await screen.findAllByText(REQUIRED)).toHaveLength(2);
  });

  it('draws nothing without the signal', async () => {
    await openEditAt('?tab=template');

    expect(screen.queryByText(/Complete all seven template fields/)).not.toBeInTheDocument();
    expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
    expect(field('Known issues')).toBeValid();
  });

  it('draws nothing when the screen is no longer In progress', async () => {
    await openEditAt('?tab=template&submit=1', 'DRAFT');

    expect(screen.queryByText(/Complete all seven template fields/)).not.toBeInTheDocument();
    expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
  });

  it('puts the banner among the alerts of the page and not in the detail', async () => {
    const user = setupUser();
    await openDetail();

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await screen.findByRole('heading', { name: /^Edit /, level: 1 });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Missing: Known issues, Risks\./)).toBeInTheDocument();
  });
});
