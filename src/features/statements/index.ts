// API pública do módulo `statements` (spec 0013): o que as rotas compõem.
export { StatementDetailPage } from './detail/statement-detail';
export {
    statementDetailSearchSchema,
    statementsPanelSearchSchema,
    type StatementDetailSearch,
    type StatementsPanelSearch,
} from './panel/statement-model';
export { StatementsPanel } from './panel/statements-panel';

// Pagar fatura sobre outra tela, para o fluxo de caixa (spec 0015, INV-0015-06).
export {
    useStatementPayQuickAction,
    type StatementPayQuickAction,
    type StatementPayRequest,
} from './payment/pay-quick-action';
