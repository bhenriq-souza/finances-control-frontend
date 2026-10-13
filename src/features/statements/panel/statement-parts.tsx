import { clsx } from 'clsx';
import type { ReactNode } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { formatBRL } from '@/shared/money';
import { BarList } from '@/ui/charts/bar-list';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { StatusBadge } from '@/ui/status-badge';
import { expenseBadge, statementBadge } from '@/ui/status-labels';

import type {
    Statement,
    StatementExpense,
    StatementPayment,
    StatementRefund,
} from './statement-model';

// Peças comuns ao painel (fatura atual) e ao detalhe de uma fatura persistida (spec 0013,
// "Valores e detalhe da fatura"). Nenhum valor é calculado aqui (INV-0013-01): todos vêm da
// resposta; o `−` de estornos e despesas é só a apresentação do sinal.

type HeadingLevel = 2 | 3;

export function Heading({
    level,
    id,
    children,
}: {
    level: HeadingLevel;
    id?: string;
    children: ReactNode;
}) {
    const Tag = level === 2 ? 'h2' : 'h3';
    return (
        <Tag id={id} className={level === 2 ? 'text-titulo-2' : 'text-titulo-3'}>
            {children}
        </Tag>
    );
}

/** O selo da fatura pela tabela da spec 0009 (com **Vencida** e **Vence hoje**). */
export function StatementBadge({ statement }: { statement: Statement }) {
    return <StatusBadge badge={statementBadge(statement)} />;
}

/** "9 set. – 8 out." — o período da fatura. */
export function periodText(statement: Statement): string {
    return `${formatDate(statement.startsOn, 'curta')} – ${formatDate(statement.closesOn, 'curta')}`;
}

/** Período, "Fecha em" e "Vence em". */
export function StatementDates({ statement }: { statement: Statement }) {
    return (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <DateItem label="Período">{periodText(statement)}</DateItem>
            <DateItem label="Fecha em">{formatDate(statement.closesOn, 'longa')}</DateItem>
            <DateItem label="Vence em">{formatDate(statement.dueOn, 'longa')}</DateItem>
        </dl>
    );
}

function DateItem({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-rotulo text-texto-apoio">{label}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

function ValueRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-t border-linha py-2.5 first:border-t-0">
            <dt className="text-corpo text-texto-apoio">{label}</dt>
            <dd className="text-end">{children}</dd>
        </div>
    );
}

/**
 * Os valores da fatura, na ordem da tabela da spec 0013. **Restante** fica no tom `negativo`
 * quando a fatura está `overdue`: sem sinal, por isso fora do `Money`, que só colore pelo sinal.
 */
export function StatementValues({ statement }: { statement: Statement }) {
    return (
        <dl aria-label="Valores da fatura" className="flex flex-col">
            <ValueRow label="Compras">
                <Money cents={statement.purchasesCents} />
            </ValueRow>
            <ValueRow label="Estornos">
                <Money cents={-statement.refundsCents} />
            </ValueRow>
            {statement.previousBalanceCents !== 0 && (
                <ValueRow label="Saldo anterior">
                    <Money cents={statement.previousBalanceCents} />
                </ValueRow>
            )}
            <ValueRow label="Total da fatura">
                <Money cents={statement.amountDueCents} size="valor-destaque" />
            </ValueRow>
            <ValueRow label="Pago">
                <Money cents={statement.paidCents} />
            </ValueRow>
            <ValueRow label="Restante">
                {statement.overdue ? (
                    <span data-tone="negativo" className="text-valor text-negativo tabular-nums">
                        {formatBRL(statement.remainingCents)}
                    </span>
                ) : (
                    <Money cents={statement.remainingCents} />
                )}
            </ValueRow>
            <ValueRow label="Mínimo informado">
                {statement.minimumPaymentCents === null ? (
                    <span className="text-corpo text-texto-apoio">Não informado</span>
                ) : (
                    <Money cents={statement.minimumPaymentCents} />
                )}
            </ValueRow>
        </dl>
    );
}

function Block({
    title,
    level,
    children,
}: {
    title: string;
    level: HeadingLevel;
    children: ReactNode;
}) {
    return (
        <section aria-label={title} className="flex flex-col gap-3">
            <Heading level={level}>{title}</Heading>
            {children}
        </section>
    );
}

/** **Por tipo**: `byExpenseType` em `BarList`, na ordem da resposta. */
export function StatementByType({
    statement,
    level,
}: {
    statement: Statement;
    level: HeadingLevel;
}) {
    if (statement.byExpenseType.length === 0) return null;
    return (
        <Block title="Por tipo" level={level}>
            <BarList
                label="Compras por tipo"
                items={statement.byExpenseType.map((item) => ({
                    key: item.expenseTypeId,
                    label: item.name,
                    cents: item.totalCents,
                }))}
            />
        </Block>
    );
}

function installmentText(expense: StatementExpense): string {
    return expense.installment ? `${expense.installment.number}/${expense.installment.total}` : '—';
}

/** Valor da despesa: `Money` negado, com o `−` sempre visível (como na lista de despesas). */
function ExpenseAmount({ cents }: { cents: number }) {
    return <Money cents={-cents} sign="always" tone="auto" />;
}

const EXPENSE_COLUMNS: readonly EntryColumn<StatementExpense>[] = [
    { header: 'Descrição', cell: (expense) => expense.description },
    { header: 'Data', cell: (expense) => formatDate(expense.occurredOn, 'curta') },
    { header: 'Parcela', cell: installmentText },
    { header: 'Tipo', cell: (expense) => expense.expenseType.name, hideBelow: 'lg' },
    {
        header: 'Status',
        // Despesa de cartão: sem `bankAccountId`, nunca **Vence hoje** (vence com a fatura).
        cell: (expense) => (
            <StatusBadge badge={expenseBadge({ ...expense, bankAccountId: null })} />
        ),
    },
    {
        header: 'Valor',
        cell: (expense) => <ExpenseAmount cents={expense.amountCents} />,
        align: 'end',
    },
];

function CardLine({
    title,
    support,
    badge,
    value,
}: {
    title: string;
    support: string;
    badge?: ReactNode;
    value: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-corpo text-texto">{title}</span>
                <span className="text-pequeno text-texto-apoio">{support}</span>
                {badge}
            </div>
            <span className="shrink-0">{value}</span>
        </div>
    );
}

function expenseSupport(expense: StatementExpense): string {
    const parts = [formatDate(expense.occurredOn, 'curta'), expense.expenseType.name];
    if (expense.installment) {
        parts.push(`Parcela ${expense.installment.number} de ${expense.installment.total}`);
    }
    return parts.join(' · ');
}

function NoneText({ children }: { children: string }) {
    return <p className="text-corpo text-texto-apoio">{children}</p>;
}

/** **Despesas** da fatura; cada uma leva ao detalhe dela (`/despesas/$despesaId`). */
export function StatementExpenses({
    expenses,
    level,
}: {
    expenses: readonly StatementExpense[];
    level: HeadingLevel;
}) {
    return (
        <Block title="Despesas" level={level}>
            <EntryList
                items={expenses}
                getKey={(expense) => expense.id}
                caption="Despesas da fatura"
                columns={EXPENSE_COLUMNS}
                renderCard={(expense) => (
                    <CardLine
                        title={expense.description}
                        support={expenseSupport(expense)}
                        badge={
                            <StatusBadge
                                badge={expenseBadge({ ...expense, bankAccountId: null })}
                                className="self-start"
                            />
                        }
                        value={<ExpenseAmount cents={expense.amountCents} />}
                    />
                )}
                href={(expense) => `/despesas/${expense.id}`}
                empty={
                    <EmptyState
                        variant="vazio"
                        title="Nenhuma despesa nesta fatura."
                        description="As compras no cartão aparecem aqui."
                    />
                }
            />
        </Block>
    );
}

/** Estorno: valor com `+`, no tom `positivo` (crédito na fatura). */
function RefundAmount({ cents }: { cents: number }) {
    return <Money cents={cents} sign="always" tone="auto" />;
}

const REFUND_COLUMNS: readonly EntryColumn<StatementRefund>[] = [
    { header: 'Descrição', cell: (refund) => refund.description },
    { header: 'Data', cell: (refund) => formatDate(refund.occurredOn, 'curta') },
    {
        header: 'Valor',
        cell: (refund) => <RefundAmount cents={refund.amountCents} />,
        align: 'end',
    },
];

/** **Estornos** da fatura; com `actions` (só com `entries.write`), **Editar** e **Excluir**. */
export function StatementRefunds({
    refunds,
    level,
    actions,
}: {
    refunds: readonly StatementRefund[];
    level: HeadingLevel;
    actions?: (refund: StatementRefund) => ReactNode;
}) {
    return (
        <Block title="Estornos" level={level}>
            <EntryList
                items={refunds}
                getKey={(refund) => refund.id}
                caption="Estornos da fatura"
                columns={
                    actions
                        ? [...REFUND_COLUMNS, { header: 'Ações', cell: actions, align: 'end' }]
                        : REFUND_COLUMNS
                }
                renderCard={(refund) => (
                    <div className="flex flex-col gap-3">
                        <CardLine
                            title={refund.description}
                            support={formatDate(refund.occurredOn, 'curta')}
                            value={<RefundAmount cents={refund.amountCents} />}
                        />
                        {actions?.(refund)}
                    </div>
                )}
                empty={<NoneText>Nenhum estorno nesta fatura.</NoneText>}
            />
        </Block>
    );
}

/** **Pagamentos** da fatura, com a conta pelo nome e, com `action`, o **Desfazer** do último. */
export function StatementPayments({
    payments,
    level,
    action,
}: {
    payments: readonly StatementPayment[];
    level: HeadingLevel;
    action?: (payment: StatementPayment) => ReactNode;
}) {
    const accounts = useAccountLookup();
    const columns: readonly EntryColumn<StatementPayment>[] = [
        { header: 'Data', cell: (payment) => formatDate(payment.paidOn, 'curta') },
        { header: 'Conta', cell: (payment) => accounts.label(payment.bankAccountId) },
        { header: 'Valor', cell: (payment) => <Money cents={payment.amountCents} />, align: 'end' },
        ...(action ? [{ header: 'Ações', cell: action, align: 'end' as const }] : []),
    ];
    return (
        <Block title="Pagamentos" level={level}>
            <EntryList
                items={payments}
                getKey={(payment) => payment.id}
                caption="Pagamentos da fatura"
                columns={columns}
                renderCard={(payment) => (
                    <div className="flex flex-col gap-3">
                        <CardLine
                            title={accounts.label(payment.bankAccountId)}
                            support={formatDate(payment.paidOn, 'curta')}
                            value={<Money cents={payment.amountCents} />}
                        />
                        {action?.(payment)}
                    </div>
                )}
                empty={<NoneText>Nenhum pagamento nesta fatura.</NoneText>}
            />
        </Block>
    );
}

/**
 * O corpo de uma fatura com o detalhe: valores, por tipo, despesas, estornos e pagamentos. Na
 * fatura atual, o painel; na persistida, a página de detalhe.
 */
export function StatementBody({
    statement,
    level,
    className,
    refundActions,
    paymentAction,
}: {
    statement: Statement;
    level: HeadingLevel;
    className?: string;
    /** **Editar** e **Excluir** de cada estorno (T-0013-03). */
    refundActions?: (refund: StatementRefund) => ReactNode;
    paymentAction?: (payment: StatementPayment) => ReactNode;
}) {
    return (
        <div className={clsx('flex flex-col gap-6', className)}>
            <div className="rounded-md border border-linha bg-superficie px-4 py-1.5 md:px-6">
                <StatementValues statement={statement} />
            </div>
            <StatementByType statement={statement} level={level} />
            <StatementExpenses expenses={statement.expenses ?? []} level={level} />
            <StatementRefunds
                refunds={statement.refunds ?? []}
                level={level}
                actions={refundActions}
            />
            <StatementPayments
                payments={statement.payments ?? []}
                level={level}
                action={paymentAction}
            />
        </div>
    );
}
