// The Jira status pill of the top bar (D-100): not checked until something is learned, then the last known availability.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JiraStatusPill } from '../../layout/JiraStatusPill';
import { JiraStatusProvider } from '../../layout/JiraStatusProvider';
import { useJiraStatus } from '../../layout/jiraStatusContext';
import { renderApp } from '../helpers/renderApp';
import { setupUser } from '../helpers/setupUser';

function Reporter() {
  const { report } = useJiraStatus();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          report(true);
        }}
      >
        up
      </button>
      <button
        type="button"
        onClick={() => {
          report(false);
        }}
      >
        down
      </button>
    </>
  );
}

describe('JiraStatusPill', () => {
  it('starts as "Jira not checked" and follows the last report, in memory', async () => {
    const user = setupUser();
    render(
      <JiraStatusProvider>
        <Reporter />
        <JiraStatusPill />
      </JiraStatusProvider>,
    );
    const pill = screen.getByText('Jira not checked');
    expect(pill).toHaveAttribute('data-jira-status', 'unknown');

    await user.click(screen.getByRole('button', { name: 'up' }));
    expect(screen.getByText('Jira connected')).toHaveAttribute('data-jira-status', 'available');

    await user.click(screen.getByRole('button', { name: 'down' }));
    expect(screen.getByText('Jira unavailable')).toHaveAttribute('data-jira-status', 'unavailable');
    expect(screen.queryByText('Jira connected')).not.toBeInTheDocument();
  });

  it('is not a live region and has no role of its own (the pages say what changed)', () => {
    render(
      <JiraStatusProvider>
        <JiraStatusPill />
      </JiraStatusProvider>,
    );
    expect(screen.getByText('Jira not checked')).not.toHaveAttribute('role');
    expect(screen.getByText('Jira not checked')).not.toHaveAttribute('aria-live');
  });

  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    'is in the top bar of the %s before anything is known',
    async (role) => {
      await renderApp({ role });
      const pill = await screen.findByText('Jira not checked');
      expect(pill.closest('header')).not.toBeNull();
    },
  );
});
