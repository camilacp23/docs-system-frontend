// useFollowElementApplication: keeps the selected application consistent with the element a detail or edit page
// shows (D-78). useFollowElementApplication(elementApplicationId, listPath):
//  - the element belongs to another application than the selected one when the page opens (a shared link): the
//    element's application is selected and a toast says "Switched to <application>.";
//  - the user switches application from the shell while the page is open: the page goes back to `listPath`.
// elementApplicationId is null while the element is loading. Same rule for variables and collections.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useToast } from '../components/ui';

import { useApplication } from './useApplication';

export function useFollowElementApplication(
  elementApplicationId: number | null,
  listPath: string,
): void {
  const { applications, currentApplicationId, selectApplication } = useApplication();
  const toast = useToast();
  const navigate = useNavigate();
  const matched = useRef(false);

  useEffect(() => {
    if (elementApplicationId === null || currentApplicationId === null) return;
    if (currentApplicationId === elementApplicationId) {
      matched.current = true;
      return;
    }
    if (matched.current) {
      // It matched before: the user chose another application.
      void navigate(listPath, { replace: true });
      return;
    }
    const target = applications.find((application) => application.id === elementApplicationId);
    if (target === undefined) return;
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
  ]);
}
