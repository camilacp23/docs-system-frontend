// CollectionAssignmentsTab: the Variable assignments tab of the collection detail (S-15c), in a card with the tinted header
// of the other redesigned pages (cerulean, the color of the variables), from the collection
// (`variableAssignments`). Props: assignments. Columns: Variable (links to its detail), Function (Set /
// UpdateContext), Table function, Screen (links to its page; App (OnStart) is a screen like the others, D-57) and
// Used in (the Power Apps event or property). Identifiers and usedIn are in IBM Plex Mono.
import { Variable } from 'lucide-react';
import { Link } from 'react-router';

import { ICON_STROKE_WIDTH, Tag, ToneCard } from '../../components/ui';
import { ASSIGNMENT_FUNCTION_LABEL } from '../variables/variableLabels';

import type { VariableAssignment } from './collectionTypes';

const HEAD_CLASS =
  'px-4 py-3 text-left text-micro font-bold tracking-wider text-variable-ink uppercase';
const CELL_CLASS = 'px-4 py-3 align-middle';
const MONO_CLASS = 'font-mono text-label text-identifier';

export function CollectionAssignmentsTab({
  assignments,
}: {
  assignments: readonly VariableAssignment[];
}) {
  return (
    <ToneCard
      title="Variable assignments"
      tone="variable"
      description="Variables this collection feeds, and where"
      icon={<Variable size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      count={assignments.length}
      flush
    >
      {assignments.length === 0 ? (
        <p className="px-4 py-4 text-body-lg text-ink-500">No variable assignments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Variable assignments" className="w-full text-left">
            <thead className="bg-variable-soft/70">
              <tr>
                {['Variable', 'Function', 'Table function', 'Screen', 'Used in'].map((header) => (
                  <th key={header} scope="col" className={HEAD_CLASS}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className="border-t border-divider transition-colors duration-150 hover:bg-variable-soft/40 motion-reduce:transition-none"
                >
                  <td className={CELL_CLASS}>
                    <Link
                      to={`/variables/${assignment.variable.id}`}
                      className={`${MONO_CLASS} rounded-chip hover:underline`}
                    >
                      {assignment.variable.name}
                    </Link>
                  </td>
                  <td className={CELL_CLASS}>
                    <Tag>{ASSIGNMENT_FUNCTION_LABEL[assignment.assignmentFunction]}</Tag>
                  </td>
                  <td className={`${CELL_CLASS} font-mono text-label text-ink-900`}>
                    {assignment.tableFunction ?? '—'}
                  </td>
                  <td className={CELL_CLASS}>
                    <Link
                      to={`/screens/${assignment.screen.id}`}
                      className={`${MONO_CLASS} rounded-chip hover:underline`}
                    >
                      {assignment.screen.name}
                    </Link>
                  </td>
                  <td className={`${CELL_CLASS} font-mono text-label text-ink-900`}>
                    {assignment.usedIn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ToneCard>
  );
}
