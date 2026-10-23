// useApplication: the application list, the selected one and the actions (see ApplicationContext).
import { useContext } from 'react';

import { ApplicationContext, type ApplicationValue } from './ApplicationContext';

export function useApplication(): ApplicationValue {
  const value = useContext(ApplicationContext);
  if (value === null) throw new Error('useApplication must be used inside <ApplicationProvider>');
  return value;
}
