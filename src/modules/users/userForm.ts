// userForm: the "New user" form (S-03): values, the checks of what the contract declares (name 1 to 120, email
// format up to 254, role, and the password policy of the department: 12 to 128 characters with letters and digits,
// FR-02, NFR-02) and the body of POST /users. The server checks everything again.
// generatePassword() makes a temporary password with the browser's random source; it is shown in the form and sent,
// and it is never stored, logged or put in a URL: the state of the modal is its only home.
import { getRuleMessage } from '../../api/messages';
import type { components } from '../../api/schema';

import type { UserRole } from './userLabels';

export const NAME_MAX = 120;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type UserCreate = components['schemas']['UserCreate'];

export interface UserFormValues {
  name: string;
  email: string;
  role: UserRole | '';
  password: string;
}

export interface UserFormErrors {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  /** What belongs to the whole form (a business refusal, an unexpected error). */
  form?: string;
}

export const FIELD_LABEL = {
  name: 'Full name',
  email: 'Email',
  role: 'Role',
  password: 'Temporary password',
  newPassword: 'New password',
} as const;

export const emptyUserValues: UserFormValues = { name: '', email: '', role: '', password: '' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordChecks {
  /** 12 to 128 characters. */
  length: boolean;
  /** At least one letter and one digit. */
  mix: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    mix: /[A-Za-z]/.test(password) && /\d/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.mix;
}

/** The message under the password field after a failed check; null when the password meets the policy. */
export function passwordError(password: string, label: string): string | null {
  if (password === '') return getRuleMessage('required', label);
  if (password.length < PASSWORD_MIN) return getRuleMessage('minLength', label);
  if (password.length > PASSWORD_MAX) return getRuleMessage('maxLength', label);
  return isPasswordValid(password) ? null : getRuleMessage('pattern', label);
}

export function nameError(value: string): string | undefined {
  const name = value.trim();
  if (name === '') return getRuleMessage('required', FIELD_LABEL.name);
  return name.length > NAME_MAX ? getRuleMessage('maxLength', FIELD_LABEL.name) : undefined;
}

export function emailError(value: string): string | undefined {
  const email = value.trim();
  if (email === '') return getRuleMessage('required', FIELD_LABEL.email);
  return EMAIL_PATTERN.test(email) && email.length <= EMAIL_MAX
    ? undefined
    : getRuleMessage('format', FIELD_LABEL.email);
}

export function validateNewUser(values: UserFormValues): UserFormErrors {
  return {
    name: nameError(values.name),
    email: emailError(values.email),
    role: values.role === '' ? getRuleMessage('required', FIELD_LABEL.role) : undefined,
    password: passwordError(values.password, FIELD_LABEL.password) ?? undefined,
  };
}

export function hasErrors(errors: UserFormErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}

export function toUserCreate(values: UserFormValues): UserCreate {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password,
    role: values.role as UserRole,
  };
}

// Letters and digits without the look-alikes (0 O 1 l I), so a password read aloud or from a screen is not mistyped.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const GENERATED_LENGTH = 16;

/** 16 random letters and digits, always with at least one of each. `random` is injectable for tests. */
export function generatePassword(
  random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
): string {
  const limit = 256 - (256 % ALPHABET.length); // bytes at or above it would favor the first characters
  for (;;) {
    let text = '';
    while (text.length < GENERATED_LENGTH) {
      for (const byte of random(new Uint8Array(GENERATED_LENGTH * 2))) {
        if (byte < limit && text.length < GENERATED_LENGTH) {
          text += ALPHABET[byte % ALPHABET.length];
        }
      }
    }
    if (isPasswordValid(text)) return text;
  }
}
