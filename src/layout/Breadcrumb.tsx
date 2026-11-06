// Breadcrumb: the trail in the top bar (S-31). Every part but the last is a link that goes back to that level:
// application chip -> Dashboard, section -> its list, record -> its detail page (from the edit page).
// No props. The name of the record comes from the page (useBreadcrumbLabel); the section from the route table.
//   /variables                  App / Variables
//   /variables/7                App / Variables / gUsuario
//   /variables/7/edit           App / Variables / gUsuario / Edit
// The parts after the chip come from buildCrumbs.ts.
import { ChevronRight } from 'lucide-react';
import { useContext } from 'react';
import { Link, useLocation } from 'react-router';

import { HOME_PATH } from '../app/router/routes';
import { useApplication } from '../application/useApplication';
import { cx, ICON_STROKE_WIDTH } from '../components/ui';

import { applicationInitials } from './applicationInitials';
import { buildCrumbs } from './buildCrumbs';
import { BreadcrumbContext } from './breadcrumbContext';

const LINK_CLASS =
  'truncate rounded-chip text-label/5 font-medium text-ink-500 transition-colors duration-150 hover:text-accent-ink hover:underline motion-reduce:transition-none';

export function Breadcrumb() {
  const { currentApplication } = useApplication();
  const { pathname } = useLocation();
  const { label } = useContext(BreadcrumbContext);
  const crumbs = buildCrumbs(pathname, label);
  const chip = currentApplication && (
    <>
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-keycap bg-accent text-[9px] font-extrabold text-on-primary"
      >
        {applicationInitials(currentApplication.name)}
      </span>
      <span className="truncate text-[12.5px]/5 font-bold text-accent-ink">
        {currentApplication.name}
      </span>
    </>
  );
  const chipClass =
    'flex min-w-0 items-center gap-2 rounded-pill bg-accent-soft py-1.25 pr-3 pl-1.5';

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2">
        {chip && (
          <li className="flex min-w-0 items-center">
            <Link
              to={HOME_PATH}
              title="Go to Dashboard"
              className={cx(chipClass, 'transition-colors duration-150 hover:bg-info-border')}
            >
              {chip}
            </Link>
          </li>
        )}
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {(chip || index > 0) && (
                <ChevronRight
                  aria-hidden="true"
                  size={14}
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="shrink-0 text-ink-500"
                />
              )}
              {last || crumb.to === undefined ? (
                <span aria-current="page" className="truncate text-label/5 font-bold text-ink-900">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className={LINK_CLASS}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
