// Error pages inside the shell: NotFoundPage (S-41a), NoAccessPage (S-41b) and ServerErrorPage (S-41c).
// NotFoundPage and NoAccessPage take no props (the role comes from the session). ServerErrorPage is also the
// route error element: it shows "Reference: <requestId>" when the error came from the API (ApiError).
import { useNavigate, useRouteError } from 'react-router';

import { isApiError } from '../../api/ApiError';
import { ErrorState } from '../../components/ui';
import { HOME_PATH, ROLE_LABEL } from '../../app/router/routes';
import { useCurrentUser } from '../../session/useCurrentUser';

const PAGE_CLASS = 'flex-1';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <ErrorState
      variant="not-found"
      element="page"
      listLabel="Dashboard"
      className={PAGE_CLASS}
      onAction={() => void navigate(HOME_PATH)}
    />
  );
}

export function NoAccessPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  return (
    <ErrorState
      variant="no-access"
      roleName={user ? ROLE_LABEL[user.role] : 'current'}
      className={PAGE_CLASS}
      onAction={() => void navigate(HOME_PATH)}
    />
  );
}

export function ServerErrorPage() {
  const navigate = useNavigate();
  const error = useRouteError();
  return (
    <ErrorState
      variant="server-error"
      requestId={isApiError(error) ? (error.requestId ?? undefined) : undefined}
      className={PAGE_CLASS}
      onAction={() => void navigate(0)}
    />
  );
}
