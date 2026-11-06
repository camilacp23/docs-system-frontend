// Sidebar: the navigation column (S-31): application card, groups of items by role and the version of the
// app at the foot (package.json). The active item follows the route. It is 268 px wide, or 72 px when collapsed:
// then only the icons remain (each item keeps its accessible name and shows a tooltip on hover / focus). The
// collapse button is a small round chevron on the right edge of the column.
// Props: role (decides the items, SDD Table 56), collapsed, onToggle (collapse / expand button), onExpand.
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';

import pkg from '../../package.json';
import type { Role } from '../app/router/routes';
import { cx } from '../components/ui';

import { ApplicationCard } from './ApplicationCard';
import { getNavGroups, type NavItem } from './navConfig';

export const SIDEBAR_ID = 'app-sidebar';

interface TooltipPosition {
  top: number;
  left: number;
}

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const showTooltip = (element: HTMLElement) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    setTooltip({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  };
  const hideTooltip = () => {
    setTooltip(null);
  };

  return (
    <NavLink
      to={item.to}
      aria-label={collapsed ? item.label : undefined}
      onMouseEnter={(event) => {
        showTooltip(event.currentTarget);
      }}
      onMouseLeave={hideTooltip}
      onFocus={(event) => {
        showTooltip(event.currentTarget);
      }}
      onBlur={hideTooltip}
      className={({ isActive }) =>
        cx(
          'relative flex items-center rounded-control transition-colors duration-150 motion-reduce:transition-none',
          'h-9 gap-2.75 px-2',
          isActive ? 'bg-(image:--gradient-nav-active)' : 'hover:bg-sidebar-tile',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className={cx(
                'absolute inset-y-2.25 w-0.75 rounded-r-indicator bg-sidebar-active-indicator',
                '-left-3.5',
              )}
            />
          )}
          <span
            className={cx(
              'flex items-center justify-center rounded-chip',
              'size-7',
              isActive
                ? 'bg-accent text-on-primary shadow-nav-tile'
                : 'bg-sidebar-tile text-sidebar-text',
            )}
          >
            {item.icon}
          </span>
          {!collapsed && (
            <span
              className={cx(
                'text-body whitespace-nowrap motion-safe:animate-fade-in',
                isActive ? 'font-semibold text-on-primary' : 'font-medium text-sidebar-text',
              )}
            >
              {item.label}
            </span>
          )}
          {tooltip && (
            <span
              aria-hidden="true"
              style={{ top: tooltip.top, left: tooltip.left }}
              className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-chip bg-navy-950 px-2.5 py-1.5 text-label font-semibold whitespace-nowrap text-on-primary shadow-toast"
            >
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export interface SidebarProps {
  role: Role;
  collapsed: boolean;
  onToggle: () => void;
  onExpand: () => void;
}

export function Sidebar({ role, collapsed, onToggle, onExpand }: SidebarProps) {
  const groups = getNavGroups(role);
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <div className="relative z-20 row-span-3 flex min-h-0 flex-col">
      <aside
        id={SIDEBAR_ID}
        aria-label="Sidebar"
        className={cx(
          'flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-1 overflow-x-hidden bg-(image:--gradient-sidebar) py-4.5',
          'px-3.5',
          collapsed ? 'overflow-y-hidden' : 'overflow-y-auto',
        )}
      >
        <ApplicationCard collapsed={collapsed} onExpand={onExpand} />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {groups.map((group) => (
            <div key={group.section ?? 'root'} className="flex flex-col gap-1.5">
              {group.section &&
                (collapsed ? (
                  <div
                    aria-hidden="true"
                    className="mx-2 mt-2 mb-0.5 h-px bg-sidebar-divider motion-safe:animate-fade-in"
                  />
                ) : (
                  <div className="px-2.5 pt-2.5 pb-0.5 text-nav-section font-bold whitespace-nowrap text-sidebar-label uppercase motion-safe:animate-fade-in">
                    {group.section}
                  </div>
                ))}
              {group.items.map((item) => (
                <SidebarItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>
        <div
          className={cx(
            'mt-auto border-t border-sidebar-divider pt-3 text-tag/5 text-sidebar-muted-3',
            collapsed ? 'text-center' : 'px-2',
          )}
        >
          v{pkg.version}
        </div>
      </aside>
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        aria-controls={SIDEBAR_ID}
        title={toggleLabel}
        onClick={onToggle}
        className="absolute top-5.5 -right-3 flex size-6 items-center justify-center rounded-pill border border-border bg-surface text-ink-500 shadow-button transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-on-primary motion-reduce:transition-none"
      >
        <ChevronLeft
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          className={cx(
            'transition-transform duration-200 motion-reduce:transition-none',
            collapsed && 'rotate-180',
          )}
        />
      </button>
    </div>
  );
}
