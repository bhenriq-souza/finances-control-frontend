import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS,
    EARNING_TYPES,
    OCTOBER_EARNINGS,
    PROJECT_INSTALLMENT,
    ROOM_RENT,
    SALARY,
} from './fixtures/data/earnings';
import { stubRuntime } from './fixtures/runtime-config';

// Ações de status e exclusão do detalhe de receita (spec 0014): AC-0014-05, AC-0014-06 (nas
// ações), AC-0014-07 (detalhe), INV-0014-02 e INV-0014-03.

/** "Hoje" dos testes, para a data padrão de **Receber**. */
const TODAY = '2026-10-12';

const STATUS_CONFLICT = {
    error: { code: 'EARNING_ALREADY_RECEIVED', message: 'Earning already received' },
};

async function openDetail(
    page: Page,
    earning: { id: string; description: string },
    {
        user = 'ativo',
        query = '',
        routes = [],
    }: {
        user?: E2EUser;
        query?: string;
        routes?: StubRoute[];
    } = {},
): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`));
    await stubRuntime(page);
    const stub = await stubApi(page, [
        ...routes,
        { method: 'GET', path: '/earnings', body: { data: OCTOBER_EARNINGS } },
        ...OCTOBER_EARNINGS.map((item): StubRoute => ({
            method: 'GET',
            path: `/earnings/${item.id}`,
            body: { data: item },
        })),
        { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
        { method: 'GET', path: '/earning-types', body: { data: EARNING_TYPES } },
    ]);
    await chooseUser(page, user);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(`/receitas/${earning.id}${query}`)}`);
    await signInWithEmail(page);
    await expect(
        page.getByRole('heading', { name: earning.description, level: 1, includeHidden: true }),
    ).toBeAttached();
    return stub;
}

function statusRequests(stub: ApiStub, id: string) {
    return stub.requests.filter((r) => r.method === 'PATCH' && r.path === `/earnings/${id}/status`);
}

function actionNames(page: Page) {
    return page.getByRole('group', { name: 'Ações' }).getByRole('button');
}

/** Abaixo de `md` (o projeto `celular`), o detalhe mostra só a primeira ação e **Mais ações**. */
function isNarrow(page: Page) {
    return (page.viewportSize()?.width ?? 1440) < 768;
}

/** As ações oferecidas: todas lado a lado, ou, no celular, a primeira e Mais ações (AC-0014-13). */
async function expectActions(page: Page, names: string[]) {
    const [first] = names;
    await expect(actionNames(page)).toHaveText(
        isNarrow(page) ? [first ?? '', 'Mais ações'] : names,
    );
}

/** Aciona uma ação, pelo menu **Mais ações** no celular quando não é a primeira. */
async function chooseAction(page: Page, name: string, { first = false } = {}) {
    if (isNarrow(page) && !first) {
        await page.getByRole('button', { name: 'Mais ações' }).click();
        await page.getByRole('menuitem', { name }).click();
    } else {
        await page.getByRole('button', { name }).click();
    }
}

// AC-0014-05 e INV-0014-02: Receber com a data padrão envia `{ status: 'RECEIVED', receivedOn }`.
test('Receber sends RECEIVED with today as receivedOn', async ({ page }) => {
    const stub = await openDetail(page, PROJECT_INSTALLMENT, {
        routes: [
            {
                method: 'PATCH',
                path: `/earnings/${PROJECT_INSTALLMENT.id}/status`,
                body: { data: { ...PROJECT_INSTALLMENT, status: 'RECEIVED', receivedOn: TODAY } },
            },
        ],
    });

    await expectActions(page, ['Receber', 'Marcar para verificar', 'Excluir']);
    await page.getByRole('button', { name: 'Receber' }).click();
    await expect(page).toHaveURL(/receber=1/);

    const dialog = page.getByRole('dialog', { name: 'Receber receita' });
    await expect(dialog.getByLabel('Recebida em')).toHaveValue('12/10/2026');
    await dialog.getByRole('button', { name: 'Receber' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Receita recebida.')).toBeVisible();
    expect(statusRequests(stub, PROJECT_INSTALLMENT.id).map((r) => r.body)).toEqual([
        { status: 'RECEIVED', receivedOn: TODAY },
    ]);
    await expect(page).not.toHaveURL(/receber=1/);
});

// AC-0014-05 e INV-0014-02: Desfazer recebimento pede confirmação e envia `{ status: 'OPEN' }`.
test('Desfazer recebimento asks first and sends OPEN', async ({ page }) => {
    const stub = await openDetail(page, SALARY, {
        routes: [
            {
                method: 'PATCH',
                path: `/earnings/${SALARY.id}/status`,
                body: { data: { ...SALARY, status: 'OPEN', receivedOn: null } },
            },
        ],
    });

    await expectActions(page, ['Desfazer recebimento']);
    await page.getByRole('button', { name: 'Desfazer recebimento' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Desfazer recebimento?' });
    await expect(dialog).toContainText('O valor sai do saldo da conta.');
    expect(statusRequests(stub, SALARY.id)).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Desfazer recebimento' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Recebimento desfeito.')).toBeVisible();
    expect(statusRequests(stub, SALARY.id).map((r) => r.body)).toEqual([{ status: 'OPEN' }]);
});

// INV-0014-02: previsto só confirma; Confirmar envia só `{ status: 'OPEN' }`.
test('a forecast earning offers Confirmar, which sends only the status', async ({ page }) => {
    const stub = await openDetail(page, ROOM_RENT, {
        routes: [
            {
                method: 'PATCH',
                path: `/earnings/${ROOM_RENT.id}/status`,
                body: { data: { ...ROOM_RENT, status: 'OPEN' } },
            },
        ],
    });

    await expectActions(page, ['Confirmar', 'Excluir']);
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Receita confirmada.')).toBeVisible();
    expect(statusRequests(stub, ROOM_RENT.id).map((r) => r.body)).toEqual([{ status: 'OPEN' }]);
});

// AC-0014-06 (nas ações): `409 EARNING_ALREADY_RECEIVED` mostra o catálogo e recarrega o detalhe.
test('EARNING_ALREADY_RECEIVED shows the catalog message and reloads the detail', async ({
    page,
}) => {
    const stub = await openDetail(page, PROJECT_INSTALLMENT, {
        query: '?receber=1',
        routes: [
            {
                method: 'PATCH',
                path: `/earnings/${PROJECT_INSTALLMENT.id}/status`,
                status: 409,
                body: STATUS_CONFLICT,
            },
        ],
    });
    const detailReads = () =>
        stub.requests.filter(
            (r) => r.method === 'GET' && r.path === `/earnings/${PROJECT_INSTALLMENT.id}`,
        ).length;

    const dialog = page.getByRole('dialog', { name: 'Receber receita' });
    await expect(dialog).toBeVisible();
    const before = detailReads();
    await dialog.getByRole('button', { name: 'Receber' }).click();

    // Alerta no diálogo, que continua aberto enquanto o detalhe é recarregado (spec 0014).
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('Essa receita já foi recebida');
    await expect(alert).not.toContainText('Earning already received');
    await expect.poll(detailReads).toBeGreaterThan(before);
    await expect(dialog).toBeVisible();
});

// INV-0014-03: a exclusão de uma parcela mostra a cascata antes de enviar e volta para a lista.
test('Excluir shows the installment cascade before deleting and goes back to the list', async ({
    page,
}) => {
    const stub = await openDetail(page, PROJECT_INSTALLMENT, {
        routes: [{ method: 'DELETE', path: `/earnings/${PROJECT_INSTALLMENT.id}` }],
    });
    const deletes = () => stub.requests.filter((r) => r.method === 'DELETE');

    await chooseAction(page, 'Excluir');
    await expect(page).toHaveURL(/excluir=1/);
    const dialog = page.getByRole('alertdialog', { name: 'Excluir receita?' });
    await expect(dialog).toContainText(
        'Todas as parcelas não recebidas deste parcelamento serão excluídas.',
    );
    expect(deletes()).toHaveLength(0);

    await dialog.getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByRole('heading', { name: 'Receitas', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/receitas$/);
    await expect(page.getByText('Receita excluída.')).toBeVisible();
    expect(deletes().map((r) => r.path)).toEqual([`/earnings/${PROJECT_INSTALLMENT.id}`]);
});

// INV-0014-03: a ocorrência de série avisa que a série termina; `?excluir=1` abre o diálogo.
test('?excluir=1 opens the series cascade, and Cancelar sends nothing', async ({ page }) => {
    const series = { ...ROOM_RENT, recurrenceId: '60000000-0000-4000-8000-000000000002' };
    const stub = await openDetail(page, series, {
        query: '?excluir=1',
        routes: [{ method: 'GET', path: `/earnings/${series.id}`, body: { data: series } }],
    });

    const dialog = page.getByRole('alertdialog', { name: 'Excluir receita?' });
    await expect(dialog).toContainText(
        'Esta ocorrência e as seguintes ainda não recebidas serão excluídas, e a série termina.',
    );
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/excluir=1/);
    expect(stub.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
});

// AC-0014-07 (detalhe): com leitor, nenhuma ação de escrita e `?receber=1`/`?excluir=1` não abrem.
test('a viewer sees no action and ?receber=1 or ?excluir=1 opens no dialog', async ({ page }) => {
    await openDetail(page, PROJECT_INSTALLMENT, { user: 'leitor', query: '?receber=1&excluir=1' });

    await expect(page.getByText('+R$ 1.500,00')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Ações' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Receber|Excluir|verificar/ })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

// AC-0014-05 com lançador: a permissão `entries.write` vale também para `BILLER`.
test('a biller opens Receber from ?receber=1', async ({ page }) => {
    await openDetail(page, PROJECT_INSTALLMENT, { user: 'lancador', query: '?receber=1' });
    await expect(page.getByRole('dialog', { name: 'Receber receita' })).toBeVisible();
});

// AC-0014-13: no celular, Receber em largura total, as demais ações em Mais ações e sem Alterar no
// cabeçalho; nos outros tamanhos, todas lado a lado, com Alterar.
test('on a phone the first action is full width and the rest are under Mais ações', async ({
    page,
}) => {
    const open = { ...ROOM_RENT, status: 'OPEN' as const };
    await openDetail(page, open, {
        routes: [{ method: 'GET', path: `/earnings/${open.id}`, body: { data: open } }],
    });

    await expectActions(page, ['Receber', 'Marcar para verificar', 'Excluir']);
    const edit = page.getByRole('button', { name: 'Alterar' });
    if (!isNarrow(page)) {
        await expect(edit).toBeVisible();
        return;
    }
    await expect(edit).toHaveCount(0);

    const group = await page.getByRole('group', { name: 'Ações' }).boundingBox();
    const receive = await page.getByRole('button', { name: 'Receber' }).boundingBox();
    expect(receive?.width).toBeCloseTo(group?.width ?? 0, 0);

    await page.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem')).toHaveText([
        'Marcar para verificar',
        'Editar',
        'Excluir',
    ]);
});
