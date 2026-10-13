import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { ExpenseRecurrences } from './expense-recurrences';
import { CARD_ID, fail, ok, recurrence, renderWithSearch } from './test-utils';

const RENT = recurrence();
const GYM = recurrence({
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    description: 'Academia',
    bankAccountId: null,
    creditCardId: CARD_ID,
    endsOn: '2026-12-31',
    nextOccurrenceOn: null,
});

async function renderList(response: unknown, showEnded = false) {
    mocks.GET.mockResolvedValue(response);
    await renderWithSearch({}, () => <ExpenseRecurrences showEnded={showEnded} />);
}

beforeEach(() => {
    vi.resetAllMocks();
});

// AC-0017-01: a aba de despesas, com o nome do tipo achado pelo `typeId`.
describe('ExpenseRecurrences (spec 0017)', () => {
    it('lists the active series with type, day, account or card, next date, end and amount', async () => {
        await renderList(ok([RENT, GYM]));

        const table = await screen.findByRole('table', { name: 'Séries de despesas' });
        expect(mocks.GET).toHaveBeenCalledWith('/expense-recurrences', {
            params: { query: { active: 'true' } },
        });
        const [rent, gym] = within(table).getAllByRole('row').slice(1);
        expect(within(rent!).getByText('Moradia')).toBeInTheDocument();
        expect(within(rent!).getByText('Todo dia 5')).toBeInTheDocument();
        expect(within(rent!).getByText('Conta corrente')).toBeInTheDocument();
        expect(within(rent!).getByText('5 nov.')).toBeInTheDocument();
        expect(within(rent!).getByText('Sem fim')).toBeInTheDocument();
        expect(within(rent!).getByText('−R$ 1.800,00')).toBeInTheDocument();
        expect(within(rent!).getByRole('link', { name: 'Aluguel' })).toHaveAttribute(
            'href',
            `/series/despesas/${RENT.id}`,
        );
        expect(within(gym!).getByText('Nubank')).toBeInTheDocument();
        expect(within(gym!).getByText('—')).toBeInTheDocument();
        expect(within(gym!).getByText('31 de dez. de 2026')).toBeInTheDocument();
    });

    it('asks without active when showing the ended ones', async () => {
        await renderList(ok([]), true);
        expect(await screen.findByText('Nenhuma série de despesa.')).toBeInTheDocument();
        expect(mocks.GET).toHaveBeenCalledWith('/expense-recurrences', { params: { query: {} } });
    });

    it('shows the empty state for no active series', async () => {
        await renderList(ok([]));
        expect(await screen.findByText('Nenhuma série de despesa ativa.')).toBeInTheDocument();
    });

    it('shows the error state when the list fails', async () => {
        await renderList(fail(500, 'INTERNAL_ERROR'));
        expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
    });
});
