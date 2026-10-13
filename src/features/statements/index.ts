// API pública do módulo `statements` (spec 0013): o que as rotas compõem.
export { StatementDetailPage } from './detail/statement-detail';
export {
    statementDetailSearchSchema,
    statementsPanelSearchSchema,
    type StatementDetailSearch,
    type StatementsPanelSearch,
} from './panel/statement-model';
export { StatementsPanel } from './panel/statements-panel';
