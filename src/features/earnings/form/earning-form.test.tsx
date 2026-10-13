import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useNavigate,
    useParams,
    useSearch,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { EarningDetail } from '../detail/earning-detail';
import type { Earning } from '../list/earning-model';
import { earningDetailSearchSchema, type EarningDetailSearch } from '../list/earning-search';
import {
    CHECKING,
    earning,
    FREELANCE_TYPE,
    OLD_ACCOUNT,
    OLD_TYPE,
    SALARY_TYPE,
    SAVINGS,
} from '../list/test-data';

import { EarningFormDialog, INSTALLMENT_ACCOUNT_NOTE, INSTALLMENT_EDIT_NOTE } from './earning-form';
import { earningFormSchema } from './earning-schema';

const onOpenChange = vi.fn();

function ok(data: unknown, status = 200) {
    return { data: { data }, response: { ok: true, status } };
}

function fail(status: number, code: string, details?: unknown) {
    return {
        error: { error: { code, message: 'raw message', details } },
        response: { ok: false, status },
    };
}

function getByPath(path: string) {
    if (path === '/bank-accounts') return ok([CHECKING, SAVINGS, OLD_ACCOUNT]);
    if (path === '/earning-types') return ok([SALARY_TYPE, FREELANCE_TYPE, OLD_TYPE]);
    if (path === '/earnings/{id}') return ok(INSTALLMENT);
    return fail(404, 'ROUTE_NOT_FOUND');
}

const INSTALLMENT: Earning = earning({
    id: 'r-parcela',
    description: 'Projeto site',
    kind: 'INSTALLMENT',
    status: 'OVERDUE',
    amountCents: 150000,
    occurredOn: '2026-10-08',
    earningType: FREELANCE_TYPE,
    bankAccountId: SAVINGS.id,
    installment: { groupId: 'grupo-1', number: 2, total: 3 },
    notes: 'Segunda parcela',
});

const SERIES: Earning = earning({
    id: 'r-serie',
    description: 'Salário',
    kind: 'FIXED',
    amountCents: 500000,
    occurredOn: '2026-10-05',
    recurrenceId: 'serie-1',
});

async function renderApp(url: string, form: ReactNode, profile: Profile = 'ADMIN') {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [CHECKING, SAVINGS, OLD_ACCOUNT]);
    queryClient.setQueryData(queryKeys.earningTypes.all, [SALARY_TYPE, FREELANCE_TYPE, OLD_TYPE]);

    const root = createRootRoute();
    const formRoute = createRoute({
        getParentRoute: () => root,
        path: '/formulario',
        component: () => form,
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/receitas/$receitaId',
        validateSearch: earningDetailSearchSchema,
        component: function Detail() {
            const { receitaId = '' } = useParams({ strict: false });
            const search: EarningDetailSearch = useSearch({ strict: false });
            const navigate = useNavigate();
            return (
                <EarningDetail
                    earningId={receitaId}
                    search={search}
                    onSearchChange={(next) =>
                        void navigate({
                            to: '/receitas/$receitaId',
                            params: { receitaId },
                            search: { ...search, ...next },
                        })
                    }
                />
            );
        },
    });
    const router = createRouter({
        routeTree: root.addChildren([formRoute, detail]),
        history: createMemoryHistory({ initialEntries: [url] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { router, queryClient };
}

async function renderForm(existing?: Earning) {
    const result = await renderApp(
        '/formulario',
        <EarningFormDialog open onOpenChange={onOpenChange} earning={existing} />,
    );
    return { ...result, dialog: screen.getByRole('dialog') };
}

function fill(dialog: HTMLElement, values: Record<string, string>) {
    for (const [label, value] of Object.entries(values)) {
        fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
}

async function click(element: HTMLElement) {
    await act(async () => {
        fireEvent.click(element);
    });
}

const save = (dialog: HTMLElement) => click(within(dialog).getByRole('button', { name: 'Salvar' }));

const optionsOf = (select: HTMLElement) =>
    within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);

function sentBody(mock: typeof mocks.POST) {
    return (mock.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.GET.mockImplementation(async (path: string) => getByPath(path));
    mocks.POST.mockResolvedValue(ok([earning({ id: 'nova' })], 201));
    mocks.PATCH.mockResolvedValue(ok(INSTALLMENT));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('EarningFormDialog — create (spec 0014)', () => {
    it('creates a variable earning, notifies and goes to its detail', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-12T15:00:00Z'), toFake: ['Date'] });
        const { dialog, router, queryClient } = await renderForm();
        vi.useRealTimers();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

        expect(within(dialog).getByRole('heading', { name: 'Nova receita' })).toBeVisible();
        expect(within(dialog).getByLabelText('Variável')).toBeChecked();
        expect(within(dialog).getByLabelText('Data prevista')).toHaveValue('2026-10-12');
        expect(within(dialog).getByLabelText('Situação inicial')).toHaveValue('OPEN');
        expect(within(dialog).queryByLabelText('Parcelas')).not.toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Repetir até')).not.toBeInTheDocument();
        expect(within(dialog).queryByText(/Fatura/)).not.toBeInTheDocument();
        // Só os tipos e as contas ativos.
        expect(optionsOf(within(dialog).getByLabelText('Tipo'))).toEqual([
            'Escolha o tipo',
            'Freela',
            'Salário',
        ]);
        expect(optionsOf(within(dialog).getByLabelText('Conta'))).toEqual([
            'Escolha a conta',
            'Conta corrente',
            'Poupança',
        ]);

        fill(dialog, {
            Descrição: '  Aluguel da sala  ',
            Tipo: FREELANCE_TYPE.id,
            Valor: '800,50',
            Conta: CHECKING.id,
            'Situação inicial': 'FORECAST',
            Observações: ' Sala 2 ',
        });
        await save(dialog);

        expect(mocks.POST).toHaveBeenCalledWith('/earnings', {
            body: {
                description: 'Aluguel da sala',
                earningTypeId: FREELANCE_TYPE.id,
                kind: 'VARIABLE',
                amountCents: 80050,
                occurredOn: '2026-10-12',
                bankAccountId: CHECKING.id,
                status: 'FORECAST',
                notes: 'Sala 2',
            },
        });
        expect(await screen.findByText('Receita salva.')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/receitas/nova');
        // INV-0009-02: invalidação pela matriz, domínio `earning`.
        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
            ['earnings'],
            ['earning-recurrences'],
            ['bank-accounts'],
            ['reports'],
        ]);
    });

    // AC-0014-03: fixa de 5.000,00 com **Repetir até**.
    it('creates a fixed earning with recurrenceEndsOn', async () => {
        mocks.POST.mockResolvedValue(
            ok([earning({ id: 's1' }), earning({ id: 's2' }), earning({ id: 's3' })], 201),
        );
        const { dialog, router } = await renderForm();

        await click(within(dialog).getByLabelText('Fixa'));
        expect(within(dialog).getByText('Sem data, a série segue mês a mês.')).toBeInTheDocument();
        fill(dialog, {
            Descrição: 'Salário',
            Tipo: SALARY_TYPE.id,
            Valor: '5.000,00',
            Conta: CHECKING.id,
            'Data prevista': '2026-10-05',
            'Repetir até': '2026-12-05',
        });
        await save(dialog);

        expect(sentBody(mocks.POST)).toEqual({
            description: 'Salário',
            earningTypeId: SALARY_TYPE.id,
            kind: 'FIXED',
            amountCents: 500000,
            occurredOn: '2026-10-05',
            bankAccountId: CHECKING.id,
            status: 'OPEN',
            recurrenceEndsOn: '2026-12-05',
        });
        expect(await screen.findByText('3 receitas criadas.')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/receitas/s1');
    });

    it('sends no recurrenceEndsOn for a fixed earning without an end date', async () => {
        const { dialog } = await renderForm();

        await click(within(dialog).getByLabelText('Fixa'));
        fill(dialog, {
            Descrição: 'Salário',
            Tipo: SALARY_TYPE.id,
            Valor: '5.000,00',
            Conta: CHECKING.id,
        });
        await save(dialog);

        expect(sentBody(mocks.POST)).toMatchObject({ kind: 'FIXED', amountCents: 500000 });
        expect(sentBody(mocks.POST)).not.toHaveProperty('recurrenceEndsOn');
        expect(sentBody(mocks.POST)).not.toHaveProperty('installmentTotal');
    });

    it('refuses an end date before the expected date', async () => {
        const { dialog } = await renderForm();

        await click(within(dialog).getByLabelText('Fixa'));
        fill(dialog, {
            Descrição: 'Salário',
            Tipo: SALARY_TYPE.id,
            Valor: '5.000,00',
            Conta: CHECKING.id,
            'Data prevista': '2026-10-05',
            'Repetir até': '2026-10-04',
        });
        await save(dialog);

        expect(
            within(dialog).getByText('A data final não pode ser anterior à data prevista.'),
        ).toBeInTheDocument();
        expect(mocks.POST).not.toHaveBeenCalled();
    });

    it('creates an installment earning with the total and the number of installments', async () => {
        const { dialog } = await renderForm();

        await click(within(dialog).getByLabelText('Parcelada'));
        expect(within(dialog).getByLabelText('Valor total')).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Repetir até')).not.toBeInTheDocument();
        fill(dialog, {
            Descrição: 'Projeto site',
            Tipo: FREELANCE_TYPE.id,
            'Valor total': '4.500,00',
            Conta: SAVINGS.id,
            Parcelas: '1',
        });
        await save(dialog);
        expect(within(dialog).getByText('Informe de 2 a 120 parcelas.')).toBeInTheDocument();
        expect(mocks.POST).not.toHaveBeenCalled();

        fill(dialog, { Parcelas: '3' });
        await save(dialog);
        expect(sentBody(mocks.POST)).toMatchObject({
            kind: 'INSTALLMENT',
            amountCents: 450000,
            installmentTotal: 3,
            bankAccountId: SAVINGS.id,
        });
        expect(sentBody(mocks.POST)).not.toHaveProperty('recurrenceEndsOn');
    });

    it('validates the required fields without sending', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { 'Data prevista': '' });
        await save(dialog);

        for (const message of [
            'Informe a descrição.',
            'Escolha o tipo.',
            'Informe o valor.',
            'Escolha a conta.',
            'Informe a data prevista.',
        ]) {
            expect(within(dialog).getByText(message)).toBeInTheDocument();
        }
        expect(mocks.POST).not.toHaveBeenCalled();
    });

    // ERR-0014-01: erros do mapa nos campos Tipo e Conta, formulário aberto.
    it.each([
        ['EARNING_TYPE_ARCHIVED', 'Tipo'],
        ['EARNING_TYPE_NOT_FOUND', 'Tipo'],
        ['BANK_ACCOUNT_ARCHIVED', 'Conta'],
        ['BANK_ACCOUNT_NOT_FOUND', 'Conta'],
    ])('marks the field for %s', async (code, label) => {
        mocks.POST.mockResolvedValue(fail(code.endsWith('NOT_FOUND') ? 404 : 409, code));
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Bônus',
            Tipo: SALARY_TYPE.id,
            Valor: '10',
            Conta: CHECKING.id,
        });
        await save(dialog);

        expect(within(dialog).getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
        expect(within(dialog).queryByText('raw message')).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Bônus');
    });

    // ERR-0014-03 / ERR-0009-04: `VALIDATION_ERROR` no campo do `path`; o resto no alerta.
    it('maps VALIDATION_ERROR details to the fields', async () => {
        mocks.POST.mockResolvedValue(
            fail(400, 'VALIDATION_ERROR', [{ path: ['amountCents'] }, { path: ['outro'] }]),
        );
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Bônus',
            Tipo: SALARY_TYPE.id,
            Valor: '10',
            Conta: CHECKING.id,
        });
        await save(dialog);

        expect(within(dialog).getByLabelText('Valor')).toHaveAttribute('aria-invalid', 'true');
        expect(within(dialog).getByRole('alert')).not.toHaveTextContent('raw message');
    });
});

describe('EarningFormDialog — edit (spec 0014)', () => {
    // AC-0014-04, INV-0014-03: a nota da cascata aparece antes de enviar; `bankAccountId` vai.
    it('changes the account of an installment showing the cascade note', async () => {
        const { dialog } = await renderForm(INSTALLMENT);

        expect(within(dialog).getByRole('heading', { name: 'Alterar receita' })).toBeVisible();
        expect(within(dialog).getByText(INSTALLMENT_EDIT_NOTE)).toBeInTheDocument();
        expect(within(dialog).getByText(INSTALLMENT_ACCOUNT_NOTE)).toBeInTheDocument();
        expect(within(dialog).getByText('Parcelada · Parcela 2 de 3')).toBeInTheDocument();
        // Natureza, parcelas, série e situação não são editáveis.
        expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Parcelas')).not.toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Situação inicial')).not.toBeInTheDocument();
        expect(within(dialog).getByLabelText('Valor')).toHaveValue('1.500,00');

        fill(dialog, { Conta: CHECKING.id });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/earnings/{id}', {
            params: { path: { id: INSTALLMENT.id } },
            body: { bankAccountId: CHECKING.id },
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(await screen.findByText('Receita salva.')).toBeInTheDocument();
    });

    // INV-0014-04: só os campos alterados, nunca `kind`, `status`, `receivedOn` nem parcela.
    it('sends only the changed fields and never kind, status or installment fields', async () => {
        const { dialog } = await renderForm(INSTALLMENT);

        fill(dialog, {
            Descrição: 'Projeto site — fase 2',
            Tipo: SALARY_TYPE.id,
            Valor: '1.600,00',
            'Data prevista': '2026-10-09',
            Observações: '',
        });
        await save(dialog);

        const body = sentBody(mocks.PATCH);
        expect(body).toEqual({
            description: 'Projeto site — fase 2',
            earningTypeId: SALARY_TYPE.id,
            occurredOn: '2026-10-09',
            amountCents: 160000,
            notes: null,
        });
        for (const key of ['kind', 'status', 'receivedOn', 'installment', 'installmentTotal']) {
            expect(body).not.toHaveProperty(key);
        }
    });

    it('closes without a request when nothing changed', async () => {
        const { dialog } = await renderForm(INSTALLMENT);
        await save(dialog);

        expect(mocks.PATCH).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('keeps an archived current type and account selectable', async () => {
        const { dialog } = await renderForm(
            earning({ id: 'r9', earningType: OLD_TYPE, bankAccountId: OLD_ACCOUNT.id }),
        );

        expect(within(dialog).getByLabelText('Tipo')).toHaveValue(OLD_TYPE.id);
        expect(within(dialog).getByLabelText('Conta')).toHaveValue(OLD_ACCOUNT.id);
    });

    it('asks the scope of a series occurrence and sends ?scope=following', async () => {
        const { dialog } = await renderForm(SERIES);

        expect(within(dialog).getByLabelText('Só esta')).toBeChecked();
        await click(within(dialog).getByLabelText('Esta e as próximas previstas'));
        fill(dialog, { Valor: '5.200,00' });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/earnings/{id}', {
            params: { path: { id: SERIES.id }, query: { scope: 'following' } },
            body: { amountCents: 520000 },
        });
    });

    it('sends no scope for "Só esta" and asks no scope outside a series', async () => {
        const { dialog } = await renderForm(SERIES);
        fill(dialog, { Descrição: 'Salário de outubro' });
        await save(dialog);
        expect(mocks.PATCH.mock.calls[0]?.[1]).toEqual({
            params: { path: { id: SERIES.id } },
            body: { description: 'Salário de outubro' },
        });
    });

    it('does not let the amount of a received earning change', async () => {
        const { dialog } = await renderForm(
            earning({ id: 'r1', status: 'RECEIVED', receivedOn: '2026-10-05' }),
        );

        expect(within(dialog).getByLabelText('Valor')).toBeDisabled();
        expect(within(dialog).queryByLabelText('Só esta')).not.toBeInTheDocument();
    });

    // AC-0014-06: `409 EARNING_ALREADY_RECEIVED` mostra o catálogo e recarrega o detalhe.
    it.each(['EARNING_ALREADY_RECEIVED', 'EARNING_STATUS_TRANSITION_NOT_ALLOWED'])(
        'shows the catalog alert and reloads on %s',
        async (code) => {
            mocks.PATCH.mockResolvedValue(fail(409, code));
            const { dialog, queryClient } = await renderForm(INSTALLMENT);
            const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

            fill(dialog, { Valor: '1.600,00' });
            await save(dialog);

            const alert = within(dialog).getByRole('alert');
            expect(alert).not.toHaveTextContent('raw message');
            expect(alert.textContent).not.toBe('');
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['earnings'] });
            expect(onOpenChange).not.toHaveBeenCalled();
        },
    );

    it('shows EARNING_NOT_FOUND as an alert', async () => {
        mocks.PATCH.mockResolvedValue(fail(404, 'EARNING_NOT_FOUND'));
        const { dialog, queryClient } = await renderForm(INSTALLMENT);
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

        fill(dialog, { Valor: '1.600,00' });
        await save(dialog);

        expect(within(dialog).getByRole('alert')).toHaveTextContent(
            'Não encontramos essa receita.',
        );
        expect(invalidate).not.toHaveBeenCalled();
    });
});

describe('Alterar on the earning detail', () => {
    it('opens the edit form by ?editar=1 with entries.write', async () => {
        const { router } = await renderApp(`/receitas/${INSTALLMENT.id}`, null, 'BILLER');

        await screen.findByRole('heading', { name: 'Projeto site', level: 1 });
        await click(screen.getByRole('button', { name: 'Alterar' }));
        expect(router.state.location.search).toEqual({ editar: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Alterar receita' });
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Projeto site');

        await click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        expect(router.state.location.search).toEqual({});
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0014-07 (detalhe, edição): sem `entries.write`, nada de **Alterar** nem de diálogo.
    it('offers no Alterar and opens no dialog for a viewer', async () => {
        await renderApp(`/receitas/${INSTALLMENT.id}?editar=1`, null, 'VIEWER');

        await screen.findByRole('heading', { name: 'Projeto site', level: 1 });
        expect(screen.queryByRole('button', { name: 'Alterar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('earningFormSchema', () => {
    const valid = {
        kind: 'VARIABLE' as const,
        description: 'Bônus',
        earningTypeId: SALARY_TYPE.id,
        amount: '10,00',
        bankAccountId: CHECKING.id,
        occurredOn: '2026-10-05',
        installmentTotal: '',
        recurrenceEndsOn: '',
        status: 'OPEN' as const,
        notes: '',
        scope: 'one' as const,
    };

    it('limits description and notes to the contract sizes', () => {
        const result = earningFormSchema('create').safeParse({
            ...valid,
            description: 'a'.repeat(201),
            notes: 'b'.repeat(1001),
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.message)).toEqual([
            'Use no máximo 200 caracteres.',
            'Use no máximo 1000 caracteres.',
        ]);
    });

    it('converts the amount to cents and skips create-only checks when editing', () => {
        const result = earningFormSchema('edit').parse({ ...valid, kind: 'INSTALLMENT' });
        expect(result.amount).toBe(1000);
        expect(
            earningFormSchema('create').safeParse({ ...valid, kind: 'INSTALLMENT' }).success,
        ).toBe(false);
    });
});
