import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { invalidateAfter } from '@/api/queries/invalidation';
import { Button } from '@/ui/components/ui/button';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';

import { describeError } from '../detail/actions/action-alert';
import {
    expenseActions,
    STATUS_ACTION_LABELS,
    STATUS_ACTION_TARGET,
    type StatusAction,
} from '../detail/actions/expense-action-model';
import { useLatchedOpen } from '../detail/actions/expense-actions';
import { useChangeAnyExpenseStatus } from '../detail/actions/mutations';
import {
    DeleteExpenseDialog,
    PayExpenseDialog,
    UndoPaymentDialog,
} from '../detail/actions/status-dialogs';
import { expenseDetailQuery } from '../detail/expense-detail';
import { ExpenseFormDialog } from '../form/expense-form';

import type { Expense } from './expense-model';

const DIRECT_NOTICES: Partial<Record<StatusAction, string>> = {
    confirm: 'Despesa confirmada.',
    verify: 'Despesa marcada para verificar.',
    reopen: 'Despesa de volta para pendente.',
};

/** As ações rápidas que abrem um diálogo, cada uma com o id da despesa. */
export const EXPENSE_QUICK_PARAMS = ['pagar', 'editar', 'excluir', 'desfazer'] as const;
export type ExpenseQuickParam = (typeof EXPENSE_QUICK_PARAMS)[number];
type QuickParam = ExpenseQuickParam;

/**
 * Os diálogos abertos: `{ pagar: <id> }` etc. A lista os lê de `?pagar=<id>`; o fluxo de caixa
 * (spec 0015) os traduz de `?acao=pagar&despesa=<id>`.
 */
export type ExpenseQuickParams = Partial<Record<ExpenseQuickParam, string | undefined>>;

/** Se a ação do diálogo existe para a despesa no status atual (mesmo modelo do detalhe). */
const ALLOWS: Record<QuickParam, (expense: Expense) => boolean> = {
    pagar: (expense) =>
        expense.creditCardId === null && expenseActions(expense).status.includes('pay'),
    editar: () => true,
    excluir: (expense) => expenseActions(expense).remove,
    desfazer: (expense) =>
        expense.creditCardId === null && expenseActions(expense).status.includes('undo-payment'),
};

export interface QuickActions {
    /** O menu da linha (`actions` do `EntryList`); `null` sem `entries.write`. */
    rowMenu: ((expense: Expense) => ReactNode) | undefined;
    /** O alerta de erro de uma transição sem diálogo, acima da lista. */
    alert: ReactNode;
    /** Os diálogos abertos pelos parâmetros (na lista, `?pagar=<id>`, `?editar=<id>` etc.). */
    dialogs: ReactNode;
}

/**
 * As ações rápidas da lista de despesas (spec 0012, INV-0012-06): o mesmo modelo de ações, os
 * mesmos diálogos e as mesmas mutações do detalhe, sobre a própria lista. Só com `entries.write`.
 * Os diálogos abertos vêm de `params`, independentes da rota: quem usa traduz os seus parâmetros
 * de busca (a lista, `?pagar=<id>`; o fluxo de caixa, spec 0015, `?acao=pagar&despesa=<id>`).
 */
export function useExpenseQuickActions(
    params: ExpenseQuickParams,
    onParamsChange: (next: ExpenseQuickParams) => void,
): QuickActions {
    const canWrite = useCan('entries.write');
    const notify = useNotify();
    const queryClient = useQueryClient();
    const change = useChangeAnyExpenseStatus();
    const [failure, setFailure] = useState<string | null>(null);

    if (!canWrite) return { rowMenu: undefined, alert: null, dialogs: null };

    const open = (param: QuickParam, id: string) => {
        setFailure(null);
        onParamsChange({ ...params, [param]: id });
    };
    const close = (param: QuickParam) => onParamsChange({ ...params, [param]: undefined });

    function send(expense: Expense, action: StatusAction) {
        setFailure(null);
        change.mutate(
            { id: expense.id, body: { status: STATUS_ACTION_TARGET[action] } },
            {
                onSuccess: () => notify({ tone: 'sucesso', message: DIRECT_NOTICES[action]! }),
                onError: (error) => {
                    setFailure(`${expense.description}: ${describeError(error).message}`);
                    void invalidateAfter(queryClient, 'expense');
                },
            },
        );
    }

    function rowMenu(expense: Expense) {
        const actions = expenseActions(expense);
        const items: RowMenuItem[] = actions.status.map((action) => ({
            label: STATUS_ACTION_LABELS[action],
            disabled: change.isPending,
            onSelect: () => {
                if (action === 'pay') open('pagar', expense.id);
                else if (action === 'undo-payment') open('desfazer', expense.id);
                else send(expense, action);
            },
        }));
        items.push({ label: 'Editar', icon: Pencil, onSelect: () => open('editar', expense.id) });
        if (actions.remove) {
            items.push({
                label: 'Excluir',
                tone: 'negativo',
                onSelect: () => open('excluir', expense.id),
            });
        }
        return <RowMenu label={`Ações de ${expense.description}`} items={items} />;
    }

    return {
        rowMenu,
        alert: failure && (
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <FormAlert message={failure} />
                </div>
                <Button variant="ghost" onClick={() => setFailure(null)}>
                    Fechar alerta
                </Button>
            </div>
        ),
        dialogs: EXPENSE_QUICK_PARAMS.map((param) => {
            const id = params[param];
            return id ? (
                <QuickDialog key={param} param={param} id={id} onClose={() => close(param)} />
            ) : null;
        }),
    };
}

/**
 * Lê a despesa (`GET /expenses/{id}`) e abre o diálogo da ação. Id desconhecido ou ação que o
 * status não permite: ignorado e o parâmetro removido. Aberto, o diálogo continua aberto mesmo
 * que um recarregamento mude o status (o alerta continua à vista, ERR-0012-01).
 */
function QuickDialog({
    param,
    id,
    onClose,
}: {
    param: QuickParam;
    id: string;
    onClose: () => void;
}) {
    const query = useQuery(expenseDetailQuery(id));
    const expense = query.data;
    const allowed = expense !== undefined && ALLOWS[param](expense);
    const shown = useLatchedOpen(true, allowed);
    const dead = !shown && (query.isError || (expense !== undefined && !allowed));

    useEffect(() => {
        if (dead) onClose();
    }, [dead, onClose]);

    if (!shown || !expense) return null;
    const dialog = { expense, open: true, onOpenChange: (next: boolean) => !next && onClose() };
    switch (param) {
        case 'pagar':
            return <PayExpenseDialog {...dialog} onBackToList={onClose} />;
        case 'desfazer':
            return <UndoPaymentDialog {...dialog} onBackToList={onClose} />;
        case 'excluir':
            return <DeleteExpenseDialog {...dialog} onBackToList={onClose} />;
        case 'editar':
            return (
                <ExpenseFormDialog
                    open
                    expense={expense}
                    onOpenChange={dialog.onOpenChange}
                    onGone={onClose}
                />
            );
    }
}
