// DeleteVariableModal: confirmation to delete a variable, with the impact (S-13).
// Props: variable ({ id, name }), onClose, onDeleted (called after DELETE succeeded; the page decides where to go).
// It reads GET /variables/{id}/dependencies when it opens and says how many screens, collections and components
// are linked ("... Those links are deleted too. The audit log keeps a record of everything deleted."). Delete stays
// disabled until the impact is known (an unknown impact is never deleted blindly); if the read fails the modal
// offers to try again. Delete is also disabled, with the reason, when the application is archived or the browser is
// offline; a server refusal (APPLICATION_ARCHIVED, NOT_FOUND ...) shows its catalog message in the modal.
import { useState } from 'react';

import { getThrownMessage, getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { Banner, Button, Modal, Spinner, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';

import { deleteImpact, impactSummary } from './deleteImpact';
import type { VariableDependencies } from './variableTypes';

interface DeleteVariableModalProps {
  variable: { id: number; name: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteVariableModal({ variable, onClose, onDeleted }: DeleteVariableModalProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useWriteBlock();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const impact = useApiResource<VariableDependencies>(
    `delete-impact:${variable.id}`,
    async (signal) => {
      const { body } = await client.get('/variables/{id}/dependencies', {
        path: { id: variable.id },
        signal,
      });
      return { body: body.data, etag: null };
    },
  );

  const remove = async () => {
    if (blocked || deleting || impact.status !== 'ready') return;
    setDeleting(true);
    setFailure(null);
    try {
      await client.delete('/variables/{id}', { path: { id: variable.id } });
      toast.show({ message: `${variable.name} deleted.` });
      onDeleted();
    } catch (thrown) {
      setFailure(getThrownMessage(thrown, { element: 'variable' }));
      setDeleting(false);
    }
  };

  const summary =
    impact.status === 'ready' && impact.data !== null
      ? impactSummary(deleteImpact(impact.data))
      : null;
  const name = <span className="font-mono text-label">{variable.name}</span>;

  return (
    <Modal
      open
      onClose={() => {
        if (!deleting) onClose();
      }}
      title={`Delete ${variable.name}?`}
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
            Delete variable
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {impact.status === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-ink-500">
            <Spinner size="sm" />
            Checking what depends on this variable…
          </p>
        )}
        {impact.status === 'error' && (
          <Banner
            tone="danger"
            lead="Couldn't check what depends on this variable."
            actions={
              <Button size="sm" onClick={impact.reload}>
                Try again
              </Button>
            }
          >
            {impact.error ? (getErrorMessage(impact.error, { element: 'variable' }) ?? '') : ''}
          </Banner>
        )}
        {impact.status === 'ready' && (
          <p>
            {name}{' '}
            {summary === null
              ? "isn't linked to anything."
              : `${summary}. Those links are deleted too.`}{' '}
            The audit log keeps a record of everything deleted.
          </p>
        )}
        {reason && <p className="text-small text-warning-ink">{reason}</p>}
        {failure && <Banner tone="danger">{failure}</Banner>}
      </div>
    </Modal>
  );
}
