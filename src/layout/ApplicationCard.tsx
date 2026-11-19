// ApplicationCard: the application block at the top of the sidebar (S-31, S-09b).
// Shows the initials tile, the name and the platform (an archived application shows the chip
// "Archived · read-only" instead, as in S-09b) and a button that opens the list of applications.
// Picking one calls selectApplication of ApplicationProvider (the id sent as `applicationId`). The list is a floating
// card drawn beside the sidebar in a portal on document.body (the sidebar clips its overflow and would hide it behind the items).
// Props: collapsed (only the initials tile, which expands the sidebar via onExpand), onExpand.
// The card shows the name and the platform line; the archived chip replaces the platform line.
import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useApplication } from '../application/useApplication';
import { cx, ICON_STROKE_WIDTH } from '../components/ui';

import { usePopover } from '../hooks/usePopover';
import { countText } from '../modules/variables/variableLabels';

import { applicationInitials } from './applicationInitials';

/** Where the floating list is drawn (viewport coordinates): to the right of the sidebar, level with the card. */
interface PanelPosition {
  top: number;
  left: number;
}

export interface ApplicationCardProps {
  collapsed?: boolean;
  onExpand?: () => void;
}

export function ApplicationCard({ collapsed = false, onExpand }: ApplicationCardProps) {
  const { currentApplication, applications, selectApplication } = useApplication();
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const { open, setOpen, containerRef, triggerRef } = usePopover(panelRef);
  const listId = useId();
  const archived = currentApplication?.status === 'ARCHIVED';
  const canSwitch = applications.length > 1;

  if (collapsed) {
    const name = currentApplication?.name ?? 'No application';
    return (
      <div className="-mt-1.5 flex justify-center pb-2 motion-safe:animate-fade-in">
        <button
          type="button"
          aria-label={`Application: ${name}. Expand the sidebar to switch.`}
          title={name}
          onClick={onExpand}
          className="flex size-11 items-center justify-center rounded-modal border border-sidebar-card-border bg-sidebar-card transition-colors duration-150 hover:bg-sidebar-card-border motion-reduce:transition-none"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-chip bg-(image:--gradient-app-tile) text-small font-extrabold text-on-primary"
          >
            {currentApplication ? applicationInitials(currentApplication.name) : '—'}
          </span>
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
                <span className="min-w-0 truncate">{currentApplication.platform}</span>
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
              const card = containerRef.current?.getBoundingClientRect();
              const column = containerRef.current?.closest('aside')?.getBoundingClientRect();
              if (card && column) {
                // Opens beside the sidebar, level with the card.
                setPanelPosition({ top: card.top, left: column.right + 12 });
              }
              setOpen((current) => !current);
            }}
            className="flex h-7.5 w-6.5 shrink-0 items-center justify-center rounded-[9px] bg-sidebar-switch text-sidebar-text transition-colors duration-150 hover:bg-sidebar-card-border hover:text-on-primary motion-reduce:transition-none"
          >
            <ChevronsUpDown size={16} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
          </button>
        )}
      </div>
      {canSwitch &&
        open &&
        panelPosition &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: panelPosition.top, left: panelPosition.left }}
            className="fixed z-50 w-80 origin-left rounded-bubble border border-border-subtle bg-surface shadow-bubble motion-safe:animate-bubble-in"
          >
            <span
              aria-hidden="true"
              className="absolute top-5.5 -left-1.5 size-3.5 rotate-45 rounded-[4px] border-b border-l border-border-subtle bg-surface"
            />
            <div className="flex items-baseline justify-between px-5 pt-4 pb-1.5">
              <span className="text-card-title font-bold text-ink-900">Switch application</span>
              <span className="text-small text-ink-500">
                {countText(applications.length, 'app')}
              </span>
            </div>
            <ul
              id={listId}
              aria-label="Applications"
              className="flex max-h-96 [scrollbar-width:thin] flex-col gap-1 overflow-y-auto p-3 pt-1.5"
            >
              {applications.map((application) => {
                const selected = application.id === currentApplication?.id;
                const isArchived = application.status === 'ARCHIVED';
                return (
                  <li key={application.id}>
                    <button
                      type="button"
                      aria-label={isArchived ? `${application.name} Archived` : application.name}
                      aria-current={selected || undefined}
                      onClick={() => {
                        selectApplication(application.id);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-bubble-item p-2.5 text-left transition-colors duration-150 motion-reduce:transition-none',
                        selected ? 'bg-accent-soft shadow-card' : 'hover:bg-control-hover',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex size-10 shrink-0 items-center justify-center rounded-full text-body-lg font-extrabold',
                          selected
                            ? 'bg-(image:--gradient-app-tile) text-on-primary shadow-nav-tile'
                            : 'bg-avatar-from text-avatar-ink',
                        )}
                      >
                        {applicationInitials(application.name)}
                      </span>
                      <span aria-hidden="true" className="min-w-0 flex-1">
                        <span className="block truncate text-body-lg font-semibold text-ink-900">
                          {application.name}
                        </span>
                        <span className="block truncate text-small text-ink-500">
                          {isArchived ? 'Archived · read-only' : application.platform}
                        </span>
                      </span>
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-accent text-on-primary"
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
