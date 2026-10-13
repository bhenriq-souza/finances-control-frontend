// Contas, bancos e cartões — listas e resumo (spec 0011, T-0011-01).
export { BankAccountsPage } from './bank-accounts-page';
export { BanksPage } from './banks-page';
export { CreditCardPage } from './credit-card-page';
export { CreditCardsPage } from './credit-cards-page';

// Cadastro: formulários e parâmetros `?novo`/`?editar` (spec 0011, T-0011-02).
export { cardFormSearchShape, listFormSearchShape, type AccountsFormSearch } from './forms';

// Transferências entre contas próprias (spec 0018).
export {
    TransferDetailPage,
    TransfersPage,
    transferDetailSearchSchema,
    transfersSearchSchema,
} from './transfers';
