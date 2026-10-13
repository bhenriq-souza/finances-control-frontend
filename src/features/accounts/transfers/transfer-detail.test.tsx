import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { queryKeys } from '@/api/queries/keys';
import type { Profile } from '@/api/queries/current-user';

import type { BankTransfer } from './api';
import type { TransferDetailSearch } from './search';
import { fail, getByPath, noContent, ok, renderWithSearch, transfer } from './test-utils';
import { TransferDetailPage } from './transfer-detail';

const SCHEDULED = transfer({
    status: 'SCHEDULED',
    completedOn: null,
    occurredOn: '2099-01-10',
    notes: 'Para a reserva',
});
const COMPLETED = transfer();
const onDeleted = vi.fn();

async function renderDetail(
    data: BankTransfer,
    search: TransferDetailSearch = {},
    profile: Profile = 'ADMIN',
) {
    respondWith(ok(data));
    const result = await renderWithSearch(
        search,
        (current, onSearchChange) => (
            <TransferDetailPage
                transferId={data.id}
                search={current}
                onSearchChange={onSearchChange}
                onDeleted={onDeleted}
            />
        ),
        { profile },
    );
    // Texto e não papel: um diálogo aberto pelos parâmetros esconde o resto da árvore de acessibilidade.
    await screen.findAllByText(data.description);
    return result;
}

/** O que `GET /bank-transfers/{id}` responde dali em diante. */
function respondWith(response: unknown) {
    mocks.GET.mockImplementation(async (path: string) =>
        getByPath({ '/bank-transfers/{id}': response })(path),
    );
}

const button = (name: string) => screen.queryByRole('button', { name });

beforeEach(() => {
    vi.resetAllMocks();
});

describe('TransferDetailPage (spec 0018)', () => {
    it('shows the transfer with accounts by name, badge, neutral amount and notes', async () => {
        await renderDetail(SCHEDULED);

        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers/{id}', {
            params: { path: { id: SCHEDULED.id } },
        });
        expect(screen.getByText('Agendada')).toBeInTheDocument();
        expect(screen.getByText('R$ 500,00')).toHaveClass('text-texto');
        expect(screen.getByText('Conta corrente')).toBeInTheDocument();
        expect(screen.getByText('Poupança')).toBeInTheDocument();
        expect(screen.getByText('10 de jan. de 2099')).toBeInTheDocument();
        expect(screen.getByText('Para a reserva')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Transferências' })).toHaveAttribute(
            'href',
            '/transferencias',
        );
        expect(screen.queryByText('Agendada para uma data que já passou.')).not.toBeInTheDocument();
    });

    it('warns about a scheduled transfer whose date has passed', async () => {
        await renderDetail({ ...SCHEDULED, occurredOn: '2020-01-01' });
        expect(screen.getByText('Agendada para uma data que já passou.')).toBeInTheDocument();
    });

    // AC-0018-04, INV-0018-02: agendada tem Concluir, Editar e Excluir; concluída, Desfazer e Editar.
    it('offers the actions of each status', async () => {
        await renderDetail(SCHEDULED);
        expect(button('Concluir')).toBeInTheDocument();
        expect(button('Editar')).toBeInTheDocument();
        expect(button('Excluir')).toBeInTheDocument();
        expect(button('Desfazer')).not.toBeInTheDocument();
    });

    it('offers only Desfazer and Editar on a completed transfer, ignoring concluir and excluir', async () => {
        await renderDetail(COMPLETED, { concluir: 1, excluir: 1 });
        expect(screen.getByText('Concluída', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('Concluída em')).toBeInTheDocument();
        expect(button('Desfazer')).toBeInTheDocument();
        expect(button('Editar')).toBeInTheDocument();
        expect(button('Concluir')).not.toBeInTheDocument();
        expect(button('Excluir')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // AC-0018-04: Concluir envia `{ status: 'COMPLETED', completedOn }`.
    it('completes a scheduled transfer with the chosen date', async () => {
        const { searches, queryClient } = await renderDetail(SCHEDULED);
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
        expect(searches.at(-1)).toEqual({ concluir: 1 });

        const dialog = await screen.findByRole('dialog', { name: 'Concluir a transferência?' });
        fireEvent.change(within(dialog).getByLabelText('Concluída em'), {
            target: { value: '2026-10-11' },
        });
        mocks.PATCH.mockResolvedValueOnce(ok({ ...SCHEDULED, status: 'COMPLETED' }));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }));
        });

        expect(mocks.PATCH).toHaveBeenCalledWith('/bank-transfers/{id}/status', {
            params: { path: { id: SCHEDULED.id } },
            body: { status: 'COMPLETED', completedOn: '2026-10-11' },
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.bankTransfers.all });
        expect(searches.at(-1)).toEqual({ concluir: undefined });
        expect(await screen.findByText('Transferência concluída.')).toBeInTheDocument();
    });

    it('defaults the completion date to today and requires it', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-12T15:00:00Z'), toFake: ['Date'] });
        await renderDetail(SCHEDULED, { concluir: 1 });
        vi.useRealTimers();
        const dialog = screen.getByRole('dialog', { name: 'Concluir a transferência?' });
        const date = within(dialog).getByLabelText('Concluída em');
        expect(date).toHaveValue('12/10/2026');

        fireEvent.change(date, { target: { value: '' } });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }));
        });
        expect(date).toHaveAccessibleDescription('Informe a data de conclusão.');
        expect(mocks.PATCH).not.toHaveBeenCalled();
    });

    // Mapa de erros: `BANK_TRANSFER_STATUS_UNCHANGED` vai para o alerta e recarrega o detalhe.
    it('shows a status conflict when completing and reloads the transfer', async () => {
        const { queryClient } = await renderDetail(SCHEDULED, { concluir: 1 });
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const dialog = screen.getByRole('dialog', { name: 'Concluir a transferência?' });
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'BANK_TRANSFER_STATUS_UNCHANGED'));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }));
        });

        expect(within(dialog).getByRole('alert')).toHaveTextContent(
            'A transferência já está nesse status. Atualize a página.',
        );
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.bankTransfers.all });
    });

    // AC-0018-04: Desfazer pede confirmação e envia `{ status: 'SCHEDULED' }`.
    it('undoes a completed transfer after confirming', async () => {
        await renderDetail(COMPLETED);
        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Desfazer a transferência?',
        });
        expect(dialog).toHaveTextContent(
            'Os saldos das duas contas voltam e a transferência fica agendada.',
        );
        expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
        expect(mocks.PATCH).not.toHaveBeenCalled();

        mocks.PATCH.mockResolvedValueOnce(ok({ ...SCHEDULED }));
        respondWith(ok({ ...COMPLETED, status: 'SCHEDULED', completedOn: null }));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }));
        });

        expect(mocks.PATCH).toHaveBeenCalledWith('/bank-transfers/{id}/status', {
            params: { path: { id: COMPLETED.id } },
            body: { status: 'SCHEDULED' },
        });
        expect(await screen.findByText('Transferência desfeita.')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(await screen.findByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    });

    it('shows an undo error in the confirmation and clears it on cancel', async () => {
        await renderDetail(COMPLETED);
        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
        const dialog = await screen.findByRole('alertdialog');
        mocks.PATCH.mockResolvedValueOnce(fail(404, 'BANK_TRANSFER_NOT_FOUND'));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }));
        });

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Não encontramos essa transferência',
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    // AC-0018-04: Excluir só existe na agendada; confirma e volta para a lista.
    it('deletes a scheduled transfer after confirming', async () => {
        const { searches } = await renderDetail(SCHEDULED);
        fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
        expect(searches.at(-1)).toEqual({ excluir: 1 });

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Excluir a transferência?',
        });
        mocks.DELETE.mockResolvedValueOnce(noContent());
        respondWith(fail(404, 'BANK_TRANSFER_NOT_FOUND'));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
        });

        expect(mocks.DELETE).toHaveBeenCalledWith('/bank-transfers/{id}', {
            params: { path: { id: SCHEDULED.id } },
        });
        await waitFor(() => expect(onDeleted).toHaveBeenCalled());
        expect(await screen.findByText('Transferência excluída.')).toBeInTheDocument();
    });

    it('shows a delete conflict in the confirmation', async () => {
        await renderDetail(SCHEDULED, { excluir: 1 });
        const dialog = screen.getByRole('alertdialog', { name: 'Excluir a transferência?' });
        mocks.DELETE.mockResolvedValueOnce(fail(409, 'BANK_TRANSFER_ALREADY_COMPLETED'));
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
        });

        expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    // AC-0018-05: na concluída, Editar só mostra descrição e observações.
    it('edits only description and notes of a completed transfer', async () => {
        const { searches } = await renderDetail(COMPLETED);
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
        expect(searches.at(-1)).toEqual({ editar: 1 });

        const dialog = await screen.findByRole('dialog', { name: 'Editar transferência' });
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Reserva do mês');
        for (const label of ['De', 'Para', 'Valor', 'Data']) {
            expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument();
        }
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        expect(searches.at(-1)).toEqual({ editar: undefined });
    });

    it('edits the accounts, amount and date of a scheduled transfer', async () => {
        await renderDetail(SCHEDULED, { editar: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Editar transferência' });
        for (const label of ['De', 'Para', 'Valor', 'Data', 'Descrição', 'Observações']) {
            expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
        }
    });

    // AC-0018-06: sem `entries.write`, nenhuma ação de escrita, nem pelos parâmetros.
    it('shows no write action to a viewer', async () => {
        await renderDetail(SCHEDULED, { editar: 1, concluir: 1, excluir: 1 }, 'VIEWER');
        for (const name of ['Concluir', 'Editar', 'Excluir', 'Desfazer']) {
            expect(button(name)).not.toBeInTheDocument();
        }
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // ERR-0018-02 / ERR-0009-02.
    it('shows not found for BANK_TRANSFER_NOT_FOUND', async () => {
        respondWith(fail(404, 'BANK_TRANSFER_NOT_FOUND'));
        await renderWithSearch({}, (search, onSearchChange) => (
            <TransferDetailPage
                transferId="x"
                search={search}
                onSearchChange={onSearchChange}
                onDeleted={onDeleted}
            />
        ));

        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
        expect(await screen.findByText('Não encontramos este item.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Voltar para a lista' })).toHaveAttribute(
            'href',
            '/transferencias',
        );
    });

    it('shows the error state for other failures and retries', async () => {
        respondWith(fail(500, 'INTERNAL_ERROR'));
        await renderWithSearch({}, (search, onSearchChange) => (
            <TransferDetailPage
                transferId="x"
                search={search}
                onSearchChange={onSearchChange}
                onDeleted={onDeleted}
            />
        ));

        expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
        respondWith(ok(SCHEDULED));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(
            await screen.findByRole('heading', { level: 1, name: SCHEDULED.description }),
        ).toBeInTheDocument();
    });
});
