// JiraLink: the "Open in Jira" link of an issue (S-23). Props: ticket ({ jiraIssueKey, url }), className.
// It opens in another tab with rel="noopener noreferrer" and names the issue for screen readers ("Open in Jira
// TECHEA-103 (opens in a new tab)"). Only an http or https address is drawn as a link (the contract gives the base URL
// of Jira followed by /browse/<key>, or null when Jira has no base URL, D-111); anything else renders nothing.
import { ExternalLink } from 'lucide-react';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { OPEN_IN_JIRA_LABEL, safeJiraUrl } from './jiraTree';

interface JiraLinkProps {
  ticket: { jiraIssueKey: string; url: string | null };
  className?: string;
}

export function JiraLink({ ticket, className }: JiraLinkProps) {
  const href = safeJiraUrl(ticket.url);
  if (href === null) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip font-semibold whitespace-nowrap text-primary hover:underline',
        className,
      )}
    >
      {OPEN_IN_JIRA_LABEL}
      <ExternalLink aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
      <span className="sr-only">{` ${ticket.jiraIssueKey} (opens in a new tab)`}</span>
    </a>
  );
}
