// SessionNotices: the two session messages of the frame states, rendered once at the root of the router.
// S-43a: when the session enters its last 10 minutes, a persistent warning toast "Your session ends at HH:MM...".
//        It closes when the user dismisses it, or by itself if the session is renewed.
// S-43b: when the session ended (12 h limit reached or the refresh cookie revoked) a blocking dialog
//        "Your session ended" over the same page; "Sign in" goes to /login and returns to that page afterwards.
//        The sentence about unsaved changes kept in the browser is left out until forms keep drafts.
// No props.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Button, Modal, useToast } from '../components/ui';
import { useSession } from '../session/useSession';

import { destinationOf, type LoginRouteState } from './router/destination';
import { LOGIN_PATH } from './router/routes';

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const SESSION_ENDED_TEXT =
  'For security, sessions last up to 12 hours. Sign in again to continue where you were.';
export const SESSION_REVOKED_TEXT = 'Your session ended. Sign in again to continue.';

export function SessionNotices() {
  const { status, phase, endsAt, endReason } = useSession();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const endingSoon = status === 'authenticated' && phase === 'endingSoon';

  useEffect(() => {
    if (!endingSoon || endsAt === null) return;
    const id = toast.show({
      tone: 'warning',
      message: (
        <>
          Your session ends at <strong>{TIME_FORMAT.format(endsAt)}</strong>. Save your work;
          you&apos;ll need to sign in again after that.
        </>
      ),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [endingSoon, endsAt, toast]);

  const ended = status === 'anonymous' && (endReason === 'expired' || endReason === 'revoked');
  const open = ended && location.pathname !== LOGIN_PATH;

  const signIn = () => {
    const state: LoginRouteState = { from: destinationOf(location) };
    void navigate(LOGIN_PATH, { state });
  };

  return (
    <Modal
      open={open}
      onClose={signIn}
      dismissible={false}
      title="Your session ended"
      footer={
        <Button variant="primary" onClick={signIn}>
          Sign in
        </Button>
      }
    >
      {endReason === 'revoked' ? SESSION_REVOKED_TEXT : SESSION_ENDED_TEXT}
    </Modal>
  );
}
