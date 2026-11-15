// useFollowElementApplication: keeps the selected application consistent with the element a detail or edit page
// shows (D-78). useFollowElementApplication(elementApplicationId, listPath):
//  - the element belongs to another application than the selected one when the page opens (a shared link): the
//    element's application is selected, the page stays and a toast says "Switched to <application>.";
//  - the user switches application from the shell while the page is open: the page goes back to `listPath`.
// elementApplicationId is null while the element is loading. Same rule for variables and collections.
// What the hook remembers (that the element's application was reached, that its own switch is on its way) belongs to
// ONE element, so it starts over whenever the URL changes: going from /variables/1 to /variables/7 keeps the same page
// component mounted, and a "reached" decision about variable 1 must not make the automatic switch for variable 7 look
// like a switch made by the user.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useToast } from '../components/ui';

import { useApplication } from './useApplication';

interface Progress {
  /** The URL the state belongs to. */
  path: string;
  /** The selected application has been the element's at least once: any later difference is the user's doing. */
  reached: boolean;
  /** The application this hook selected and that has not reached the context yet (its own switch in flight). */
  switchingTo: number | null;
}

export function useFollowElementApplication(
  elementApplicationId: number | null,
  listPath: string,
): void {
  const { applications, currentApplicationId, selectApplication } = useApplication();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const progress = useRef<Progress>({ path: pathname, reached: false, switchingTo: null });

  useEffect(() => {
    if (progress.current.path !== pathname) {
      progress.current = { path: pathname, reached: false, switchingTo: null };
    }
    const state = progress.current;
    if (elementApplicationId === null || currentApplicationId === null) return;
    if (currentApplicationId === elementApplicationId) {
      state.reached = true;
      state.switchingTo = null;
      return;
    }
    // Our own switch has been asked for and is still on its way: this is not the user choosing something else.
    if (state.switchingTo === elementApplicationId) return;
    if (state.reached) {
      // It was the element's application and now it is not: the user chose another one.
      void navigate(listPath, { replace: true });
      return;
    }
    const target = applications.find((application) => application.id === elementApplicationId);
    if (target === undefined) return;
    state.switchingTo = target.id;
    selectApplication(target.id);
    toast.show({ message: `Switched to ${target.name}.` });
  }, [
    elementApplicationId,
    currentApplicationId,
    applications,
    selectApplication,
    toast,
    navigate,
    listPath,
    pathname,
  ]);
}
