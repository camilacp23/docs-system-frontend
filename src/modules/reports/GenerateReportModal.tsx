// GenerateReportModal: "Generate report" (S-34, flow 5; FR-22, D-115). The one dialog used by the reports page and by the
// dashboard button. Rendered only while it is open (its state starts fresh each time). Props: applicationId,
// applicationName, onClose, onCreated(report, etag) (called with the new PENDING report after the 202; the caller closes
// the dialog and shows the report).
// Fields: Title (n/200), Format (PDF / Excel cards), Include (Screens, Variables, Collections, Components chips and the
// "Include status summary" switch, D-134), Documentation status (chips) and Screens (searching selector, D-139) that
// apply only when Screens or Components is included, "Include dependencies" and "Publish when ready". The footer sums up
// the choice as the frame does and says that the work goes on in the background.
// Invalid requests are made impossible, not just refused (D-115): the status chips and the screen selector are off
// without Screens or Components (and are cleared), nothing past 500 screens, and Generate checks that the title is not
// blank and that something is included. Whatever the API still refuses is shown in its field (a 400 with the position
// of the item: the chip of that status or screen is marked; a 404 for a screen the same) and the rest in a banner.
// Layout (the one of the New variable modal): wide, two columns of headed groups: Basics (title, format) and Options
// (dependencies, publish) on the left, Content (types, statuses, screens) on the right.
// After a failed submit a danger banner says "N fields need attention." with a link to each field (Table 58).
// Generating is allowed in an archived application (D-47): only being offline disables it, with the reason.
import { Clock, FileText, Layers, ListTree, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { isApiError } from '../../api/ApiError';
import {
  getErrorField,
  getErrorMessage,
  getFieldErrors,
  getThrownMessage,
} from '../../api/messages';
import { useApi } from '../../api/useApi';
import {
  Banner,
  Button,
  ChoiceCard,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  Switch,
  TextField,
  ToggleChip,
  cx,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { invalidFields, type InvalidField } from '../collections/invalidFields';
import type { ApiDocumentationStatus } from '../screens/screenTypes';

import { ModalGroup } from '../shared/ModalGroup';

import { createReport } from './createReport';
import {
  appliesToScreens,
  buildRequest,
  ELEMENT_OPTIONS,
  EMPTY_FORM,
  hasErrors,
  STATUS_OPTIONS,
  summaryText,
  TITLE_MAX,
  toggleElement,
  toggleStatus,
  validateForm,
  type ReportForm,
} from './reportForm';
import type { Report, ReportFormat } from './reportModel';
import {
  CANCEL_LABEL,
  DEPENDENCIES_HELP,
  DEPENDENCIES_LABEL,
  dialogDescription,
  DIALOG_TITLE,
  FOOTER_NOTE,
  FORMAT_DESCRIPTION,
  FORMAT_FIELD_LABEL,
  FORMAT_LABEL,
  FORMAT_TILE,
  fieldsNeedAttention,
  INCLUDE_LABEL,
  INCLUDE_REQUIRED_TEXT,
  PUBLISH_HELP,
  PUBLISH_LABEL,
  SCREENS_HELP,
  SCREENS_LABEL,
  STATUS_DISABLED_HELP,
  STATUS_FIELD_LABEL,
  STATUS_HELP,
  STATUS_SUMMARY_HELP,
  STATUS_SUMMARY_LABEL,
  SUBMIT_LABEL,
  TITLE_LABEL,
} from './reportTexts';
import { ScreenPicker } from './ScreenPicker';

export interface GenerateReportModalProps {
  applicationId: number;
  applicationName: string;
  onClose: () => void;
  onCreated: (report: Report, etag: string | null) => void;
}

interface FieldTexts {
  title?: string;
  include?: string;
  statuses?: string;
  screens?: string;
}

interface Marked {
  statuses: ReadonlySet<ApiDocumentationStatus>;
  screens: ReadonlySet<number>;
}

const NO_MARKS: Marked = { statuses: new Set(), screens: new Set() };

const FIELD_LABELS: Record<string, string> = {
  title: TITLE_LABEL,
  'scope.elementTypes': INCLUDE_LABEL,
  'scope.elementTypes[]': INCLUDE_LABEL,
  'scope.screenIds': SCREENS_LABEL,
  'scope.screenIds[]': SCREENS_LABEL,
  'scope.documentationStatus': STATUS_FIELD_LABEL,
  'scope.documentationStatus[]': STATUS_FIELD_LABEL,
  'scope.includeStatusSummary': STATUS_SUMMARY_LABEL,
  'scope.includeDependencies': DEPENDENCIES_LABEL,
  publish: PUBLISH_LABEL,
};

/** Each field of the Content group sits in its own soft box, so the right column reads as three blocks. */
const CONTENT_BOX = 'rounded-card border border-border-subtle bg-search-bg/50 p-4';
const FORMATS: readonly ReportFormat[] = ['PDF', 'XLSX'];
const FORMAT_TILE_CLASS: Record<ReportFormat, string> = {
  PDF: 'bg-danger-bg text-danger',
  XLSX: 'bg-success-bg text-success-ink',
};

/** A group of controls (chips, cards) with a label, help and error that the group itself is described by. */
function GroupField({
  label,
  required,
  help,
  error,
  invalid,
  role = 'group',
  children,
  className,
  groupRef,
}: {
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  role?: 'group' | 'radiogroup';
  children: (describedBy: string | undefined, labelId: string) => ReactNode;
  className?: string;
  groupRef?: (element: HTMLDivElement | null) => void;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <span id={`${id}-label`} className="flex gap-0.5 text-label font-medium text-ink-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </span>
      <div
        ref={groupRef}
        role={role}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={required && role === 'radiogroup' ? true : undefined}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
      >
        {children(describedBy, `${id}-label`)}
      </div>
      {help && (
        <p id={helpId} className="text-small text-ink-500">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function GenerateReportModal({
  applicationId,
  applicationName,
  onClose,
  onCreated,
}: GenerateReportModalProps) {
  const client = useApi();
  const { blocked, reason } = useOfflineBlock();
  const formId = useId();
  const reasonId = useId();
  const summaryId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ReportForm>(EMPTY_FORM);
  const [texts, setTexts] = useState<FieldTexts>({});
  const [marked, setMarked] = useState<Marked>(NO_MARKS);
  const [banner, setBanner] = useState<string | null>(null);
  const [summary, setSummary] = useState<InvalidField[]>([]);
  const [failToken, setFailToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const sent = useRef<ReturnType<typeof buildRequest> | null>(null);

  // After a failed submit: the controls that are invalid now give the "N fields need attention." summary and the first gets focus.
  useEffect(() => {
    if (failToken === 0) return;
    const fields = invalidFields(formRef.current);
    setSummary(fields);
    focusField(fields[0]?.element);
  }, [failToken]);

  const change = (patch: Partial<ReportForm>, clear: Array<keyof FieldTexts> = []) => {
    setForm((current) => ({ ...current, ...patch }));
    setTexts((current) => {
      const next = { ...current };
      for (const key of clear) next[key] = undefined;
      return next;
    });
    setBanner(null);
  };

  const applies = appliesToScreens(form);

  const fail = (nextTexts: FieldTexts, nextMarked: Marked, nextBanner: string | null) => {
    setTexts(nextTexts);
    setMarked(nextMarked);
    setBanner(nextBanner);
    setFailToken((token) => token + 1);
  };

  /** What the API refused, put in its field with the position (D-140); the rest goes to the banner. */
  const showServerError = (thrown: unknown) => {
    if (!isApiError(thrown)) {
      fail({}, NO_MARKS, getThrownMessage(thrown));
      return;
    }
    const request = sent.current;
    const nextTexts: FieldTexts = {};
    const statuses = new Set<ApiDocumentationStatus>();
    const screens = new Set<number>();
    let rest: string | null = null;

    const place = (field: string, index: number | null, text: string) => {
      if (field === 'title') nextTexts.title ??= text;
      else if (field.startsWith('scope.elementTypes')) nextTexts.include ??= text;
      else if (field.startsWith('scope.screenIds')) {
        nextTexts.screens ??= text;
        if (index !== null) screens.add(index);
      } else if (field.startsWith('scope.documentationStatus')) {
        nextTexts.statuses ??= text;
        const status = index === null ? undefined : request?.scope.documentationStatus?.[index];
        if (status) statuses.add(status);
      } else rest ??= text;
    };

    if (thrown.code === 'VALIDATION_ERROR') {
      for (const item of getFieldErrors(thrown, FIELD_LABELS)) {
        const text =
          item.field === 'scope.elementTypes' && item.rule === 'required'
            ? INCLUDE_REQUIRED_TEXT
            : item.message;
        place(item.field, item.index, text);
      }
      if (Object.keys(nextTexts).length === 0 && rest === null) rest = getErrorMessage(thrown);
    } else {
      const where = getErrorField(thrown);
      const text = getThrownMessage(thrown, { element: 'screen' });
      if (where !== null && where.field.startsWith('scope.')) place(where.field, where.index, text);
      else rest = text;
    }
    fail(nextTexts, { statuses, screens }, rest);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || submitting) return;
    const found = validateForm(form);
    if (hasErrors(found)) {
      fail({ title: found.title, include: found.include }, NO_MARKS, null);
      return;
    }
    setSubmitting(true);
    setTexts({});
    setMarked(NO_MARKS);
    setBanner(null);
    setSummary([]);
    const request = buildRequest(form, applicationId);
    sent.current = request;
    try {
      const created = await createReport(client, request, form.format);
      onCreated(created.report, created.etag);
    } catch (thrown) {
      showServerError(thrown);
    } finally {
      setSubmitting(false);
    }
  };

  const typesInvalid = texts.include !== undefined;

  return (
    <Modal
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="xl"
      initialFocusRef={titleRef}
      icon={<FileText size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={DIALOG_TITLE}
      description={dialogDescription(applicationName)}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 text-ink-700">
            <Clock
              aria-hidden="true"
              size={18}
              strokeWidth={ICON_STROKE_WIDTH}
              className="mt-0.5 shrink-0 text-ink-500"
            />
            <div className="min-w-0">
              <p
                id={summaryId}
                title={summaryText(form)}
                className="truncate text-label font-semibold"
              >
                {summaryText(form)}
              </p>
              {reason ? (
                <p id={reasonId} className="text-small text-warning-ink">
                  {reason}
                </p>
              ) : (
                <p className="text-small text-ink-500">{FOOTER_NOTE}</p>
              )}
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={submitting}>
              {CANCEL_LABEL}
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={submitting}
              disabled={blocked}
              aria-describedby={reason ? `${summaryId} ${reasonId}` : summaryId}
              iconLeft={<Sparkles aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              {SUBMIT_LABEL}
            </Button>
          </span>
        </div>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-4"
      >
        {summary.length > 0 && (
          <Banner tone="danger" lead={fieldsNeedAttention(summary.length)}>
            <span className="flex flex-wrap gap-x-3">
              {summary.map((field) => (
                <button
                  key={field.label}
                  type="button"
                  onClick={() => {
                    focusField(field.element);
                  }}
                  className="font-semibold underline underline-offset-2"
                >
                  {field.label}
                </button>
              ))}
            </span>
          </Banner>
        )}
        {banner !== null && <Banner tone="danger">{banner}</Banner>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
          <div className="flex flex-col gap-5">
            <ModalGroup
              title="Basics"
              icon={<ListTree size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <FormField
                label={TITLE_LABEL}
                required
                error={texts.title}
                help={
                  <span className="flex justify-end" aria-hidden="true">
                    {form.title.length}/{TITLE_MAX}
                  </span>
                }
              >
                {(control) => (
                  <TextField
                    {...control}
                    ref={titleRef}
                    autoComplete="off"
                    maxLength={TITLE_MAX}
                    disabled={submitting}
                    value={form.title}
                    onChange={(event) => {
                      change({ title: event.target.value }, ['title']);
                    }}
                  />
                )}
              </FormField>

              <GroupField label={FORMAT_FIELD_LABEL} required role="radiogroup">
                {() => (
                  <div className="grid grid-cols-2 gap-4">
                    {FORMATS.map((format) => (
                      <ChoiceCard
                        key={format}
                        name="report-format"
                        value={format}
                        checked={form.format === format}
                        disabled={submitting}
                        onChange={(next) => {
                          change({ format: next });
                        }}
                        title={FORMAT_LABEL[format]}
                        description={FORMAT_DESCRIPTION[format]}
                        badge={
                          <span
                            className={cx(
                              'flex size-10 items-center justify-center rounded-control font-mono text-micro font-bold',
                              FORMAT_TILE_CLASS[format],
                            )}
                          >
                            {FORMAT_TILE[format]}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </GroupField>
            </ModalGroup>
            <ModalGroup
              title="Options"
              icon={<SlidersHorizontal size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <div className="flex flex-col gap-3">
                <div className="rounded-control border border-border-control bg-surface px-3.5 py-3">
                  <Switch
                    reverse
                    checked={form.includeDependencies}
                    label={DEPENDENCIES_LABEL}
                    description={DEPENDENCIES_HELP}
                    disabled={submitting}
                    onChange={(next) => {
                      change({ includeDependencies: next });
                    }}
                  />
                </div>
                <div className="rounded-control border border-border-control bg-surface px-3.5 py-3">
                  <Switch
                    reverse
                    checked={form.publish}
                    label={PUBLISH_LABEL}
                    description={PUBLISH_HELP}
                    disabled={submitting}
                    onChange={(next) => {
                      change({ publish: next });
                    }}
                  />
                </div>
              </div>
            </ModalGroup>
          </div>
          <div className="flex flex-col gap-5 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <ModalGroup title="Content" icon={<Layers size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
              <GroupField
                label={INCLUDE_LABEL}
                required
                error={texts.include}
                invalid={typesInvalid}
                className={CONTENT_BOX}
              >
                {(describedBy) => (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {ELEMENT_OPTIONS.map((option) => (
                        <ToggleChip
                          key={option.value}
                          pressed={form.elementTypes.includes(option.value)}
                          invalid={typesInvalid}
                          disabled={submitting}
                          aria-describedby={describedBy}
                          onChange={(on) => {
                            setForm((current) => toggleElement(current, option.value, on));
                            setTexts((current) => ({ ...current, include: undefined }));
                          }}
                        >
                          {option.label}
                        </ToggleChip>
                      ))}
                    </div>
                    <Switch
                      checked={form.includeStatusSummary}
                      label={STATUS_SUMMARY_LABEL}
                      description={STATUS_SUMMARY_HELP}
                      disabled={submitting}
                      onChange={(next) => {
                        change({ includeStatusSummary: next }, ['include']);
                      }}
                    />
                  </>
                )}
              </GroupField>

              <GroupField
                label={STATUS_FIELD_LABEL}
                help={applies ? STATUS_HELP : STATUS_DISABLED_HELP}
                error={texts.statuses}
                invalid={texts.statuses !== undefined}
                className={CONTENT_BOX}
              >
                {(describedBy) => (
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => (
                      <ToggleChip
                        key={option.value}
                        pressed={form.documentationStatus.includes(option.value)}
                        invalid={marked.statuses.has(option.value)}
                        disabled={!applies || submitting}
                        aria-describedby={describedBy}
                        onChange={(on) => {
                          setForm((current) => toggleStatus(current, option.value, on));
                          setTexts((current) => ({ ...current, statuses: undefined }));
                          setMarked((current) => ({ ...current, statuses: new Set() }));
                        }}
                      >
                        {option.label}
                      </ToggleChip>
                    ))}
                  </div>
                )}
              </GroupField>

              <GroupField
                label={SCREENS_LABEL}
                help={applies ? SCREENS_HELP : STATUS_DISABLED_HELP}
                error={texts.screens}
                invalid={texts.screens !== undefined}
                className={CONTENT_BOX}
              >
                {(describedBy, labelId) => (
                  <ScreenPicker
                    applicationId={applicationId}
                    labelledBy={labelId}
                    value={form.screens}
                    disabled={!applies || submitting}
                    invalid={texts.screens !== undefined}
                    errorPositions={marked.screens}
                    describedBy={describedBy}
                    onChange={(screens) => {
                      change({ screens }, ['screens']);
                      setMarked((current) => ({ ...current, screens: new Set() }));
                    }}
                  />
                )}
              </GroupField>
            </ModalGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Puts the focus on a control of the form: a group (chips, cards) gives it to its first control. */
function focusField(element: HTMLElement | undefined): void {
  if (element === undefined) return;
  const role = element.getAttribute('role');
  if (role === 'group' || role === 'radiogroup') {
    const first = element.querySelector<HTMLElement>(
      'input:checked, input, button:not([disabled])',
    );
    (first ?? element).focus();
    return;
  }
  element.focus();
}
