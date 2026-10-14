import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch },
}));

import { CreditCardFormDialog, DAY_MESSAGE } from './credit-card-form';
import {
    CARDS,
    CARTAO_ANTIGO,
    CORRENTE,
    expectFieldError,
    fail,
    NUBANK,
    notices,
    ok,
    POUPANCA,
    renderWithApp,
    ROXINHO,
} from './test-utils';

const onClose = vi.fn();

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    onClose.mockReset();
    mocks.get.mockResolvedValue(ok({ data: CARDS }));
});

const save = (form: HTMLElement) =>
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
const change = (form: HTMLElement, label: string, value: string) =>
    fireEvent.change(within(form).getByLabelText(label), { target: { value } });
const optionTexts = (select: HTMLElement) =>
    within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);

async function fillNew(form: HTMLElement) {
    change(form, 'Banco', NUBANK.id);
    change(form, 'Nome', ' Ultravioleta ');
    change(form, 'Limite', '10.000,00');
    change(form, 'Dia de fechamento', '3');
    change(form, 'Dia de vencimento', '10');
}

describe('CreditCardFormDialog — create', () => {
    it('creates a card without a paying account', async () => {
        mocks.post.mockResolvedValue(ok({ data: ROXINHO }, 201));
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        await fillNew(form);
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.post).toHaveBeenCalledWith('/credit-cards', {
            body: {
                bankId: NUBANK.id,
                name: 'Ultravioleta',
                creditLimitCents: 1000000,
                closingDay: 3,
                dueDay: 10,
            },
        });
        expect(within(notices()).getByText('Cartão salvo.')).toBeInTheDocument();
    });

    it('sends the paying account when chosen', async () => {
        mocks.post.mockResolvedValue(ok({ data: ROXINHO }, 201));
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        await fillNew(form);
        change(form, 'Conta pagadora (opcional)', POUPANCA.id);
        save(form);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.post.mock.calls[0]![1].body.paymentBankAccountId).toBe(POUPANCA.id);
    });

    // INV-0011-04.
    it('offers only the active banks and the active accounts', async () => {
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        expect(optionTexts(within(form).getByLabelText('Banco'))).toEqual([
            'Escolha o banco',
            '341 · Itaú',
            '260 · Nubank',
        ]);
        expect(optionTexts(within(form).getByLabelText('Conta pagadora (opcional)'))).toEqual([
            'Nenhuma',
            'Conta corrente',
            'Poupança',
        ]);
    });

    it('validates the limit and the days', async () => {
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        change(form, 'Limite', '0');
        change(form, 'Dia de fechamento', '32');
        change(form, 'Dia de vencimento', 'x');
        save(form);

        expect(await within(form).findByText('Escolha o banco.')).toBeInTheDocument();
        expect(within(form).getByText('Informe o nome.')).toBeInTheDocument();
        expect(within(form).getByText('O valor precisa ser maior que zero.')).toBeInTheDocument();
        expect(within(form).getAllByText(DAY_MESSAGE)).toHaveLength(2);
        expect(mocks.post).not.toHaveBeenCalled();
    });

    // ERR-0011-01.
    it('marks the name on CREDIT_CARD_ALREADY_EXISTS', async () => {
        mocks.post.mockResolvedValue(fail(409, 'CREDIT_CARD_ALREADY_EXISTS'));
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        await fillNew(form);
        save(form);

        await waitFor(() =>
            expect(within(form).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true'),
        );
        expect(onClose).not.toHaveBeenCalled();
    });

    it('marks the bank on BANK_NOT_FOUND', async () => {
        mocks.post.mockResolvedValue(fail(404, 'BANK_NOT_FOUND'));
        await renderWithApp(<CreditCardFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo cartão' });

        await fillNew(form);
        save(form);

        await expectFieldError(within(form).getByLabelText('Banco'), 'Não encontramos esse banco.');
    });
});

describe('CreditCardFormDialog — edit', () => {
    it('shows the fixed note and sends only the changed fields, never the bank', async () => {
        mocks.patch.mockResolvedValue(ok({ data: ROXINHO }));
        await renderWithApp(<CreditCardFormDialog card={ROXINHO} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });

        expect(form).toHaveAccessibleDescription(
            'Mudar o limite muda o disponível na mesma diferença. Mudar os dias vale só para ciclos ainda não fechados.',
        );
        expect(within(form).queryByLabelText('Banco')).not.toBeInTheDocument();
        expect(within(form).getByLabelText('Limite')).toHaveValue('5.000,00');
        expect(within(form).getByLabelText('Conta pagadora (opcional)')).toHaveValue(CORRENTE.id);

        change(form, 'Limite', '6.000,00');
        change(form, 'Dia de vencimento', '20');
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).toHaveBeenCalledWith('/credit-cards/{id}', {
            params: { path: { id: ROXINHO.id } },
            body: { creditLimitCents: 600000, dueDay: 20 },
        });
    });

    it('sends null when the paying account is cleared', async () => {
        mocks.patch.mockResolvedValue(ok({ data: ROXINHO }));
        await renderWithApp(<CreditCardFormDialog card={ROXINHO} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });

        change(form, 'Conta pagadora (opcional)', '');
        change(form, 'Nome', 'Roxinho');
        change(form, 'Dia de fechamento', '9');
        save(form);

        await waitFor(() => expect(mocks.patch).toHaveBeenCalled());
        expect(mocks.patch.mock.calls[0]![1].body).toEqual({
            name: 'Roxinho',
            closingDay: 9,
            paymentBankAccountId: null,
        });
    });

    // AC-0011-05 / ERR-0011-02 (lacuna do contrato `v1.1.0`, tratada pelo `code`).
    it('marks the paying account on BANK_ACCOUNT_ARCHIVED', async () => {
        mocks.patch.mockResolvedValue(fail(409, 'BANK_ACCOUNT_ARCHIVED'));
        await renderWithApp(<CreditCardFormDialog card={ROXINHO} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });

        change(form, 'Conta pagadora (opcional)', POUPANCA.id);
        save(form);

        const payment = within(form).getByLabelText('Conta pagadora (opcional)');
        await expectFieldError(payment, 'Essa conta está arquivada.');
        expect(payment).toHaveValue(POUPANCA.id);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('keeps an archived current paying account selectable, so it is not dropped silently', async () => {
        await renderWithApp(<CreditCardFormDialog card={CARTAO_ANTIGO} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar cartão' });

        const payment = within(form).getByLabelText('Conta pagadora (opcional)');
        expect(optionTexts(payment)).toEqual([
            'Nenhuma',
            'Conta antiga (arquivada)',
            'Conta corrente',
            'Poupança',
        ]);
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).not.toHaveBeenCalled();
    });
});
