// LoadingScreen: full-page spinner shown while the session is being recovered after a page load.
// No props. Nothing redirects while it is shown, so the page the user asked for is not lost.
import { Spinner } from '../components/ui';

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas text-primary">
      <Spinner size="lg" label="Loading" />
    </div>
  );
}
