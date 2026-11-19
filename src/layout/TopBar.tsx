// TopBar: the 68 px bar of the shell (S-31), a three-column grid so the search sits in the middle: the clickable
// breadcrumb (Breadcrumb.tsx, the current page as the title) on the left, the quick search (QuickSearch.tsx, S-30) in the
// centre and on the right the Jira status (JiraStatusPill, the last known availability) and the user block (avatar with
// initials and role; the name stays for assistive technology), which opens a menu with "Sign out".
// Props: user (the signed-in user). The help button of the frame arrives with the module it depends on.
// Sign out clears the session even if the server cannot be reached; in that case a warning toast says so.
import { LogOut } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import type { components } from '../api/schema';
import { ROLE_LABEL } from '../app/router/routes';
import { useApplication } from '../application/useApplication';
import { Avatar, ICON_STROKE_WIDTH, useToast } from '../components/ui';
import { useSession } from '../session/useSession';

import { usePopover } from '../hooks/usePopover';

import { Breadcrumb } from './Breadcrumb';
import { JiraStatusPill } from './JiraStatusPill';
import { QuickSearch } from './QuickSearch';

export const SIGN_OUT_FAILED_TEXT =
  "You're signed out on this device, but the server couldn't be reached to end the session.";

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
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        title={user.name}
        className="flex items-center gap-2.5 rounded-pill py-1 pr-3.5 pl-1 text-left transition-colors duration-150 hover:bg-control-hover motion-reduce:transition-none"
      >
        <Avatar name={user.name} decorative className="shadow-card ring-2 ring-surface" />
        <span className="block">
          <span className="sr-only">{user.name}</span>
          <span className="block text-label/5 font-semibold text-ink-700">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-3 w-48 origin-top-right rounded-bubble border border-border-subtle bg-surface p-2 shadow-bubble motion-safe:animate-bubble-in">
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-7 size-3.5 rotate-45 rounded-[4px] border-t border-l border-border-subtle bg-surface"
          />
          <div id={menuId} role="menu" aria-label="User">
            <button
              type="button"
              role="menuitem"
              ref={firstItemRef}
              onClick={signOut}
              className="group flex w-full items-center gap-3 rounded-bubble-item px-3 py-2.5 text-left text-body font-semibold text-danger transition-colors duration-150 hover:bg-danger-bg motion-reduce:transition-none"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-full bg-danger-bg text-danger transition-colors duration-150 group-hover:bg-surface motion-reduce:transition-none"
              >
                <LogOut size={16} strokeWidth={ICON_STROKE_WIDTH} />
              </span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({ user }: { user: components['schemas']['User'] }) {
  const { currentApplicationId } = useApplication();
  return (
    <header className="relative z-30 col-start-2 grid grid-cols-[minmax(0,1fr)_minmax(0,33rem)_minmax(0,1fr)] items-center gap-6 border-b border-border-subtle/60 bg-surface/70 px-7 backdrop-blur-md">
      <Breadcrumb />
      <div className="flex min-w-0 items-center justify-center">
        {/* Another application starts a new search: the text and the rows of the old one are not kept. */}
        <QuickSearch key={currentApplicationId ?? 'none'} />
      </div>
      <div className="flex items-center justify-end gap-3">
        <JiraStatusPill />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
