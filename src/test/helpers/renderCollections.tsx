// renderCollections: renderApp over the in-memory collections API (fakeCollectionsApi) with the sample data of the
// frames S-14 / S-15: the collections colActivos, colClientes (4 fields, 3 assignments, derived from colUsuarios),
// colTemporal (not linked to any screen) and colUsuarios, over the screens and variables of renderVariables.
// Options: role, path, applications, plus `collections`, `variables`, `screens` to replace the sample data and
// `prepare` to arm failures before the first read. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';
import type { Collection } from '../../modules/collections/collectionTypes';
import type { ScreenSummary, Variable } from '../../modules/variables/variableTypes';

import { makeCollection, makeCollectionsApi, makeField } from './fakeCollectionsApi';
import { renderApp } from './renderApp';
import { APP_SCREEN, SCREEN_DETALLE, SCREEN_INICIO, sampleVariables } from './renderVariables';

export function sampleCollections(): Collection[] {
  const named = (names: string[], idBase: number) =>
    names.map((name, index) => makeField(idBase + index, name, index));
  const colUsuarios = makeCollection(20, 'colUsuarios', {
    environments: ['DEV', 'PROD'],
    environmentDetails: [
      { environment: 'DEV', notes: null },
      { environment: 'PROD', notes: null },
    ],
    documented: true,
    fields: named(['Id', 'Nombre', 'Rol', 'Estado', 'Alta'], 200),
    updatedAt: '2026-09-30T08:50:00',
  });
  return [
    makeCollection(10, 'colActivos', {
      environments: ['DEV', 'PROD'],
      environmentDetails: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: null },
      ],
      documented: true,
      fields: named(['Id', 'Nombre', 'Valor'], 100),
      updatedAt: '2026-10-01T10:05:00',
    }),
    makeCollection(11, 'colClientes', {
      environments: ['DEV', 'PROD'],
      environmentDetails: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'Fewer rows in production.' },
      ],
      documented: true,
      creationCondition: 'ClearCollect(colClientes, Filter(Clientes, Activo = true))',
      description: 'Active clients shown on the home gallery.',
      fields: [
        makeField(110, 'Nombre', 0, { description: 'Client display name.' }),
        makeField(111, 'Correo', 1, { description: 'Contact e-mail.' }),
        makeField(112, 'Activo', 2, { dataType: 'BOOLEAN', description: 'Active flag.' }),
        makeField(113, 'Saldo', 3, { dataType: 'CURRENCY', description: 'Balance.' }),
      ],
      variableAssignments: [
        {
          id: 120,
          variable: { id: 3, name: 'gRegistroSel' },
          collection: { id: 11, name: 'colClientes' },
          screen: { id: SCREEN_INICIO.id, name: SCREEN_INICIO.name },
          assignmentFunction: 'SET',
          tableFunction: 'First',
          usedIn: 'galClientes.OnSelect',
        },
        {
          id: 121,
          variable: { id: 4, name: 'locMostrarDetalle' },
          collection: { id: 11, name: 'colClientes' },
          screen: { id: SCREEN_DETALLE.id, name: SCREEN_DETALLE.name },
          assignmentFunction: 'UPDATE_CONTEXT',
          tableFunction: 'IsEmpty',
          usedIn: 'OnVisible',
        },
        {
          id: 122,
          variable: { id: 2, name: 'gFiltroActivo' },
          collection: { id: 11, name: 'colClientes' },
          screen: { id: APP_SCREEN.id, name: APP_SCREEN.name },
          assignmentFunction: 'SET',
          tableFunction: null,
          usedIn: 'OnStart',
        },
      ],
      derivedFrom: [{ id: 20, name: 'colUsuarios' }],
      updatedAt: '2026-10-02T14:31:00',
    }),
    makeCollection(12, 'colTemporal', {
      fields: named(['Clave', 'Valor'], 300),
      updatedAt: '2026-09-29T09:12:00',
    }),
    colUsuarios,
  ];
}

export interface RenderCollectionsOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  collections?: Collection[];
  variables?: Variable[];
  screens?: ScreenSummary[];
  /** Runs on the fake API before the first render, to arm failures or holds for the first reads. */
  prepare?: (api: ReturnType<typeof makeCollectionsApi>) => void;
}

export async function renderCollections(options: RenderCollectionsOptions = {}) {
  let api: ReturnType<typeof makeCollectionsApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'DEVELOPER',
    path: options.path ?? '/collections',
    applications: options.applications,
    buildClient: (apps) => {
      api = makeCollectionsApi(apps, {
        collections: options.collections ?? sampleCollections(),
        variables: options.variables ?? sampleVariables(),
        screens: options.screens ?? [APP_SCREEN, SCREEN_INICIO, SCREEN_DETALLE],
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
