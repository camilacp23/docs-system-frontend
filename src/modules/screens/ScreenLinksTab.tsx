// ScreenLinksTab: the Variables & collections tab of the screen detail, read only.
// Two tables: the variables the screen reads or writes (linked to /variables/:id, with the access mode and where
// it is used, in IBM Plex Mono) and the collections (linked to /collections/:id, same columns). A variable link
// with `isOrigin` is the row the variables module keeps for the variable created in this screen: it carries the
// "Origin" tag instead of a place of use and is never editable from the screen. Identifiers and usedIn are in
// IBM Plex Mono.
// Props: screen.
import { Database, Variable } from 'lucide-react';
import { Link } from 'react-router';

import { ICON_STROKE_WIDTH, SectionCard, Tag } from '../../components/ui';
import { ACCESS_MODE_LABEL } from '../variables/variableLabels';

import type { Screen } from './screenTypes';

const HEAD_CLASS =
  'px-4 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const CELL_CLASS = 'px-4 py-2.5 align-middle';
const MONO_CLASS = 'font-mono text-label text-identifier';
export const ORIGIN_ROW_NOTE = "Origin rows come from the variable and can't be edited here.";

export function ScreenLinksTab({ screen }: { screen: Screen }) {
  const hasOrigin = screen.variableLinks.some((link) => link.isOrigin);
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Variables"
        description="Variables this screen creates, reads or writes"
        icon={<Variable size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        count={screen.variableLinks.length}
        flush
      >
        {screen.variableLinks.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-500">No variables linked yet.</p>
        ) : (
          <table aria-label="Variable links" className="w-full text-left">
            <thead className="bg-search-bg">
              <tr>
                <th scope="col" className={HEAD_CLASS}>
                  Variable
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Access
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Used in
                </th>
              </tr>
            </thead>
            <tbody>
              {screen.variableLinks.map((link) => (
                <tr key={link.id} className="border-t border-divider">
                  <td className={CELL_CLASS}>
                    <Link
                      to={`/variables/${link.variable.id}`}
                      className={`${MONO_CLASS} font-semibold hover:underline`}
                    >
                      {link.variable.name}
                    </Link>
                  </td>
                  <td className={CELL_CLASS}>
                    <Tag>{ACCESS_MODE_LABEL[link.accessMode]}</Tag>
                  </td>
                  <td className={CELL_CLASS}>
                    {link.isOrigin ? (
                      <Tag tone="info">Origin</Tag>
                    ) : (
                      <span className="font-mono text-label text-ink-900">{link.usedIn}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasOrigin && (
          <p className="border-t border-divider px-5 py-3 text-small text-ink-500">
            {ORIGIN_ROW_NOTE}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Collections"
        description="Collections this screen reads or writes"
        icon={<Database size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        tone="success"
        count={screen.collectionLinks.length}
        flush
      >
        {screen.collectionLinks.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-500">No collections linked yet.</p>
        ) : (
          <table aria-label="Collection links" className="w-full text-left">
            <thead className="bg-search-bg">
              <tr>
                <th scope="col" className={HEAD_CLASS}>
                  Collection
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Access
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Used in
                </th>
              </tr>
            </thead>
            <tbody>
              {screen.collectionLinks.map((link) => (
                <tr key={link.id} className="border-t border-divider">
                  <td className={CELL_CLASS}>
                    <Link
                      to={`/collections/${link.collection.id}`}
                      className={`${MONO_CLASS} font-semibold hover:underline`}
                    >
                      {link.collection.name}
                    </Link>
                  </td>
                  <td className={CELL_CLASS}>
                    <Tag>{ACCESS_MODE_LABEL[link.accessMode]}</Tag>
                  </td>
                  <td className={CELL_CLASS}>
                    <span className="font-mono text-label text-ink-900">{link.usedIn}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
