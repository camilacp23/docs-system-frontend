// DashboardHero: the top of the dashboard: the shared PageHero with the dashboard icon.
// Props: title, description, actions (Refresh, Generate report), corner (the "Updated" time, pinned top-right), className.
import { LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH, PageHero } from '../../components/ui';

export interface DashboardHeroProps {
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  corner?: ReactNode;
  className?: string;
}

export function DashboardHero(props: DashboardHeroProps) {
  return (
    <PageHero icon={<LayoutDashboard size={20} strokeWidth={ICON_STROKE_WIDTH} />} {...props} />
  );
}
