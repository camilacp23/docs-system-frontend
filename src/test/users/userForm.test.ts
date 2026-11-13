// userForm: the password policy of the department (12 to 128 characters with letters and digits), the checks of the
// "New user" form, the body of POST /users, and the temporary password generator.
import { describe, expect, it } from 'vitest';

import {
  emptyUserValues,
  generatePassword,
  hasErrors,
  isPasswordValid,
  passwordChecks,
  passwordError,
  toUserCreate,
  validateNewUser,
} from '../../modules/users/userForm';

const VALID = {
  name: 'Ana Mora',
  email: 'ana@dept.local',
  role: 'DEVELOPER',
  password: 'Clave-2026-xyz',
} as const;

describe('password policy', () => {
  it.each([
    ['abcdefghijk1', true, true], // 12 characters, a letter and a digit
    ['abcdefghij1', false, true], // 11 characters
    ['abcdefghijkl', true, false], // no digit
    ['123456789012', true, false], // no letter
    ['', false, false],
  ])('%j -> length %s, letters and digits %s', (password, length, mix) => {
    expect(passwordChecks(password)).toEqual({ length, mix });
  });

  it('accepts exactly 128 characters and rejects 129', () => {
    expect(isPasswordValid(`a1${'x'.repeat(126)}`)).toBe(true);
    expect(isPasswordValid(`a1${'x'.repeat(127)}`)).toBe(false);
  });

  it('says what is wrong with the words of the catalog', () => {
    expect(passwordError('', 'Temporary password')).toBe('Temporary password is required.');
    expect(passwordError('abc1', 'Temporary password')).toBe('Temporary password is too short.');
    expect(passwordError(`a1${'x'.repeat(127)}`, 'Temporary password')).toBe(
      'Temporary password is too long.',
    );
    expect(passwordError('abcdefghijkl', 'Temporary password')).toBe(
      "Temporary password isn't in a valid format.",
    );
    expect(passwordError('abcdefghijk1', 'Temporary password')).toBeNull();
  });
});

describe('validateNewUser', () => {
  it('accepts a complete form and builds the body with trimmed name and email', () => {
    expect(hasErrors(validateNewUser(VALID))).toBe(false);
    expect(toUserCreate({ ...VALID, name: '  Ana Mora ', email: ' ana@dept.local ' })).toEqual({
      name: 'Ana Mora',
      email: 'ana@dept.local',
      password: 'Clave-2026-xyz',
      role: 'DEVELOPER',
    });
  });

  it('requires every field', () => {
    expect(validateNewUser(emptyUserValues)).toEqual({
      name: 'Full name is required.',
      email: 'Email is required.',
      role: 'Role is required.',
      password: 'Temporary password is required.',
    });
  });

  it('checks the length of the name and the format of the email', () => {
    expect(validateNewUser({ ...VALID, name: 'x'.repeat(121) }).name).toBe(
      'Full name is too long.',
    );
    expect(validateNewUser({ ...VALID, name: '   ' }).name).toBe('Full name is required.');
    expect(validateNewUser({ ...VALID, email: 'not-an-email' }).email).toBe(
      "Email isn't in a valid format.",
    );
    expect(validateNewUser({ ...VALID, email: `${'x'.repeat(250)}@a.co` }).email).toBe(
      "Email isn't in a valid format.",
    );
  });
});

describe('generatePassword', () => {
  it('makes 16 letters and digits that meet the policy', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      expect(password).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(isPasswordValid(password)).toBe(true);
    }
  });

  it('never uses the look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(generatePassword()).not.toMatch(/[01OlI]/);
  });

  it('keeps drawing until it has a letter and a digit, and ignores the biased bytes', () => {
    // 255 is above the unbiased limit (252 for 56 characters) and is skipped; the first draw is letters only.
    const draws = [
      new Uint8Array(32).fill(0), // 32 times "A": no digit, rejected as a whole
      new Uint8Array(32).fill(255), // all skipped
      Uint8Array.from({ length: 32 }, (_, index) => (index === 0 ? 55 : 1)), // a digit first, then letters
    ];
    let next = 0;
    const password = generatePassword((bytes) => {
      const draw = draws[Math.min(next++, draws.length - 1)] as Uint8Array;
      bytes.set(draw.subarray(0, bytes.length));
      return bytes;
    });
    expect(isPasswordValid(password)).toBe(true);
    expect(password).toHaveLength(16);
  });
});
