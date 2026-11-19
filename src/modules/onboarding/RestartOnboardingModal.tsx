// RestartOnboardingModal: the confirmation of "Restart onboarding" (DELETE /onboarding/progress). Rendered only while it is open.
// Props: applicationName, busy (the DELETE is in flight: the buttons wait), onConfirm(), onClose().
// It only forgets the completed steps of the user in this application; nothing else changes. Esc and Cancel close it (not while busy).
import { RotateCcw } from 'lucide-react';

import { Button, ICON_STROKE_WIDTH, Modal } from '../../components/ui';

import {
  RESTART_CANCEL_LABEL,
  RESTART_LABEL,
  RESTART_TITLE,
  restartTextOf,
} from './onboardingTexts';

interface RestartOnboardingModalProps {
  applicationName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function RestartOnboardingModal({
  applicationName,
  busy,
  onConfirm,
  onClose,
}: RestartOnboardingModalProps) {
  return (
    <Modal
      open
      size="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
      icon={<RotateCcw size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={RESTART_TITLE}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {RESTART_CANCEL_LABEL}
          </Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            {RESTART_LABEL}
          </Button>
        </>
      }
    >
      <p className="text-body-lg text-ink-700">{restartTextOf(applicationName)}</p>
    </Modal>
  );
}
