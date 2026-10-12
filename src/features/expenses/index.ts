// API pública do módulo `expenses` (spec 0012): o que as rotas compõem.
export { ExpenseDetailPage, expenseDetailSearchSchema } from './detail/expense-detail';
export { ExpenseListPage } from './list/expense-list-page';
export { expenseListSearchSchema, type ExpenseListSearch } from './list/expense-list-search';

// Tipos de despesa (T-0012-04).
export { ExpenseTypesPage } from './types/expense-types-page';
export { parseExpenseTypesSearch, type ExpenseTypesSearch } from './types/search';
