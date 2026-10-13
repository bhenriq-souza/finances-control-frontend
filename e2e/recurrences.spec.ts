import { expect, test, type Page } from '@playwright/test';

import type { components } from '../src/api/generated/schema';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS as EARNING_ACCOUNTS,
    CHECKING_ACCOUNT,
    EARNING_TYPES,
    OCTOBER_EARNINGS,
    SALARY,
    SALARY_TYPE,
} from './fixtures/data/earnings';
import {
    ACCOUNT_ID,
    BANK_ACCOUNTS as EXPENSE_ACCOUNTS,
    CARD_ID,
    CREDIT_CARDS,
    EXPENSE_TYPES,
    EXPENSES_TODAY,
    OCTOBER_EXPENSES,
} from './fixtures/data/expenses';
import { stubRuntime } from './fixtures/runtime-config';

// Séries fixas de despesas e receitas (spec 0017), com a API simulada. "Hoje" é 2026-10-20.

type ExpenseRecurrence = components['schemas']['RecurrenceResponse'];
type EarningRecurrence = components['schemas']['EarningRecurrenceResponse'];

const CREATED = '2026-08-01T12:00:00Z';
const [MORADIA, , SAUDE] = EXPENSE_TYPES;
const RENT = OCTOBER_EXPENSES.find(({ description }) => description === 'Aluguel')!;

/** A série do Aluguel: o `recurrenceId` da despesa de outubro dos dados de despesas. */
const RENT_SERIES: ExpenseRecurrence = {
    id: RENT.recurrenceId!,
    description: 'Aluguel',
    typeId: MORADIA!.id,
    amountCents: 180000,
    dayOfMonth: 5,
    bankAccountId: ACCOUNT_ID,
    creditCardId: null,
    startsOn: '2026-08-05',
    endsOn: null,
    nextOccurrenceOn: '2026-11-05',
    createdAt: CREATED,
    updatedAt: CREATED,
};

const GYM_SERIES: ExpenseRecurrence = {
    id: '70000000-0000-4000-8000-000000000002',
    description: 'Academia',
    typeId: SAUDE!.id,
    amountCents: 12990,
    dayOfMonth: 12,
    bankAccountId: null,
    creditCardId: CARD_ID,
    startsOn: '2026-06-12',
    endsOn: '2026-12-31',
    nextOccurrenceOn: '2026-11-12',
    createdAt: CREATED,
    updatedAt: CREATED,
};

/** A série do salário: o `recurrenceId` da receita de outubro dos dados de receitas. */
const SALARY_SERIES: EarningRecurrence = {
    id: SALARY.recurrenceId!,
    description: 'Salário mensal',
    typeId: SALARY_TYPE.id,
    amountCents: 500000,
    dayOfMonth: 5,
    bankAccountId: CHECKING_ACCOUNT.id,
    startsOn: '2026-01-05',
    endsOn: null,
    nextOccurrenceOn: '2026-11-05',
    createdAt: CREATED,
    updatedAt: CREATED,
};

const ROUTES: StubRoute[] = [
    {
        method: 'GET',
        path: '/bank-accounts',
        body: { data: [...EXPENSE_ACCOUNTS, ...EARNING_ACCOUNTS] },
    },
    { method: 'GET', path: '/credit-cards', body: { data: CREDIT_CARDS } },
    { method: 'GET', path: '/expense-types', body: { data: EXPENSE_TYPES } },
    { method: 'GET', path: '/earning-types', body: { data: EARNING_TYPES } },
    { method: 'GET', path: '/expense-recurrences', body: { data: [RENT_SERIES, GYM_SERIES] } },
    { method: 'GET', path: `/expense-recurrences/${RENT_SERIES.id}`, body: { data: RENT_SERIES } },
    { method: 'GET', path: '/earning-recurrences', body: { data: [SALARY_SERIES] } },
    {
        method: 'GET',
        path: `/earning-recurrences/${SALARY_SERIES.id}`,
        body: { data: SALARY_SERIES },
    },
    // O período devolve lançamentos de outras séries e avulsos: o detalhe filtra no cliente.
    { method: 'GET', path: '/expenses', body: { data: OCTOBER_EXPENSES } },
    { method: 'GET', path: `/expenses/${RENT.id}`, body: { data: RENT } },
    { method: 'GET', path: '/earnings', body: { data: OCTOBER_EARNINGS } },
    { method: 'GET', path: `/earnings/${SALARY.id}`, body: { data: SALARY } },
    {
        method: 'PATCH',
        path: `/expense-recurrences/${RENT_SERIES.id}`,
        body: { data: { ...RENT_SERIES, endsOn: '2026-10-31', nextOccurrenceOn: null } },
    },
];

/** Entra como `user` e abre `path` (pelo `redirect` do `/entrar`). */
async function open(page: Page, path: string, user: E2EUser = 'ativo'): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(EXPENSES_TODAY));
    await stubRuntime(page);
    const api = await stubApi(page, ROUTES);
    await chooseUser(page, user);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return api;
}

/** O conteúdo visível de uma `EntryList`: cartões no celular, a tabela a partir do tablet. */
function entries(page: Page, projectName: string, name: string) {
    return projectName === 'celular'
        ? page.getByRole('list', { name })
        : page.getByRole('table', { name });
}

const calls = (api: ApiStub, path: string) =>
    api.requests.filter((request) => request.method === 'GET' && request.path === path);

// AC-0017-01, AC-0017-05 (a lista segue o `EntryList` nos três projetos).
test('lists the active expense series by default and the earning series in the other tab', async ({
    page,
}, testInfo) => {
    const api = await open(page, '/series');

    await expect(page.getByRole('heading', { name: 'Séries fixas', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Despesas' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    const expenses = entries(page, testInfo.project.name, 'Séries de despesas');
    await expect(expenses).toBeVisible();
    await expect(expenses.getByText('Aluguel')).toBeVisible();
    // O tipo vem de `useExpenseTypes` pelo `typeId`.
    await expect(expenses.getByText('Moradia')).toBeVisible();
    await expect(expenses.getByText('Academia')).toBeVisible();
    await expect(expenses.getByText('Saúde')).toBeVisible();
    await expect(expenses.getByText('Nubank')).toBeVisible();
    await expect(expenses.getByText('−R$ 1.800,00')).toBeVisible();
    expect(calls(api, '/expense-recurrences')[0]?.query).toEqual({ active: 'true' });

    await page.getByRole('tab', { name: 'Receitas' }).click();
    await expect(page).toHaveURL(/aba=receitas/);
    const earnings = entries(page, testInfo.project.name, 'Séries de receitas');
    await expect(earnings.getByText('Salário mensal')).toBeVisible();
    await expect(earnings.getByText('Salário', { exact: true })).toBeVisible();
    await expect(earnings.getByText('+R$ 5.000,00')).toBeVisible();
    expect(calls(api, '/earning-recurrences')[0]?.query).toEqual({ active: 'true' });

    // **Mostrar encerradas**: a lista vem sem `active`.
    await page.getByLabel('Mostrar encerradas').check();
    await expect(page).toHaveURL(/encerradas=1/);
    await expect.poll(() => calls(api, '/earning-recurrences').at(-1)?.query).toEqual({});

    await earnings.getByRole('link', { name: /Salário mensal/ }).click();
    await expect(page).toHaveURL(`/series/receitas/${SALARY_SERIES.id}`);
    await expect(page.getByRole('heading', { name: 'Salário mensal', level: 1 })).toBeVisible();
});

// AC-0017-02 no detalhe, com o stub devolvendo outras despesas no período.
test('the series detail lists only its own occurrences', async ({ page }, testInfo) => {
    const api = await open(page, `/series/despesas/${RENT_SERIES.id}`);

    await expect(page.getByRole('heading', { name: 'Aluguel', level: 1 })).toBeVisible();
    const occurrences = entries(page, testInfo.project.name, 'Ocorrências da série');
    await expect(occurrences.getByRole('link')).toHaveCount(1);
    await expect(occurrences.getByRole('link')).toHaveAttribute('href', `/despesas/${RENT.id}`);
    await expect(occurrences.getByText('Pago')).toBeVisible();
    expect(calls(api, '/expenses')[0]?.query).toEqual({ from: '2026-08-05', to: '2027-10-31' });
});

// AC-0017-03, INV-0017-01, INV-0017-02.
test('ends a series showing the effect first and sending only { endsOn }', async ({ page }) => {
    const api = await open(page, `/series/despesas/${RENT_SERIES.id}`);

    await page.getByRole('button', { name: 'Encerrar série' }).click();
    await expect(page).toHaveURL(/encerrar=1/);
    const dialog = page.getByRole('dialog', { name: 'Encerrar a série?' });
    await expect(
        dialog.getByText(
            'As ocorrências previstas depois desta data serão excluídas. As já confirmadas, pagas ou recebidas ficam.',
        ),
    ).toBeVisible();
    await expect(dialog.getByLabel('Último mês')).toHaveValue('31/10/2026');
    expect(api.requests.some((request) => request.method === 'PATCH')).toBe(false);

    await dialog.getByRole('button', { name: 'Encerrar série' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Série encerrada.')).toBeVisible();
    const patches = api.requests.filter((request) => request.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0]?.path).toBe(`/expense-recurrences/${RENT_SERIES.id}`);
    expect(patches[0]?.body).toEqual({ endsOn: '2026-10-31' });
});

// AC-0017-05: com `leitor`, **Encerrar série** não aparece, nem pela URL.
test('a leitor sees the series but not Encerrar série', async ({ page }) => {
    await open(page, `/series/despesas/${RENT_SERIES.id}?encerrar=1`, 'leitor');

    await expect(page.getByRole('heading', { name: 'Aluguel', level: 1 })).toBeVisible();
    await expect(page.getByText('Todo dia 5')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Encerrar série' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

// AC-0017-04: **Ver série** no detalhe de uma despesa e no de uma receita de série.
test('the expense detail of a series occurrence links to its series', async ({ page }) => {
    await open(page, `/despesas/${RENT.id}`);

    const link = page.getByRole('link', { name: 'Ver série' });
    await expect(link).toHaveAttribute('href', `/series/despesas/${RENT_SERIES.id}`);
    await link.click();
    await expect(page).toHaveURL(`/series/despesas/${RENT_SERIES.id}`);
    await expect(page.getByRole('heading', { name: 'Aluguel', level: 1 })).toBeVisible();
});

test('the earning detail of a series occurrence links to its series', async ({ page }) => {
    await open(page, `/receitas/${SALARY.id}`);

    const link = page.getByRole('link', { name: 'Ver série' });
    await expect(link).toHaveAttribute('href', `/series/receitas/${SALARY_SERIES.id}`);
    await link.click();
    await expect(page.getByRole('heading', { name: 'Salário mensal', level: 1 })).toBeVisible();
});

// Spec 0017, "Rotas e navegação": **Séries fixas** para todo perfil (no celular e no tablet, em Mais).
test('Séries fixas is in the navigation for a leitor', async ({ page }, testInfo) => {
    const desktop = testInfo.project.name === 'desktop';
    await open(page, desktop ? '/series' : '/mais', 'leitor');
    const nav = page.getByRole('navigation', { name: desktop ? 'Principal' : 'Mais' });
    await expect(nav.getByRole('link', { name: 'Séries fixas' })).toHaveAttribute(
        'href',
        '/series',
    );
});
