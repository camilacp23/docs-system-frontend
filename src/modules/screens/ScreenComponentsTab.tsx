// ScreenComponentsTab: the Components & navigation tab of the screen detail, read only.
// Two cards with a tinted header (the style of Template progress): the components of the screen, each one in its own box in
// two columns (name, control type, the OnSelect formula in IBM Plex Mono, the description and what it uses: variables and
// collections, linked to their pages), and the navigations (the screens this one goes to, linked to /screens/:id, with
// their description, in two columns). The color per element type is not
// defined in the design: every element uses the neutral icon of ElementTypeIcon.
// Props: screen.
import { Box, Navigation } from 'lucide-react';
import { Link } from 'react-router';

import { ElementTypeIcon, ICON_STROKE_WIDTH, Tag, ToneCard } from '../../components/ui';

import type { Screen } from './screenTypes';

const LINK_CLASS =
  'rounded-chip font-mono text-label font-semibold text-identifier hover:underline';

type Component = Screen['components'][number];
function Uses({ component }: { component: Component }) {
  const { uses } = component;
  if (uses.length === 0) return null;
  return (
    <ul aria-label={`Uses of ${component.name}`} className="flex flex-col gap-1">
      {uses.map((use) => (
        <li key={use.id} className="flex flex-wrap items-center gap-2 text-label text-ink-700">
          <span aria-hidden="true" className="text-ink-500">
            <ElementTypeIcon type={use.targetType === 'VARIABLE' ? 'variable' : 'collection'} />
          </span>
          <Link
            to={`/${use.targetType === 'VARIABLE' ? 'variables' : 'collections'}/${use.target.id}`}
            className={LINK_CLASS}
          >
            {use.target.name}
          </Link>
          {use.description !== null && use.description !== undefined && use.description !== '' && (
            <span className="text-ink-500">· {use.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ScreenComponentsTab({ screen }: { screen: Screen }) {
  return (
    <div className="flex flex-col gap-4">
      <ToneCard
        title="Components"
        tone="screen"
        description="Controls of the screen and what they use"
        icon={<Box size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        count={screen.components.length}
      >
        {screen.components.length === 0 ? (
          <p className="text-body text-ink-500">No components yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {screen.components.map((component) => (
              <li
                key={component.id}
                className="flex min-w-0 flex-col gap-2 rounded-card border border-border-subtle p-4"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span aria-hidden="true" className="text-ink-500">
                    <ElementTypeIcon type="component" />
                  </span>
                  <h3 className="font-mono text-label font-semibold text-identifier">
                    {component.name}
                  </h3>
                  <Tag>{component.type}</Tag>
                </div>
                {component.description !== null &&
                  component.description !== undefined &&
                  component.description !== '' && (
                    <p className="text-body text-ink-700">{component.description}</p>
                  )}
                {component.onSelect !== null &&
                  component.onSelect !== undefined &&
                  component.onSelect !== '' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-small text-ink-500">OnSelect</span>
                      <pre className="overflow-x-auto rounded-chip border border-border-subtle bg-search-bg px-3.5 py-2.5 font-mono text-label whitespace-pre-wrap text-ink-900">
                        {component.onSelect}
                      </pre>
                    </div>
                  )}
                <Uses component={component} />
              </li>
            ))}
          </ul>
        )}
      </ToneCard>

      <ToneCard
        title="Navigation"
        description="Screens this screen goes to"
        icon={<Navigation size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        tone="teal"
        count={screen.navigations.length}
      >
        {screen.navigations.length === 0 ? (
          <p className="text-body text-ink-500">No navigations yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {screen.navigations.map((navigation) => (
              <li
                key={navigation.id}
                className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-card border border-border-subtle px-4 py-3"
              >
                <span aria-hidden="true" className="text-ink-500">
                  <ElementTypeIcon type="screen" />
                </span>
                <Link to={`/screens/${navigation.targetScreen.id}`} className={LINK_CLASS}>
                  {navigation.targetScreen.name}
                </Link>
                {navigation.description !== null &&
                  navigation.description !== undefined &&
                  navigation.description !== '' && (
                    <span className="text-label text-ink-500">· {navigation.description}</span>
                  )}
              </li>
            ))}
          </ul>
        )}
      </ToneCard>
    </div>
  );
}
