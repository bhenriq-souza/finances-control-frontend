import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarCheck } from 'lucide-react';

import { useCan } from '@/api/permissions';
import { useAccountLookup, type Lookup } from '@/api/queries/lookups';
import type { CreditCard } from '@/api/queries/reference';
import { formatDate, type IsoDate } from '@/shared/dates';
import { buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { expenseBadge, statementBadge } from '@/ui/status-labels';

import { dueAmount, dueThisWeek, weekEnd, type DueItem } from './dashboard-data';
import { expensesQuery } from './dashboard-queries';
import { PANEL, Section, SectionContent, type Loadable } from './section';
import type { CardStatements } from './use-card-statements';

/** No celular, no máximo cinco linhas e **Ver todas**. */
export const PHONE_LIMIT = 5;

const CAPTION = 'Vence esta semana';
const LINK_FOCUS =
    'rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

function whereLabel(item: DueItem, accounts: Lookup): string {
    if (item.kind === 'statement') return item.card.name;
    return item.expense.bankAccountId ? accounts.label(item.expense.bankAccountId) : '';
}

function badgeOf(item: DueItem, today: IsoDate) {
    return item.kind === 'expense'
        ? expenseBadge(item.expense, today)
        : statementBadge(item.statement, today);
}

/** A descrição como link para o detalhe da despesa ou da fatura. */
function DetailLink({ item }: { item: DueItem }) {
    if (item.kind === 'expense') {
        return (
            <Link
                to="/despesas/$despesaId"
                params={{ despesaId: item.expense.id }}
                className={LINK_FOCUS}
            >
                {item.description}
            </Link>
        );
    }
    return (
        <Link
            to="/cartoes/$cartaoId/faturas/$faturaId"
            params={{ cartaoId: item.card.id, faturaId: item.statement.id }}
            className={LINK_FOCUS}
        >
            {item.description}
        </Link>
    );
}

/**
 * **Pagar**: só navegação (INV-0015-01). Despesa → `/despesas/$id?pagar=1`; fatura →
 * `/cartoes/$cartaoId/faturas/$faturaId?pagar=1`, onde a tela da feature abre o diálogo.
 */
function PayLink({ item }: { item: DueItem }) {
    const className = buttonVariants({ variant: 'outline' });
    if (item.kind === 'expense') {
        return (
            <Link
                to="/despesas/$despesaId"
                params={{ despesaId: item.expense.id }}
                search={{ pagar: 1 }}
                className={className}
            >
                Pagar
            </Link>
        );
    }
    return (
        <Link
            to="/cartoes/$cartaoId/faturas/$faturaId"
            params={{ cartaoId: item.card.id, faturaId: item.statement.id }}
            search={{ pagar: 1 }}
            className={className}
        >
            Pagar
        </Link>
    );
}

function DueCards({
    items,
    accounts,
    today,
}: {
    items: DueItem[];
    accounts: Lookup;
    today: IsoDate;
}) {
    return (
        <ul aria-label={CAPTION} className="flex flex-col gap-3 md:hidden">
            {items.slice(0, PHONE_LIMIT).map((item) => (
                <li key={item.key} className={`${PANEL} flex flex-col gap-2`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-corpo-forte text-texto">
                                <DetailLink item={item} />
                            </span>
                            <span className="text-pequeno text-texto-apoio">
                                {formatDate(item.dueOn, 'relativa')} · {whereLabel(item, accounts)}
                            </span>
                        </div>
                        <Money cents={-dueAmount(item)} sign="always" />
                    </div>
                    <StatusBadge badge={badgeOf(item, today)} className="self-start" />
                </li>
            ))}
        </ul>
    );
}

function DueTable({
    items,
    accounts,
    today,
    canPay,
}: {
    items: DueItem[];
    accounts: Lookup;
    today: IsoDate;
    canPay: boolean;
}) {
    const th = 'px-4 py-3 text-rotulo text-texto-apoio';
    return (
        <table className="hidden w-full border-collapse overflow-hidden rounded-md border border-linha bg-superficie text-corpo text-texto md:table">
            <caption className="sr-only">{CAPTION}</caption>
            <thead className="bg-superficie-elevada">
                <tr>
                    <th scope="col" className={`${th} text-start`}>
                        Vencimento
                    </th>
                    <th scope="col" className={`${th} text-start`}>
                        Descrição
                    </th>
                    <th scope="col" className={`${th} text-start`}>
                        Conta ou cartão
                    </th>
                    <th scope="col" className={`${th} text-start`}>
                        Situação
                    </th>
                    <th scope="col" className={`${th} text-end`}>
                        Valor
                    </th>
                    {canPay && (
                        <th scope="col" className={`${th} text-end`}>
                            <span className="sr-only">Ação</span>
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                {items.map((item) => (
                    <tr key={item.key} className="border-t border-linha">
                        <td className="px-4 py-3 whitespace-nowrap text-texto-apoio">
                            {formatDate(item.dueOn, 'relativa')}
                        </td>
                        <td className="px-4 py-3">
                            <DetailLink item={item} />
                        </td>
                        <td className="px-4 py-3 text-texto-apoio">{whereLabel(item, accounts)}</td>
                        <td className="px-4 py-3">
                            <StatusBadge badge={badgeOf(item, today)} />
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                            <Money cents={-dueAmount(item)} sign="always" />
                        </td>
                        {canPay && (
                            <td className="px-4 py-2 text-end">
                                <PayLink item={item} />
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const skeleton = (
    <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
    </div>
);

/**
 * "Vence esta semana" (spec 0015): despesas de conta vencidas e a vencer até `today() + 6` e as
 * faturas fechadas a pagar, em ordem de vencimento. Celular: cartões, no máximo cinco, e **Ver
 * todas**; tablet e desktop: a tabela, com **Pagar** para quem tem `entries.write`.
 */
export function DueSection({
    today,
    cards,
    statements,
    className,
}: {
    today: IsoDate;
    /** A consulta de cartões; as faturas dependem dela. */
    cards: Loadable & { data: CreditCard[] | undefined };
    statements: readonly CardStatements[];
    className?: string;
}) {
    const overdue = useQuery(expensesQuery({ status: 'OVERDUE' }));
    const week = useQuery(expensesQuery({ from: today, to: weekEnd(today) }));
    const accounts = useAccountLookup();
    const canPay = useCan('entries.write');

    const queries: Loadable[] = [overdue, week, cards, ...statements.map(({ query }) => query)];
    const items =
        overdue.data && week.data && statements.every(({ query }) => query.data)
            ? dueThisWeek({
                  overdue: overdue.data,
                  week: week.data,
                  statements: statements.map(({ card, query }) => ({
                      card,
                      statements: query.data ?? [],
                  })),
                  today,
              })
            : [];
    const hasOverdue = items.some(
        (item) => item.kind === 'expense' && item.expense.status === 'OVERDUE',
    );

    return (
        <Section
            title="Vence esta semana"
            className={className}
            action={
                items.length > 0 ? (
                    <Link
                        to="/despesas"
                        search={hasOverdue ? { status: 'OVERDUE' } : {}}
                        className={`${buttonVariants({ variant: 'link' })} min-h-11 md:hidden`}
                    >
                        Ver todas
                    </Link>
                ) : null
            }
        >
            <SectionContent queries={queries} skeleton={skeleton}>
                {() =>
                    items.length === 0 ? (
                        <EmptyState
                            variant="vazio"
                            icon={CalendarCheck}
                            title="Nada vence esta semana."
                        />
                    ) : (
                        <>
                            <DueCards items={items} accounts={accounts} today={today} />
                            <DueTable
                                items={items}
                                accounts={accounts}
                                today={today}
                                canPay={canPay}
                            />
                        </>
                    )
                }
            </SectionContent>
        </Section>
    );
}
