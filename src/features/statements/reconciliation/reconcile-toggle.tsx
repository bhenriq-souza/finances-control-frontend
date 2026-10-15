import { useNavigate, useSearch } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { useId } from 'react';

import { useCan } from '@/api/permissions';
import { Button } from '@/ui/components/ui/button';
import { useNotify } from '@/ui/notice';
import { StatusBadge } from '@/ui/status-badge';
import type { Badge } from '@/ui/status-labels';

import { asApiError, type StatementExpense } from '../panel/statement-model';

import { useChangeReconciliation } from './reconciliation-api';

export const CONFIRMED_NOTICE = 'Despesa confirmada e incluída.';

const INCLUDED_BADGE: Badge = { label: 'Incluída', family: 'positivo' };

/**
 * O botão **Incluída** de uma despesa da fatura (spec 0020). Sem `entries.write`, só o selo da
 * despesa marcada (INV-0020-02). Marcar uma `FORECAST` também a confirma, e o aviso diz isso; as
 * demais não avisam, porque o próprio botão muda. Um erro vira alerta pelo catálogo.
 */
export function ReconcileToggle({ expense }: { expense: StatementExpense }) {
    const canWrite = useCan('entries.write');
    const marked = expense.reconciledAt !== null;
    if (!canWrite) return marked ? <StatusBadge badge={INCLUDED_BADGE} /> : null;
    return <WriterToggle expense={expense} marked={marked} />;
}

function WriterToggle({ expense, marked }: { expense: StatementExpense; marked: boolean }) {
    const notify = useNotify();
    const change = useChangeReconciliation();
    const confirms = !marked && expense.status === 'FORECAST';

    const toggle = () =>
        change.mutate(
            { expenseId: expense.id, reconciled: !marked },
            {
                onSuccess: () => {
                    if (confirms) notify({ tone: 'sucesso', message: CONFIRMED_NOTICE });
                },
                onError: (error) =>
                    notify({ tone: 'erro', message: asApiError(error).userMessage }),
            },
        );

    return (
        <Button
            variant={marked ? undefined : 'outline'}
            aria-pressed={marked}
            aria-busy={change.isPending}
            aria-label={
                marked
                    ? `Desmarcar incluída: ${expense.description}`
                    : `Marcar como incluída: ${expense.description}`
            }
            disabled={change.isPending}
            onClick={toggle}
            className={clsx(
                'min-w-11 px-3',
                marked && 'bg-positivo text-sobre-acento hover:bg-positivo/90',
            )}
        >
            <Check aria-hidden />
            {marked && <span className="hidden md:inline">Incluída</span>}
        </Button>
    );
}

/** `?conferir=1` liga **Só o que falta conferir**; desligar tira o parâmetro da URL. */
export function useReconcileFilter() {
    const search: { conferir?: unknown } = useSearch({ strict: false });
    const navigate = useNavigate();
    return {
        pendingOnly: search.conferir === 1,
        set: (on: boolean) =>
            void navigate({
                to: '.',
                search: (prev: Record<string, unknown>) => ({
                    ...prev,
                    conferir: on ? (1 as const) : undefined,
                }),
                replace: true,
            }),
    };
}

/** As despesas que o filtro deixa: só por `reconciledAt` (INV-0020-03). */
export function pendingExpenses(expenses: readonly StatementExpense[]): StatementExpense[] {
    return expenses.filter((expense) => expense.reconciledAt === null);
}

export function ReconcileFilter({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    const id = useId();
    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="checkbox"
                role="switch"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="size-5 accent-acento"
            />
            <label htmlFor={id} className="text-corpo text-texto">
                Só o que falta conferir
            </label>
        </div>
    );
}
