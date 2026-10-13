import { useId, type ReactNode } from 'react';

import type { BankAccount, CreditCard } from '@/api/queries/reference';
import { formatDate } from '@/shared/dates';
import type { Cents } from '@/shared/money';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { STATEMENT_OVERDUE_BADGE, STATEMENT_STATUS_BADGES } from '@/ui/status-labels';

import { activeAccounts, activeCards, closedStatementToPay } from './dashboard-data';
import { PANEL, Section, SectionContent, type Loadable } from './section';
import type { CardStatements } from './use-card-statements';

/** Valor neutro; negativo com `−` e o tom `negativo`. */
function SignedMoney({ cents, size }: { cents: Cents; size?: 'valor' | 'valor-pequeno' }) {
    return cents < 0 ? (
        <Money cents={cents} sign="always" tone="auto" size={size} />
    ) : (
        <Money cents={cents} size={size} />
    );
}

const ITEM = `${PANEL} flex min-w-0 flex-col gap-2`;

function AccountItem({ account }: { account: BankAccount }) {
    return (
        <li className={ITEM}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-corpo-forte text-texto">
                        {account.description}
                    </span>
                    <span className="text-pequeno text-texto-apoio">{account.bank.name}</span>
                </div>
                <SignedMoney cents={account.currentBalanceCents} />
            </div>
        </li>
    );
}

/**
 * O selo da fatura no cartão (tablet e desktop): **Fechada** ou **Vencida** se houver fechada a
 * pagar, senão **Em aberto** com "Fecha em …". Com a consulta das faturas falhando, o erro.
 */
function StatementBadge({ card, statements }: { card: CreditCard; statements?: CardStatements }) {
    const query = statements?.query;
    if (!query || query.isError) {
        return <p className="text-pequeno text-negativo">Não foi possível carregar a fatura.</p>;
    }
    if (!query.data) return <Skeleton className="h-6 w-28" />;
    const closed = closedStatementToPay(query.data);
    if (closed) {
        return (
            <StatusBadge
                badge={closed.overdue ? STATEMENT_OVERDUE_BADGE : STATEMENT_STATUS_BADGES.CLOSED}
            />
        );
    }
    return (
        <span className="flex flex-wrap items-center gap-2">
            <StatusBadge badge={STATEMENT_STATUS_BADGES.OPEN} />
            <span className="text-pequeno text-texto-apoio">
                Fecha em {formatDate(card.currentCycle.closesOn, 'curta')}
            </span>
        </span>
    );
}

function CardItem({ card, statements }: { card: CreditCard; statements?: CardStatements }) {
    // Usado: `creditLimitCents − availableLimitCents`, só subtração (INV-0015-02).
    const used = card.creditLimitCents - card.availableLimitCents;
    return (
        <li className={ITEM}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-corpo-forte text-texto">{card.name}</span>
                    <span className="text-pequeno text-texto-apoio">{card.bank.name}</span>
                </div>
                <Money cents={-used} sign="always" />
            </div>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-pequeno text-texto-apoio">Limite disponível</span>
                <SignedMoney cents={card.availableLimitCents} size="valor-pequeno" />
            </div>
            <div className="hidden md:block">
                <StatementBadge card={card} statements={statements} />
            </div>
        </li>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    const id = useId();
    return (
        <div className="flex flex-col gap-2">
            <h3 id={id} className="text-rotulo text-texto-apoio uppercase">
                {title}
            </h3>
            <ul aria-labelledby={id} className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {children}
            </ul>
        </div>
    );
}

const skeleton = (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
    </div>
);

/**
 * "Contas e cartões": as contas ativas (descrição, banco, saldo) e os cartões ativos (nome, usado
 * com `−`, limite disponível e, no tablet e no desktop, o selo da fatura). Celular: lista; tablet:
 * grade de duas colunas; desktop: uma coluna, ao lado de "Vence esta semana".
 */
export function AccountsSection({
    accounts,
    cards,
    statements,
    className,
}: {
    accounts: Loadable & { data: BankAccount[] | undefined };
    cards: Loadable & { data: CreditCard[] | undefined };
    statements: readonly CardStatements[];
    className?: string;
}) {
    return (
        <Section title="Contas e cartões" className={className}>
            <SectionContent queries={[accounts, cards]} skeleton={skeleton}>
                {() => {
                    const accountList = activeAccounts(accounts.data ?? []);
                    const cardList = activeCards(cards.data ?? []);
                    return (
                        <div className="flex flex-col gap-4">
                            {accountList.length > 0 && (
                                <Group title="Contas">
                                    {accountList.map((account) => (
                                        <AccountItem key={account.id} account={account} />
                                    ))}
                                </Group>
                            )}
                            {cardList.length > 0 && (
                                <Group title="Cartões">
                                    {cardList.map((card) => (
                                        <CardItem
                                            key={card.id}
                                            card={card}
                                            statements={statements.find(
                                                (entry) => entry.card.id === card.id,
                                            )}
                                        />
                                    ))}
                                </Group>
                            )}
                            {accountList.length === 0 && cardList.length === 0 && (
                                <p className="text-corpo text-texto-apoio">
                                    Nenhuma conta ou cartão ativo.
                                </p>
                            )}
                        </div>
                    );
                }}
            </SectionContent>
        </Section>
    );
}
