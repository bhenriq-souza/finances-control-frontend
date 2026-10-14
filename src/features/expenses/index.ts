// API pública do módulo `expenses` (spec 0012): o que as rotas compõem.
export { ExpenseDetailPage, expenseDetailSearchSchema } from './detail/expense-detail';
export { ExpenseListPage } from './list/expense-list-page';
export { expenseListSearchSchema, type ExpenseListSearch } from './list/expense-list-search';

// Tipos de despesa (T-0012-04).
export { ExpenseTypesPage } from './types/expense-types-page';
export { parseExpenseTypesSearch, type ExpenseTypesSearch } from './types/search';

// Séries fixas de despesas (T-0017-01).
export { ExpenseRecurrenceDetailPage } from './recurrences/expense-recurrence-detail';
export { ExpenseRecurrences } from './recurrences/expense-recurrences';
export { expenseRecurrenceSearchSchema, type ExpenseRecurrenceSearch } from './recurrences/search';

// Ações rápidas da lista, para o fluxo de caixa (spec 0015, INV-0015-06).
export {
    EXPENSE_QUICK_PARAMS,
    useExpenseQuickActions,
    type ExpenseQuickParam,
    type ExpenseQuickParams,
    type QuickActions as ExpenseQuickActions,
} from './list/expense-quick-actions';
