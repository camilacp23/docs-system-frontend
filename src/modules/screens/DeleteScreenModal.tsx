// DeleteScreenModal: confirmation to delete a screen, with the impact (S-26).
// Props: screen ({ id, name }), onClose, onDeleted (called after DELETE succeeded; the page decides where to go).
// It reads GET /screens/{id} and the total of GET /variables?originScreenId=<id> when it opens and says how many
// components and links the screen has and how many variables will stay without an origin screen ("Its 3
// components and 5 links are deleted too. 1 variable created in it stays without an origin screen. The Jira
// issues stay in Jira. The audit log keeps a record of everything deleted."). Only what the API gives is counted.
// Delete stays disabled until the impact is known (an unknown impact is never deleted blindly); if a read fails the
// modal offers to try again. Delete is also disabled, with the reason, when the application is archived or the
// browser is offline. The API stays the authority: a refusal (APP_CONTEXT_PROTECTED, SCREEN_IN_REVIEW,
// APPLICATION_ARCHIVED, NOT_FOUND ...) shows its catalog message in the modal.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { getErrorMessage, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, Spinner, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { DeleteImpactBody } from '../shared/DeleteImpactBody';

import { impactSummary, screenDeleteImpact, type ScreenDeleteImpact } from './deleteImpact';

interface DeleteScreenModalProps {
  screen: { id: number; name: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteScreenModal({ screen, onClose, onDeleted }: DeleteScreenModalProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useWriteBlock();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const impact = useApiResource<ScreenDeleteImpact>(
    `delete-impact:screen:${screen.id}`,
    async (signal) => {
      const { body } = await client.get('/screens/{id}', { path: { id: screen.id }, signal });
      const detail = body.data;
      const orphaned = await client.get('/variables', {
        query: {
          applicationId: detail.applicationId,
          originScreenId: screen.id,
          page: 1,
          pageSize: 1,
        },
        signal,
      });
      return { body: screenDeleteImpact(detail, orphaned.body.total), etag: null };
    },
  );

  const remove = async () => {
    if (blocked || deleting || impact.status !== 'ready') return;
    setDeleting(true);
    setFailure(null);
    try {
      await client.delete('/screens/{id}', { path: { id: screen.id } });
      toast.show({
        message: `${screen.name} deleted.`,
        description: 'The audit log keeps a record of everything deleted.',
      });
      onDeleted();
    } catch (thrown) {
      setFailure(getThrownMessage(thrown, { element: 'screen', action: 'delete' }));
      setDeleting(false);
    }
  };

  const summary =
    impact.status === 'ready' && impact.data !== null
      ? impactSummary(impact.data, screen.name)
      : null;

  return (
    <Modal
      open
      placement="top-right"
      icon={<Trash2 size={18} strokeWidth={ICON_STROKE_WIDTH} />}
      tone="danger"
      onClose={() => {
        if (!deleting) onClose();
      }}
      title={`Delete ${screen.name}?`}
      footer={
        <>
          <Button onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={blocked || impact.status !== 'ready'}
            onClick={() => {
              void remove();
            }}
          >
            Delete screen
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {impact.status === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-ink-500">
            <Spinner size="sm" />
            Checking what depends on this screen…
          </p>
        )}
        {impact.status === 'error' && (
          <Banner
            tone="danger"
            lead="Couldn't check what depends on this screen."
            actions={
              <Button size="sm" onClick={impact.reload}>
                Try again
              </Button>
            }
          >
            {impact.error ? (getErrorMessage(impact.error, { element: 'screen' }) ?? '') : ''}
          </Banner>
        )}
        {summary !== null && <DeleteImpactBody>{summary}</DeleteImpactBody>}
        {reason && <p className="text-small text-warning-ink">{reason}</p>}
        {failure && <Banner tone="danger">{failure}</Banner>}
      </div>
    </Modal>
  );
}
