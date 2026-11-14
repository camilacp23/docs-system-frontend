// DeleteCollectionModal: confirmation to delete a collection, with the impact (S-17).
// Props: collection ({ id, name }), onClose, onDeleted (called after DELETE succeeded; the page decides where to go).
// It reads GET /collections/{id} and the screens that use the collection (GET /dependencies/collections/{id}?depth=1,
// D-103) when it opens, and says how many fields, variable assignments, derivations and links to screens are deleted
// too ("Its 8 fields, 3 variable assignments, 1 derivation and its links to 2 screens are deleted too. The audit log
// keeps a record of everything deleted."). Delete stays disabled until BOTH reads are known (an unknown impact is
// never deleted blindly, the same pattern as the screen, D-99); if either read fails the modal says so and offers to
// try again. Delete is also disabled, with the reason, when the application is archived or the browser is
// offline; a server refusal (APPLICATION_ARCHIVED, NOT_FOUND ...) shows its catalog message in the modal.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { getErrorMessage, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, Spinner, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { DeleteImpactBody } from '../shared/DeleteImpactBody';

import type { Collection } from './collectionTypes';
import { deleteImpact, impactSummary } from './deleteImpact';
import { useCollectionScreens } from './useCollectionScreens';

interface DeleteCollectionModalProps {
  collection: { id: number; name: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteCollectionModal({
  collection,
  onClose,
  onDeleted,
}: DeleteCollectionModalProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useWriteBlock();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const impact = useApiResource<Collection>(`delete-impact:${collection.id}`, async (signal) => {
    const { body } = await client.get('/collections/{id}', {
      path: { id: collection.id },
      signal,
    });
    return { body: body.data, etag: null };
  });

  const screens = useCollectionScreens(collection.id, 'delete');
  // The impact is known only when both reads arrived.
  const status =
    impact.status === 'error' || screens.status === 'error'
      ? 'error'
      : impact.status === 'ready' && screens.status === 'ready'
        ? 'ready'
        : 'loading';
  const failed = impact.status === 'error' ? impact : screens;

  const remove = async () => {
    if (blocked || deleting || status !== 'ready') return;
    setDeleting(true);
    setFailure(null);
    try {
      await client.delete('/collections/{id}', { path: { id: collection.id } });
      toast.show({
        message: `${collection.name} deleted.`,
        description: 'The audit log keeps a record of everything deleted.',
      });
      onDeleted();
    } catch (thrown) {
      setFailure(getThrownMessage(thrown, { element: 'collection' }));
      setDeleting(false);
    }
  };

  const summary =
    status === 'ready' && impact.data !== null && screens.data !== null
      ? impactSummary(deleteImpact(impact.data, screens.data.length))
      : null;
  const name = <span className="font-mono text-label">{collection.name}</span>;

  return (
    <Modal
      open
      placement="top-right"
      icon={<Trash2 size={18} strokeWidth={ICON_STROKE_WIDTH} />}
      tone="danger"
      onClose={() => {
        if (!deleting) onClose();
      }}
      title={`Delete ${collection.name}?`}
      footer={
        <>
          <Button onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={blocked || status !== 'ready'}
            onClick={() => {
              void remove();
            }}
          >
            Delete collection
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {status === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-ink-500">
            <Spinner size="sm" />
            Checking what depends on this collection…
          </p>
        )}
        {status === 'error' && (
          <Banner
            tone="danger"
            lead="Couldn't check what depends on this collection."
            actions={
              <Button
                size="sm"
                onClick={() => {
                  // Read again only what failed: the other answer is still good.
                  if (impact.status === 'error') impact.reload();
                  if (screens.status === 'error') screens.reload();
                }}
              >
                Try again
              </Button>
            }
          >
            {failed.error ? (getErrorMessage(failed.error, { element: 'collection' }) ?? '') : ''}
          </Banner>
        )}
        {status === 'ready' && (
          <DeleteImpactBody>
            {summary === null ? <>{name} has no fields or links.</> : summary}
          </DeleteImpactBody>
        )}
        {reason && <p className="text-small text-warning-ink">{reason}</p>}
        {failure && <Banner tone="danger">{failure}</Banner>}
      </div>
    </Modal>
  );
}
