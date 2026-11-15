// MockShell (development only): static copy of the Figma shell (sidebar 268 px + top bar 68 px) so that /dev/ui
// can be compared pixel by pixel with S-47. It is NOT the application shell (that is F-03); icons here are the
// obvious Lucide glyphs and still have to be confirmed against the frames when the real shell is built.
// Props: activeLabel (sidebar item drawn as active), pageName (last breadcrumb segment), role (which sidebar: Table 56,
// default the Administrator's), user (name and role label of the user block), jira ('available' | 'unavailable', the pill),
// children (main content).
import {
  BookOpen,
  ChevronsUpDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  Network,
  Search,
  Users,
  Variable,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar, cx, ICON_STROKE_WIDTH } from '../components/ui';

interface NavItem {
  label: string;
  icon: ReactNode;
  badge?: number;
}

const iconProps = { size: 16, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

const NAV: Array<{ section?: string; items: NavItem[] }> = [
  { items: [{ label: 'Dashboard', icon: <LayoutDashboard {...iconProps} /> }] },
  {
    section: 'Documentation',
    items: [
      { label: 'Screens', icon: <Monitor {...iconProps} /> },
      { label: 'Variables', icon: <Variable {...iconProps} /> },
      { label: 'Collections', icon: <Database {...iconProps} /> },
      { label: 'Dependency map', icon: <Network {...iconProps} /> },
    ],
  },
  {
    section: 'Explore',
    items: [
      { label: 'Advanced search', icon: <Search {...iconProps} /> },
      { label: 'Reports', icon: <FileText {...iconProps} /> },
      { label: 'Onboarding', icon: <BookOpen {...iconProps} /> },
    ],
  },
  {
    section: 'Control',
    items: [
      { label: 'Review', icon: <ClipboardCheck {...iconProps} />, badge: 3 },
      { label: 'Audit log', icon: <History {...iconProps} /> },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Users & roles', icon: <Users {...iconProps} /> },
      { label: 'Applications', icon: <LayoutGrid {...iconProps} /> },
    ],
  },
];

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <div
      className={cx(
        'relative flex h-9 items-center gap-2.75 rounded-control px-2',
        active && 'bg-(image:--gradient-nav-active)',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.25 -left-3.5 w-0.75 rounded-r-indicator bg-sidebar-active-indicator"
        />
      )}
      <span
        className={cx(
          'flex size-7 items-center justify-center rounded-chip',
          active
            ? 'bg-accent text-on-primary shadow-nav-tile'
            : 'bg-sidebar-tile text-sidebar-text',
        )}
      >
        {item.icon}
      </span>
      <span
        className={cx(
          'text-body',
          active ? 'font-semibold text-on-primary' : 'font-medium text-sidebar-text',
        )}
      >
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-control bg-badge-warning-bg px-1.5 text-micro font-bold text-badge-warning-ink">
          {item.badge}
        </span>
      )}
    </div>
  );
}

/** The sections of the sidebar each role sees (SDD Table 56): the Reader has no Control and no Administration, the Developer no Administration. */
const HIDDEN_SECTIONS: Record<MockRole, readonly string[]> = {
  ADMINISTRATOR: [],
  DEVELOPER: ['Administration'],
  READER: ['Control', 'Administration'],
};

export type MockRole = 'ADMINISTRATOR' | 'DEVELOPER' | 'READER';

function Sidebar({ activeLabel, role }: { activeLabel: string; role: MockRole }) {
  return (
    <aside className="row-span-2 flex flex-col gap-1.5 overflow-y-auto bg-(image:--gradient-sidebar) px-3.5 py-4.5">
      <div className="flex items-center gap-2.5 px-1.5 pt-0.5 pb-3.5">
        <div className="flex size-8.5 items-center justify-center rounded-control bg-(image:--gradient-brand-tile) text-micro font-bold text-sidebar-muted shadow-brand-tile">
          DT
        </div>
        <div>
          <div className="text-[14.5px]/4.5 font-extrabold text-on-primary">
            Documentación técnica
          </div>
          <div className="text-micro/5 font-semibold text-sidebar-muted">
            Enterprise Architecture
          </div>
        </div>
      </div>
      <div className="pb-2">
        <div className="relative flex items-center gap-2.75 rounded-modal border border-sidebar-card-border bg-sidebar-card p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-(image:--gradient-app-tile) text-body-lg font-extrabold text-on-primary">
            SA
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-nav-section/5 font-bold text-sidebar-muted uppercase">
              Application
            </div>
            <div className="text-card-title/5 font-bold text-on-primary">SAR</div>
            <div className="flex items-center gap-1.5 text-tag/5 text-sidebar-muted-2">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-pill bg-sidebar-live-dot shadow-live-dot"
              />
              <span>Power Apps · 24 screens</span>
            </div>
          </div>
          <span className="flex h-7.5 w-6.5 items-center justify-center rounded-[9px] bg-sidebar-switch text-sidebar-text">
            <ChevronsUpDown {...iconProps} />
          </span>
        </div>
      </div>
      {NAV.filter((group) => !HIDDEN_SECTIONS[role].includes(group.section ?? '')).map((group) => (
        <div key={group.section ?? 'root'} className="flex flex-col gap-1.5">
          {group.section && (
            <div className="px-2.5 pt-3 pb-1 text-nav-section font-bold text-sidebar-label uppercase">
              {group.section}
            </div>
          )}
          {group.items.map((item) => (
            <SidebarItem key={item.label} item={item} active={item.label === activeLabel} />
          ))}
        </div>
      ))}
      <div className="mt-auto flex justify-between border-t border-sidebar-divider px-2 pt-3 text-tag/5 text-sidebar-muted-3">
        <span>v1.0 · Phase 2</span>
        <span>Collapse ‹</span>
      </div>
    </aside>
  );
}

export interface MockUser {
  name: string;
  roleLabel: string;
}

function TopBar({
  pageName,
  user,
  jira,
}: {
  pageName: string;
  user: MockUser;
  jira: 'available' | 'unavailable';
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-topbar px-7 backdrop-blur-xs">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-2 rounded-pill bg-accent-soft py-1.25 pr-3 pl-1.5">
          <span className="flex size-5 items-center justify-center rounded-keycap bg-accent text-[9px] font-extrabold text-on-primary">
            SA
          </span>
          <span className="text-[12.5px]/5 font-bold text-accent-ink">SAR</span>
        </span>
        <span className="text-label/5 text-ink-500">/</span>
        <span className="text-label/5 font-bold text-ink-900">{pageName}</span>
      </div>
      <div className="relative flex h-10 w-140 items-center gap-2.5 overflow-hidden rounded-card border border-border bg-search-bg pr-2 pl-3.5 shadow-field-inset">
        <Search
          size={18}
          strokeWidth={ICON_STROKE_WIDTH}
          aria-hidden="true"
          className="shrink-0 text-ink-500"
        />
        <span className="truncate text-body-lg text-ink-500">
          Search screens, variables, collections, components…
        </span>
        <span className="rounded-chip border border-border bg-surface px-2 py-0.75 text-small/5 font-semibold text-ink-700">
          in SAR
        </span>
        <kbd className="ml-auto rounded-keycap border border-b-2 border-border bg-surface px-1.75 py-1.25 font-mono text-micro/[11px] font-semibold text-ink-700">
          Ctrl K
        </kbd>
      </div>
      <div className="flex items-center justify-end gap-2.5">
        {jira === 'available' ? (
          <span className="flex items-center gap-1.75 rounded-pill bg-success-pill-bg px-2.75 py-1.5 text-small/5 font-semibold text-success-pill-ink">
            <span
              aria-hidden="true"
              className="size-1.75 rounded-pill bg-success shadow-success-dot"
            />
            Jira connected
          </span>
        ) : (
          <span className="flex items-center gap-1.75 rounded-pill border border-warning-border bg-warning-bg px-2.75 py-1.5 text-small/5 font-semibold text-warning-ink">
            <span aria-hidden="true" className="size-1.75 rounded-pill bg-badge-warning-bg" />
            Jira unavailable
          </span>
        )}
        <span className="flex size-9.5 items-center justify-center rounded-[11px] border border-border-subtle bg-surface text-ink-700">
          <CircleHelp size={18} strokeWidth={ICON_STROKE_WIDTH} aria-label="Help" />
        </span>
        <div className="flex items-center gap-2.5 border-l border-border-subtle pl-2.5">
          <Avatar name={user.name} decorative />
          <div>
            <div className="text-label/5 font-bold text-ink-900">{user.name}</div>
            <div className="text-tag/5 text-ink-500">{user.roleLabel}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function MockShell({
  activeLabel,
  pageName,
  role = 'ADMINISTRATOR',
  user = { name: 'Camila Castillo', roleLabel: 'Administrator' },
  jira = 'available',
  children,
}: {
  activeLabel: string;
  pageName: string;
  /** Which sidebar to draw (default: the Administrator's, as in S-47). */
  role?: MockRole;
  user?: MockUser;
  /** The state of the Jira pill (default: connected, as in the frames). */
  jira?: 'available' | 'unavailable';
  children: ReactNode;
}) {
  return (
    <div className="grid h-screen grid-cols-[268px_minmax(0,1fr)] grid-rows-[68px_minmax(0,1fr)] bg-canvas">
      <Sidebar activeLabel={activeLabel} role={role} />
      <TopBar pageName={pageName} user={user} jira={jira} />
      <main className="flex flex-col gap-4 overflow-y-auto px-6 py-5">{children}</main>
    </div>
  );
}
