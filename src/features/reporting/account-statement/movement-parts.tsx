import { ArrowDownLeft, ArrowUpRight, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Lookup } from '@/api/queries/lookups';

import type { AccountMovement } from './queries';

/** A descrição da linha e o texto de apoio, por tipo de movimento (spec 0015). */
export function movementTexts(
    movement: AccountMovement,
    accounts: Lookup,
    cards: Lookup,
): { title: string; support: string | null } {
    switch (movement.kind) {
        case 'EARNING':
        case 'EXPENSE':
            return { title: movement.description ?? '', support: movement.typeName };
        case 'STATEMENT_PAYMENT':
            return {
                title: 'Pagamento de fatura',
                support: movement.creditCardId ? cards.label(movement.creditCardId) : null,
            };
        case 'TRANSFER_IN':
        case 'TRANSFER_OUT': {
            const other = movement.counterpartBankAccountId
                ? accounts.label(movement.counterpartBankAccountId)
                : '';
            const prefix = movement.kind === 'TRANSFER_IN' ? 'De' : 'Para';
            return {
                title: movement.description ?? '',
                support: other ? `${prefix} ${other}` : null,
            };
        }
    }
}

/** A rota do lançamento de origem (spec 0015). */
export function movementHref(movement: AccountMovement): string {
    switch (movement.kind) {
        case 'EARNING':
            return `/receitas/${movement.sourceId}`;
        case 'EXPENSE':
            return `/despesas/${movement.sourceId}`;
        case 'STATEMENT_PAYMENT':
            if (!movement.creditCardId) return '/cartoes';
            return movement.statementId
                ? `/cartoes/${movement.creditCardId}/faturas/${movement.statementId}`
                : `/cartoes/${movement.creditCardId}`;
        case 'TRANSFER_IN':
        case 'TRANSFER_OUT':
            return `/transferencias/${movement.sourceId}`;
    }
}

const ICONS = {
    EARNING: TrendingUp,
    EXPENSE: Receipt,
    STATEMENT_PAYMENT: CreditCard,
    TRANSFER_IN: ArrowDownLeft,
    TRANSFER_OUT: ArrowUpRight,
} as const;

/** Descrição e apoio de um movimento, com o ícone do tipo. */
export function MovementDescription({
    title,
    support,
    kind,
}: ReturnType<typeof movementTexts> & Pick<AccountMovement, 'kind'>): ReactNode {
    const Icon = ICONS[kind];
    return (
        <span className="flex items-start gap-2">
            <Icon
                aria-hidden="true"
                strokeWidth={1.75}
                className="mt-0.5 size-4 shrink-0 text-texto-apoio"
            />
            <span className="flex min-w-0 flex-col">
                <span className="text-corpo-forte">{title}</span>
                {support && <span className="text-pequeno text-texto-apoio">{support}</span>}
            </span>
        </span>
    );
}
