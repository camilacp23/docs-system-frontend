// ScreenWorkflowControls: the workflow actions of the screen header (S-19, S-25b), drawn from workflowActions.
// WorkflowButtons props: actions, reason (why they are disabled: archived application or no connection, null when they are
//   available), reasonId (id of the element that holds the reason for assistive technology), running (key of the action in
//   flight: its button shows the spinner and every one is disabled), onRun.
// Every action is a button with its icon: the steps back are secondary buttons and the step forward is the primary one.
// A disabled button keeps the reason as its title and its accessible description, like Edit and Delete.
import { Check, CornerUpLeft, Play, RotateCcw, Send, SquarePen, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, ICON_STROKE_WIDTH } from '../../components/ui';

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
    case 'start-draft':
      return <SquarePen {...ICON_PROPS} />;
    case 'mark-in-progress':
      return <Play {...ICON_PROPS} />;
    case 'submit':
      return <Send {...ICON_PROPS} />;
    case 'approve':
      return <Check {...ICON_PROPS} />;
    case 'return':
      return <CornerUpLeft {...ICON_PROPS} />;
    case 'reopen':
      return <RotateCcw {...ICON_PROPS} />;
    case 'back-to-undocumented':
    case 'back-to-draft':
    case 'withdraw':
      return <Undo2 {...ICON_PROPS} />;
  }
}

export function WorkflowButtons({ actions, reason, reasonId, running, onRun }: ControlsProps) {
  return actions.map((action) => (
    <Button
      key={action.key}
      size="sm"
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
