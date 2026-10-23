// LoginPage: sign in (S-01a, S-01b, S-01c). The only page outside the shell (SDD Figure 9).
// No props. Client validation (email required and valid, password required) with the S-01c texts. Errors:
// 401 INVALID_CREDENTIALS -> the same danger banner whatever the cause (S-01b, D-27); 429 -> warning banner with the
// minutes of `details` and a disabled button counting down "Try again in mm:ss" from Retry-After (seconds; if it is
// missing, details.minutes x 60); anything else -> its catalog text. On success the session changes and the route
// (GuestOnly) sends the user to the remembered page or /dashboard. Below 1280 px the left panel is hidden (SDD 7.3.7).
import { Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  FormField,
  ICON_STROKE_WIDTH,
  PasswordField,
  TextField,
} from '../../components/ui';
import { useSession } from '../../session/useSession';

import { formatCountdown, useCountdown } from './useCountdown';

export const EMAIL_ERROR_TEXT = 'Enter a valid email, e.g. name@domain.com.';
export const PASSWORD_ERROR_TEXT = 'Enter your password.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Banners {
  tone: 'danger' | 'warning';
  text: string;
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
  const { remaining, start } = useCountdown();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const blocked = remaining > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || submitting) return;

    const nextEmailError = EMAIL_PATTERN.test(email.trim()) ? null : EMAIL_ERROR_TEXT;
    const nextPasswordError = password === '' ? PASSWORD_ERROR_TEXT : null;
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
    <div className="grid min-h-screen grid-cols-1 bg-canvas xl:grid-cols-[5fr_7fr]">
      <section
        aria-label="Documentación técnica"
        className="hidden flex-col justify-between bg-navy-900 p-14 xl:flex"
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-keycap bg-accent font-mono text-body-lg font-semibold text-on-primary"
          >
            DT
          </span>
          <span className="text-subheading font-semibold text-on-primary">
            Documentación técnica
          </span>
        </div>
        <div className="flex max-w-105 flex-col gap-4">
          <p className="text-hero font-semibold text-on-primary">
            Technical documentation of the department&apos;s applications
          </p>
          <p className="text-body-lg text-sidebar-muted">
            Screens, variables, collections and their dependencies, in one place, with review and
            Jira tracking.
          </p>
        </div>
        <p className="text-small text-sidebar-muted">
          Enterprise Architecture Department · Sessions last up to 12 hours.
        </p>
      </section>
      <main className="flex items-center justify-center p-6">
        <form
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby="sign-in-title"
          className="flex w-full max-w-100 flex-col gap-5 rounded-card border border-border-subtle bg-surface p-8 shadow-card"
        >
          <div className="flex flex-col gap-1">
            <h1
              id="sign-in-title"
              className="text-page-title font-semibold tracking-normal text-ink-900"
            >
              Sign in
            </h1>
            <p className="text-body text-ink-500">Use your department account.</p>
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
                ref={emailRef}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                }}
              />
            )}
          </FormField>
          <FormField label="Password" required error={passwordError}>
            {(control) => (
              <PasswordField
                {...control}
                ref={passwordRef}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError(null);
                }}
              />
            )}
          </FormField>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={blocked}
          >
            {blocked ? `Try again in ${formatCountdown(remaining)}` : 'Sign in'}
          </Button>
          <p className="text-center text-small text-ink-500">
            Forgot your password? Ask an administrator to reset it.
          </p>
        </form>
      </main>
    </div>
  );
}
