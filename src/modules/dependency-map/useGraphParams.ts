// useGraphParams: the filters and the focus of the dependency map, kept in the URL so a view can be shared.
// useGraphParams() -> { params, setParams(patch), clearAll, clearFocus, hasFilters, hasView }
//   Query names: types (the node types shown, comma separated as the contract takes them, `SCREEN,VARIABLE`; every
//   type is the default and leaves no parameter), environment (DEV | PROD), untraced (`1`: only untraced variables and
//   their neighbors, a filter of the client), focus (a node key, `variable:7`) and depth (1 to 3, 1 is the default).
//   A value that is missing, the default or not valid is dropped. The selected node is not in the URL.
//   Unknown parameters are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { NODE_TYPES, nodeKeyOf, type Environment, type NodeType } from './graphTypes';

export const DEFAULT_DEPTH = 1;
export const DEPTHS = [1, 2, 3] as const;
export type Depth = (typeof DEPTHS)[number];

export interface Focus {
  type: NodeType;
  id: number;
  key: string;
}

export interface GraphParams {
  types: readonly NodeType[];
  environment: Environment | '';
  untraced: boolean;
  focus: Focus | null;
  depth: Depth;
}

export type GraphParamsPatch = Partial<{
  types: readonly NodeType[];
  environment: Environment | '';
  untraced: boolean;
  focus: Focus | null;
  depth: Depth;
}>;

const OWN_KEYS = ['types', 'environment', 'untraced', 'focus', 'depth'] as const;
const FOCUS_PATTERN = /^(screen|variable|collection|component):([1-9]\d{0,9})$/;
const MAX_ID = 2147483647;

export function parseFocus(value: string | null): Focus | null {
  const match = value === null ? null : FOCUS_PATTERN.exec(value);
  if (match === null) return null;
  const id = Number(match[2]);
  if (id > MAX_ID) return null;
  const type = NODE_TYPES.find((candidate) => candidate.toLowerCase() === match[1]);
  return type === undefined ? null : { type, id, key: nodeKeyOf(type, id) };
}

export function parseGraphParams(search: URLSearchParams): GraphParams {
  const requested = (search.get('types') ?? '').split(',');
  const chosen = NODE_TYPES.filter((type) => requested.includes(type));
  const environment = search.get('environment');
  const depth = Number(search.get('depth'));
  return {
    types: chosen.length === 0 ? NODE_TYPES : chosen,
    environment: environment === 'DEV' || environment === 'PROD' ? environment : '',
    untraced: search.get('untraced') === '1',
    focus: parseFocus(search.get('focus')),
    depth: DEPTHS.find((candidate) => candidate === depth) ?? DEFAULT_DEPTH,
  };
}

/** True when the `types` filter leaves out at least one type. */
export function typesAreFiltered(types: readonly NodeType[]): boolean {
  return types.length < NODE_TYPES.length;
}

export function useGraphParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseGraphParams(search), [search]);

  const setParams = useCallback(
    (patch: GraphParamsPatch) => {
      setSearch((current) => {
        const next = new URLSearchParams(current);
        if ('types' in patch) {
          const types = patch.types ?? NODE_TYPES;
          const ordered = NODE_TYPES.filter((type) => types.includes(type));
          if (ordered.length === 0 || ordered.length === NODE_TYPES.length) next.delete('types');
          else next.set('types', ordered.join(','));
        }
        if ('environment' in patch) {
          if (patch.environment) next.set('environment', patch.environment);
          else next.delete('environment');
        }
        if ('untraced' in patch) {
          if (patch.untraced) next.set('untraced', '1');
          else next.delete('untraced');
        }
        if ('focus' in patch) {
          if (patch.focus) next.set('focus', patch.focus.key);
          else {
            next.delete('focus');
            next.delete('depth');
          }
        }
        if ('depth' in patch) {
          if (patch.depth !== undefined && patch.depth !== DEFAULT_DEPTH) {
            next.set('depth', String(patch.depth));
          } else next.delete('depth');
        }
        return next;
      });
    },
    [setSearch],
  );

  const clearAll = useCallback(() => {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      for (const key of OWN_KEYS) next.delete(key);
      return next;
    });
  }, [setSearch]);

  const clearFocus = useCallback(() => {
    setParams({ focus: null });
  }, [setParams]);

  const hasFilters = typesAreFiltered(params.types) || params.environment !== '' || params.untraced;
  return {
    params,
    setParams,
    clearAll,
    clearFocus,
    hasFilters,
    hasView: hasFilters || params.focus !== null,
  };
}
