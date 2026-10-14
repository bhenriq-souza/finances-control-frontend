import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import {
    EARNING_QUICK_PARAMS,
    useEarningQuickActions,
    type EarningQuickParams,
} from '@/features/earnings';
import {
    EXPENSE_QUICK_PARAMS,
    useExpenseQuickActions,
    type ExpenseQuickParams,
} from '@/features/expenses';
import { CashFlowPage, cashFlowSearchSchema, type CashFlowSearch } from '@/features/reporting';
import { useStatementPayQuickAction, type StatementPayRequest } from '@/features/statements';

/**
 * Fluxo de caixa do mês (spec 0015): `?mes`, `?situacao` e os diálogos das ações,
 * `?acao=<…>&despesa=<id>`, `?acao=<…>&receita=<id>` e `?acao=pagar&fatura=<id>&cartao=<id>`.
 */
export const Route = createFileRoute('/_app/fluxo-de-caixa')({
    validateSearch: cashFlowSearchSchema,
    component: CashFlowRoute,
});

type Target = Pick<CashFlowSearch, 'acao' | 'despesa' | 'receita' | 'fatura' | 'cartao'>;

const NO_TARGET: Record<keyof Target, undefined> = {
    acao: undefined,
    despesa: undefined,
    receita: undefined,
    fatura: undefined,
    cartao: undefined,
};

const isIn = <T extends string>(list: readonly T[], value: string | undefined): value is T =>
    value !== undefined && (list as readonly string[]).includes(value);

/** O primeiro diálogo aberto de um par `{ <ação>: <id> }` das features, ou nenhum. */
function firstOpen(params: Readonly<Record<string, string | undefined>>) {
    const entry = Object.entries(params).find(([, id]) => id !== undefined);
    return entry ? { acao: entry[0], id: entry[1]! } : undefined;
}

/**
 * Os parâmetros de ação da URL, traduzidos para os de cada feature: o par `acao` + alvo só vale
 * inteiro e com uma ação que o alvo tem (`receber` só na receita, `pagar` na fatura só com o
 * cartão). Qualquer outra combinação é inválida e sai da URL.
 */
function targets(search: CashFlowSearch) {
    const { acao, despesa, receita, fatura, cartao } = search;
    const expense: ExpenseQuickParams =
        isIn(EXPENSE_QUICK_PARAMS, acao) && despesa && !receita && !fatura && !cartao
            ? { [acao]: despesa }
            : {};
    const earning: EarningQuickParams =
        isIn(EARNING_QUICK_PARAMS, acao) && receita && !despesa && !fatura && !cartao
            ? { [acao]: receita }
            : {};
    const statement: StatementPayRequest | undefined =
        acao === 'pagar' && fatura && cartao && !despesa && !receita
            ? { statementId: fatura, cardId: cartao }
            : undefined;
    const valid =
        firstOpen(expense) !== undefined ||
        firstOpen(earning) !== undefined ||
        statement !== undefined;
    const present = [acao, despesa, receita, fatura, cartao].some((value) => value !== undefined);
    return { expense, earning, statement, invalid: present && !valid };
}

/**
 * Compõe o fluxo de caixa de `reporting` com as ações das listas de despesas e de receitas e o
 * pagamento do detalhe da fatura, os mesmos diálogos e mutações (INV-0015-06). O mês e o filtro
 * se mantêm enquanto um diálogo abre e fecha.
 */
function CashFlowRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const target = targets(search);

    const setTarget = (next: Target) =>
        void navigate({ search: (prev) => ({ ...prev, ...NO_TARGET, ...next }) });
    const clear = () => setTarget({});

    const expense = useExpenseQuickActions(target.expense, (next) => {
        const open = firstOpen(next);
        if (!open || !isIn(EXPENSE_QUICK_PARAMS, open.acao)) clear();
        else setTarget({ acao: open.acao, despesa: open.id });
    });
    const earning = useEarningQuickActions(target.earning, (next) => {
        const open = firstOpen(next);
        if (!open || !isIn(EARNING_QUICK_PARAMS, open.acao)) clear();
        else setTarget({ acao: open.acao, receita: open.id });
    });
    const statement = useStatementPayQuickAction(target.statement, (next) => {
        if (!next) clear();
        else setTarget({ acao: 'pagar', fatura: next.statementId, cartao: next.cardId });
    });

    // Combinação de parâmetros que nenhuma ação aceita: ignorada e removida da URL.
    useEffect(() => {
        if (target.invalid) {
            void navigate({ search: (prev) => ({ ...prev, ...NO_TARGET }), replace: true });
        }
    }, [target.invalid, navigate]);

    return (
        <CashFlowPage
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
            rowActions={{
                expense: expense.rowMenu,
                earning: earning.rowMenu,
                statement: statement.rowMenu,
            }}
            alerts={
                <>
                    {expense.alert}
                    {earning.alert}
                </>
            }
            dialogs={
                <>
                    {expense.dialogs}
                    {earning.dialogs}
                    {statement.dialogs}
                </>
            }
        />
    );
}
