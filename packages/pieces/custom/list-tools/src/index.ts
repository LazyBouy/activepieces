import { createPiece, PieceAuth, PieceCategory } from '@activepieces/pieces-framework';
import { collectValuesAction } from './lib/actions/collect-values';
import { combineListsAction } from './lib/actions/combine-lists';
import { compareListsAction } from './lib/actions/compare-lists';
import { expandNestedListAction } from './lib/actions/expand-nested-list';
import { filterListAction } from './lib/actions/filter-list';
import { forgetSeenItemsAction } from './lib/actions/forget-seen-items';
import { groupAndSummarizeAction } from './lib/actions/group-and-summarize';
import { keepNewItemsAction } from './lib/actions/keep-new-items';
import { limitListAction } from './lib/actions/limit-list';
import { removeDuplicatesAction } from './lib/actions/remove-duplicates';
import { renameFieldsAction } from './lib/actions/rename-fields';
import { setFieldsAction } from './lib/actions/set-fields';
import { sortListAction } from './lib/actions/sort-list';
import { listToolsLogo } from './lib/logo';

export const listTools = createPiece({
  displayName: 'List Tools',
  description: 'Filter, sort, de-duplicate, reshape and combine lists of items',
  minimumSupportedRelease: '0.30.0',
  logoUrl: listToolsLogo,
  auth: PieceAuth.None(),
  categories: [PieceCategory.CORE],
  actions: [
    filterListAction,
    sortListAction,
    limitListAction,
    removeDuplicatesAction,
    keepNewItemsAction,
    forgetSeenItemsAction,
    expandNestedListAction,
    collectValuesAction,
    groupAndSummarizeAction,
    compareListsAction,
    combineListsAction,
    renameFieldsAction,
    setFieldsAction,
  ],
  authors: ['LazyBouy'],
  triggers: [],
});
