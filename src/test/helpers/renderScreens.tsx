// renderScreens: renderApp over the in-memory screens API (fakeScreensApi) with the sample data of the frames
// S-18 / S-19: the screens App (OnStart) (Reserved, In progress), Detalle (In review), Inicio (Approved), Busqueda
// (Draft) and Reportes (Undocumented), over the variables and collections of renderVariables / renderCollections.
// Detalle has a full detail (template 5 of 7, components, links with an origin row, a navigation).
// Options: role, path, applications, `comments`, plus `screens` (full screens) and `variables` to replace the sample data and `prepare` to arm
// failures or holds before the first read. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';
import type { ScreenComment } from '../../modules/comments/commentTypes';
import type { Screen } from '../../modules/screens/screenTypes';
import type { Variable } from '../../modules/variables/variableTypes';

import { sampleCollections } from './renderCollections';
import { makeScreenDetail, makeScreensApi } from './fakeScreensApi';
import { renderApp } from './renderApp';
import { sampleVariables } from './renderVariables';

const CAMILA = { id: 1, name: 'Camila Castillo' };
const DEV_A = { id: 2, name: 'Sample Developer A' };
const DEV_B = { id: 3, name: 'Sample Developer B' };

export function sampleScreens(): Screen[] {
  return [
    makeScreenDetail(10, 'App (OnStart)', {
      isAppContext: true,
      documentationStatus: 'IN_PROGRESS',
      author: CAMILA,
      pendingSubtasks: 2,
      updatedAt: '2026-10-03T09:14:00',
      template: {
        onStart: 'Set(gUsuario, LookUp(Usuarios, Correo = User().Email))',
        workingProcess: null,
        architecture: null,
        dataModel: null,
        requirements: null,
        knownIssues: null,
        risks: null,
      },
      variableLinks: [
        {
          id: 900,
          variable: { id: 1, name: 'gUsuario' },
          accessMode: 'WRITE',
          usedIn: 'origin',
          isOrigin: true,
        },
      ],
    }),
    makeScreenDetail(12, 'Detalle', {
      documentationStatus: 'IN_REVIEW',
      author: DEV_A,
      pendingSubtasks: 3,
      commentCount: 2,
      miroLink: 'https://miro.com/app/board/uXjVDetalle=/',
      updatedAt: '2026-10-04T16:02:00',
      template: {
        onStart:
          'UpdateContext({locMostrarDetalle: false});\nSet(gRegistroSel, First(colClientes))',
        workingProcess: 'The user reviews the selected record and saves changes with btnGuardar.',
        architecture: 'Header container, form frmDetalle, button btnGuardar.',
        dataModel: 'Reads gRegistroSel and colClientes; writes locMostrarDetalle.',
        requirements: 'Show the selected record.',
        knownIssues: null,
        risks: '   ',
      },
      components: [
        {
          id: 301,
          name: 'btnGuardar',
          type: 'Button',
          onSelect: 'Patch(Clientes, gRegistroSel, frmDetalle.Updates)',
          description: 'Saves the record.',
          uses: [
            {
              id: 401,
              targetType: 'VARIABLE',
              target: { id: 3, name: 'gRegistroSel' },
              description: null,
            },
            {
              id: 402,
              targetType: 'COLLECTION',
              target: { id: 11, name: 'colClientes' },
              description: 'Reads the client list.',
            },
          ],
        },
        { id: 302, name: 'lblNombre', type: 'Label', onSelect: null, description: null, uses: [] },
        {
          id: 303,
          name: 'galClientes',
          type: 'Gallery',
          onSelect: null,
          description: null,
          uses: [],
        },
      ],
      variableLinks: [
        {
          id: 501,
          variable: { id: 4, name: 'locMostrarDetalle' },
          accessMode: 'WRITE',
          usedIn: 'origin',
          isOrigin: true,
        },
        {
          id: 502,
          variable: { id: 3, name: 'gRegistroSel' },
          accessMode: 'READ_WRITE',
          usedIn: 'btnGuardar.OnSelect',
          isOrigin: false,
        },
      ],
      collectionLinks: [
        {
          id: 601,
          collection: { id: 11, name: 'colClientes' },
          accessMode: 'READ',
          usedIn: 'galClientes.Items',
        },
      ],
      navigations: [
        { id: 701, targetScreen: { id: 11, name: 'Inicio' }, description: 'After saving' },
      ],
    }),
    makeScreenDetail(11, 'Inicio', {
      documentationStatus: 'APPROVED',
      author: CAMILA,
      commentCount: 1,
      updatedAt: '2026-10-01T10:20:00',
    }),
    makeScreenDetail(13, 'Busqueda', {
      documentationStatus: 'DRAFT',
      author: DEV_B,
      updatedAt: '2026-09-30T15:44:00',
    }),
    makeScreenDetail(14, 'Reportes', {
      documentationStatus: 'UNDOCUMENTED',
      author: DEV_A,
      updatedAt: '2026-09-29T08:30:00',
    }),
  ];
}

export interface RenderScreensOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  screens?: Screen[];
  /** The comments the API serves (default: none). */
  comments?: ScreenComment[];
  /** Replaces the sample variables (their origin screens decide what a deletion leaves without origin). */
  variables?: Variable[];
  /** Runs on the fake API before the first render, to arm failures or holds for the first reads. */
  prepare?: (api: ReturnType<typeof makeScreensApi>) => void;
}

export async function renderScreens(options: RenderScreensOptions = {}) {
  let api: ReturnType<typeof makeScreensApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'DEVELOPER',
    path: options.path ?? '/screens',
    applications: options.applications,
    buildClient: (apps) => {
      const screens = options.screens ?? sampleScreens();
      api = makeScreensApi(apps, {
        screenDetails: screens,
        collections: sampleCollections(),
        variables: options.variables ?? sampleVariables(),
        comments: options.comments,
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
