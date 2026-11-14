// nodeLinks and httpsUrl: where each node leads (D-102 for a component, with the real tab constant), the Miro link
// only when it is https, and the names of the nodes (cut with "…", the full name in the accessible name).
import { describe, expect, it } from 'vitest';

import {
  MAX_NAME_CHARS,
  nodeAriaLabel,
  truncateName,
} from '../../modules/dependency-map/nodeLabels';
import { miroHrefOf, nodeHref, nodeOpenLabel } from '../../modules/dependency-map/nodeLinks';
import { isHttpsUrl } from '../../modules/screens/httpsUrl';
import { COMPONENTS_TAB, SCREEN_TAB_KEYS } from '../../modules/screens/screenTabs';
import {
  collectionNode,
  componentNode,
  MIRO_LINK,
  screenNode,
  variableNode,
} from '../helpers/graphFixtures';

describe('nodeHref', () => {
  it('leads each element to its own page', () => {
    expect(nodeHref(screenNode(12, 'Detalle'))).toBe('/screens/12');
    expect(nodeHref(variableNode(7, 'gUsuario'))).toBe('/variables/7');
    expect(nodeHref(collectionNode(21, 'colClientes'))).toBe('/collections/21');
  });

  it('leads a component to the Components & navigation tab of its screen, with the tab of the screens module (D-102)', () => {
    expect(SCREEN_TAB_KEYS).toContain(COMPONENTS_TAB);
    expect(nodeHref(componentNode(31, 'btnGuardar', 12))).toBe(`/screens/12?tab=${COMPONENTS_TAB}`);
  });

  it('uses the screenId of the component node itself, so it works when the types filter has no SCREEN', () => {
    // The node carries `screenId` even when the screen node was filtered out: nothing else is needed for the link.
    expect(nodeHref(componentNode(99, 'cmpX', 4321))).toBe(`/screens/4321?tab=${COMPONENTS_TAB}`);
  });

  it('names the button after the element', () => {
    expect(nodeOpenLabel(screenNode(1, 'a'))).toBe('Open screen');
    expect(nodeOpenLabel(componentNode(1, 'a', 1))).toBe('Open screen');
    expect(nodeOpenLabel(variableNode(1, 'a'))).toBe('Open variable');
    expect(nodeOpenLabel(collectionNode(1, 'a'))).toBe('Open collection');
  });
});

describe('miroHrefOf and isHttpsUrl', () => {
  it('gives the Miro link of a screen when it is https', () => {
    expect(miroHrefOf(screenNode(11, 'Inicio', { miroLink: MIRO_LINK }))).toBe(MIRO_LINK);
  });

  it.each([
    ['http', 'http://miro.com/app/board/x/'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<b>x</b>'],
    ['relative', '/app/board/x'],
    ['no scheme', 'miro.com/app/board/x'],
    ['empty', ''],
    ['only the scheme', 'https://'],
    ['ftp', 'ftp://miro.com/x'],
  ])('does not make a %s address a link', (_name, value) => {
    expect(isHttpsUrl(value)).toBe(false);
    expect(miroHrefOf(screenNode(1, 's', { miroLink: value }))).toBeNull();
  });

  it('gives nothing for a null link or for a node that is not a screen', () => {
    expect(miroHrefOf(screenNode(1, 's', { miroLink: null }))).toBeNull();
    expect(miroHrefOf(variableNode(1, 'v'))).toBeNull();
    expect(isHttpsUrl(null)).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
  });
});

describe('node names', () => {
  it('cuts a long name with "…" and keeps a short one', () => {
    const long = 'x'.repeat(60);
    for (const type of ['SCREEN', 'VARIABLE', 'COLLECTION', 'COMPONENT'] as const) {
      const cut = truncateName(long, type);
      expect(cut).toHaveLength(MAX_NAME_CHARS[type]);
      expect(cut.endsWith('…')).toBe(true);
    }
    expect(truncateName('gUsuario', 'VARIABLE')).toBe('gUsuario');
  });

  it('keeps the full name in the accessible name', () => {
    const long = 'locMostrarDetalleDelCliente';
    expect(nodeAriaLabel(variableNode(4, long, { scope: 'CONTEXT' }))).toBe(
      `Variable ${long}, Context`,
    );
    expect(nodeAriaLabel(variableNode(3, 'gRegistroSel', { untraced: true }))).toBe(
      'Variable gRegistroSel, Global, untraced',
    );
    expect(
      nodeAriaLabel(
        screenNode(10, 'App (OnStart)', { documentationStatus: 'IN_PROGRESS', isAppContext: true }),
      ),
    ).toBe('Screen App (OnStart), In progress, Reserved');
    expect(nodeAriaLabel(collectionNode(21, 'colClientes'))).toBe('Collection colClientes');
    expect(nodeAriaLabel(componentNode(31, 'btnGuardar', 12))).toBe('Component btnGuardar');
  });
});
