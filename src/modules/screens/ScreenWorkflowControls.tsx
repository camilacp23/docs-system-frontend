// ScreenWorkflowControls: the workflow actions of the screen header (S-19, S-25b), drawn from workflowActions.
// WorkflowButtons props: actions, beforeEdit (which side of Edit: the frame draws some before it and Approve / Return
//   after it), reason (why they are disabled: archived application or no connection, null when they are available),
//   reasonId (id of the element that holds the reason for assistive technology), running (key of the action in
//   flight: its button shows the spinner and every one is disabled), onRun.
// WorkflowMenu props: the same, for the "…" menu with the less frequent actions (nothing is drawn without items).
// A disabled button keeps the reason as its title and its accessible description, like Edit and Delete.
import { Check, CornerUpLeft, Send, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { ActionMenu, Button, ICON_STROKE_WIDTH } from '../../components/ui';

import type { WorkflowAction, WorkflowActionKey } from './screenWorkflow';

interface ControlsProps {
  actions: readonly WorkflowAction[];
  reason: string | null;
  reasonId: string;
  running: WorkflowActionKey | null;
  onRun: (action: WorkflowAction) => void;
}

const ICON_PROPS = { 'aria-hidden': true, size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;

function iconOf(action: WorkflowAction): ReactNode {
  switch (action.key) {
    case 'submit':
      return <Send {...ICON_PROPS} />;
    case 'approve':
      return <Check {...ICON_PROPS} />;
    case 'return':
      return <CornerUpLeft {...ICON_PROPS} />;
    case 'withdraw':
      return <Undo2 {...ICON_PROPS} />;
    default:
      return null;
  }
}

export function WorkflowButtons({
  actions,
  beforeEdit,
  reason,
  reasonId,
  running,
  onRun,
}: ControlsProps & { beforeEdit: boolean }) {
  return actions
    .filter((action) => action.slot === 'button' && action.beforeEdit === beforeEdit)
    .map((action) => (
      <Button
        key={action.key}
        variant={action.primary ? 'primary' : 'secondary'}
        loading={running === action.key}
        disabled={reason !== null || (running !== null && running !== action.key)}
        title={reason ?? undefined}
        aria-describedby={reason === null ? undefined : reasonId}
        iconLeft={iconOf(action)}
        onClick={() => {
          onRun(action);
        }}
      >
        {action.label}
      </Button>
    ));
}

export function WorkflowMenu({ actions, reason, running, onRun }: ControlsProps) {
  const items = actions.filter((action) => action.slot === 'menu');
  if (items.length === 0) return null;
  return (
    <ActionMenu
      label="More actions"
      items={items.map((action) => ({
        key: action.key,
        label: action.label,
        disabled: reason !== null || running !== null,
        reason: reason ?? undefined,
        onSelect: () => {
          onRun(action);
        },
      }))}
    />
  );
}
