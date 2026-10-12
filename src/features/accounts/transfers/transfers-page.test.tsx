import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import type { TransfersSearch } from './search';
import { CORRENTE, fail, ok, POUPANCA, renderWithSearch, transfer } from './test-utils';
import { TransfersPage } from './transfers-page';

const OUT = transfer({ id: 't-out', description: 'Reserva do mês' });
const IN = transfer({
    id: 't-in',
    description: 'Resgate',
    fromBankAccountId: POUPANCA,
    toBankAccountId: CORRENTE,
    amountCents: 12345,
    status: 'SCHEDULED',
    completedOn: null,
    occurredOn: '2026-10-20',
});

function renderList(search: TransfersSearch, profile: 'ADMIN' | 'BILLER' | 'VIEWER' = 'ADMIN') {
    return renderWithSearch(
        search,
        (current, onSearchChange) => (
            <TransfersPage search={current} onSearchChange={onSearchChange} />
        ),
        { profile },
    );
}

/** A tabela (a partir de `md`); os cartões repetem o conteúdo para o celular. */
const table = () => screen.getByRole('table', { name: /Transferências de/ });

beforeEach(() => {
    vi.resetAllMocks();
    mocks.GET.mockResolvedValue(ok([OUT, IN]));
});

describe('TransfersPage (spec 0018)', () => {
    // AC-0018-01, INV-0018-01.
    it('lists the month with origin → destination by name, badge and a neutral unsigned amount', async () => {
        await renderList({ mes: '2026-10' });

        expect(await screen.findByRole('table')).toBeInTheDocument();
        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
            params: { query: { from: '2026-10-01', to: '2026-10-31' } },
        });
        expect(screen.getByRole('heading', { name: 'Transferências' })).toBeInTheDocument();
        expect(screen.getByText('outubro de 2026')).toBeInTheDocument();

        const rows = within(table()).getAllByRole('row');
        const out = rows[1]!;
        expect(within(out).getByText('Conta corrente → Poupança')).toBeInTheDocument();
        expect(within(out).getByText('Concluída')).toBeInTheDocument();
        const amount = within(out).getByText('R$ 500,00');
        expect(amount).toHaveClass('text-texto');
        expect(amount).not.toHaveClass('text-positivo', 'text-negativo');
        expect(within(rows[2]!).getByText('Poupança → Conta corrente')).toBeInTheDocument();
        expect(within(rows[2]!).getByText('Agendada')).toBeInTheDocument();
        expect(within(rows[2]!).getByText('R$ 123,45')).toBeInTheDocument();
        expect(within(out).getByRole('link', { name: 'Reserva do mês' })).toHaveAttribute(
            'href',
            '/transferencias/t-out',
        );
    });

    // AC-0018-01, INV-0018-01: com `conta`, `−` quando sai e `+` quando entra, ainda neutro.
    it('signs the amount from the point of view of the account filter', async () => {
        await renderList({ mes: '2026-10', conta: CORRENTE });

        await screen.findByRole('table');
        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
            params: { query: { from: '2026-10-01', to: '2026-10-31', bankAccountId: CORRENTE } },
        });
        const rows = within(table()).getAllByRole('row');
        const out = within(rows[1]!).getByText('−R$ 500,00');
        const incoming = within(rows[2]!).getByText('+R$ 123,45');
        for (const amount of [out, incoming]) {
            expect(amount).toHaveClass('text-texto');
            expect(amount).not.toHaveClass('text-positivo', 'text-negativo');
        }
    });

    it('sends the status filter and changes the filters and the month through the search', async () => {
        const { searches } = await renderList({ mes: '2026-10', status: 'SCHEDULED' });
        await screen.findByRole('table');
        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
            params: { query: { from: '2026-10-01', to: '2026-10-31', status: 'SCHEDULED' } },
        });

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('Conta'), { target: { value: POUPANCA } });
        fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

        expect(searches).toEqual([
            { mes: '2026-10', status: undefined },
            { mes: '2026-10', status: undefined, conta: POUPANCA },
            { mes: '2026-11', status: undefined, conta: POUPANCA },
            { mes: '2026-10', status: undefined, conta: POUPANCA },
            { mes: '2026-09', status: undefined, conta: POUPANCA },
        ]);
        expect(await screen.findByText('setembro de 2026')).toBeInTheDocument();
    });

    it('defaults to the current month', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-12T15:00:00Z'), toFake: ['Date'] });
        try {
            await renderList({});
            expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
                params: { query: { from: '2026-10-01', to: '2026-10-31' } },
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('opens the form with Nova transferência (novo=1)', async () => {
        const { searches } = await renderList({ mes: '2026-10' }, 'BILLER');
        fireEvent.click(screen.getByRole('button', { name: 'Nova transferência' }));

        expect(searches.at(-1)).toMatchObject({ novo: 1 });
        expect(
            await screen.findByRole('dialog', { name: 'Nova transferência' }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(searches.at(-1)).toMatchObject({ novo: undefined });
    });

    // AC-0018-06: sem `entries.write`, nenhuma ação de escrita.
    it('shows no write action to a viewer, even with novo=1', async () => {
        await renderList({ mes: '2026-10', novo: 1 }, 'VIEWER');
        await screen.findByRole('table');

        expect(
            screen.queryByRole('button', { name: 'Nova transferência' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the empty state without transfers', async () => {
        mocks.GET.mockResolvedValue(ok([]));
        await renderList({ mes: '2026-10' });

        expect(await screen.findByText('Nenhuma transferência neste mês.')).toBeInTheDocument();
    });

    // ERR-0018-02 / ERR-0009-01.
    it('shows the error state with the catalog message and retries', async () => {
        mocks.GET.mockResolvedValue(fail(500, 'INTERNAL_ERROR'));
        await renderList({ mes: '2026-10' });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Não foi possível carregar.');
        expect(alert).not.toHaveTextContent('raw message');

        mocks.GET.mockResolvedValue(ok([OUT]));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });
});
