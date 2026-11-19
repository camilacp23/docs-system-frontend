// CreateUserModal: "New user" over the list (S-03). Rendered only while it is open (its state starts fresh each time and
// is dropped when it closes: the temporary password is never kept anywhere else). Props: onClose, onCreated (called
// after the user was created, to read the list again).
// Layout (the one of the New variable modal): wide, two columns of headed groups: Account (name, email) and Temporary password on the
// left, Access (the role cards) on the right.
// Fields: Full name (n/120), Email, Role (radio cards) and Temporary password with "Generate" and the two checks of
// the policy (12 to 128 characters; letters and digits). The password is shown as typed, as the frame draws it, so
// the administrator can pass it on. Client checks cover only what the contract declares; EMAIL_TAKEN goes under the
// email and every other refusal in the banner of the form. Creating is disabled, with the reason, while offline.
// On success a toast says "<name> created.".
import { Check, Info, KeyRound, Plus, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import {
  Banner,
  Button,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  TextField,
  cx,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { ModalGroup } from '../shared/ModalGroup';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';

import { RolePicker } from './RolePicker';
import {
  FIELD_LABEL,
  NAME_MAX,
  PASSWORD_MAX,
  emptyUserValues,
  generatePassword,
  hasErrors,
  passwordChecks,
  toUserCreate,
  validateNewUser,
  type UserFormErrors,
  type UserFormValues,
} from './userForm';
import { mapUserError } from './userErrors';

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function PolicyCheck({ met, children }: { met: boolean; children: string }) {
  const Icon = met ? Check : X;
  return (
    <li className={cx('flex items-center gap-1.5', met ? 'text-success-ink' : 'text-ink-500')}>
      <Icon aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
      <span>{children}</span>
      <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
    </li>
  );
}

export function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useOfflineBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<UserFormValues>(emptyUserValues);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: UserFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const change = (patch: Partial<UserFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current, form: undefined };
      for (const key of Object.keys(patch) as Array<keyof UserFormValues>) next[key] = undefined;
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving) return;
    const found = validateNewUser(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    setSaving(true);
    try {
      const { body } = await client.post('/users', { body: toUserCreate(values) });
      toast.show({ message: `${body.data.name} created.` });
      onCreated();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown)) fail(mapUserError(thrown));
      else fail({ form: 'Something went wrong on our side. Try again in a moment.' });
    } finally {
      setSaving(false);
    }
  };

  const checks = passwordChecks(values.password);
  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      size="xl"
      initialFocusRef={nameRef}
      icon={<UserPlus size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title="New user"
      description="Who they are, which role they have and a temporary password"
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {reason ? (
            <p id={reasonId} className="text-small text-warning-ink">
              {reason}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-small text-ink-500">
              <Info
                aria-hidden="true"
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                className="mt-px shrink-0"
              />
              <span>
                <span className="block font-semibold text-ink-700">
                  Pass the password on to the user
                </span>
                It is not shown again once the user is created.
              </span>
            </p>
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
              disabled={blocked}
              aria-describedby={reason ? reasonId : undefined}
              aria-label="Create user"
              iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              Create
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
        {errors.form && <Banner tone="danger">{errors.form}</Banner>}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
          <div className="flex flex-col gap-5">
            <ModalGroup
              title="Account"
              icon={<UserRound size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <FormField
                label={FIELD_LABEL.name}
                required
                error={errors.name}
                help={
                  <span className="flex justify-end" aria-hidden="true">
                    {values.name.length}/{NAME_MAX}
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
                    value={values.name}
                    onChange={(event) => {
                      change({ name: event.target.value });
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
                    value={values.email}
                    onChange={(event) => {
                      change({ email: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </ModalGroup>
            <ModalGroup
              title="Password"
              icon={<KeyRound size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <div className="flex flex-col gap-1.5">
                <FormField label={FIELD_LABEL.password} required error={errors.password}>
                  {(control) => (
                    <div className="flex items-start gap-2">
                      <TextField
                        {...control}
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={PASSWORD_MAX}
                        disabled={saving}
                        value={values.password}
                        onChange={(event) => {
                          change({ password: event.target.value });
                        }}
                        className="flex-1"
                      />
                      <Button
                        disabled={saving}
                        iconLeft={
                          <KeyRound aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
                        }
                        onClick={() => {
                          change({ password: generatePassword() });
                        }}
                      >
                        Generate
                      </Button>
                    </div>
                  )}
                </FormField>
                <ul aria-label="Password policy" className="flex flex-col gap-0.5 text-small">
                  <PolicyCheck met={checks.length}>At least 12 characters</PolicyCheck>
                  <PolicyCheck met={checks.mix}>Letters and digits</PolicyCheck>
                </ul>
              </div>
            </ModalGroup>
          </div>
          <div className="flex flex-col gap-5 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <ModalGroup
              title="Access"
              icon={<ShieldCheck size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <RolePicker
                name="new-user-role"
                label={FIELD_LABEL.role}
                required
                error={errors.role}
                disabled={saving}
                value={values.role}
                onChange={(role) => {
                  change({ role });
                }}
              />
            </ModalGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}
