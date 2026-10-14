// API pública do módulo `reporting` (spec 0015): o que as rotas compõem.
export { Dashboard } from './dashboard/dashboard';
export { ReportsPage, reportsSearchSchema, type ReportsSearch } from './reports';
export {
    AccountStatementPage,
    accountStatementSearchSchema,
    type AccountStatementSearch,
} from './account-statement';
export {
    CASH_FLOW_ACTIONS,
    CashFlowPage,
    cashFlowSearchSchema,
    type CashFlowAction,
    type CashFlowPageProps,
    type CashFlowRowActions,
    type CashFlowSearch,
} from './cash-flow';
