import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch, DELETE: mocks.delete },
}));

import type { Profile } from '@/api/queries/current-user';

import { BankAccountsPage } from '../bank-accounts-page';
import { BanksPage } from '../banks-page';
import { CreditCardPage } from '../credit-card-page';
import { CreditCardsPage } from '../credit-cards-page';

import {
    ACCOUNTS,
    ANTIGA,
    BANKS,
    CARDS,
    CARTAO_ANTIGO,
    CORRENTE,
    fail,
    ITAU,
    notices,
    ok,
    renderWithApp,
    ROXINHO,
} from './test-utils';

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    // A invalidação depois de uma escrita consulta de novo: devolve os mesmos dados.
    mocks.get.mockImplementation((path: string) =>
        Promise.resolve(ok({ data: REFERENCE[path] ?? [] })),
    );
});

const REFERENCE: Record<string, unknown[]> = {
    '/banks': BANKS,
    '/bank-accounts': ACCOUNTS,
    '/credit-cards': CARDS,
};

const table = (name: string) => screen.getByRole('table', { name });

describe('write controls with accounts.write (ADMIN)', () => {
    it('/contas offers Nova conta, Editar and Arquivar, and opens the forms from the search', async () => {
        const onFormChange = vi.fn();
        await renderWithApp(
            <BankAccountsPage
                showArchived
                onShowArchivedChange={vi.fn()}
                form={{}}
                onFormChange={onFormChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
        expect(onFormChange).toHaveBeenLastCalledWith({ novo: 1 });
        const rows = table('Contas bancárias');
        expect(within(rows).getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
        fireEvent.click(within(rows).getByRole('button', { name: 'Editar Conta corrente' }));
        expect(onFormChange).toHaveBeenLastCalledWith({ editar: CORRENTE.id });
        expect(
            within(rows).getByRole('button', { name: 'Desarquivar Conta antiga' }),
        ).toBeInTheDocument();
    });

    it('/contas?editar=<id> opens Editar conta and Cancelar clears the search', async () => {
        const onFormChange = vi.fn();
        await renderWithApp(
            <BankAccountsPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                form={{ editar: CORRENTE.id }}
                onFormChange={onFormChange}
            />,
        );
        const form = await screen.findByRole('dialog', { name: 'Editar conta' });
        fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
        expect(onFormChange).toHaveBeenCalledWith({});
    });

    it('/contas?novo=1 opens the create form', async () => {
        await renderWithApp(
            <BankAccountsPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                form={{ novo: 1 }}
            />,
        );
        expect(await screen.findByRole('dialog', { name: 'Nova conta' })).toBeInTheDocument();
    });

    it('ignores ?editar with an unknown id', async () => {
        await renderWithApp(
            <BanksPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                form={{ editar: 'desconhecido' }}
            />,
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0011-06.
    it('archives an account with POST and unarchives with DELETE /…/archive', async () => {
        mocks.post.mockResolvedValue(ok());
        mocks.delete.mockResolvedValue(ok());
        const { client } = await renderWithApp(
            <BankAccountsPage showArchived onShowArchivedChange={vi.fn()} />,
        );
        const invalidate = vi.spyOn(client, 'invalidateQueries');

        fireEvent.click(
            within(table('Contas bancárias')).getByRole('button', {
                name: 'Arquivar Conta corrente',
            }),
        );
        expect(await within(notices()).findByText('Conta arquivada.')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledWith('/bank-accounts/{id}/archive', {
            params: { path: { id: CORRENTE.id } },
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bank-accounts'] });

        fireEvent.click(
            within(table('Contas bancárias')).getByRole('button', {
                name: 'Desarquivar Conta antiga',
            }),
        );
        expect(await within(notices()).findByText('Conta desarquivada.')).toBeInTheDocument();
        expect(mocks.delete).toHaveBeenCalledWith('/bank-accounts/{id}/archive', {
            params: { path: { id: ANTIGA.id } },
        });
    });

    it('/contas/bancos offers Novo banco and archives a bank', async () => {
        mocks.post.mockResolvedValue(ok());
        const onFormChange = vi.fn();
        await renderWithApp(
            <BanksPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                onFormChange={onFormChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Novo banco' }));
        expect(onFormChange).toHaveBeenLastCalledWith({ novo: 1 });
        const banks = table('Bancos');
        fireEvent.click(within(banks).getByRole('button', { name: 'Editar Itaú' }));
        expect(onFormChange).toHaveBeenLastCalledWith({ editar: ITAU.id });

        fireEvent.click(within(banks).getByRole('button', { name: 'Arquivar Itaú' }));
        expect(await within(notices()).findByText('Banco arquivado.')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledWith('/banks/{id}/archive', {
            params: { path: { id: ITAU.id } },
        });
    });

    it('/contas/bancos?novo=1 opens the bank form', async () => {
        await renderWithApp(
            <BanksPage showArchived={false} onShowArchivedChange={vi.fn()} form={{ novo: 1 }} />,
        );
        expect(await screen.findByRole('dialog', { name: 'Novo banco' })).toBeInTheDocument();
    });

    it('/cartoes?editar=<id> opens the edit form', async () => {
        const onFormChange = vi.fn();
        await renderWithApp(
            <CreditCardsPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                form={{ editar: ROXINHO.id }}
                onFormChange={onFormChange}
            />,
        );

        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });
        fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
        expect(onFormChange).toHaveBeenLastCalledWith({});
    });

    it('/cartoes offers Novo cartão, with no row actions (they live in the summary)', async () => {
        const onFormChange = vi.fn();
        await renderWithApp(
            <CreditCardsPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                onFormChange={onFormChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Novo cartão' }));
        expect(onFormChange).toHaveBeenLastCalledWith({ novo: 1 });
        expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    });

    it('/cartoes?novo=1 opens the create form', async () => {
        await renderWithApp(
            <CreditCardsPage
                showArchived={false}
                onShowArchivedChange={vi.fn()}
                form={{ novo: 1 }}
            />,
        );
        expect(await screen.findByRole('dialog', { name: 'Novo cartão' })).toBeInTheDocument();
    });

    it('/cartoes/$cartaoId offers Editar (?editar=1) and Arquivar', async () => {
        mocks.post.mockResolvedValue(ok());
        const onEditingChange = vi.fn();
        await renderWithApp(
            <CreditCardPage cardId={ROXINHO.id} onEditingChange={onEditingChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Roxinho' }));
        expect(onEditingChange).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByRole('button', { name: 'Arquivar Nubank Roxinho' }));
        expect(await within(notices()).findByText('Cartão arquivado.')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledWith('/credit-cards/{id}/archive', {
            params: { path: { id: ROXINHO.id } },
        });
    });

    it('/cartoes/$cartaoId?editar=1 opens the edit form', async () => {
        const onEditingChange = vi.fn();
        await renderWithApp(
            <CreditCardPage cardId={CARTAO_ANTIGO.id} editing onEditingChange={onEditingChange} />,
        );

        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });
        fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
        expect(onEditingChange).toHaveBeenCalledWith(false);
    });

    it('/cartoes/$cartaoId unarchives an archived card', async () => {
        mocks.delete.mockResolvedValue(ok());
        await renderWithApp(<CreditCardPage cardId={CARTAO_ANTIGO.id} />);

        fireEvent.click(screen.getByRole('button', { name: 'Desarquivar Cartão antigo' }));
        expect(await within(notices()).findByText('Cartão desarquivado.')).toBeInTheDocument();
        expect(mocks.delete).toHaveBeenCalledWith('/credit-cards/{id}/archive', {
            params: { path: { id: CARTAO_ANTIGO.id } },
        });
    });

    it('shows the catalog message when archiving fails', async () => {
        mocks.post.mockResolvedValue(fail(404, 'BANK_NOT_FOUND'));
        await renderWithApp(<BanksPage showArchived={false} onShowArchivedChange={vi.fn()} />);

        fireEvent.click(within(table('Bancos')).getByRole('button', { name: 'Arquivar Itaú' }));

        const notice = await within(notices()).findByText('Não encontramos esse banco.', {
            exact: false,
        });
        expect(notice.closest('[data-tone]')).toHaveAttribute('data-tone', 'erro');
    });

    it('shows a generic message when archiving fails without an API error', async () => {
        mocks.post.mockRejectedValue(new TypeError('boom'));
        await renderWithApp(<BanksPage showArchived={false} onShowArchivedChange={vi.fn()} />);

        fireEvent.click(within(table('Bancos')).getByRole('button', { name: 'Arquivar Itaú' }));

        expect(
            await within(notices()).findByText(
                'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
            ),
        ).toBeInTheDocument();
    });
});

// AC-0011-07, INV-0011-01.
describe.each<Profile>(['BILLER', 'VIEWER'])('without accounts.write (%s)', (profile) => {
    const WRITE = /^(Nova conta|Novo banco|Novo cartão|Editar|Arquivar|Desarquivar)/;

    it('renders no write control and ignores ?novo and ?editar on the lists', async () => {
        await renderWithApp(
            <>
                <BankAccountsPage
                    showArchived
                    onShowArchivedChange={vi.fn()}
                    form={{ novo: 1, editar: CORRENTE.id }}
                />
                <BanksPage showArchived onShowArchivedChange={vi.fn()} form={{ novo: 1 }} />
                <CreditCardsPage
                    showArchived
                    onShowArchivedChange={vi.fn()}
                    form={{ editar: ROXINHO.id }}
                />
            </>,
            profile,
        );

        expect(screen.queryAllByRole('button', { name: WRITE })).toHaveLength(0);
        // Só a lista de contas tem a coluna de ações, e só com o link Extrato (spec 0015).
        expect(screen.getAllByRole('columnheader', { name: 'Ações' })).toHaveLength(1);
        expect(screen.queryAllByRole('link', { name: /^Extrato de / }).length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('renders no write control and ignores ?editar=1 on the card summary', async () => {
        await renderWithApp(<CreditCardPage cardId={ROXINHO.id} editing />, profile);

        expect(screen.getByRole('heading', { name: 'Nubank Roxinho' })).toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: WRITE })).toHaveLength(0);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
