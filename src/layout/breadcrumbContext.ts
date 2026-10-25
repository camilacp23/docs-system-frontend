// breadcrumbContext: lets a page replace the last part of the breadcrumb (S-11 "Variables / gUsuario",
// S-12b "gUsuario / Edit"). Without a label the breadcrumb shows the title of the route (routes.ts).
// useBreadcrumbLabel(label): sets the label while the page is mounted; null keeps the route title.
import { createContext, useContext, useEffect } from 'react';

export interface BreadcrumbValue {
  label: string | null;
  setLabel: (label: string | null) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbValue>({
  label: null,
  setLabel: () => undefined,
});

export function useBreadcrumbLabel(label: string | null): void {
  const { setLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    setLabel(label);
    return () => {
      setLabel(null);
    };
  }, [label, setLabel]);
}
