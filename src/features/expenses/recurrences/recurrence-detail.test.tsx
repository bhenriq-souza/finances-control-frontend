import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import type { Profile } from '@/api/queries/current-user';

import type { ExpenseRecurrence } from './api';
import { ExpenseRecurrenceDetailPage } from './expense-recurrence-detail';
import type { ExpenseRecurrenceSearch } from './search';
import {
    CARD_ID,
    fail,
    occurrence,
    ok,
    OTHER_SERIES_ID,
    recurrence,
    renderWithSearch,
    SERIES_ID,
} from './test-utils';

// AC-0017-02 e INV-0017-03: o detalhe lista só as ocorrências com o `recurrenceId` da série.

const SEPTEMBER = occurrence({
    id: 'e0000000-0000-4000-8000-000000000001',
    status: 'PAID',
    occurredOn: '2026-09-05',
    paidOn: '2026-09-05',
});
const OCTOBER = occurrence({ id: 'e0000000-0000-4000-8000-000000000002', status: 'OPEN' });
const NOVEMBER = occurrence({
    id: 'e0000000-0000-4000-8000-000000000003',
    occurredOn: '2026-11-05',
});
const OTHER_SERIES = occurrence({
    id: 'e0000000-0000-4000-8000-000000000004',
    description: 'Condomínio',
    occurredOn: '2026-10-10',
    recurrenceId: OTHER_SERIES_ID,
});
const VARIABLE = occurrence({
    id: 'e0000000-0000-4000-8000-000000000005',
    description: 'Mercado',
    kind: 'VARIABLE',
    occurredOn: '2026-10-12',
    recurrenceId: null,
});

/** A API devolve tudo do período, fora de ordem e de outras séries. */
const PERIOD = [NOVEMBER, OTHER_SERIES, SEPTEMBER, VARIABLE, OCTOBER];

function respond(series: unknown, expenses: unknown = ok(PERIOD)) {
    mocks.GET.mockImplementation(async (path: string) =>
        path === '/expense-recurrences/{id}' ? series : expenses,
    );
}

async function renderDetail(
    data: ExpenseRecurrence,
    search: ExpenseRecurrenceSearch = {},
    profile: Profile = 'ADMIN',
    expenses: unknown = ok(PERIOD),
) {
    respond(ok(data), expenses);
    await renderWithSearch(
        search,
        (current, onSearchChange) => (
            <ExpenseRecurrenceDetailPage
                recurrenceId={data.id}
                search={current}
                onSearchChange={onSearchChange}
            />
        ),
        { profile },
    );
    await screen.findByRole('heading', { name: data.description, level: 1 });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-13T15:00:00Z'), toFake: ['Date'] });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ExpenseRecurrenceDetailPage (spec 0017)', () => {
    it('shows the series fields with the type name found by typeId', async () => {
        await renderDetail(recurrence());

        expect(mocks.GET).toHaveBeenCalledWith('/expense-recurrences/{id}', {
            params: { path: { id: SERIES_ID } },
        });
        expect(screen.getByText('Moradia')).toBeInTheDocument();
        expect(screen.getByText('Todo dia 5')).toBeInTheDocument();
        expect(screen.getByText('Conta corrente')).toBeInTheDocument();
        expect(screen.getByText('5 de ago. de 2026')).toBeInTheDocument();
        expect(screen.getByText('5 de nov. de 2026')).toBeInTheDocument();
        expect(screen.getByText('Sem fim')).toBeInTheDocument();
        expect(screen.getAllByText('−R$ 1.800,00').length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: 'Séries fixas' })).toHaveAttribute(
            'href',
            '/series',
        );
    });

    it('labels a card series by the card name', async () => {
        await renderDetail(recurrence({ bankAccountId: null, creditCardId: CARD_ID }));
        expect(screen.getByText('Cartão')).toBeInTheDocument();
        expect(screen.getByText('Nubank')).toBeInTheDocument();
    });

    // AC-0017-02, INV-0017-03.
    it('lists only the occurrences with its recurrenceId, by date, linking to each one', async () => {
        await renderDetail(recurrence());

        const table = await screen.findByRole('table', { name: 'Ocorrências da série' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual([
            '5 de set. de 2026',
            '5 de out. de 2026',
            '5 de nov. de 2026',
        ]);
        expect(within(table).queryByText('Condomínio')).not.toBeInTheDocument();
        expect(within(table).queryByText('Mercado')).not.toBeInTheDocument();
        expect(within(table).getByText('Pago')).toBeInTheDocument();
        expect(within(table).getByRole('link', { name: '5 de out. de 2026' })).toHaveAttribute(
            'href',
            `/despesas/${OCTOBER.id}`,
        );
    });

    it('asks for the series period: startsOn to the end of the 12th month after today', async () => {
        await renderDetail(recurrence());
        await screen.findByRole('table', { name: 'Ocorrências da série' });
        expect(mocks.GET).toHaveBeenCalledWith('/expenses', {
            params: { query: { from: '2026-08-05', to: '2027-10-31' } },
        });
    });

    it('asks up to endsOn when the series has an end', async () => {
        await renderDetail(recurrence({ endsOn: '2026-12-31' }));
        await screen.findByRole('table', { name: 'Ocorrências da série' });
        expect(mocks.GET).toHaveBeenCalledWith('/expenses', {
            params: { query: { from: '2026-08-05', to: '2026-12-31' } },
        });
        expect(screen.getByText('31 de dez. de 2026')).toBeInTheDocument();
    });

    it('shows the empty state when no occurrence belongs to the series', async () => {
        await renderDetail(recurrence(), {}, 'ADMIN', ok([OTHER_SERIES, VARIABLE]));
        expect(await screen.findByText('Nenhuma ocorrência no período.')).toBeInTheDocument();
    });

    // ERR-0017-02 → ERR-0009-02.
    it('shows the not-found state for EXPENSE_RECURRENCE_NOT_FOUND', async () => {
        respond(fail(404, 'EXPENSE_RECURRENCE_NOT_FOUND'));
        await renderWithSearch({}, (current, onSearchChange) => (
            <ExpenseRecurrenceDetailPage
                recurrenceId={SERIES_ID}
                search={current}
                onSearchChange={onSearchChange}
            />
        ));
        expect(await screen.findByText('Não encontramos este item.')).toBeInTheDocument();
    });

    // ERR-0017-02 → ERR-0009-01.
    it('shows the error state when the occurrences fail', async () => {
        await renderDetail(recurrence(), {}, 'ADMIN', fail(500, 'INTERNAL_ERROR'));
        expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    });

    // AC-0017-05: sem `entries.write`, **Encerrar série** não aparece, nem pela URL.
    it('hides Encerrar série from a VIEWER, even with ?encerrar=1', async () => {
        await renderDetail(recurrence(), { encerrar: 1 }, 'VIEWER');
        expect(screen.queryByRole('button', { name: 'Encerrar série' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('hides Encerrar série on a series whose endsOn has passed', async () => {
        await renderDetail(recurrence({ endsOn: '2026-09-30', nextOccurrenceOn: null }));
        expect(screen.queryByRole('button', { name: 'Encerrar série' })).not.toBeInTheDocument();
    });

    it('offers Encerrar série to a BILLER on an active series', async () => {
        await renderDetail(recurrence(), {}, 'BILLER');
        expect(screen.getByRole('button', { name: 'Encerrar série' })).toBeInTheDocument();
    });
});
