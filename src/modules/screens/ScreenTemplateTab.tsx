// ScreenTemplateTab: the Template tab of the screen detail (S-19, S-19r), read only.
// Three cards as in the frame: the list of the seven template fields (done or still to write), the fields with
// their text (OnStart in IBM Plex Mono, "Not documented yet." when a field has no content) and the side card with
// the progress "n of 7", the status, the author, the Miro link and the elements the screen is linked to. A field
// has content when it is not null and not empty after trimming (D-81, the rule of the server).
// The side card has the "Pending to-dos" row of the frame ("3 in Jira", "—" when none) and the "Comments" row of P-01
// (the comment count, which follows the Comments tab).
// Props: screen, pendingSubtasks (the count to show: the detail's `pendingSubtasks`, or the one the Future to do tab computed
// from the tree once it has been read).
import { Check, Circle, FileText, Layers, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH, SectionCard, StatusTag, Tag } from '../../components/ui';

import { MiroLink } from './MiroLink';
import { toTagStatus } from './screenLabels';
import type { Screen } from './screenTypes';
import { hasContent, TEMPLATE_FIELDS, templateProgress } from './templateFields';

const NOT_DOCUMENTED_TEXT = 'Not documented yet.';

function fieldAnchor(key: string): string {
  return `template-field-${key}`;
}

function listText(labels: readonly string[]): string {
  return labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] ?? ''}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-divider py-2.5 text-label first:border-t-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold text-ink-900">{children}</dd>
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
  const missing = TEMPLATE_FIELDS.filter((field) => !hasContent(screen.template[field.key])).map(
    (field) => field.label,
  );
  const variables = unique(screen.variableLinks.map((link) => link.variable.name));
  const collections = unique(screen.collectionLinks.map((link) => link.collection.name));
  const components = screen.components.map((component) => component.name);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.2fr)] items-start gap-4">
      <SectionCard
        title="Template fields"
        description={`${total} template fields`}
        icon={<Layers size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        flush
      >
        <ul className="flex flex-col gap-0.5 p-2">
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
                  className="flex items-center gap-2.5 rounded-chip px-3 py-2 text-body text-ink-900 hover:bg-control-hover"
                >
                  {filled ? (
                    <Check
                      aria-hidden="true"
                      size={16}
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="text-success"
                    />
                  ) : (
                    <Circle
                      aria-hidden="true"
                      size={16}
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="text-ink-500"
                    />
                  )}
                  <span>{field.label}</span>
                  <span className="sr-only">{filled ? '(done)' : '(to write)'}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title="Documentation"
        description="The standard template of the screen"
        icon={<FileText size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      >
        <div className="flex flex-col">
          {TEMPLATE_FIELDS.map((field) => {
            const text = screen.template[field.key];
            const filled = hasContent(text);
            return (
              <section
                key={field.key}
                id={fieldAnchor(field.key)}
                aria-label={field.label}
                className="flex flex-col gap-2 border-t border-divider py-4 first:border-t-0 first:pt-0 last:pb-0"
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
      </SectionCard>

      <SectionCard
        title="Template progress"
        icon={<Link2 size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        tone="success"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-body-lg font-semibold text-ink-900">Fields with content</span>
              <span className="text-body-lg font-bold text-ink-900">
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
              className="h-2 overflow-hidden rounded-pill bg-disabled-bg"
            >
              <div
                className="h-full rounded-pill bg-primary"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            {missing.length > 0 && (
              <p className="text-small text-ink-500">
                {listText(missing)} {missing.length === 1 ? 'is' : 'are'} needed to submit for
                review.
              </p>
            )}
          </div>
          <dl>
            <Row label="Status">
              <StatusTag status={toTagStatus(screen.documentationStatus)} />
            </Row>
            <Row label="Author">{screen.author.name}</Row>
            <Row label="Miro diagram">
              {screen.miroLink === null ? '—' : <MiroLink href={screen.miroLink}>Open</MiroLink>}
            </Row>
            <Row label="Pending to-dos">
              {pendingSubtasks > 0 ? `${pendingSubtasks} in Jira` : '—'}
            </Row>
            <Row label="Comments">{commentCount}</Row>
          </dl>
          <section aria-label="Linked elements" className="flex flex-col gap-2">
            <h3 className="text-micro font-bold tracking-wider text-ink-500 uppercase">
              Linked elements
            </h3>
            {variables.length + collections.length + components.length === 0 ? (
              <p className="text-small text-ink-500">Nothing is linked yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-small text-ink-700">
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
        </div>
      </SectionCard>
    </div>
  );
}
