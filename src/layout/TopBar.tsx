// TopBar: the 68 px bar of the shell (S-31): breadcrumb (application chip / section title) on the left and the
// user block (initials, name, role) on the right, which opens a menu with "Sign out".
// Props: user (the signed-in user). The quick search, Jira status pill and help button of the frame arrive with
// the modules they depend on.
// Sign out clears the session even if the server cannot be reached; in that case a warning toast says so.
import { useEffect, useId, useRef } from 'react';
import { useLocation } from 'react-router';

import type { components } from '../api/schema';
import { findRoute, ROLE_LABEL } from '../app/router/routes';
import { useApplication } from '../application/useApplication';
import { Avatar, useToast } from '../components/ui';
import { useSession } from '../session/useSession';

import { applicationInitials } from './applicationInitials';
import { usePopover } from './usePopover';

export const SIGN_OUT_FAILED_TEXT =
  "You're signed out on this device, but the server couldn't be reached to end the session.";

function Breadcrumb() {
  const { currentApplication } = useApplication();
  const { pathname } = useLocation();
  const title = findRoute(pathname)?.title;
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5">
      {currentApplication && (
        <span className="flex min-w-0 items-center gap-2 rounded-pill bg-accent-soft py-1.25 pr-3 pl-1.5">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-keycap bg-accent text-[9px] font-extrabold text-on-primary"
          >
            {applicationInitials(currentApplication.name)}
          </span>
          <span className="truncate text-[12.5px]/5 font-bold text-accent-ink">
            {currentApplication.name}
          </span>
        </span>
      )}
      {currentApplication && title && (
        <span aria-hidden="true" className="text-label/5 text-ink-500">
          /
        </span>
      )}
      {title && (
        <span aria-current="page" className="truncate text-label/5 font-bold text-ink-900">
          {title}
        </span>
      )}
    </nav>
  );
}

function UserMenu({ user }: { user: components['schemas']['User'] }) {
  const { logout } = useSession();
  const toast = useToast();
  const { open, setOpen, containerRef, triggerRef } = usePopover();
  const menuId = useId();
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const signOut = () => {
    setOpen(false);
    logout().catch(() => {
      toast.show({ tone: 'warning', message: SIGN_OUT_FAILED_TEXT });
    });
  };

  return (
    <div ref={containerRef} className="relative border-l border-border-subtle pl-2.5">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="flex items-center gap-2.5 rounded-control text-left"
      >
        <Avatar name={user.name} decorative />
        <span className="block">
          <span className="block text-label/5 font-bold text-ink-900">{user.name}</span>
          <span className="block text-tag/5 text-ink-500">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="User"
          className="absolute top-full right-0 z-30 mt-2 min-w-40 rounded-card border border-border-subtle bg-surface p-1 shadow-modal"
        >
          <button
            type="button"
            role="menuitem"
            ref={firstItemRef}
            onClick={signOut}
            className="flex w-full rounded-chip px-3 py-2 text-left text-body font-medium text-ink-900 hover:bg-control-hover"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ user }: { user: components['schemas']['User'] }) {
  return (
    <header className="col-start-2 flex items-center justify-between gap-4 border-b border-border-subtle bg-topbar px-7 backdrop-blur-xs">
      <Breadcrumb />
      <UserMenu user={user} />
    </header>
  );
}
