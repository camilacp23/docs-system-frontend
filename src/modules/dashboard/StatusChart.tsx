// StatusChart: "Documentation by status" (S-31): the donut with the number of screens at its center and the legend next
// to it. Props: rows (StatusRow[], the five statuses in order), total (screens).
// Drawing: one SVG path per status with the fixed color of Table 54. The fill alone does not reach 3:1 against white
// for Undocumented (2.19) and In review (2.68), so every segment has a 1.5 px outline in the dark ink of its Tag
// (7:1 or more) and the legend swatch is drawn the same way (WCAG 1.4.11).
// The information never depends on color: every status has its label, its count and its share in the legend, which is
// a real table and the text alternative of the donut (the SVG is role="img" with the same figures in its aria-label).
// Each row of the legend is a link to the screen list of that status. With no screens the ring is an empty track and a
// sentence says so. The entrance (fade) is skipped under prefers-reduced-motion.
import { Link } from 'react-router';

import { cx, type DocumentationStatus } from '../../components/ui';

import { donutSegments, DONUT_INNER, DONUT_OUTER, DONUT_SIZE } from './donutGeometry';
import { donutSummary, type StatusRow } from './dashboardModel';

/** Fill and outline of each status, written out so Tailwind finds the classes. */
const SEGMENT_CLASS: Record<DocumentationStatus, string> = {
  undocumented: 'fill-status-undocumented stroke-status-undocumented-ink',
  draft: 'fill-status-draft stroke-status-draft-ink',
  'in-progress': 'fill-status-in-progress stroke-status-in-progress-ink',
  'in-review': 'fill-status-in-review stroke-status-in-review-ink',
  approved: 'fill-status-approved stroke-status-approved-ink',
};

const SWATCH_CLASS: Record<DocumentationStatus, string> = {
  undocumented: 'bg-status-undocumented border-status-undocumented-ink',
  draft: 'bg-status-draft border-status-draft-ink',
  'in-progress': 'bg-status-in-progress border-status-in-progress-ink',
  'in-review': 'bg-status-in-review border-status-in-review-ink',
  approved: 'bg-status-approved border-status-approved-ink',
};

export const NO_SCREENS_TEXT = 'No screens to chart yet.';

interface StatusChartProps {
  rows: readonly StatusRow[];
  total: number;
}

export function StatusChart({ rows, total }: StatusChartProps) {
  const segments = donutSegments(rows.map((row) => row.count));
  const center = DONUT_SIZE / 2;
  return (
    <div className="flex flex-wrap items-center gap-7">
      <div className="shrink-0">
        <svg
          role="img"
          aria-label={donutSummary(rows, total)}
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          className="size-55"
        >
          {total === 0 && (
            <circle
              cx={center}
              cy={center}
              r={(DONUT_OUTER + DONUT_INNER) / 2}
              strokeWidth={DONUT_OUTER - DONUT_INNER}
              fill="none"
              className="stroke-divider"
            />
          )}
          <g className="motion-safe:animate-fade-in">
            {segments.map((segment) => (
              <path
                key={segment.index}
                d={segment.d}
                fillRule="evenodd"
                strokeWidth={1.5}
                strokeLinejoin="round"
                className={SEGMENT_CLASS[rows[segment.index]?.tag ?? 'undocumented']}
              />
            ))}
          </g>
          <text
            x={center}
            y={center + 4}
            textAnchor="middle"
            className="fill-ink-900 text-hero font-extrabold"
          >
            {total}
          </text>
          <text x={center} y={center + 24} textAnchor="middle" className="fill-ink-500 text-label">
            {total === 1 ? 'screen' : 'screens'}
          </text>
        </svg>
        {total === 0 && (
          <p className="mt-2 text-center text-small text-ink-500">{NO_SCREENS_TEXT}</p>
        )}
      </div>
      <table className="min-w-0 flex-1">
        <caption className="sr-only">Documentation by status</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Screens</th>
            <th scope="col">Share of the screens</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.api} className="border-b border-divider">
              <th scope="row" className="py-1.75 text-left text-label font-normal text-ink-900">
                <Link
                  to={row.href}
                  className="inline-flex items-center gap-2.5 rounded-chip hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'size-2.5 rounded-indicator border-[1.5px]',
                      SWATCH_CLASS[row.tag],
                    )}
                  />
                  {row.label}
                </Link>
              </th>
              <td className="w-8 py-1.75 text-label font-bold text-ink-900 tabular-nums">
                {row.count}
              </td>
              <td className="w-14 py-1.75 text-right text-label text-ink-500 tabular-nums">
                {row.percent}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
