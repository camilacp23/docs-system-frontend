// DeactivateUserModal: confirmation to deactivate a user (S-06, S-06b). Props: user, onClose, onDone (the list is read
// again). DELETE /users/{id} is a logical deactivation: the user cannot sign in and their sessions end, while their
// documentation, comments and audit history stay. When the API refuses (LAST_ACTIVE_ADMIN, CANNOT_DEACTIVATE_SELF,
// RESERVED_ACCOUNT) the banner says why and the only button left is "Close" (S-06b); for any other failure (no
// connection, an unexpected error) the button stays so the user can try again. The confirm button is disabled with
// the reason while offline.
import { Lock } from 'lucide-react';
import { useId, useState } from 'react';

import { isApiError } from '../../api/ApiError';
import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, useToast } from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';

import type { User } from './userLabels';

interface DeactivateUserModalProps {
  user: User;
  onClose: () => void;
  onDone: () => void;
}

const REFUSALS: readonly string[] = [
  'LAST_ACTIVE_ADMIN',
  'CANNOT_DEACTIVATE_SELF',
  'RESERVED_ACCOUNT',
  'NOT_FOUND',
];

export function DeactivateUserModal({ user, onClose, onDone }: DeactivateUserModalProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useOfflineBlock();
  const reasonId = useId();
  const [deactivating, setDeactivating] = useState(false);
  const [failure, setFailure] = useState<{ message: string; final: boolean } | null>(null);

  const deactivate = async () => {
    if (blocked || deactivating) return;
    setDeactivating(true);
    setFailure(null);
    try {
      await client.delete('/users/{id}', { path: { id: user.id } });
      toast.show({ message: `${user.name} deactivated.` });
      onDone();
      onClose();
    } catch (thrown) {
      setFailure({
        message: getThrownMessage(thrown, { element: 'user' }),
        final: isApiError(thrown) && REFUSALS.includes(thrown.code),
      });
      setDeactivating(false);
    }
  };

  return (
    <Modal
      open
      size="sm"
      tone="danger"
      icon={<Lock size={18} strokeWidth={ICON_STROKE_WIDTH} />}
      onClose={() => {
        if (!deactivating) onClose();
      }}
      title="Deactivate this user?"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          {reason && (
            <p id={reasonId} className="mr-auto text-small text-warning-ink">
              {reason}
            </p>
          )}
          <Button onClick={onClose} disabled={deactivating}>
            {failure?.final ? 'Close' : 'Cancel'}
          </Button>
          {!failure?.final && (
            <Button
              variant="danger"
              loading={deactivating}
              disabled={blocked}
              aria-describedby={reason ? reasonId : undefined}
              onClick={() => {
                void deactivate();
              }}
            >
              Deactivate user
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {failure && <Banner tone="danger">{failure.message}</Banner>}
        <p>
          {user.name} will no longer be able to sign in, and their open sessions will end. Their
          documentation, comments and audit history are kept. You can reactivate them later.
        </p>
      </div>
    </Modal>
  );
}
