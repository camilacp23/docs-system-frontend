// AuditFilters: the filter bar of the audit log (S-32, S-32d, S-32f): period, user, element type, element id, action
// and application. Every filter lives in the URL (useAuditListParams).
// Props: params, setParams, range (the days in use: the URL's or Last 7 days), today, applicationName (the selected
// application, for "Application: <name>"), isDeveloper (the user filter is fixed on the Developer), errors (a text
// under the control it belongs to, from the client or from the API's 400).
// Every control has an accessible name. The element id is enabled only with an element type (the API asks for
// `entityType` with `entityId`), its text goes to the URL after the usual pause (useSearchDraft), and changing the
// type clears it because an id means something only inside its table.
import { CircleAlert } from 'lucide-react';
import { useCallback, useId } from 'react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { useSearchDraft } from '../../hooks/useSearchDraft';

import { AuditDateFilter } from './AuditDateFilter';
import { AuditOwnActionsFilter, AuditUserFilter } from './AuditUserFilter';
import { ACTIONS, ACTION_LABEL, ENTITY_TYPES, ENTITY_TYPE_LABEL } from './auditLabels';
import type { AuditAction, AuditEntityType } from './auditLabels';
import type { AuditListParams } from './useAuditListParams';

export type AuditControl = 'date' | 'type' | 'entityId' | 'action' | 'actor';

interface AuditFiltersProps {
  params: AuditListParams;
  setParams: (patch: Partial<AuditListParams>, options?: { replace?: boolean }) => void;
  range: { from: string; to: string };
  today: string;
  applicationName: string | null;
  isDeveloper: boolean;
  errors: Partial<Record<AuditControl, string>>;
}

export const NEEDS_TYPE_REASON = 'Choose an element type first.';

/**
 * The element id: its text goes to the URL after the usual pause. The page gives it a `key` made of the element type,
 * so a new type starts with an empty text instead of an old draft.
 */
function ElementIdField({
  value,
  typeChosen,
  describedBy,
  invalid,
  setParams,
}: {
  value: string;
  typeChosen: boolean;
  describedBy?: string;
  invalid: boolean;
  setParams: AuditFiltersProps['setParams'];
}) {
  const [text, setText] = useSearchDraft(
    value,
    useCallback(
      (entityId: string) => {
        setParams({ entityId }, { replace: true });
      },
      [setParams],
    ),
  );
  return (
    <TextField
      aria-label="Element id"
      aria-describedby={describedBy}
      invalid={invalid}
      placeholder="Element id"
      maxLength={50}
      mono
      disabled={!typeChosen}
      title={typeChosen ? undefined : NEEDS_TYPE_REASON}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
    />
  );
}

function Control({
  id,
  error,
  className,
  children,
}: {
  id: string;
  error?: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {children}
      {error && (
        <p id={id} className="flex items-start gap-1 text-small text-danger">
          <CircleAlert
            aria-hidden="true"
            size={14}
            strokeWidth={ICON_STROKE_WIDTH}
            className="mt-px shrink-0"
          />
          {error}
        </p>
      )}
    </div>
  );
}

export function AuditFilters({
  params,
  setParams,
  range,
  today,
  applicationName,
  isDeveloper,
  errors,
}: AuditFiltersProps) {
  const ids = useId();
  const errorId = (control: AuditControl) => `${ids}-${control}-error`;
  const describedBy = (control: AuditControl) =>
    errors[control] === undefined ? undefined : errorId(control);

  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-divider bg-search-bg/60 p-4">
      <Control id={errorId('date')} error={errors.date} className="">
        <AuditDateFilter
          from={range.from}
          to={range.to}
          today={today}
          error={errors.date}
          onApply={(from, to) => {
            setParams({ from, to });
          }}
        />
      </Control>
      <Control id={errorId('actor')} error={errors.actor} className="w-52">
        {isDeveloper ? (
          <AuditOwnActionsFilter reasonId={`${ids}-own-actions`} />
        ) : (
          <AuditUserFilter
            value={params.actor}
            invalid={errors.actor !== undefined}
            describedBy={describedBy('actor')}
            onChange={(actor) => {
              setParams({ actor });
            }}
          />
        )}
      </Control>
      <Control id={errorId('type')} error={errors.type} className="w-56">
        <Select
          aria-label="Element type"
          aria-describedby={describedBy('type')}
          invalid={errors.type !== undefined}
          value={params.type}
          onChange={(event) => {
            setParams({ type: event.target.value as AuditEntityType | '', entityId: '' });
          }}
        >
          <option value="">Element type</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {ENTITY_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </Control>
      <Control id={errorId('entityId')} error={errors.entityId} className="w-44">
        <ElementIdField
          key={params.type}
          value={params.entityId}
          typeChosen={params.type !== ''}
          describedBy={describedBy('entityId')}
          invalid={errors.entityId !== undefined}
          setParams={setParams}
        />
      </Control>
      <Control id={errorId('action')} error={errors.action} className="w-36">
        <Select
          aria-label="Action"
          aria-describedby={describedBy('action')}
          invalid={errors.action !== undefined}
          value={params.action}
          onChange={(event) => {
            setParams({ action: event.target.value as AuditAction | '' });
          }}
        >
          <option value="">Action</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABEL[action]}
            </option>
          ))}
        </Select>
      </Control>
      <Control id={`${ids}-application`} className="w-56">
        <Select
          aria-label="Application"
          value={params.application}
          onChange={(event) => {
            setParams({ application: event.target.value === 'all' ? 'all' : 'selected' });
          }}
        >
          <option value="selected">
            {applicationName === null ? 'Application' : `Application: ${applicationName}`}
          </option>
          <option value="all">All applications</option>
        </Select>
      </Control>
    </div>
  );
}
