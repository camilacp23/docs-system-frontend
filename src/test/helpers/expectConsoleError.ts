// expectConsoleError: lets ONE test accept the console.error it provokes on purpose, and nothing else.
// expectConsoleError(...expected) -> { matched: string[] } (the accepted messages, so the test can also assert that the
// expected one did happen). `expected` are strings (the text of the message contains it) or regular expressions.
// A console.error that matches none is NOT swallowed: it is passed on to the real console (so it shows in the output) and
// the test fails when it ends, with the message in the failure. The spy is restored after each test; this file registers
// that hook for every test file that imports it.
// The text compared is the arguments of the call joined with a space (an Error as "Name: message"), as the console
// would write them.
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

type Expected = string | RegExp;

interface Handle {
  matched: string[];
  unexpected: string[];
  restore: () => void;
}

const handles: Handle[] = [];

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function textOf(args: unknown[]): string {
  return args
    .map((arg) =>
      arg instanceof Error
        ? `${arg.name}: ${arg.message}`
        : typeof arg === 'string'
          ? arg
          : safeJson(arg),
    )
    .join(' ');
}

export function expectConsoleError(...expected: Expected[]): Pick<Handle, 'matched'> {
  const original = console.error;
  const handle: Handle = { matched: [], unexpected: [], restore: () => undefined };
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = textOf(args);
    const accepted = expected.some((one) =>
      typeof one === 'string' ? text.includes(one) : one.test(text),
    );
    if (accepted) {
      handle.matched.push(text);
      return;
    }
    const where = (new Error().stack ?? '').split('\n').slice(2, 9).join('\n');
    handle.unexpected.push(`${text}\n${where}`);
    original.apply(console, args);
  });
  handle.restore = () => {
    spy.mockRestore();
  };
  handles.push(handle);
  return handle;
}

afterEach(() => {
  const finished = handles.splice(0);
  for (const handle of finished) handle.restore();
  const unexpected = finished.flatMap((handle) => handle.unexpected);
  if (unexpected.length > 0) {
    // Clean the page first: the cleanup of the setup file may run after this hook, and a failure must not leak its DOM.
    cleanup();
    throw new Error(
      `Unexpected console.error (${unexpected.length}) while one was expected:\n${unexpected
        .map((text) => text.slice(0, 900))
        .join('\n---\n')}`,
    );
  }
});
