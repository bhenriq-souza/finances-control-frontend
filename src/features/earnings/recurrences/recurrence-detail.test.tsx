import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import type { Profile } from '@/api/queries/current-user';

import type { EarningRecurrence } from './api';
import { EarningRecurrenceDetailPage } from './earning-recurrence-detail';
import { END_EFFECT_TEXT } from './recurrence-model';
import type { EarningRecurrenceSearch } from './search';
import {
    fail,
    occurrence,
    ok,
    OTHER_SERIES_ID,
    recurrence,
    renderWithSearch,
    SERIES_ID,
} from './test-utils';

// AC-0017-02 e INV-0017-03 (receitas): o detalhe lista só as ocorrências com o `recurrenceId` da
// série; AC-0017-03 e INV-0017-01/02 no encerrar da série de receita.

const SEPTEMBER = occurrence({
    id: 'e0000000-0000-4000-8000-000000000001',
    status: 'RECEIVED',
    occurredOn: '2026-09-05',
    receivedOn: '2026-09-05',
});
const OCTOBER = occurrence({ id: 'e0000000-0000-4000-8000-000000000002', status: 'OPEN' });
const OTHER_SERIES = occurrence({
    id: 'e0000000-0000-4000-8000-000000000003',
    description: 'Aluguel da sala',
    occurredOn: '2026-10-08',
    recurrenceId: OTHER_SERIES_ID,
});
const VARIABLE = occurrence({
    id: 'e0000000-0000-4000-8000-000000000004',
    description: 'Freela',
    kind: 'VARIABLE',
    occurredOn: '2026-10-09',
    recurrenceId: null,
});

const PERIOD = [OCTOBER, OTHER_SERIES, VARIABLE, SEPTEMBER];

async function renderDetail(
    data: EarningRecurrence,
    {
        search = {},
        profile = 'ADMIN',
        earnings = ok(PERIOD),
    }: { search?: EarningRecurrenceSearch; profile?: Profile; earnings?: unknown } = {},
) {
    mocks.GET.mockImplementation(async (path: string) =>
        path === '/earning-recurrences/{id}' ? ok(data) : earnings,
    );
    await renderWithSearch(
        search,
        (current, onSearchChange) => (
            <EarningRecurrenceDetailPage
                recurrenceId={data.id}
                search={current}
                onSearchChange={onSearchChange}
            />
        ),
        { profile },
    );
    // Texto e não papel: um diálogo aberto pelos parâmetros esconde o resto da árvore de acessibilidade.
    await screen.findAllByText(data.description);
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-13T15:00:00Z'), toFake: ['Date'] });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('EarningRecurrenceDetailPage (spec 0017)', () => {
    it('shows the series with the type name found by typeId and a positive amount', async () => {
        await renderDetail(recurrence());

        expect(screen.getByText('Salário', { selector: 'dd' })).toBeInTheDocument();
        expect(screen.getByText('Todo dia 5')).toBeInTheDocument();
        expect(screen.getByText('Conta corrente')).toBeInTheDocument();
        expect(screen.getByText('Sem fim')).toBeInTheDocument();
        expect(screen.getAllByText('+R$ 5.000,00').length).toBeGreaterThan(0);
    });

    // AC-0017-02, INV-0017-03.
    it('lists only the occurrences with its recurrenceId, by date, linking to each one', async () => {
        await renderDetail(recurrence());

        const table = await screen.findByRole('table', { name: 'Ocorrências da série' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual([
            '5 de set. de 2026',
            '5 de out. de 2026',
        ]);
        expect(within(table).queryByText('Aluguel da sala')).not.toBeInTheDocument();
        expect(within(table).queryByText('Freela')).not.toBeInTheDocument();
        expect(within(table).getByRole('link', { name: '5 de out. de 2026' })).toHaveAttribute(
            'href',
            `/receitas/${OCTOBER.id}`,
        );
        expect(mocks.GET).toHaveBeenCalledWith('/earnings', {
            params: { query: { from: '2026-08-05', to: '2027-10-31' } },
        });
    });

    it('shows the not-found state for EARNING_RECURRENCE_NOT_FOUND', async () => {
        mocks.GET.mockResolvedValue(fail(404, 'EARNING_RECURRENCE_NOT_FOUND'));
        await renderWithSearch({}, (current, onSearchChange) => (
            <EarningRecurrenceDetailPage
                recurrenceId={SERIES_ID}
                search={current}
                onSearchChange={onSearchChange}
            />
        ));
        expect(await screen.findByText('Não encontramos este item.')).toBeInTheDocument();
    });

    it('shows the error state when the occurrences fail', async () => {
        await renderDetail(recurrence(), { earnings: fail(500, 'INTERNAL_ERROR') });
        expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
    });

    // AC-0017-05.
    it('hides Encerrar série from a VIEWER, even with ?encerrar=1', async () => {
        await renderDetail(recurrence(), { search: { encerrar: 1 }, profile: 'VIEWER' });
        expect(screen.queryByRole('button', { name: 'Encerrar série' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0017-03, INV-0017-01, INV-0017-02.
    it('ends the series showing the effect first and sending only { endsOn }', async () => {
        mocks.PATCH.mockResolvedValue(ok({ ...recurrence(), endsOn: '2026-10-31' }));
        await renderDetail(recurrence());

        fireEvent.click(screen.getByRole('button', { name: 'Encerrar série' }));
        const dialog = await screen.findByRole('dialog', { name: 'Encerrar a série?' });
        expect(within(dialog).getByText(END_EFFECT_TEXT)).toBeInTheDocument();
        expect(within(dialog).getByLabelText('Último mês')).toHaveValue('31/10/2026');

        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar série' }));
        });
        expect(mocks.PATCH).toHaveBeenCalledWith('/earning-recurrences/{id}', {
            params: { path: { id: SERIES_ID } },
            body: { endsOn: '2026-10-31' },
        });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    // ERR-0017-01: alerta dentro do diálogo, que continua aberto.
    it('keeps the dialog open with an alert on EARNING_RECURRENCE_NOT_FOUND', async () => {
        mocks.PATCH.mockResolvedValue(fail(404, 'EARNING_RECURRENCE_NOT_FOUND'));
        await renderDetail(recurrence(), { search: { encerrar: 1 } });

        const dialog = await screen.findByRole('dialog', { name: 'Encerrar a série?' });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar série' }));
        });
        expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Encerrar a série?' })).toBeInTheDocument();
    });
});
