// UsedByScreensCard: the "Used by screens" card of the collection overview (frame S-15a, D-103).
// Props: collectionId. It reads GET /dependencies/collections/{id}?depth=1 by itself (useCollectionScreens), so if that
// read fails only this card shows its own error with "Try again" and the rest of the page keeps working.
// One row per screen (a link to its page, App (OnStart) included), with every use of the collection in that screen
// listed inside the cells: the access mode (Read, Write, Read-write) and where it happens (`usedIn`, in IBM Plex
// Mono). The header counts distinct screens ("2 · edited in each screen"). Loading shows a skeleton after 300 ms.
import { Monitor } from 'lucide-react';
import { Link } from 'react-router';

import { getErrorMessage } from '../../api/messages';
import {
  Banner,
  Button,
  ICON_STROKE_WIDTH,
  SectionCard,
  Skeleton,
  Tag,
  useDelayedLoading,
} from '../../components/ui';
import { ACCESS_MODE_LABEL } from '../dependency-map/graphLabels';
import { RESERVED_LABEL } from '../screens/screenLabels';

import { USED_BY_SCREENS_EMPTY_TEXT, USED_BY_SCREENS_FAILED_LEAD } from './screenUsage';
import { useCollectionScreens } from './useCollectionScreens';

const HEAD_CLASS =
  'px-4 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const CELL_CLASS = 'px-4 py-2 align-top';
const USE_ROW_CLASS = 'flex min-h-7 items-center';

export function UsedByScreensCard({ collectionId }: { collectionId: number }) {
  const screens = useCollectionScreens(collectionId, 'card');
  const { showSkeleton } = useDelayedLoading(screens.loading);
  const groups = screens.status === 'ready' ? (screens.data ?? []) : [];

  return (
    <SectionCard
      title="Used by screens"
      icon={<Monitor size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      tone="neutral"
      actions={
        screens.status === 'ready' ? (
          <span className="text-small text-ink-500">{groups.length} · edited in each screen</span>
        ) : undefined
      }
      flush
    >
      {screens.status === 'loading' && showSkeleton && (
        <div role="status" aria-label="Loading" className="flex flex-col gap-2 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {screens.status === 'error' && (
        <div className="p-4">
          <Banner
            tone="danger"
            lead={USED_BY_SCREENS_FAILED_LEAD}
            actions={
              <Button size="sm" onClick={screens.reload}>
                Try again
              </Button>
            }
          >
            {screens.error ? (getErrorMessage(screens.error, { element: 'collection' }) ?? '') : ''}
          </Banner>
        </div>
      )}
      {screens.status === 'ready' &&
        (groups.length === 0 ? (
          <p className="px-4 py-4 text-body-lg text-ink-500">{USED_BY_SCREENS_EMPTY_TEXT}</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Used by screens" className="w-full text-left">
              <thead className="bg-search-bg">
                <tr>
                  {['Screen', 'Access', 'Used in'].map((header) => (
                    <th key={header} scope="col" className={HEAD_CLASS}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.screen.id} className="border-t border-divider">
                    <th scope="row" className={`${CELL_CLASS} font-normal`}>
                      <span className={`${USE_ROW_CLASS} gap-2`}>
                        <Link
                          to={`/screens/${group.screen.id}`}
                          className="rounded-chip font-mono text-label font-semibold text-identifier hover:underline"
                        >
                          {group.screen.name}
                        </Link>
                        {group.screen.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
                      </span>
                    </th>
                    <td className={CELL_CLASS}>
                      <ul>
                        {group.uses.map((use, index) => (
                          <li key={index} className={USE_ROW_CLASS}>
                            <Tag>{ACCESS_MODE_LABEL[use.accessMode]}</Tag>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={CELL_CLASS}>
                      <ul>
                        {group.uses.map((use, index) => (
                          <li
                            key={index}
                            className={`${USE_ROW_CLASS} font-mono text-label text-ink-900`}
                          >
                            {use.usedIn}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </SectionCard>
  );
}
