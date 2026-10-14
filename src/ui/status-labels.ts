import { today, type IsoDate } from '@/shared/dates';

// Tabelas de status da spec 0009. As uniões abaixo espelham as enums do contrato
// (`ExpenseStatus`, `EarningStatus`, `StatementStatus`, `BankTransferStatus` em
// `src/api/generated/schema.d.ts`), mas o `ui` não importa os tipos gerados (fronteira
// `ui-only-shared`, spec 0003): a feature passa o status da resposta da API, e um status novo no
// contrato que não esteja aqui falha no gate `types` no ponto de uso.

export type ExpenseStatus = 'OPEN' | 'FORECAST' | 'PAID' | 'OVERDUE' | 'VERIFYING';
export type EarningStatus = 'OPEN' | 'FORECAST' | 'RECEIVED' | 'OVERDUE' | 'VERIFYING';
export type StatementStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'ROLLED_OVER';
export type BankTransferStatus = 'SCHEDULED' | 'COMPLETED';

/** Família de cor do selo; `neutra` é `superficie-elevada` com `texto-apoio`. */
export type BadgeFamily = 'positivo' | 'negativo' | 'atencao' | 'info' | 'neutra';

export type Badge = { readonly label: string; readonly family: BadgeFamily };

const badge = (label: string, family: BadgeFamily): Badge => Object.freeze({ label, family });

export const EXPENSE_STATUS_BADGES: Readonly<Record<ExpenseStatus, Badge>> = {
    OPEN: badge('Pendente', 'neutra'),
    FORECAST: badge('Previsto', 'info'),
    PAID: badge('Pago', 'positivo'),
    OVERDUE: badge('Vencido', 'negativo'),
    VERIFYING: badge('Verificando', 'neutra'),
};

export const EARNING_STATUS_BADGES: Readonly<Record<EarningStatus, Badge>> = {
    OPEN: badge('Pendente', 'neutra'),
    FORECAST: badge('Previsto', 'info'),
    RECEIVED: badge('Recebido', 'positivo'),
    OVERDUE: badge('Atrasado', 'negativo'),
    VERIFYING: badge('Verificando', 'neutra'),
};

export const STATEMENT_STATUS_BADGES: Readonly<Record<StatementStatus, Badge>> = {
    OPEN: badge('Em aberto', 'info'),
    CLOSED: badge('Fechada', 'atencao'),
    PAID: badge('Paga', 'positivo'),
    ROLLED_OVER: badge('Rolada', 'neutra'),
};

/** Fatura `CLOSED` com `overdue: true`. */
export const STATEMENT_OVERDUE_BADGE = badge('Vencida', 'negativo');

export const BANK_TRANSFER_STATUS_BADGES: Readonly<Record<BankTransferStatus, Badge>> = {
    SCHEDULED: badge('Agendada', 'info'),
    COMPLETED: badge('Concluída', 'positivo'),
};

/** Selos derivados, sem status próprio na API. */
export const DERIVED_BADGES = {
    /** Despesa de conta em `OPEN` vencendo hoje; fatura `CLOSED` vencendo hoje. */
    venceHoje: badge('Vence hoje', 'atencao'),
    /** Banco, conta, cartão ou tipo com `archivedAt`. */
    arquivado: badge('Arquivado', 'neutra'),
    /** Usuário sem perfil. */
    aguardando: badge('Aguardando', 'atencao'),
} as const satisfies Record<string, Badge>;

/**
 * Selo de uma despesa. **Vence hoje** só para despesa de conta (`bankAccountId`) em `OPEN` com
 * `occurredOn` igual a `today()`; despesa de cartão vence com a fatura.
 */
export function expenseBadge(
    expense: { status: ExpenseStatus; occurredOn: IsoDate; bankAccountId: string | null },
    reference: IsoDate = today(),
): Badge {
    if (
        expense.status === 'OPEN' &&
        expense.bankAccountId !== null &&
        expense.occurredOn === reference
    ) {
        return DERIVED_BADGES.venceHoje;
    }
    return EXPENSE_STATUS_BADGES[expense.status];
}

export function earningBadge(earning: { status: EarningStatus }): Badge {
    return EARNING_STATUS_BADGES[earning.status];
}

/** Selo de uma fatura: `CLOSED` vira **Vencida** com `overdue` e **Vence hoje** com `dueOn` hoje. */
export function statementBadge(
    statement: { status: StatementStatus; overdue: boolean; dueOn: IsoDate },
    reference: IsoDate = today(),
): Badge {
    if (statement.status === 'CLOSED') {
        if (statement.overdue) return STATEMENT_OVERDUE_BADGE;
        if (statement.dueOn === reference) return DERIVED_BADGES.venceHoje;
    }
    return STATEMENT_STATUS_BADGES[statement.status];
}

export function bankTransferBadge(transfer: { status: BankTransferStatus }): Badge {
    return BANK_TRANSFER_STATUS_BADGES[transfer.status];
}
