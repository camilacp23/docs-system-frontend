// Sidebar: the navigation column (S-31): application card, groups of items by role. The active item follows the route. It is 268 px wide, or 72 px when collapsed:
// then only the icons remain (each item keeps its accessible name and shows a tooltip on hover / focus). The
// collapse button is the last row of the column ("Collapse" + chevron).
// The active item has a soft blue wash, a bar on its left edge and a blue icon (no filled tile).
// Props: role (decides the items, SDD Table 56), collapsed, onToggle (collapse / expand button), onExpand.
// The Review item carries the number of screens In review of the selected application (useReviewCount) in an amber badge
// (S-36); it is left out when the count is 0, unknown or could not be read. The number is never the only signal: the
// accessible name says "<n> screens in review" (also when collapsed, where only the icon and a small badge are drawn).
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';

import type { Role } from '../app/router/routes';
import { useApplication } from '../application/useApplication';
import { useReviewCount } from '../application/useReviewCount';
import { cx, ICON_STROKE_WIDTH } from '../components/ui';

import { ApplicationCard } from './ApplicationCard';
import { getNavGroups, REVIEW_PATH, type NavItem } from './navConfig';

export const SIDEBAR_ID = 'app-sidebar';

interface TooltipPosition {
  top: number;
  left: number;
}

function reviewCountText(count: number): string {
  return `${count} ${count === 1 ? 'screen' : 'screens'} in review`;
}

function SidebarItem({
  item,
  collapsed,
  count = null,
}: {
  item: NavItem;
  collapsed: boolean;
  /** The number to show on the item (Review only); null or 0 shows none. */
  count?: number | null;
}) {
  const shown = count !== null && count > 0 ? count : null;
  const countLabel = shown === null ? null : reviewCountText(shown);
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
      aria-label={
        collapsed ? (countLabel === null ? item.label : `${item.label}, ${countLabel}`) : undefined
      }
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
          isActive ? 'bg-(image:--gradient-nav-active)' : 'hover:bg-sidebar-hover',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-0 w-0.75 rounded-pill bg-sidebar-active-indicator"
            />
          )}
          <span
            className={cx(
              'flex size-7 items-center justify-center',
              isActive ? 'text-sidebar-active-icon' : 'text-sidebar-text',
            )}
          >
            {item.icon}
          </span>
          {collapsed && shown !== null && (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-badge-warning-bg px-1 text-micro font-bold text-badge-warning-ink"
            >
              {shown > 99 ? '99+' : shown}
            </span>
          )}
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
          {!collapsed && shown !== null && (
            <>
              <span
                aria-hidden="true"
                className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-badge-warning-bg px-1.5 text-tag font-bold text-badge-warning-ink"
              >
                {shown > 99 ? '99+' : shown}
              </span>
              <span className="sr-only">, {countLabel}</span>
            </>
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
  const { currentApplicationId } = useApplication();
  const hasReview = groups.some((group) => group.items.some((item) => item.to === REVIEW_PATH));
  const reviewCount = useReviewCount(currentApplicationId, hasReview);
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
        <div aria-hidden="true" className="mx-2 mb-1.5 h-px shrink-0 bg-sidebar-divider" />
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
                <SidebarItem
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  count={item.to === REVIEW_PATH ? reviewCount : null}
                />
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1.5 border-t border-sidebar-divider pt-3">
          <button
            type="button"
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            aria-controls={SIDEBAR_ID}
            title={toggleLabel}
            onClick={onToggle}
            className="flex h-9 items-center gap-2.75 rounded-control px-2 text-sidebar-text transition-colors duration-150 hover:bg-sidebar-hover hover:text-on-primary motion-reduce:transition-none"
          >
            <span className="flex size-7 shrink-0 items-center justify-center">
              <ChevronLeft
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                aria-hidden="true"
                className={cx(
                  'transition-transform duration-200 motion-reduce:transition-none',
                  collapsed && 'rotate-180',
                )}
              />
            </span>
            {!collapsed && (
              <span className="text-body font-medium whitespace-nowrap motion-safe:animate-fade-in">
                Collapse
              </span>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}
