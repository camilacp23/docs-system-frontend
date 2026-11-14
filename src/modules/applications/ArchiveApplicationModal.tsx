// ArchiveApplicationModal: confirmation to archive an application (S-09). Props: application ({ id, name }), onClose,
// onDone (called after the PUT succeeded: the list and the applications of the shell are read again).
// Archiving does not delete anything: the documentation of the application becomes read-only for everyone and the
// Administrator can unarchive it later. The PUT replaces the whole representation, so the modal reads the application
// again and sends EVERY field back with If-Match, changing only `status` (useApplicationStatusChange); pressing the
// button again after a failure reads it anew. A refusal of the API (412, 404, ...) shows its catalog text in the
// modal. The button is disabled with the reason while offline.
import { Archive } from 'lucide-react';
import { useId, useState } from 'react';

import { getThrownMessage } from '../../api/messages';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, useToast } from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';

import { useApplicationStatusChange } from './useApplicationStatusChange';

interface ArchiveApplicationModalProps {
  application: { id: number; name: string };
  onClose: () => void;
  onDone: () => void;
}

export function ArchiveApplicationModal({
  application,
  onClose,
  onDone,
}: ArchiveApplicationModalProps) {
  const changeStatus = useApplicationStatusChange();
  const toast = useToast();
  const { blocked, reason } = useOfflineBlock();
  const reasonId = useId();
  const [archiving, setArchiving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const archive = async () => {
    if (blocked || archiving) return;
    setArchiving(true);
    setFailure(null);
    try {
      await changeStatus(application.id, 'ARCHIVED');
      toast.show({ message: `${application.name} archived.` });
      onDone();
      onClose();
    } catch (thrown) {
      setFailure(getThrownMessage(thrown, { element: 'application' }));
      setArchiving(false);
    }
  };

  return (
    <Modal
      open
      size="sm"
      tone="danger"
      icon={<Archive size={18} strokeWidth={ICON_STROKE_WIDTH} />}
      onClose={() => {
        if (!archiving) onClose();
      }}
      title={`Archive ${application.name}?`}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          {reason && (
            <p id={reasonId} className="mr-auto text-small text-warning-ink">
              {reason}
            </p>
          )}
          <Button onClick={onClose} disabled={archiving}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={archiving}
            disabled={blocked}
            aria-describedby={reason ? reasonId : undefined}
            onClick={() => {
              void archive();
            }}
          >
            Archive application
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <p>
          Its documentation becomes read-only for everyone. Nothing is deleted, and you can
          unarchive it later.
        </p>
      </div>
    </Modal>
  );
}
