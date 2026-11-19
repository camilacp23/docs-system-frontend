// navConfig: the sidebar groups and items in the exact order and labels of S-31 (Lucide glyphs identified in
// the Figma frame S-31, node 2:15800). An item is shown to a role only if the route table lets that role in
// (SDD Table 56), so the sidebar has 12 items for Administrator, 10 for Developer and 8 for Reader.
// getNavGroups(role) -> groups with the items of that role (empty groups are dropped).
import {
  BookOpen,
  Braces,
  ClipboardCheck,
  Database,
  FileText,
  History,
  LayoutDashboard,
  Blocks,
  Monitor,
  Network,
  Search,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { canAccessPath, type Role } from '../app/router/routes';
import { ICON_STROKE_WIDTH } from '../components/ui';

/** The route of the Review item: the sidebar draws the number of screens in review on it. */
export const REVIEW_PATH = '/review';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export interface NavGroup {
  /** Section label; the first group (Dashboard) has none. */
  section?: string;
  items: NavItem[];
}

const iconProps = { size: 16, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

const NAV_GROUPS: readonly NavGroup[] = [
  { items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard {...iconProps} /> }] },
  {
    section: 'Documentation',
    items: [
      { to: '/screens', label: 'Screens', icon: <Monitor {...iconProps} /> },
      { to: '/variables', label: 'Variables', icon: <Braces {...iconProps} /> },
      { to: '/collections', label: 'Collections', icon: <Database {...iconProps} /> },
      { to: '/dependency-map', label: 'Dependency map', icon: <Network {...iconProps} /> },
    ],
  },
  {
    section: 'Explore',
    items: [
      { to: '/search', label: 'Advanced search', icon: <Search {...iconProps} /> },
      { to: '/reports', label: 'Reports', icon: <FileText {...iconProps} /> },
      { to: '/onboarding', label: 'Onboarding', icon: <BookOpen {...iconProps} /> },
    ],
  },
  {
    section: 'Control',
    items: [
      { to: REVIEW_PATH, label: 'Review', icon: <ClipboardCheck {...iconProps} /> },
      { to: '/audit', label: 'Audit log', icon: <History {...iconProps} /> },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users & roles', icon: <Users {...iconProps} /> },
      { to: '/admin/applications', label: 'Applications', icon: <Blocks {...iconProps} /> },
    ],
  },
];

export function getNavGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessPath(role, item.to) === true),
  })).filter((group) => group.items.length > 0);
}
