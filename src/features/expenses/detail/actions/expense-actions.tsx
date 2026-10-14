import { Link, useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { useCan } from '@/api/permissions';
import { Button, buttonVariants } from '@/ui/components/ui/button';
import { useNotify } from '@/ui/notice';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';

import type { Expense } from '../../list/expense-model';

import { ActionAlert, describeError } from './action-alert';
import {
    expenseActions,
    STATUS_ACTION_LABELS,
    STATUS_ACTION_TARGET,
    type StatusAction,
} from './expense-action-model';
import { useActionErrorEffects, useChangeExpenseStatus } from './mutations';
import { PaymentMethodDialog } from './payment-method-dialog';
import { DeleteExpenseDialog, PayExpenseDialog, UndoPaymentDialog } from './status-dialogs';
import { useIsPhone } from './use-is-phone';

/** Os parâmetros de busca das ações (`?pagar`, `?excluir`, `?meio`). */
export interface ExpenseActionSearch {
    editar?: 1;
    pagar?: 1;
    excluir?: 1;
    meio?: 1;
}

export interface ExpenseActionsProps {
    expense: Expense;
    search: ExpenseActionSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<ExpenseActionSearch>) => void;
    /** Volta para a lista (depois de excluir, ou com `EXPENSE_NOT_FOUND`). */
    onBackToList: () => void;
}

const DIRECT_NOTICES: Partial<Record<StatusAction, string>> = {
    confirm: 'Despesa confirmada.',
    verify: 'Despesa marcada para verificar.',
    reopen: 'Despesa de volta para pendente.',
};

/**
 * Um diálogo aberto pela URL só abre se a ação existe no status atual; aberto, fica aberto mesmo
 * que um recarregamento mude o status (o erro continua à vista, ERR-0012-01).
 */
export function useLatchedOpen(requested: boolean, allowed: boolean): boolean {
    const [latched, setLatched] = useState(false);
    const open = requested && (allowed || latched);
    if (open !== latched) setLatched(open);
    return open;
}

/**
 * As ações do detalhe (spec 0012, "Detalhe e ações"), só com `entries.write` (INV-0009-03):
 * a tabela de transições por status e por conta ou cartão, **Estornar** (link para o **Novo
 * estorno** do cartão), **Trocar forma de pagamento** e **Excluir**. `?pagar=1`, `?excluir=1` e `?meio=1` abrem o diálogo correspondente.
 */
export function ExpenseActions(props: ExpenseActionsProps) {
    const canWrite = useCan('entries.write');
    if (!canWrite) return null;
    return <WriterActions {...props} />;
}

function WriterActions({ expense, search, onSearchChange, onBackToList }: ExpenseActionsProps) {
    const notify = useNotify();
    const onActionError = useActionErrorEffects(onBackToList);
    const change = useChangeExpenseStatus(expense.id);
    const [undoOpen, setUndoOpen] = useState(false);
    const actions = expenseActions(expense);
    const accountExpense = expense.creditCardId === null;
    const phone = useIsPhone();
    const navigate = useNavigate();

    const payOpen = useLatchedOpen(search.pagar === 1, actions.status.includes('pay'));
    const deleteOpen = useLatchedOpen(search.excluir === 1, actions.remove);
    const methodOpen = useLatchedOpen(search.meio === 1, actions.changeMethod);
    const failure = change.error ? describeError(change.error) : null;
    const cardId = expense.creditCardId;
    const hasButtons =
        actions.status.length > 0 || actions.refund || actions.changeMethod || actions.remove;

    function run(action: StatusAction) {
        if (action === 'pay') {
            onSearchChange({ pagar: 1 });
            return;
        }
        if (action === 'undo-payment') {
            setUndoOpen(true);
            return;
        }
        change.mutate(
            { status: STATUS_ACTION_TARGET[action] },
            {
                onSuccess: () => notify({ tone: 'sucesso', message: DIRECT_NOTICES[action]! }),
                onError: onActionError,
            },
        );
    }

    const buttons = phone ? (
        <PhoneButtons
            first={actions.status[0]}
            menu={[
                ...actions.status.slice(1).map((action): RowMenuItem => ({
                    label: STATUS_ACTION_LABELS[action],
                    onSelect: () => run(action),
                    disabled: change.isPending,
                })),
                { label: 'Editar', icon: Pencil, onSelect: () => onSearchChange({ editar: 1 }) },
                ...(actions.changeMethod
                    ? [
                          {
                              label: 'Trocar forma de pagamento',
                              onSelect: () => onSearchChange({ meio: 1 }),
                          },
                      ]
                    : []),
                ...(actions.refund && cardId
                    ? [
                          {
                              label: 'Estornar',
                              onSelect: () =>
                                  void navigate({
                                      to: '/cartoes/$cartaoId',
                                      params: { cartaoId: cardId },
                                      search: { estorno: 1, despesa: expense.id },
                                  }),
                          },
                      ]
                    : []),
                ...(actions.remove
                    ? [
                          {
                              label: 'Excluir',
                              tone: 'negativo' as const,
                              onSelect: () => onSearchChange({ excluir: 1 }),
                          },
                      ]
                    : []),
            ]}
            description={expense.description}
            pending={change.isPending}
            onFirst={run}
        />
    ) : (
        hasButtons && (
            <div className="flex flex-wrap gap-3">
                {actions.status.map((action, index) => (
                    <Button
                        key={action}
                        variant={index === 0 && action !== 'undo-payment' ? 'default' : 'outline'}
                        disabled={change.isPending}
                        onClick={() => run(action)}
                    >
                        {STATUS_ACTION_LABELS[action]}
                    </Button>
                ))}
                {/* AC-0012-13: abre o **Novo estorno** do cartão com esta despesa selecionada. */}
                {actions.refund && cardId && (
                    <Link
                        to="/cartoes/$cartaoId"
                        params={{ cartaoId: cardId }}
                        search={{ estorno: 1, despesa: expense.id }}
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        Estornar
                    </Link>
                )}
                {actions.changeMethod && (
                    <Button variant="outline" onClick={() => onSearchChange({ meio: 1 })}>
                        Trocar forma de pagamento
                    </Button>
                )}
                {actions.remove && (
                    <Button variant="outline" onClick={() => onSearchChange({ excluir: 1 })}>
                        Excluir
                    </Button>
                )}
            </div>
        )
    );

    return (
        <div className="flex flex-col gap-3 empty:hidden">
            {buttons}
            <ActionAlert
                message={failure?.message}
                code={failure?.code}
                cardId={expense.creditCardId}
            />

            {/* INV-0012-02: pagar e desfazer só existem em despesa de conta. */}
            {accountExpense && payOpen && (
                <PayExpenseDialog
                    open
                    expense={expense}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ pagar: undefined });
                    }}
                    onBackToList={onBackToList}
                />
            )}
            {accountExpense && (
                <UndoPaymentDialog
                    open={undoOpen}
                    expense={expense}
                    onOpenChange={setUndoOpen}
                    onBackToList={onBackToList}
                />
            )}
            {methodOpen && (
                <PaymentMethodDialog
                    open
                    expense={expense}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ meio: undefined });
                    }}
                    onBackToList={onBackToList}
                />
            )}
            <DeleteExpenseDialog
                open={deleteOpen}
                expense={expense}
                onOpenChange={(open) => onSearchChange({ excluir: open ? 1 : undefined })}
                onBackToList={onBackToList}
            />
        </div>
    );
}

/**
 * No celular (abaixo de `md`): a primeira transição em largura total e o resto no menu
 * **Mais ações** (spec 0012, "Detalhe e ações").
 */
function PhoneButtons({
    first,
    menu,
    description,
    pending,
    onFirst,
}: {
    first: StatusAction | undefined;
    menu: readonly RowMenuItem[];
    description: string;
    pending: boolean;
    onFirst: (action: StatusAction) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            {first && (
                <Button
                    className="w-full"
                    variant={first === 'undo-payment' ? 'outline' : 'default'}
                    disabled={pending}
                    onClick={() => onFirst(first)}
                >
                    {STATUS_ACTION_LABELS[first]}
                </Button>
            )}
            <RowMenu label={`Mais ações de ${description}`} trigger="texto" items={menu} />
        </div>
    );
}
