// EditUserModal: "Edit user" over the list (S-04, S-44). Props: userId, onClose, onSaved (the list is read again).
// Opening it reads GET /users/{id}: the list carries no ETag, and the form must start from the current copy.
// Saving sends PUT /users/{id} with If-Match = that ETag and { name, email, status } (the status as it is: role and
// status change from the row menu) plus `password` only when a new one was typed.
//  - 412 (S-44): the form keeps what was typed, Save is disabled and the banner offers "Reload" (reads the other
//    person's version into the form) or "Keep my changes visible" (hides the banner; the catalog sentence stays next to
//    Save).
//  - EMAIL_TAKEN goes under the email, VALIDATION_ERROR on each field, and every other refusal in the banner of the
//    form (RESERVED_ACCOUNT, NOT_FOUND, ...). Saving is disabled with the reason while offline.
//  - The administrator editing THEMSELVES: a new password ends their sessions on the server, so the client signs out
//    at once and the sign-in page says why; a change of name or email only updates the top bar (replaceUser).
import { Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import {
  Banner,
  Button,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  PasswordField,
  Skeleton,
  TextField,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { useSession } from '../../session/useSession';
import { formatTimestamp } from '../variables/variableLabels';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';

import {
  FIELD_LABEL,
  NAME_MAX,
  PASSWORD_MAX,
  emailError,
  hasErrors,
  nameError,
  passwordError,
  type UserFormErrors,
} from './userForm';
import { mapUserError } from './userErrors';
import type { User } from './userLabels';

interface EditUserModalProps {
  userId: number;
  onClose: () => void;
  onSaved: () => void;
}

const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';
const LABELS = { password: FIELD_LABEL.newPassword } as const;

export function EditUserModal({ userId, onClose, onSaved }: EditUserModalProps) {
  const client = useApi();
  const [reloads, setReloads] = useState(0);
  const resource = useApiResource<User>(`user:${userId}`, async (signal) => {
    const { body, etag } = await client.get('/users/{id}', { path: { id: userId }, signal });
    return { body: body.data, etag };
  });

  if (resource.status === 'ready' && resource.data !== null) {
    return (
      <EditUserForm
        // A fresh copy (after "Reload") starts a fresh form.
        key={`${resource.etag ?? ''}:${reloads}`}
        user={resource.data}
        etag={resource.etag}
        onClose={onClose}
        onSaved={onSaved}
        onReload={() => {
          setReloads((count) => count + 1);
          resource.reload();
        }}
      />
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Pencil size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title="Edit user"
    >
      {resource.status === 'error' ? (
        <Banner
          tone="danger"
          actions={
            <Button size="sm" onClick={resource.reload}>
              Try again
            </Button>
          }
        >
          {resource.error ? (getErrorMessage(resource.error, { element: 'user' }) ?? '') : ''}
        </Banner>
      ) : (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
    </Modal>
  );
}

interface EditUserFormProps {
  user: User;
  etag: string | null;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}

function EditUserForm({ user, etag, onClose, onSaved, onReload }: EditUserFormProps) {
  const client = useApi();
  const toast = useToast();
  const me = useCurrentUser();
  const { logout, replaceUser } = useSession();
  const { blocked, reason } = useOfflineBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const isSelf = me?.id === user.id;

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: UserFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || conflict !== null) return;
    const found: UserFormErrors = {
      name: nameError(name),
      email: emailError(email),
      password:
        password === ''
          ? undefined
          : (passwordError(password, FIELD_LABEL.newPassword) ?? undefined),
    };
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    setSaving(true);
    try {
      const { body } = await client.put('/users/{id}', {
        path: { id: user.id },
        ifMatch: etag ?? undefined,
        body: {
          name: name.trim(),
          email: email.trim(),
          status: user.status,
          ...(password !== '' && { password }),
        },
      });
      if (isSelf && password !== '') {
        // The server revoked the sessions of this user: the next refresh would fail, so end this one now.
        await logout('PASSWORD_CHANGED').catch(() => undefined);
        return;
      }
      if (isSelf) replaceUser(body.data);
      toast.show({ message: `${body.data.name} saved.` });
      onSaved();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown) && thrown.status === 412) {
        setConflict(getErrorMessage(thrown, { element: 'user' }) ?? '');
        setConflictHidden(false);
      } else if (isApiError(thrown)) {
        fail(mapUserError(thrown, LABELS));
      } else {
        fail({ form: 'Something went wrong on our side. Try again in a moment.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveReason = conflict !== null ? conflict : reason;
  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      size="md"
      initialFocusRef={nameRef}
      icon={<Pencil size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title="Edit user"
      description={`Last updated ${formatTimestamp(user.updatedAt)}`}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {saveReason ? (
            <p id={reasonId} className="text-small text-warning-ink">
              {saveReason}
            </p>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={saving}
              disabled={blocked || conflict !== null}
              aria-describedby={saveReason ? reasonId : undefined}
            >
              Save changes
            </Button>
          </span>
        </div>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-4"
      >
        {conflict !== null && !conflictHidden && (
          <Banner
            tone="warning"
            actions={
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setConflictHidden(true);
                  }}
                >
                  Keep my changes visible
                </Button>
                <Button size="sm" variant="primary" onClick={onReload}>
                  Reload
                </Button>
              </>
            }
          >
            {conflict} {CONFLICT_EXTRA}
          </Banner>
        )}
        {errors.form && <Banner tone="danger">{errors.form}</Banner>}
        <FormField
          label={FIELD_LABEL.name}
          required
          error={errors.name}
          help={
            <span className="flex justify-end" aria-hidden="true">
              {name.length}/{NAME_MAX}
            </span>
          }
        >
          {(control) => (
            <TextField
              {...control}
              ref={nameRef}
              autoComplete="off"
              maxLength={NAME_MAX}
              disabled={saving}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined, form: undefined }));
              }}
            />
          )}
        </FormField>
        <FormField label={FIELD_LABEL.email} required error={errors.email}>
          {(control) => (
            <TextField
              {...control}
              type="email"
              autoComplete="off"
              disabled={saving}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined, form: undefined }));
              }}
            />
          )}
        </FormField>
        <FormField
          label={FIELD_LABEL.newPassword}
          error={errors.password}
          help={
            isSelf
              ? "Changing it signs you out: you'll need to sign in again."
              : 'Changing it signs the user out of open sessions.'
          }
        >
          {(control) => (
            <PasswordField
              {...control}
              autoComplete="new-password"
              spellCheck={false}
              maxLength={PASSWORD_MAX}
              placeholder="Leave empty to keep the current password"
              disabled={saving}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined, form: undefined }));
              }}
            />
          )}
        </FormField>
        <p className="text-small text-ink-500">Role and status are changed from the row menu.</p>
      </form>
    </Modal>
  );
}
