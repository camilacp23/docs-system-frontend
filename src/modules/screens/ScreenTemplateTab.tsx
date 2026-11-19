// ScreenTemplateTab: the Template tab of the screen detail (S-19, S-19r), read only. Two cards across the page:
//   Template progress: the progress "n of 7" with its bar across the card, under it the seven fields as chips (done or still to write; each one
//   goes to its text), a row of facts (status, author, last update, Miro diagram, pending to-dos, comments) and the elements the screen is
//   linked to;
//   Documentation: the fields with their text (OnStart in IBM Plex Mono, "Not documented yet." when a field has no
//   content) in two columns. A field has content when it is not null and not empty after trimming (D-81, the rule of the
//   server).
// The facts have the "Pending to-dos" row of the frame ("3 in Jira", "—" when none) and the "Comments" row of P-01 (the
// comment count, which follows the Comments tab).
// Props: screen, pendingSubtasks (the count to show: the detail's `pendingSubtasks`, or the one the Future to do tab computed
// from the tree once it has been read), commentCount.
import { Check, Circle, FileText, Layers } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH, StatusTag, Tag, ToneCard } from '../../components/ui';

import { formatTimestamp } from '../variables/variableLabels';

import { MiroLink } from './MiroLink';
import { toTagStatus } from './screenLabels';
import type { Screen } from './screenTypes';
import { hasContent, TEMPLATE_FIELDS, templateProgress } from './templateFields';

const NOT_DOCUMENTED_TEXT = 'Not documented yet.';

function fieldAnchor(key: string): string {
  return `template-field-${key}`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-micro font-bold tracking-wider text-screen-ink uppercase">{label}</dt>
      <dd className="text-body-lg text-ink-900">{children}</dd>
    </div>
  );
}

function unique(names: readonly string[]): string[] {
  return [...new Set(names)];
}

export function ScreenTemplateTab({
  screen,
  pendingSubtasks,
  commentCount,
}: {
  screen: Screen;
  pendingSubtasks: number;
  commentCount: number;
}) {
  const done = templateProgress(screen.template);
  const total = TEMPLATE_FIELDS.length;
  const variables = unique(screen.variableLinks.map((link) => link.variable.name));
  const collections = unique(screen.collectionLinks.map((link) => link.collection.name));
  const components = screen.components.map((component) => component.name);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ToneCard
        title="Template progress"
        tone="screen"
        description="How much of the standard template is written"
        icon={<Layers size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        flush
      >
        <div className="flex flex-col gap-5 px-5 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-body-lg font-semibold text-ink-900">Fields with content</span>
              <span className="text-body-lg font-bold text-screen-ink">
                {done} of {total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Template progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-valuetext={`${done} of ${total}`}
              className="h-2.5 overflow-hidden rounded-pill bg-disabled-bg"
            >
              <div
                className="h-full rounded-pill bg-linear-to-r from-screen to-screen-light"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
          <section
            aria-label="Template fields"
            className="flex flex-col gap-2.5 border-t border-divider pt-4"
          >
            <h3 className="text-micro font-bold tracking-wider text-screen-ink uppercase">
              {total} template fields
            </h3>
            <ul className="flex flex-wrap gap-2">
              {TEMPLATE_FIELDS.map((field) => {
                const filled = hasContent(screen.template[field.key]);
                return (
                  <li key={field.key}>
                    <a
                      href={`#${fieldAnchor(field.key)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(fieldAnchor(field.key))?.scrollIntoView?.({
                          block: 'nearest',
                        });
                      }}
                      className={cx(
                        'flex items-center gap-1.5 rounded-pill border px-3 py-1 text-label font-medium transition-colors duration-150 motion-reduce:transition-none',
                        filled
                          ? 'border-success-border bg-success-bg text-success-ink hover:border-success'
                          : 'border-border-subtle bg-surface text-ink-700 hover:border-screen-border hover:bg-screen-soft',
                      )}
                    >
                      {filled ? (
                        <Check aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH + 0.5} />
                      ) : (
                        <Circle aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                      )}
                      <span>{field.label}</span>
                      <span className="sr-only">{filled ? '(done)' : '(to write)'}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider bg-screen-soft/30 px-5 py-4 lg:grid-cols-6">
          <Fact label="Status">
            <StatusTag status={toTagStatus(screen.documentationStatus)} />
          </Fact>
          <Fact label="Author">{screen.author.name}</Fact>
          <Fact label="Updated">{formatTimestamp(screen.updatedAt)}</Fact>
          <Fact label="Miro diagram">
            {screen.miroLink === null ? '—' : <MiroLink href={screen.miroLink}>Open</MiroLink>}
          </Fact>
          <Fact label="Pending to-dos">
            {pendingSubtasks > 0 ? `${pendingSubtasks} in Jira` : '—'}
          </Fact>
          <Fact label="Comments">{commentCount}</Fact>
        </dl>
        <section
          aria-label="Linked elements"
          className="flex flex-col gap-2 border-t border-divider px-5 py-4"
        >
          <h3 className="text-micro font-bold tracking-wider text-screen-ink uppercase">
            Linked elements
          </h3>
          {variables.length + collections.length + components.length === 0 ? (
            <p className="text-small text-ink-500">Nothing is linked yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-small text-ink-700 lg:grid-cols-3">
              {variables.length > 0 && (
                <li>
                  <strong className="text-ink-900">
                    {variables.length} {variables.length === 1 ? 'variable' : 'variables'}
                  </strong>{' '}
                  · {variables.join(', ')}
                </li>
              )}
              {collections.length > 0 && (
                <li>
                  <strong className="text-ink-900">
                    {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
                  </strong>{' '}
                  · {collections.join(', ')}
                </li>
              )}
              {components.length > 0 && (
                <li>
                  <strong className="text-ink-900">
                    {components.length} {components.length === 1 ? 'component' : 'components'}
                  </strong>{' '}
                  · {components.join(', ')}
                </li>
              )}
            </ul>
          )}
        </section>
      </ToneCard>

      <ToneCard
        title="Documentation"
        tone="teal"
        description="The standard template of the screen"
        icon={<FileText size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {TEMPLATE_FIELDS.map((field) => {
            const text = screen.template[field.key];
            const filled = hasContent(text);
            return (
              <section
                key={field.key}
                id={fieldAnchor(field.key)}
                aria-label={field.label}
                className="flex min-w-0 flex-col gap-2 rounded-card border border-border-subtle p-4"
              >
                <header className="flex items-center justify-between gap-3">
                  <h3 className="text-body-lg font-semibold text-ink-900">{field.label}</h3>
                  <Tag tone={filled ? 'success' : 'neutral'}>{filled ? 'Done' : 'To write'}</Tag>
                </header>
                {filled ? (
                  field.mono ? (
                    <pre className="overflow-x-auto rounded-chip border border-border-subtle bg-search-bg px-3.5 py-3 font-mono text-label whitespace-pre-wrap text-ink-900">
                      {text}
                    </pre>
                  ) : (
                    <p className="text-body-lg whitespace-pre-wrap text-ink-700">{text}</p>
                  )
                ) : (
                  <p className="text-body text-ink-500">{NOT_DOCUMENTED_TEXT}</p>
                )}
              </section>
            );
          })}
        </div>
      </ToneCard>
    </div>
  );
}
