// buildCrumbs: the parts of the breadcrumb after the application chip, from the route and the record name a page
// set with useBreadcrumbLabel. buildCrumbs(pathname, recordName) -> Crumb[]; the last crumb has no `to` (current page).
import { findRoute } from '../app/router/routes';

export interface Crumb {
  label: string;
  /** Absent on the last crumb (the current page). */
  to?: string;
}

const EDIT_SEGMENT = 'edit';

/** `/admin/users/3` -> `/admin/users`; `/variables/7/edit` -> `/variables`. */
function sectionPathOf(segments: string[]): string {
  const depth = segments[0] === 'admin' ? 2 : 1;
  return `/${segments.slice(0, depth).join('/')}`;
}

export function buildCrumbs(pathname: string, recordName: string | null): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const sectionPath = sectionPathOf(segments);
  const sectionTitle = (findRoute(sectionPath) ?? findRoute(pathname))?.title;
  const isEdit = segments[segments.length - 1] === EDIT_SEGMENT;

  if (recordName === null || sectionTitle === undefined) {
    return sectionTitle === undefined ? [] : [{ label: sectionTitle }];
  }
  if (isEdit) {
    return [
      { label: sectionTitle, to: sectionPath },
      { label: recordName, to: `/${segments.slice(0, -1).join('/')}` },
      { label: 'Edit' },
    ];
  }
  return [{ label: sectionTitle, to: sectionPath }, { label: recordName }];
}
