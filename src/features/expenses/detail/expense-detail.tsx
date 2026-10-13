import { queryOptions, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { useCan } from '@/api/permissions';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { useAccountLookup, useCardLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { expenseBadge } from '@/ui/status-labels';

import { ExpenseFormDialog } from '../form/expense-form';
import { asApiError } from '../list/expense-list-search';
import { EXPENSE_KIND_LABELS, type Expense } from '../list/expense-model';

import { ExpenseActions } from './actions/expense-actions';

const flag = z.literal(1).optional().catch(undefined);

/**
 * Parâmetros de busca de `/despesas/$despesaId` (spec 0012): cada um abre o diálogo da ação
 * correspondente (formulário em T-0012-02, ações em T-0012-03) e só tem efeito com `entries.write`.
 */
export const expenseDetailSearchSchema = z.object({
    editar: flag,
    pagar: flag,
    excluir: flag,
    meio: flag,
});

export type ExpenseDetailSearch = z.infer<typeof expenseDetailSearchSchema>;

/** `GET /expenses/{id}`, chave `queryKeys.expenses.detail(id)`. */
export function expenseDetailQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.expenses.detail(id),
        queryFn: async (): Promise<Expense> => {
            const body = unwrap(await api.GET('/expenses/{id}', { params: { path: { id } } }));
            if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
            return body.data;
        },
        staleTime: ENTRY_STALE_TIME,
    });
}

function Item({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-linha py-3 first:border-t-0 md:flex-row md:gap-4">
            <dt className="text-rotulo text-texto-apoio md:w-44 md:shrink-0">{term}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

function ExpenseFields({ expense }: { expense: Expense }) {
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const card = expense.creditCardId;
    return (
        <dl className="flex flex-col">
            <Item term="Natureza">{EXPENSE_KIND_LABELS[expense.kind]}</Item>
            <Item term="Tipo">{expense.expenseType.name}</Item>
            {expense.bankAccountId && (
                <Item term="Conta">{accounts.label(expense.bankAccountId)}</Item>
            )}
            {card && (
                <Item term="Cartão">
                    <span className="flex flex-col gap-1">
                        <span>{cards.label(card)}</span>
                        <Link
                            to="/cartoes/$cartaoId"
                            params={{ cartaoId: card }}
                            className={LINK_CLASS}
                        >
                            Paga pela fatura do cartão
                        </Link>
                    </span>
                </Item>
            )}
            <Item term={card ? 'Data da compra' : 'Vencimento'}>
                {formatDate(expense.occurredOn, 'longa')}
            </Item>
            {card && expense.postedOn && (
                <Item term="Fatura de">{formatDate(expense.postedOn, 'longa')}</Item>
            )}
            {expense.paidOn && <Item term="Pago em">{formatDate(expense.paidOn, 'longa')}</Item>}
            {expense.installment && (
                <Item term="Parcela">
                    <span className="flex flex-col gap-1">
                        <span>
                            Parcela {expense.installment.number} de {expense.installment.total}
                        </span>
                        <Link
                            to="/despesas"
                            search={{ grupo: expense.installment.groupId }}
                            className={LINK_CLASS}
                        >
                            Ver todas as parcelas
                        </Link>
                    </span>
                </Item>
            )}
            {expense.recurrenceId && (
                <Item term="Repetição">
                    <span className="flex flex-col gap-1">
                        <span>Fixa, mês a mês</span>
                        <Link
                            to="/series/despesas/$serieId"
                            params={{ serieId: expense.recurrenceId }}
                            className={LINK_CLASS}
                        >
                            Ver série
                        </Link>
                    </span>
                </Item>
            )}
            {expense.notes && (
                <Item term="Observações">
                    <span className="whitespace-pre-line">{expense.notes}</span>
                </Item>
            )}
        </dl>
    );
}

export interface ExpenseDetailPageProps {
    expenseId: string;
    search: ExpenseDetailSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<ExpenseDetailSearch>) => void;
    /** Volta para a lista (depois de excluir, ou com `EXPENSE_NOT_FOUND` numa ação). */
    onBackToList: () => void;
}

/**
 * Detalhe de uma despesa (`/despesas/$despesaId`, spec 0012): os campos da resposta, o selo, a
 * conta ou o cartão por nome, os links da parcela e da fatura, e as ações. `404 EXPENSE_NOT_FOUND`
 * mostra o estado `nao-encontrado` (ERR-0009-02); outra falha, o estado `erro` (ERR-0009-01). Com
 * `entries.write`, **Alterar** abre o formulário (`?editar=1`).
 */
export function ExpenseDetailPage({
    expenseId,
    search,
    onSearchChange,
    onBackToList,
}: ExpenseDetailPageProps) {
    const query = useQuery(expenseDetailQuery(expenseId));
    const canWrite = useCan('entries.write');

    let content;
    // Com dado, ele vale mesmo que um recarregamento falhe: assim a exclusão termina na tela.
    if (query.isError && !query.data) {
        const error = asApiError(query.error);
        content = error.code.endsWith('_NOT_FOUND') ? (
            <EmptyState
                variant="nao-encontrado"
                backTo="/despesas"
                backLabel="Voltar para despesas"
            />
        ) : (
            <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />
        );
    } else if (!query.data) {
        content = (
            <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    } else {
        const expense = query.data;
        content = (
            <article className="flex flex-col gap-4">
                <header className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-titulo-1">{expense.description}</h1>
                        <StatusBadge badge={expenseBadge(expense)} />
                    </div>
                    <Money
                        cents={-expense.amountCents}
                        sign="always"
                        tone="auto"
                        size="valor-destaque"
                    />
                    {canWrite && (
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={() => onSearchChange({ editar: 1 })}>
                                <Pencil aria-hidden="true" />
                                Alterar
                            </Button>
                        </div>
                    )}
                </header>
                <ExpenseActions
                    expense={expense}
                    search={search}
                    onSearchChange={onSearchChange}
                    onBackToList={onBackToList}
                />
                <section className="rounded-md border border-linha bg-superficie px-4 md:px-6">
                    <ExpenseFields expense={expense} />
                </section>
                {canWrite && search.editar === 1 && (
                    <ExpenseFormDialog
                        open
                        expense={expense}
                        onOpenChange={(open) => {
                            if (!open) onSearchChange({ editar: undefined });
                        }}
                        onGone={onBackToList}
                    />
                )}
            </article>
        );
    }

    return (
        <div className="flex max-w-3xl flex-col gap-4">
            <Link
                to="/despesas"
                className={`inline-flex items-center gap-1 self-start ${LINK_CLASS}`}
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Despesas
            </Link>
            {content}
        </div>
    );
}
