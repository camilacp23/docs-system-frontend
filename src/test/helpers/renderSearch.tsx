// renderSearch: renderApp over the in-memory search API (fakeSearchApi), in application 1 ("SAR", the one the shell
// selects). Options: role (of the signed-in user, default ADMINISTRATOR), path (default /search), elements (what the
// application holds), applications, `prepare` (arms failures or holds on the fake before the first read). Returns what
// renderApp returns plus `api`.
// sampleElements() is the data of the frames S-29 and S-29b: gives a search for "client" four results of four types.
import type { Role } from '../../app/router/routes';
import type { Application } from '../../application/ApplicationContext';

import {
  collectionElement,
  componentElement,
  makeSearchApi,
  screenElement,
  variableElement,
  type SimElement,
} from './fakeSearchApi';
import { renderApp } from './renderApp';

export function sampleElements(): SimElement[] {
  return [
    collectionElement(21, 'colClientes', {
      environments: ['DEV', 'PROD'],
      creationCondition: 'ClearCollect(colClientes, Filter(Clientes, Activo))',
    }),
    screenElement(12, 'Inicio', {
      status: 'APPROVED',
      template: [
        'Runs when the app starts.',
        'The user picks a client in galClientes and opens Detalle.',
      ],
    }),
    componentElement(31, 'galClientes', {
      description: 'Gallery bound to colClientes.',
      screen: { id: 12, name: 'Inicio' },
    }),
    variableElement(7, 'gRegistroSel', {
      description: 'Record of the selected client.',
      environments: ['DEV', 'PROD'],
    }),
    variableElement(8, 'locMostrarDetalle', {
      scope: 'CONTEXT',
      screen: { id: 13, name: 'Detalle' },
      environments: ['DEV'],
    }),
    variableElement(9, 'locOrden', {
      scope: 'CONTEXT',
      screen: { id: 12, name: 'Inicio' },
      environments: ['DEV', 'PROD'],
    }),
  ];
}

export interface RenderSearchOptions {
  role?: Role;
  path?: string;
  elements?: SimElement[];
  applications?: Application[];
  prepare?: (api: ReturnType<typeof makeSearchApi>) => void;
}

export async function renderSearch(options: RenderSearchOptions = {}) {
  let api: ReturnType<typeof makeSearchApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'ADMINISTRATOR',
    path: options.path ?? '/search',
    applications: options.applications,
    buildClient: (apps) => {
      api = makeSearchApi(apps, { elements: options.elements ?? sampleElements() });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
