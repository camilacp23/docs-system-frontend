// searchTypes: the shapes of the advanced search taken from the generated contract types (never hand-written).
// SearchResult is one of four variants told apart by `type` (SCREEN, VARIABLE, COLLECTION, COMPONENT); each variant
// declares only its own fields. SEARCH_TYPES lists the types in the order of the contract and of the frame.
import type { components } from '../../api/schema';

export type SearchResult = components['schemas']['SearchResult'];
export type SearchElementType = components['schemas']['ElementType'];
export type SearchEnvironment = components['schemas']['Environment'];
export type SearchStatus = components['schemas']['DocumentationStatus'];
export type SearchScope = components['schemas']['VariableScope'];

export const SEARCH_TYPES: readonly SearchElementType[] = [
  'SCREEN',
  'VARIABLE',
  'COLLECTION',
  'COMPONENT',
];
export const SEARCH_ENVIRONMENTS: readonly SearchEnvironment[] = ['DEV', 'PROD'];
