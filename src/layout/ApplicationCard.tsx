// ApplicationCard: the application block at the top of the sidebar (S-31, S-09b).
// Shows the initials tile, the name and the platform (an archived application shows the chip
// "Archived · read-only" instead, as in S-09b) and a button that opens the list of applications.
// Picking one calls selectApplication of ApplicationProvider (the id sent as `applicationId`).
// Props: collapsed (only the initials tile, which expands the sidebar via onExpand), onExpand.
// The platform line also says how many screens the application has ("Power Apps · 24 screens"): the total of
// GET /screens, App (OnStart) included (D-98); it is left out while unknown. The archived chip replaces the whole line.
import { Check, ChevronsUpDown } from 'lucide-react';
import { useId } from 'react';

import { useApplication } from '../application/useApplication';
import { useScreenCount } from '../application/useScreenCount';
import { cx, ICON_STROKE_WIDTH } from '../components/ui';

import { usePopover } from '../hooks/usePopover';
import { countText } from '../modules/variables/variableLabels';

import { applicationInitials } from './applicationInitials';

export interface ApplicationCardProps {
  collapsed?: boolean;
  onExpand?: () => void;
}

export function ApplicationCard({ collapsed = false, onExpand }: ApplicationCardProps) {
  const { currentApplication, applications, selectApplication } = useApplication();
  const { open, setOpen, containerRef, triggerRef } = usePopover();
  const screenCount = useScreenCount(currentApplication?.id ?? null);
  const listId = useId();
  const archived = currentApplication?.status === 'ARCHIVED';
  const canSwitch = applications.length > 1;

  if (collapsed) {
    const name = currentApplication?.name ?? 'No application';
    return (
      <div className="flex justify-center pb-2 motion-safe:animate-fade-in">
        <button
          type="button"
          aria-label={`Application: ${name}. Expand the sidebar to switch.`}
          title={name}
          onClick={onExpand}
          className="flex size-10 items-center justify-center rounded-[11px] bg-(image:--gradient-app-tile) text-body-lg font-extrabold text-on-primary shadow-nav-tile"
        >
          {currentApplication ? applicationInitials(currentApplication.name) : '—'}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative pb-2 motion-safe:animate-fade-in">
      <div className="flex items-center gap-2.75 rounded-modal border border-sidebar-card-border bg-sidebar-card p-3 shadow-field-inset">
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-(image:--gradient-app-tile) text-body-lg font-extrabold text-on-primary"
        >
          {currentApplication ? applicationInitials(currentApplication.name) : '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-nav-section/5 font-bold text-sidebar-muted uppercase">
            Application
          </div>
          <div className="truncate text-card-title/5 font-bold text-on-primary">
            {currentApplication?.name ?? '—'}
          </div>
          {currentApplication &&
            (archived ? (
              <span className="mt-0.5 inline-block rounded-pill border border-warning-border bg-warning-bg px-1.5 py-px text-micro font-bold whitespace-nowrap text-warning-ink">
                Archived · read-only
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-tag/5 text-sidebar-muted-2">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-pill bg-sidebar-live-dot shadow-live-dot"
                />
                <span className="min-w-0 truncate">
                  {currentApplication.platform}
                  {screenCount !== null && ` · ${countText(screenCount, 'screen')}`}
                </span>
              </div>
            ))}
        </div>
        {canSwitch && (
          <button
            ref={triggerRef}
            type="button"
            aria-label="Switch application"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => {
              setOpen((current) => !current);
            }}
            className="flex h-7.5 w-6.5 shrink-0 items-center justify-center rounded-[9px] bg-sidebar-switch text-sidebar-text"
          >
            <ChevronsUpDown size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          </button>
        )}
      </div>
      {canSwitch && open && (
        <ul
          id={listId}
          aria-label="Applications"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-card border border-border-subtle bg-surface p-1 shadow-modal"
        >
          {applications.map((application) => {
            const selected = application.id === currentApplication?.id;
            return (
              <li key={application.id}>
                <button
                  type="button"
                  aria-current={selected || undefined}
                  onClick={() => {
                    selectApplication(application.id);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-chip px-2.5 py-2 text-left text-body text-ink-900 hover:bg-control-hover',
                    selected && 'font-semibold',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{application.name}</span>
                  {application.status === 'ARCHIVED' && (
                    <span className="shrink-0 text-small text-ink-500">Archived</span>
                  )}
                  {selected && (
                    <Check
                      size={16}
                      strokeWidth={ICON_STROKE_WIDTH}
                      aria-hidden="true"
                      className="shrink-0 text-primary"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
