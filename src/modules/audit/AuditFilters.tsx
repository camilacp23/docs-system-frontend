// AuditFilters: the filter bar of the audit log (S-32, S-32d, S-32f): period, user, element type, element id, action
// and application, as one centered row of pills on a soft teal band (the same look as the filters of Variables). A select with
// a value turns teal, so the active filters can be seen at a glance; the pills grow to the text they show, so a chosen value is
// never cut. Every filter lives in the URL (useAuditListParams).
// Props: params, setParams, range (the days in use: the URL's or Last 7 days), today, applicationName (the selected
// application, for "Application: <name>"), isDeveloper (the user filter is fixed on the Developer), errors (a text
// under the control it belongs to, from the client or from the API's 400).
// Every control has an accessible name. The element id is enabled only with an element type (the API asks for
// `entityType` with `entityId`), its text goes to the URL after the usual pause (useSearchDraft), and changing the
// type clears it because an id means something only inside its table.
import { Blocks, CircleAlert, Hash, Shapes, Zap } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import type { ReactNode } from 'react';

import { cx, FilterSelect, ICON_STROKE_WIDTH } from '../../components/ui';
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
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
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
    <label
      className={cx(
        'flex h-9 w-full items-center gap-2 rounded-pill border bg-surface pr-3.5 pl-3.5 text-ink-700 shadow-button transition-colors duration-150 motion-reduce:transition-none',
        invalid
          ? 'border-danger'
          : value !== ''
            ? 'border-audit bg-audit-soft text-audit-ink'
            : 'border-border-subtle focus-within:border-audit focus-within:bg-audit-soft hover:border-audit-border hover:bg-audit-soft',
        !typeChosen && 'cursor-not-allowed opacity-45',
      )}
      onMouseEnter={(event) => {
        if (typeChosen) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      }}
      onMouseLeave={() => {
        setTip(null);
      }}
    >
      <Hash aria-hidden="true" size={15} strokeWidth={ICON_STROKE_WIDTH} className="shrink-0" />
      <input
        type="text"
        aria-label="Element id"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder="Element id"
        maxLength={50}
        disabled={!typeChosen}
        title={typeChosen ? undefined : NEEDS_TYPE_REASON}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className="min-w-0 flex-1 bg-transparent font-mono text-label font-bold outline-none placeholder:font-sans placeholder:font-medium placeholder:text-ink-500 disabled:pointer-events-none"
      />
      {tip !== null && !typeChosen && (
        <span
          aria-hidden="true"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-chip bg-navy-950 px-2.5 py-1.5 text-label font-semibold whitespace-nowrap text-on-primary shadow-toast"
        >
          {NEEDS_TYPE_REASON}
        </span>
      )}
    </label>
  );
}

/** A captioned pair of filters, so the bar reads as three questions: when and where, who and what they did (side by side), on which element (below). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex min-w-0 flex-col gap-1.5">
      <p
        aria-hidden="true"
        className="text-micro font-bold tracking-wider text-audit-ink uppercase"
      >
        {title}
      </p>
      <div className="grid min-w-0 grid-cols-1 items-start gap-2.5 @min-[560px]:grid-cols-2">
        {children}
      </div>
    </div>
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
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
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
    <div className="@container border-b border-audit-border/60 bg-audit-soft/40 px-5 py-4">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 @min-[900px]:grid-cols-2">
        <Group title="When and where">
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
          <Control id={`${ids}-application`} className="">
            <FilterSelect
              tone="audit"
              label="Application"
              icon={<Blocks size={15} strokeWidth={ICON_STROKE_WIDTH} />}
              value={params.application === 'all' ? 'all' : ''}
              fullWidth
              selectClassName="max-w-none"
              onChange={(next) => {
                setParams({ application: next === 'all' ? 'all' : 'selected' });
              }}
            >
              <option value="">
                {applicationName === null ? 'Selected' : `${applicationName} (selected)`}
              </option>
              <option value="all">All applications</option>
            </FilterSelect>
          </Control>
        </Group>
        <Group title="Who and what they did">
          <Control id={errorId('actor')} error={errors.actor} className="">
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
          <Control id={errorId('action')} error={errors.action} className="">
            <FilterSelect
              tone="audit"
              label="Action"
              icon={<Zap size={15} strokeWidth={ICON_STROKE_WIDTH} />}
              value={params.action}
              invalid={errors.action !== undefined}
              describedBy={describedBy('action')}
              fullWidth
              selectClassName="max-w-none"
              onChange={(next) => {
                setParams({ action: next as AuditAction | '' });
              }}
            >
              <option value="">All actions</option>
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABEL[action]}
                </option>
              ))}
            </FilterSelect>
          </Control>
        </Group>
        <Group title="On which element">
          <Control id={errorId('type')} error={errors.type} className="">
            <FilterSelect
              tone="audit"
              label="Element type"
              icon={<Shapes size={15} strokeWidth={ICON_STROKE_WIDTH} />}
              value={params.type}
              invalid={errors.type !== undefined}
              describedBy={describedBy('type')}
              fullWidth
              selectClassName="max-w-none"
              onChange={(next) => {
                setParams({ type: next as AuditEntityType | '', entityId: '' });
              }}
            >
              <option value="">All types</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABEL[type]}
                </option>
              ))}
            </FilterSelect>
          </Control>
          <Control id={errorId('entityId')} error={errors.entityId} className="">
            <ElementIdField
              key={params.type}
              value={params.entityId}
              typeChosen={params.type !== ''}
              describedBy={describedBy('entityId')}
              invalid={errors.entityId !== undefined}
              setParams={setParams}
            />
          </Control>
        </Group>
      </div>
    </div>
  );
}
