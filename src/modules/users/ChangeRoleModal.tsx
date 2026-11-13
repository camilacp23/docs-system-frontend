// ChangeRoleModal: "Change role" over the list (S-05). Props: user, onClose, onChanged (the list is read again).
// The three roles as radio cards with what each allows; "Change role" is disabled until another role is chosen.
// PUT /users/{id}/role has no If-Match (the contract declares none), so there is no 412 here. The server revokes
// the sessions of the user whose role changes: the frame says so ("... is signed out of open sessions"). When the
// administrator changes THEIR OWN role the modal warns before confirming, and after the 200 the client signs out at
// once (the refresh cookie is revoked) and the sign-in page says why.
// LAST_ACTIVE_ADMIN, RESERVED_ACCOUNT, NOT_FOUND and the other refusals appear in a banner of the modal.
import { Info, TriangleAlert, Users } from 'lucide-react';
import { useId, useState } from 'react';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, useToast } from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { useSession } from '../../session/useSession';

import { RolePicker } from './RolePicker';
import { FIELD_LABEL } from './userForm';
import { mapUserError } from './userErrors';
import { ROLE_LABEL, type User, type UserRole } from './userLabels';

interface ChangeRoleModalProps {
  user: User;
  onClose: () => void;
  onChanged: () => void;
}

export function ChangeRoleModal({ user, onClose, onChanged }: ChangeRoleModalProps) {
  const client = useApi();
  const toast = useToast();
  const me = useCurrentUser();
  const { logout } = useSession();
  const { blocked, reason } = useOfflineBlock();
  const reasonId = useId();
  const isSelf = me?.id === user.id;

  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ form?: string; role?: string } | null>(null);

  const submit = async () => {
    if (blocked || saving || role === user.role) return;
    setSaving(true);
    setFailure(null);
    try {
      const { body } = await client.put('/users/{id}/role', {
        path: { id: user.id },
        body: { role },
      });
      if (isSelf) {
        await logout('ROLE_CHANGED').catch(() => undefined);
        return;
      }
      toast.show({ message: `${body.data.name} is now ${ROLE_LABEL[body.data.role]}.` });
      onChanged();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown)) setFailure(mapUserError(thrown));
      else setFailure({ form: 'Something went wrong on our side. Try again in a moment.' });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      size="md"
      icon={<Users size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title="Change role"
      description={`${user.name} · currently ${ROLE_LABEL[user.role]}`}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {reason ? (
            <p id={reasonId} className="text-small text-warning-ink">
              {reason}
            </p>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={blocked || role === user.role}
              aria-describedby={reason ? reasonId : undefined}
              onClick={() => {
                void submit();
              }}
            >
              Change role
            </Button>
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {failure?.form && <Banner tone="danger">{failure.form}</Banner>}
        <RolePicker
          name="change-role"
          label={FIELD_LABEL.role}
          error={failure?.role}
          disabled={saving}
          value={role}
          onChange={(next) => {
            setRole(next);
            setFailure(null);
          }}
        />
        {isSelf ? (
          <Banner
            tone="warning"
            icon={<TriangleAlert size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />}
          >
            You&apos;re changing your own role. Your sessions will end and you&apos;ll need to sign
            in again.
          </Banner>
        ) : (
          <Banner
            tone="info"
            icon={<Info size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />}
          >
            The new role applies immediately and {user.name} is signed out of open sessions.
          </Banner>
        )}
      </div>
    </Modal>
  );
}
