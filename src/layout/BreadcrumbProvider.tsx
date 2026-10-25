// BreadcrumbProvider: holds the label a page sets with useBreadcrumbLabel (see breadcrumbContext.ts).
// Props: children. Mounted once by AppShell, around the top bar and the page.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { BreadcrumbContext, type BreadcrumbValue } from './breadcrumbContext';

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const value = useMemo<BreadcrumbValue>(() => ({ label, setLabel }), [label]);
  return <BreadcrumbContext value={value}>{children}</BreadcrumbContext>;
}
