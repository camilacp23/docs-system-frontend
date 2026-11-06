// VariableDetailsCard: the "Details" card of the variable detail (S-11): data type, scope, origin screen,
// description and, for each environment, its notes ("No known differences." when it has none).
// Props: variable. The origin screen links to its page and is in IBM Plex Mono; a variable without origin shows
// the "Untraced" tag.
import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ICON_STROKE_WIDTH, SectionCard, Tag } from '../../components/ui';

import { DATA_TYPE_LABEL, SCOPE_FUNCTION, SCOPE_LABEL } from './variableLabels';
import type { Variable } from './variableTypes';

const NO_DIFFERENCES_TEXT = 'No known differences.';
const NO_DESCRIPTION_TEXT = 'No description.';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-divider px-4 py-2.5 first:border-t-0">
      <dt className="text-small text-ink-500">{label}</dt>
      <dd className="text-body-lg text-ink-900">{children}</dd>
    </div>
  );
}

export function VariableDetailsCard({ variable }: { variable: Variable }) {
  const origin = variable.originScreen;
  return (
    <SectionCard
      title="Details"
      description="Type, scope, origin and notes per environment"
      icon={<Info size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      flush
    >
      <dl>
        <Row label="Data type">{DATA_TYPE_LABEL[variable.dataType]}</Row>
        <Row label="Scope">
          {SCOPE_LABEL[variable.scope]} ({SCOPE_FUNCTION[variable.scope]})
        </Row>
        <Row label="Origin screen">
          {origin === null ? (
            <Tag tone="warning" icon={<CircleAlert size={14} strokeWidth={ICON_STROKE_WIDTH} />}>
              Untraced
            </Tag>
          ) : (
            <Link
              to={`/screens/${origin.id}`}
              className="rounded-chip font-mono text-label text-identifier hover:underline"
            >
              {origin.name}
            </Link>
          )}
        </Row>
        <Row label="Description">
          {variable.description === null || variable.description === ''
            ? NO_DESCRIPTION_TEXT
            : variable.description}
        </Row>
        {variable.environmentDetails.map((detail) => (
          <div
            key={detail.environment}
            className="flex flex-col gap-1 border-t border-divider px-4 py-2.5"
          >
            <dt>
              <Tag tone={detail.environment === 'PROD' ? 'success' : 'neutral'}>
                {detail.environment}
              </Tag>
            </dt>
            <dd className="text-body-lg text-ink-900">
              {detail.notes === null || detail.notes === '' ? NO_DIFFERENCES_TEXT : detail.notes}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
