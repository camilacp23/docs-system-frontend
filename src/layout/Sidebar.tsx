// Sidebar: the 268 px navigation column (S-31): brand, application card, groups of items by role and the
// version of the app at the foot (package.json). The active item follows the route.
// Props: role (decides the items, SDD Table 56).
import { NavLink } from 'react-router';

import pkg from '../../package.json';
import type { Role } from '../app/router/routes';
import { cx } from '../components/ui';

import { ApplicationCard } from './ApplicationCard';
import { getNavGroups, type NavItem } from './navConfig';

function SidebarItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cx(
          'relative flex h-9 items-center gap-2.75 rounded-control px-2',
          isActive && 'bg-(image:--gradient-nav-active)',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-y-2.25 -left-3.5 w-0.75 rounded-r-indicator bg-sidebar-active-indicator"
            />
          )}
          <span
            className={cx(
              'flex size-7 items-center justify-center rounded-chip',
              isActive
                ? 'bg-accent text-on-primary shadow-nav-tile'
                : 'bg-sidebar-tile text-sidebar-text',
            )}
          >
            {item.icon}
          </span>
          <span
            className={cx(
              'text-body',
              isActive ? 'font-semibold text-on-primary' : 'font-medium text-sidebar-text',
            )}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ role }: { role: Role }) {
  const groups = getNavGroups(role);
  return (
    <aside className="row-span-3 flex flex-col gap-1.5 overflow-y-auto bg-(image:--gradient-sidebar) px-3.5 py-4.5">
      <div className="flex items-center gap-2.5 px-1.5 pt-0.5 pb-3.5">
        <div
          aria-hidden="true"
          className="flex size-8.5 items-center justify-center rounded-control bg-(image:--gradient-brand-tile) text-micro font-bold text-sidebar-muted shadow-brand-tile"
        >
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
      <ApplicationCard />
      <nav aria-label="Main" className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <div key={group.section ?? 'root'} className="flex flex-col gap-1.5">
            {group.section && (
              <div className="px-2.5 pt-3 pb-1 text-nav-section font-bold text-sidebar-label uppercase">
                {group.section}
              </div>
            )}
            {group.items.map((item) => (
              <SidebarItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-sidebar-divider px-2 pt-3 text-tag/5 text-sidebar-muted-3">
        v{pkg.version}
      </div>
    </aside>
  );
}
