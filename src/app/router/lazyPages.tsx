// lazyPages: the pages that are loaded when their route is opened (code splitting, NFR-11). One entry per page; the
// route table (router.tsx) uses them as elements. To add a page (/onboarding comes next):
//   export const OnboardingPage = lazyPage(() => import('../../modules/onboarding/OnboardingPage'), 'OnboardingPage');
//   and list it in LAZY_ROUTES (preloadPage.ts) with its route path.
// preloadPage.ts maps a route path to its page, to start the load before rendering (tests).
import { lazyPage } from './lazyPage';

export const AuditLogPage = lazyPage(
  () => import('../../modules/audit/AuditLogPage'),
  'AuditLogPage',
);
export const SearchPage = lazyPage(() => import('../../modules/search/SearchPage'), 'SearchPage');
export const DependencyMapPage = lazyPage(
  () => import('../../modules/dependency-map/DependencyMapPage'),
  'DependencyMapPage',
);
export const ReportsPage = lazyPage(
  () => import('../../modules/reports/ReportsPage'),
  'ReportsPage',
);
export const ReviewPage = lazyPage(() => import('../../modules/review/ReviewPage'), 'ReviewPage');
