// CollectionFieldsTab: the Fields tab of the collection detail (S-15b), from GET /collections/{id}/fields (ordered
// by position, paged). Props: collectionId, page, pageSize, onPageChange, onPageSizeChange (the page and its size live
// in the URL, so the tab can be shared), reloadKey (changes when the collection was reloaded, to read the fields
// again). Columns: # (the row number), Name (IBM Plex Mono), Data type, Description. Loading shows a skeleton after
// 300 ms; a failure shows the error with a retry (the rest of the page keeps working); no fields: "No fields yet."
import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { ListOrdered } from 'lucide-react';

import {
  Banner,
  Button,
  ICON_STROKE_WIDTH,
  Pagination,
  SectionCard,
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';
import { DATA_TYPE_LABEL } from '../variables/variableLabels';

import type { CollectionField } from './collectionTypes';

const HEAD_CLASS =
  'px-4 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';

interface CollectionFieldsTabProps {
  collectionId: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  reloadKey: string;
}

export function CollectionFieldsTab({
  collectionId,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  reloadKey,
}: CollectionFieldsTabProps) {
  const client = useApi();
  const fields = useApiResource<{ rows: CollectionField[]; total: number }>(
    `collection-fields:${collectionId}:${page}:${pageSize}:${reloadKey}`,
    async (signal) => {
      const { body } = await client.get('/collections/{id}/fields', {
        path: { id: collectionId },
        query: { page, pageSize },
        signal,
      });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
  );
  const { showSkeleton } = useDelayedLoading(fields.loading);

  if (fields.status === 'error') {
    return (
      <Banner
        tone="danger"
        lead="Couldn't load the fields."
        actions={
          <Button size="sm" onClick={fields.reload}>
            Try again
          </Button>
        }
      >
        {fields.error ? (getErrorMessage(fields.error) ?? '') : ''}
      </Banner>
    );
  }
  const rows = fields.data?.rows ?? [];
  const total = fields.data?.total ?? 0;
  const loaded = fields.status === 'ready';

  return (
    <SectionCard
      title="Fields"
      description="In the order they have in the collection"
      icon={<ListOrdered size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      count={loaded ? total : null}
      flush
    >
      {loaded && total === 0 ? (
        <p className="px-4 py-4 text-body-lg text-ink-500">No fields yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table aria-label="Fields" aria-busy={fields.loading} className="w-full text-left">
              <thead className="bg-search-bg">
                <tr>
                  <th scope="col" className={HEAD_CLASS}>
                    #
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Name
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Data type
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {showSkeleton && fields.data === null
                  ? Array.from({ length: 4 }, (_, index) => (
                      <tr key={index} aria-hidden="true" className="border-t border-divider">
                        <td colSpan={4} className="px-4 py-3.5">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((field, index) => (
                      <tr key={field.id} className="border-t border-divider">
                        <td className="px-4 py-2.5 text-label text-ink-500 tabular-nums">
                          {(page - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-label text-ink-900">
                          {field.name}
                        </td>
                        <td className="px-4 py-2.5 text-body-lg text-ink-900">
                          {DATA_TYPE_LABEL[field.dataType]}
                        </td>
                        <td className="px-4 py-2.5 text-body-lg text-ink-500">
                          {field.description === null || field.description === ''
                            ? '—'
                            : field.description}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            disabled={fields.loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </SectionCard>
  );
}
