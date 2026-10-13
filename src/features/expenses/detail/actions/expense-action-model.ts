import type { BankAccount, CreditCard } from '@/api/queries/reference';
import type { SelectOptionGroup } from '@/ui/select-field';

import type { Expense, ExpenseStatus } from '../../list/expense-model';

/** Mudança de status oferecida no detalhe (spec 0012, "Detalhe e ações"). */
export type StatusAction = 'confirm' | 'pay' | 'verify' | 'reopen' | 'undo-payment';

export const STATUS_ACTION_LABELS: Readonly<Record<StatusAction, string>> = {
    confirm: 'Confirmar',
    pay: 'Pagar',
    verify: 'Marcar para verificar',
    reopen: 'Voltar para pendente',
    'undo-payment': 'Desfazer pagamento',
};

/** O status que cada ação envia em `PATCH /expenses/{id}/status`. */
export const STATUS_ACTION_TARGET: Readonly<Record<StatusAction, ExpenseStatus>> = {
    confirm: 'OPEN',
    pay: 'PAID',
    verify: 'VERIFYING',
    reopen: 'OPEN',
    'undo-payment': 'OPEN',
};

/** O que o detalhe oferece para uma despesa, só com `entries.write`. */
export interface ExpenseActionSet {
    /** As mudanças de status, na ordem dos botões. */
    status: readonly StatusAction[];
    /** **Excluir** (não paga). */
    remove: boolean;
    /** **Trocar forma de pagamento** (não paga). */
    changeMethod: boolean;
}

/**
 * A tabela de transições do backend (INV-0012-03): despesa de cartão nunca tem **Pagar** nem
 * **Desfazer pagamento**, porque é paga pela fatura (INV-0012-02).
 */
export function expenseActions(
    expense: Pick<Expense, 'status' | 'creditCardId'>,
): ExpenseActionSet {
    const card = expense.creditCardId !== null;
    const unpaid = expense.status !== 'PAID';
    let status: StatusAction[];
    switch (expense.status) {
        case 'FORECAST':
            status = ['confirm'];
            break;
        case 'OPEN':
        case 'OVERDUE':
            status = card ? ['verify'] : ['pay', 'verify'];
            break;
        case 'VERIFYING':
            status = card ? ['reopen'] : ['pay', 'reopen'];
            break;
        case 'PAID':
            status = card ? [] : ['undo-payment'];
            break;
    }
    return { status, remove: unpaid, changeMethod: unpaid };
}

/** O efeito da exclusão, mostrado antes de enviar (INV-0012-04). */
export function deleteCascadeText(expense: Pick<Expense, 'installment' | 'recurrenceId'>): string {
    if (expense.installment) {
        return 'Todas as parcelas não pagas deste parcelamento serão excluídas.';
    }
    if (expense.recurrenceId) {
        return 'Esta ocorrência e as seguintes ainda não pagas serão excluídas, e a série termina.';
    }
    return 'A despesa será excluída.';
}

/** Nota da troca de forma de pagamento numa parcela (INV-0012-04). */
export const INSTALLMENT_METHOD_NOTE = 'Vale para todas as parcelas não pagas do parcelamento.';

/** O select "Pagar com" guarda `conta:<id>` ou `cartao:<id>`. */
export type PaymentMethod = { kind: 'conta' | 'cartao'; id: string };

export function parsePaymentMethod(value: string): PaymentMethod | null {
    const [kind, id] = value.split(':', 2);
    if ((kind === 'conta' || kind === 'cartao') && id) return { kind, id };
    return null;
}

/** Contas e cartões ativos, exceto a forma de pagamento atual da despesa. */
export function paymentMethodOptions(
    expense: Pick<Expense, 'bankAccountId' | 'creditCardId'>,
    accounts: readonly BankAccount[],
    cards: readonly CreditCard[],
): SelectOptionGroup[] {
    const groups: SelectOptionGroup[] = [
        {
            label: 'Contas',
            options: accounts
                .filter((a) => a.archivedAt === null && a.id !== expense.bankAccountId)
                .map((a) => ({ value: `conta:${a.id}`, label: a.description })),
        },
        {
            label: 'Cartões',
            options: cards
                .filter((c) => c.archivedAt === null && c.id !== expense.creditCardId)
                .map((c) => ({ value: `cartao:${c.id}`, label: c.name })),
        },
    ];
    return groups.filter((group) => group.options.length > 0);
}
