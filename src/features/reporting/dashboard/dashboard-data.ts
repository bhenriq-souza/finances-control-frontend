import type { components } from '@/api/generated/schema';
import type { BankAccount, CreditCard } from '@/api/queries/reference';
import { addDays, type IsoDate, type IsoMonth } from '@/shared/dates';
import type { Cents } from '@/shared/money';

// Números do dashboard (spec 0015, "Dashboard"): tudo vem da API em centavos; aqui só se soma,
// subtrai e filtra (INV-0015-02), nunca se divide nem arredonda.

export type Expense = components['schemas']['ExpenseResponse'];
export type Earning = components['schemas']['EarningResponse'];
export type Statement = components['schemas']['StatementResponse'];
export type BalanceReport = components['schemas']['BalanceReport'];
export type ByTypeReport = components['schemas']['ByTypeReport'];

const isActive = (item: { archivedAt: string | null }) => item.archivedAt === null;

/** As contas ativas, na ordem de descrição. */
export function activeAccounts(accounts: readonly BankAccount[]): BankAccount[] {
    return accounts
        .filter(isActive)
        .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'));
}

/** Os cartões ativos, na ordem de nome. */
export function activeCards(cards: readonly CreditCard[]): CreditCard[] {
    return cards.filter(isActive).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Saldo realizado: a soma de `currentBalanceCents` das contas ativas. */
export function realizedBalance(accounts: readonly BankAccount[]): Cents {
    return accounts.filter(isActive).reduce((sum, account) => sum + account.currentBalanceCents, 0);
}

/**
 * O previsto do mês (revisão de 2026-10-15): `accountsTotalCents − cardDueCents` do ponto
 * `FORECAST`, as contas menos as faturas que vencem no mês, o mesmo fim do mês corrente do fluxo
 * de caixa. `null` se a resposta não tiver o ponto.
 */
export function forecastBalance(report: BalanceReport, month: IsoMonth): Cents | null {
    const point = report.points.find((p) => p.month === month && p.kind === 'FORECAST');
    return point ? point.accountsTotalCents - (point.cardDueCents ?? 0) : null;
}

export interface EarningsSummary {
    totalCents: Cents;
    received: number;
    pending: number;
}

/** Receitas do mês, todos os status: o total e as recebidas e pendentes (o resto). */
export function summarizeEarnings(earnings: readonly Earning[]): EarningsSummary {
    const summary: EarningsSummary = { totalCents: 0, received: 0, pending: 0 };
    for (const earning of earnings) {
        summary.totalCents += earning.amountCents;
        if (earning.status === 'RECEIVED') summary.received += 1;
        else summary.pending += 1;
    }
    return summary;
}

export interface ExpensesSummary {
    totalCents: Cents;
    paid: number;
    pending: number;
    overdue: number;
}

/** Despesas do mês, todos os status: o total e as pagas, vencidas e pendentes (o resto). */
export function summarizeExpenses(expenses: readonly Expense[]): ExpensesSummary {
    const summary: ExpensesSummary = { totalCents: 0, paid: 0, pending: 0, overdue: 0 };
    for (const expense of expenses) {
        summary.totalCents += expense.amountCents;
        if (expense.status === 'PAID') summary.paid += 1;
        else if (expense.status === 'OVERDUE') summary.overdue += 1;
        else summary.pending += 1;
    }
    return summary;
}

/** "1 recebida", "2 pendentes": a contagem com a palavra no número certo. */
export function countLabel(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

/** O último dia da janela de "Vence esta semana": `today() + 6`. */
export function weekEnd(today: IsoDate): IsoDate {
    return addDays(today, 6);
}

const DUE_EXPENSE_STATUSES: ReadonlySet<Expense['status']> = new Set([
    'OPEN',
    'OVERDUE',
    'VERIFYING',
]);

/** Fatura fechada ainda a pagar. */
export function isClosedToPay(statement: Statement): boolean {
    return statement.status === 'CLOSED' && statement.remainingCents > 0;
}

export type DueItem =
    | { kind: 'expense'; key: string; dueOn: IsoDate; description: string; expense: Expense }
    | {
          kind: 'statement';
          key: string;
          dueOn: IsoDate;
          description: string;
          statement: Statement & { id: string };
          card: CreditCard;
      };

export interface DueInput {
    /** `GET /expenses?status=OVERDUE`. */
    overdue: readonly Expense[];
    /** `GET /expenses?from=<hoje>&to=<hoje+6>`. */
    week: readonly Expense[];
    /** As faturas de cada cartão ativo (`GET /statements?creditCardId`). */
    statements: readonly { card: CreditCard; statements: readonly Statement[] }[];
    today: IsoDate;
}

/**
 * "Vence esta semana" (spec 0015, regra): as despesas de conta em `OPEN`, `OVERDUE` ou
 * `VERIFYING` das duas consultas, sem repetir id, e as faturas `CLOSED` a pagar com `dueOn` até
 * `today() + 6`; despesa de cartão não entra (quem vence é a fatura). Em ordem de vencimento,
 * depois de descrição.
 */
export function dueThisWeek({ overdue, week, statements, today }: DueInput): DueItem[] {
    const items: DueItem[] = [];
    const seen = new Set<string>();
    for (const expense of [...overdue, ...week]) {
        if (seen.has(expense.id)) continue;
        if (expense.bankAccountId === null || !DUE_EXPENSE_STATUSES.has(expense.status)) continue;
        seen.add(expense.id);
        items.push({
            kind: 'expense',
            key: `expense-${expense.id}`,
            dueOn: expense.occurredOn,
            description: expense.description,
            expense,
        });
    }
    const last = weekEnd(today);
    for (const { card, statements: list } of statements) {
        for (const statement of list) {
            const { id } = statement;
            if (id === null || !isClosedToPay(statement) || statement.dueOn > last) continue;
            items.push({
                kind: 'statement',
                key: `statement-${id}`,
                dueOn: statement.dueOn,
                description: `Fatura ${card.name}`,
                statement: { ...statement, id },
                card,
            });
        }
    }
    return items.sort(
        (a, b) =>
            a.dueOn.localeCompare(b.dueOn) || a.description.localeCompare(b.description, 'pt-BR'),
    );
}

/** O valor da linha: a despesa inteira ou o que falta pagar da fatura. */
export function dueAmount(item: DueItem): Cents {
    return item.kind === 'expense' ? item.expense.amountCents : item.statement.remainingCents;
}

/**
 * O estado da fatura no cartão (tablet e desktop): a fechada a pagar, se houver (**Fechada** ou
 * **Vencida**); senão, nenhuma, e o cartão mostra **Em aberto** com o fechamento do ciclo.
 */
export function closedStatementToPay(statements: readonly Statement[]): Statement | undefined {
    return statements.find(isClosedToPay);
}

export interface TypeTotal {
    key: string;
    label: string;
    cents: Cents;
}

export const OTHERS_LABEL = 'Outros';

/**
 * "Despesas por tipo" do mês: os três maiores de `byType` (a API já ordena) e "Outros" com a
 * soma do resto, quando há resto.
 */
export function topExpenseTypes(report: ByTypeReport, month: IsoMonth): TypeTotal[] {
    const byType = report.months.find((m) => m.month === month)?.byType ?? [];
    const top = byType.slice(0, 3).map((type) => ({
        key: type.typeId,
        label: type.name,
        cents: type.totalCents,
    }));
    const rest = byType.slice(3);
    if (rest.length === 0) return top;
    return [
        ...top,
        {
            key: 'outros',
            label: OTHERS_LABEL,
            cents: rest.reduce((sum, type) => sum + type.totalCents, 0),
        },
    ];
}
