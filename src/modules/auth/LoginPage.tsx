// LoginPage: sign in (S-01a, S-01b, S-01c). The only page outside the shell (SDD Figure 9).
// No props. Client validation (email required and valid, password required) with the S-01c texts. Errors:
// 401 INVALID_CREDENTIALS -> the same danger banner whatever the cause (S-01b, D-27); 429 -> warning banner with the
// minutes of `details` and a disabled button counting down "Try again in mm:ss" from Retry-After (seconds; if it is
// missing, details.minutes x 60); anything else -> its catalog text. On success the session changes and the route
// (GuestOnly) sends the user to the remembered page or /dashboard. Below 1280 px the left panel is hidden (SDD 7.3.7).
import { Clock, Lock, Mail } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  ElementTypeIcon,
  FormField,
  ICON_STROKE_WIDTH,
  PasswordField,
  TextField,
} from '../../components/ui';
import { useSession } from '../../session/useSession';

import { formatCountdown, useCountdown } from './useCountdown';

export const EMAIL_ERROR_TEXT = 'Enter a valid email, e.g. name@domain.com.';
export const PASSWORD_ERROR_TEXT = 'Enter your password.';

const HIGHLIGHTS = [
  { type: 'screen', text: 'Screens' },
  { type: 'variable', text: 'Variables' },
  { type: 'collection', text: 'Collections' },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Banners {
  tone: 'danger' | 'warning';
  text: string;
}

function checkEmail(value: string): string | null {
  return EMAIL_PATTERN.test(value.trim()) ? null : EMAIL_ERROR_TEXT;
}

function checkPassword(value: string): string | null {
  return value === '' ? PASSWORD_ERROR_TEXT : null;
}

/** Seconds to wait after a 429: Retry-After, or `details.minutes` x 60 when the header is missing; null if neither. */
function waitSeconds(error: {
  retryAfterSeconds: number | null;
  details: Record<string, unknown> | null;
}) {
  if (error.retryAfterSeconds !== null) return error.retryAfterSeconds;
  const minutes = error.details?.minutes;
  return typeof minutes === 'number' ? minutes * 60 : null;
}

export function LoginPage() {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banners | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A field is validated when it loses focus only after the user has edited it (S-01c shows the errors of edited
  // fields next to the countdown, when the button cannot be pressed).
  const edited = useRef({ email: false, password: false });
  const { remaining, start } = useCountdown();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const blocked = remaining > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || submitting) return;

    const nextEmailError = checkEmail(email);
    const nextPasswordError = checkPassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setBanner(null);
    if (nextEmailError) return emailRef.current?.focus();
    if (nextPasswordError) return passwordRef.current?.focus();

    setSubmitting(true);
    login(email.trim(), password)
      .catch((error: unknown) => {
        if (!isApiError(error)) return;
        if (error.code === 'RATE_LIMITED') {
          const seconds = waitSeconds(error);
          if (seconds !== null) start(seconds);
        }
        const text = getErrorMessage(error);
        if (text) setBanner({ tone: error.code === 'RATE_LIMITED' ? 'warning' : 'danger', text });
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[5fr_7fr]">
      <section
        aria-label="Documentación técnica"
        className="relative hidden flex-col justify-between overflow-hidden bg-(image:--gradient-sidebar) p-14 xl:flex"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-(image:--pattern-grid) [mask-image:radial-gradient(ellipse_at_30%_55%,black,transparent_75%)] bg-size-[40px_40px]"
        />
        <div />
        <div className="relative flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-5">
            <span aria-hidden="true" className="h-1 w-10 rounded-pill bg-accent" />
            <div className="flex flex-col gap-3">
              <p className="text-hero font-semibold text-on-primary">
                Technical documentation for department applications
              </p>
              <p className="text-subheading text-sidebar-muted-2">
                One reviewed source of truth, tracked in Jira.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-3 border-t border-sidebar-divider pt-8">
            {HIGHLIGHTS.map(({ type, text }) => (
              <li key={type} className="flex items-center gap-3 text-body-lg text-sidebar-text">
                <span className="flex size-9 items-center justify-center rounded-chip border border-sidebar-card-border bg-sidebar-card text-sidebar-active-indicator">
                  <ElementTypeIcon type={type} size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-small text-sidebar-muted">
          Enterprise Architecture Department · Sessions last up to 12 hours.
        </p>
      </section>
      <main className="flex flex-col bg-(image:--gradient-canvas-soft) px-6 py-8">
        <div className="flex flex-1 items-center justify-center">
          <form
            noValidate
            onSubmit={handleSubmit}
            aria-labelledby="sign-in-title"
            className="flex w-full max-w-130 flex-col gap-6 rounded-card border border-border-subtle bg-surface p-10 shadow-modal motion-safe:animate-rise"
          >
            <div className="flex flex-col gap-1.5">
              <h1 id="sign-in-title" className="text-heading font-semibold text-ink-900">
                Sign in
              </h1>
              <p className="text-body-lg text-ink-500">Use your department account.</p>
            </div>
            {banner && (
              <Banner
                tone={banner.tone}
                icon={
                  banner.tone === 'warning' ? (
                    <Clock size={18} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
                  ) : undefined
                }
              >
                {banner.text}
              </Banner>
            )}
            <FormField label="Email" required error={emailError}>
              {(control) => (
                <TextField
                  {...control}
                  large
                  icon={<Mail size={18} strokeWidth={ICON_STROKE_WIDTH} />}
                  ref={emailRef}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    edited.current.email = true;
                    setEmail(event.target.value);
                    setEmailError(null);
                  }}
                  onBlur={() => {
                    if (edited.current.email) setEmailError(checkEmail(email));
                  }}
                />
              )}
            </FormField>
            <FormField label="Password" required error={passwordError}>
              {(control) => (
                <PasswordField
                  {...control}
                  large
                  icon={<Lock size={18} strokeWidth={ICON_STROKE_WIDTH} />}
                  ref={passwordRef}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    edited.current.password = true;
                    setPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  onBlur={() => {
                    if (edited.current.password) setPasswordError(checkPassword(password));
                  }}
                />
              )}
            </FormField>
            <Button
              type="submit"
              variant="primary"
              size="xl"
              fullWidth
              loading={submitting}
              disabled={blocked}
            >
              {blocked ? `Try again in ${formatCountdown(remaining)}` : 'Sign in'}
            </Button>
            <p className="border-t border-divider pt-5 text-center text-small text-ink-500">
              Forgot your password? Ask an administrator to reset it.
            </p>
          </form>
        </div>
        <p className="pt-6 text-center text-small text-ink-500">
          © {new Date().getFullYear()} Enterprise Architecture Department
        </p>
      </main>
    </div>
  );
}
