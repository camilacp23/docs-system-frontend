// jiraTypes: the shapes of the Jira to-dos of a screen taken from the generated contract types (never hand-written).
import type { components } from '../../api/schema';

export type JiraTicket = components['schemas']['JiraTicket'];
export type JiraTree = components['schemas']['JiraTreeEnvelope']['data'];
export type JiraStory = JiraTree['stories'][number];
export type JiraSync = JiraTree['sync'];
export type JiraTicketCreate = components['schemas']['JiraTicketCreate'];
export type JiraIssueText = components['schemas']['JiraIssueText'];
export type JiraCreated = components['schemas']['JiraTicketCreatedEnvelope']['data'];
export type JiraStatusCategory = components['schemas']['JiraStatusCategory'];
