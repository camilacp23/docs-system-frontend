// DeleteCollectionModal: confirmation to delete a collection, with the impact (S-17).
// Props: collection ({ id, name }), onClose, onDeleted (called after DELETE succeeded; the page decides where to go).
// It reads GET /collections/{id} when it opens and says how many fields, variable assignments and derivations the
// collection has ("Its 8 fields, 3 variable assignments and 1 derivation are deleted too. The audit log keeps a
// record of everything deleted."). The API gives no screen links, so they are not counted (D-79). Delete stays
// disabled until the impact is known (an unknown impact is never deleted blindly); if the read fails the modal
// offers to try again. Delete is also disabled, with the reason, when the application is archived or the browser is
// offline; a server refusal (APPLICATION_ARCHIVED, NOT_FOUND ...) shows its catalog message in the modal.
import { useState } from 'react';

import { getErrorMessage, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Banner, Button, Modal, Spinner, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';

import type { Collection } from './collectionTypes';
import { deleteImpact, impactSummary } from './deleteImpact';

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

  const remove = async () => {
    if (blocked || deleting || impact.status !== 'ready') return;
    setDeleting(true);
    setFailure(null);
    try {
      await client.delete('/collections/{id}', { path: { id: collection.id } });
      toast.show({ message: `${collection.name} deleted.` });
      onDeleted();
    } catch (thrown) {
      setFailure(getThrownMessage(thrown, { element: 'collection' }));
      setDeleting(false);
    }
  };

  const summary =
    impact.status === 'ready' && impact.data !== null
      ? impactSummary(deleteImpact(impact.data))
      : null;
  const name = <span className="font-mono text-label">{collection.name}</span>;

  return (
    <Modal
      open
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
            disabled={blocked || impact.status !== 'ready'}
            onClick={() => {
              void remove();
            }}
          >
            Delete collection
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {impact.status === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-ink-500">
            <Spinner size="sm" />
            Checking what depends on this collection…
          </p>
        )}
        {impact.status === 'error' && (
          <Banner
            tone="danger"
            lead="Couldn't check what depends on this collection."
            actions={
              <Button size="sm" onClick={impact.reload}>
                Try again
              </Button>
            }
          >
            {impact.error ? (getErrorMessage(impact.error, { element: 'collection' }) ?? '') : ''}
          </Banner>
        )}
        {impact.status === 'ready' && (
          <p>
            {summary === null ? <>{name} has no fields or links.</> : summary} The audit log keeps a
            record of everything deleted.
          </p>
        )}
        {reason && <p className="text-small text-warning-ink">{reason}</p>}
        {failure && <Banner tone="danger">{failure}</Banner>}
      </div>
    </Modal>
  );
}
