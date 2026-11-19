// ScreenTemplateFields: the Template tab of the screen edit page (S-20), in the style of the edit variable page: two numbered
// bands in one card, Basics (the name and the link to the Miro diagram) and Template (the seven fields of the standard
// template, SRS Table 28, in template order, in two columns).
// Props: values (ScreenEditValues), onChange(next values), errors, applicationName, isAppContext, disabled (while saving).
// The name of App (OnStart) is shown but cannot be changed (D-87). The Miro link accepts https addresses only and has
// an "Open" link next to it when what is typed is a valid address. OnStart is Power Fx: IBM Plex Mono. The hint of the
// Template band says how many of the seven fields have content (the rule of the server, D-81).
import { FormField, Textarea, TextField } from '../../components/ui';
import { PageBand } from '../shared/PageBand';

import { MiroLink } from './MiroLink';
import {
  FIELD_LABEL,
  MIRO_LINK_MAX_LENGTH,
  MIRO_LINK_PATTERN,
  NAME_MAX_LENGTH,
  type ScreenEditErrors,
  type ScreenEditValues,
} from './screenEditForm';
import { hasContent, TEMPLATE_FIELDS, type TemplateKey } from './templateFields';

/** The help under each field (frame S-20); the one of Risks is derived, pending confirmation in design. */
const FIELD_HELP: Record<TemplateKey, string> = {
  onStart: 'Initialization logic that runs when the screen loads.',
  workingProcess: 'What the user does, in what order, and what each action produces.',
  architecture: 'Main components, containers and their organization.',
  dataModel: 'Variables and collections the screen uses or modifies.',
  requirements: 'Functional or business requirements the screen must satisfy.',
  knownIssues: 'Known errors or unexpected behaviours.',
  risks: 'Risks the team has identified for this screen.',
};

interface ScreenTemplateFieldsProps {
  values: ScreenEditValues;
  onChange: (next: ScreenEditValues) => void;
  errors: ScreenEditErrors;
  applicationName: string;
  isAppContext: boolean;
  disabled?: boolean;
}

export function ScreenTemplateFields({
  values,
  onChange,
  errors,
  applicationName,
  isAppContext,
  disabled = false,
}: ScreenTemplateFieldsProps) {
  const done = TEMPLATE_FIELDS.filter((field) => hasContent(values.template[field.key])).length;
  const link = values.miroLink.trim();
  const openable =
    link !== '' && link.length <= MIRO_LINK_MAX_LENGTH && MIRO_LINK_PATTERN.test(link);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <PageBand
        step={1}
        tone="accent"
        title="Basics"
        label="Basics"
        description="Name and the link to the Miro diagram."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-2">
          <FormField
            label={FIELD_LABEL.name}
            required
            error={errors.name}
            help={
              isAppContext ? (
                "The name of App (OnStart) can't be changed."
              ) : (
                <span className="flex justify-between gap-2">
                  <span>Unique in {applicationName}</span>
                  <span aria-hidden="true">
                    {values.name.length}/{NAME_MAX_LENGTH}
                  </span>
                </span>
              )
            }
          >
            {(control) => (
              <TextField
                {...control}
                data-first
                mono
                autoComplete="off"
                spellCheck={false}
                disabled={disabled || isAppContext}
                value={values.name}
                onChange={(event) => {
                  onChange({ ...values, name: event.target.value });
                }}
              />
            )}
          </FormField>
          <FormField
            label={FIELD_LABEL.miroLink}
            error={errors.miroLink}
            help="Optional · https only"
          >
            {(control) => (
              <div className="flex items-start gap-2">
                <TextField
                  {...control}
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://miro.com/app/board/…"
                  disabled={disabled}
                  value={values.miroLink}
                  onChange={(event) => {
                    onChange({ ...values, miroLink: event.target.value });
                  }}
                />
                {openable && (
                  <MiroLink
                    href={link}
                    className="h-9 shrink-0 rounded-control border border-border-control bg-surface px-3.5 text-body shadow-button"
                  >
                    Open
                  </MiroLink>
                )}
              </div>
            )}
          </FormField>
        </div>
      </PageBand>
      <PageBand
        step={2}
        tone="success"
        title="Template"
        label="Template"
        description={`${done} of ${TEMPLATE_FIELDS.length} template fields completed`}
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-2">
          {TEMPLATE_FIELDS.map((field) => (
            <FormField
              key={field.key}
              label={field.label}
              error={errors.template?.[field.key]}
              help={FIELD_HELP[field.key]}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={4}
                  spellCheck={field.mono ? false : undefined}
                  className={field.mono ? 'font-mono text-label' : undefined}
                  disabled={disabled}
                  value={values.template[field.key]}
                  onChange={(event) => {
                    onChange({
                      ...values,
                      template: { ...values.template, [field.key]: event.target.value },
                    });
                  }}
                />
              )}
            </FormField>
          ))}
        </div>
      </PageBand>
    </div>
  );
}
