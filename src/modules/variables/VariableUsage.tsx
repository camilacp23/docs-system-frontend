// VariableUsage: the "where it is used" cards of the variable detail (S-11), from GET /variables/{id}/dependencies:
//   Screens (the origin row first, with its "Origin" tag, then the other screens with access mode and usedIn),
//   Fed from collections (collection, function, table function, screen, usedIn) and Used by components.
// Props: variable (the Variable, for its origin screen), dependencies (the resource of the dependencies read).
// While they load the cards show skeletons; if the read fails only these cards show the error with a retry, the rest
// of the page keeps working. Power Apps identifiers and usedIn values are in IBM Plex Mono; every screen and
// collection links to its page.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { getErrorMessage } from '../../api/messages';
import type { ApiResource } from '../../api/useApiResource';
import { Banner, Button, Skeleton, Tag, useDelayedLoading } from '../../components/ui';

import { ACCESS_MODE_LABEL, ASSIGNMENT_FUNCTION_LABEL } from './variableLabels';
import type { Variable, VariableDependencies } from './variableTypes';

const CARD_CLASS = 'rounded-card border border-border-subtle bg-surface shadow-card';
const TH_CLASS = 'px-4 py-2 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const TD_CLASS = 'px-4 py-2.5 align-middle';
const MONO_CLASS = 'font-mono text-label text-identifier';

function UsageCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number | null;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={CARD_CLASS}>
      <header className="flex items-center justify-between px-4 py-3.5">
        <h2 className="text-subheading font-semibold text-ink-900">{title}</h2>
        {count !== null && <span className="text-label text-ink-500">{count}</span>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="border-t border-divider px-4 py-4 text-body-lg text-ink-500">{children}</p>;
}

function Placeholder() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2.5 px-4 pb-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[90%]" />
      <Skeleton className="h-4 w-[70%]" />
    </div>
  );
}

function ScreenLink({ screen }: { screen: { id: number; name: string } }) {
  return (
    <Link to={`/screens/${screen.id}`} className={`${MONO_CLASS} rounded-chip hover:underline`}>
      {screen.name}
    </Link>
  );
}

function CollectionLink({ collection }: { collection: { id: number; name: string } }) {
  return (
    <Link
      to={`/collections/${collection.id}`}
      className={`${MONO_CLASS} rounded-chip hover:underline`}
    >
      {collection.name}
    </Link>
  );
}

function Table({
  label,
  headers,
  children,
}: {
  label: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full text-left">
        <thead className="border-t border-divider bg-search-bg">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className={TH_CLASS}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface VariableUsageProps {
  variable: Variable;
  dependencies: ApiResource<VariableDependencies>;
}

export function VariableUsage({ variable, dependencies }: VariableUsageProps) {
  const { showSkeleton } = useDelayedLoading(dependencies.loading);

  if (dependencies.status === 'error') {
    const message = dependencies.error ? getErrorMessage(dependencies.error) : null;
    return (
      <Banner
        tone="danger"
        lead="Couldn't load where this variable is used."
        actions={
          <Button size="sm" onClick={dependencies.reload}>
            Try again
          </Button>
        }
      >
        {message ?? ''}
      </Banner>
    );
  }

  const loaded = dependencies.status === 'ready' ? dependencies.data : null;
  const origin = variable.originScreen;
  const otherScreens = loaded?.screens ?? [];
  const screenCount = loaded === null ? null : otherScreens.length + (origin === null ? 0 : 1);
  const loading = loaded === null;

  return (
    <>
      <UsageCard title="Screens" count={screenCount}>
        {loading ? (
          showSkeleton ? (
            <Placeholder />
          ) : null
        ) : screenCount === 0 ? (
          <Empty>No screen uses this variable yet.</Empty>
        ) : (
          <Table label="Screens" headers={['Screen', 'Access', 'Used in']}>
            {origin !== null && (
              <tr className="border-t border-divider">
                <td className={TD_CLASS}>
                  <span className="inline-flex items-center gap-2">
                    <ScreenLink screen={origin} />
                    <Tag>Origin</Tag>
                  </span>
                </td>
                <td className={TD_CLASS}>
                  <Tag>{ACCESS_MODE_LABEL.WRITE}</Tag>
                </td>
                <td className={`${TD_CLASS} ${MONO_CLASS}`}>origin</td>
              </tr>
            )}
            {otherScreens.map((link, index) => (
              <tr
                key={`${link.screen.id}-${link.usedIn}-${index}`}
                className="border-t border-divider"
              >
                <td className={TD_CLASS}>
                  <ScreenLink screen={link.screen} />
                </td>
                <td className={TD_CLASS}>
                  <Tag>{ACCESS_MODE_LABEL[link.accessMode]}</Tag>
                </td>
                <td className={`${TD_CLASS} ${MONO_CLASS}`}>{link.usedIn}</td>
              </tr>
            ))}
          </Table>
        )}
      </UsageCard>

      <UsageCard title="Fed from collections" count={loaded?.collections.length ?? null}>
        {loading ? (
          showSkeleton ? (
            <Placeholder />
          ) : null
        ) : loaded.collections.length === 0 ? (
          <Empty>No collection feeds this variable.</Empty>
        ) : (
          <Table
            label="Fed from collections"
            headers={['Collection', 'Function', 'Table function', 'Screen', 'Used in']}
          >
            {loaded.collections.map((assignment) => (
              <tr key={assignment.id} className="border-t border-divider">
                <td className={TD_CLASS}>
                  <CollectionLink collection={assignment.collection} />
                </td>
                <td className={TD_CLASS}>
                  <Tag>{ASSIGNMENT_FUNCTION_LABEL[assignment.assignmentFunction]}</Tag>
                </td>
                <td className={`${TD_CLASS} ${MONO_CLASS}`}>{assignment.tableFunction ?? '—'}</td>
                <td className={TD_CLASS}>
                  <ScreenLink screen={assignment.screen} />
                </td>
                <td className={`${TD_CLASS} ${MONO_CLASS}`}>{assignment.usedIn}</td>
              </tr>
            ))}
          </Table>
        )}
      </UsageCard>

      <UsageCard title="Used by components" count={loaded?.components.length ?? null}>
        {loading ? (
          showSkeleton ? (
            <Placeholder />
          ) : null
        ) : loaded.components.length === 0 ? (
          <Empty>No component uses this variable.</Empty>
        ) : (
          <Table label="Used by components" headers={['Component', 'Screen', 'Description']}>
            {loaded.components.map((usage) => (
              <tr
                key={`${usage.component.id}-${usage.screen.id}`}
                className="border-t border-divider"
              >
                <td className={`${TD_CLASS} ${MONO_CLASS}`}>{usage.component.name}</td>
                <td className={TD_CLASS}>
                  <ScreenLink screen={usage.screen} />
                </td>
                <td className={`${TD_CLASS} text-body text-ink-700`}>{usage.description ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
        <p className="border-t border-divider px-4 py-3 text-small text-ink-500">
          Links are edited in the screen (Module 4) or the collection.{' '}
          <Link to="/dependency-map" className="font-semibold text-primary hover:underline">
            Open in dependency map
          </Link>
        </p>
      </UsageCard>
    </>
  );
}
