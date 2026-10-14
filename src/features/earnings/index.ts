// Lista e detalhe de receitas (T-0014-01).
export { EarningDetail } from './detail/earning-detail';
export { EarningListPage } from './list/earning-list-page';
export {
    earningDetailSearchSchema,
    earningListSearchSchema,
    type EarningDetailSearch,
    type EarningListSearch,
} from './list/earning-search';

// Tipos de receita (T-0014-04).
export { EarningTypesPage, type EarningTypesPageProps } from './types/earning-types-page';
export { parseEarningTypesSearch, type EarningTypesSearch } from './types/search';

// Séries fixas de receitas (T-0017-01).
export { EarningRecurrenceDetailPage } from './recurrences/earning-recurrence-detail';
export { EarningRecurrences } from './recurrences/earning-recurrences';
export { earningRecurrenceSearchSchema, type EarningRecurrenceSearch } from './recurrences/search';

// Ações rápidas da lista, para o fluxo de caixa (spec 0015, INV-0015-06).
export {
    ROW_DIALOGS as EARNING_QUICK_PARAMS,
    useEarningQuickActions,
    type EarningQuickActions,
    type EarningQuickParams,
    type RowDialog as EarningQuickParam,
} from './list/row-actions';
