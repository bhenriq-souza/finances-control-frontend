import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { EarningRecurrences } from './earning-recurrences';
import { fail, ok, recurrence, renderWithSearch } from './test-utils';

const SALARY = recurrence({ description: 'Salário mensal' });
const ENDED = recurrence({
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    description: 'Bolsa',
    endsOn: '2026-06-30',
    nextOccurrenceOn: null,
});

async function renderList(response: unknown, showEnded = false) {
    mocks.GET.mockResolvedValue(response);
    await renderWithSearch({}, () => <EarningRecurrences showEnded={showEnded} />);
}

beforeEach(() => {
    vi.resetAllMocks();
});

// AC-0017-01: a aba de receitas, com o nome do tipo achado pelo `typeId`.
describe('EarningRecurrences (spec 0017)', () => {
    it('lists the active series with type, account, next date and a positive amount', async () => {
        await renderList(ok([SALARY]));

        const table = await screen.findByRole('table', { name: 'Séries de receitas' });
        expect(mocks.GET).toHaveBeenCalledWith('/earning-recurrences', {
            params: { query: { active: 'true' } },
        });
        const [row] = within(table).getAllByRole('row').slice(1);
        expect(within(row!).getByText('Salário')).toBeInTheDocument();
        expect(within(row!).getByText('Conta corrente')).toBeInTheDocument();
        expect(within(row!).getByText('Todo dia 5')).toBeInTheDocument();
        expect(within(row!).getByText('+R$ 5.000,00')).toBeInTheDocument();
        expect(within(row!).getByRole('link', { name: 'Salário mensal' })).toHaveAttribute(
            'href',
            `/series/receitas/${SALARY.id}`,
        );
    });

    it('asks without active and shows the ended ones when asked', async () => {
        await renderList(ok([ENDED]), true);
        const table = await screen.findByRole('table', { name: 'Séries de receitas' });
        expect(within(table).getByText('30 de jun. de 2026')).toBeInTheDocument();
        expect(mocks.GET).toHaveBeenCalledWith('/earning-recurrences', { params: { query: {} } });
    });

    it('shows the empty state for no active series', async () => {
        await renderList(ok([]));
        expect(await screen.findByText('Nenhuma série de receita ativa.')).toBeInTheDocument();
    });

    it('shows the error state when the list fails', async () => {
        await renderList(fail(500, 'INTERNAL_ERROR'));
        expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
    });
});
