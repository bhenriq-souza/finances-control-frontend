import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch },
}));

import { BankAccountFormDialog } from './bank-account-form';
import {
    ACCOUNTS,
    CORRENTE,
    expectFieldError,
    fail,
    ITAU,
    notices,
    ok,
    POUPANCA,
    renderWithApp,
} from './test-utils';

const onClose = vi.fn();

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    onClose.mockReset();
    mocks.get.mockResolvedValue(ok({ data: ACCOUNTS }));
});

const dialog = (name: string) => screen.findByRole('dialog', { name });
const save = (form: HTMLElement) =>
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));

async function fillNew(form: HTMLElement) {
    fireEvent.change(within(form).getByLabelText('Banco'), { target: { value: ITAU.id } });
    fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'SAVINGS' } });
    fireEvent.change(within(form).getByLabelText('Número da conta'), {
        target: { value: ' 4321-0 ' },
    });
    fireEvent.change(within(form).getByLabelText('Descrição'), {
        target: { value: 'Reserva' },
    });
    fireEvent.change(within(form).getByLabelText('Saldo inicial'), {
        target: { value: '1.234,56' },
    });
}

describe('BankAccountFormDialog — create', () => {
    // AC-0011-03.
    it('sends a negative opening balance when Saldo inicial negativo is checked', async () => {
        mocks.post.mockResolvedValue(ok({ data: CORRENTE }, 201));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        fireEvent.click(within(form).getByRole('checkbox', { name: 'Saldo inicial negativo' }));
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.post).toHaveBeenCalledWith('/bank-accounts', {
            body: {
                bankId: ITAU.id,
                type: 'SAVINGS',
                accountNumber: '4321-0',
                description: 'Reserva',
                openingBalanceCents: -123456,
                overdraftLimitCents: 0,
            },
        });
        expect(within(notices()).getByText('Conta salva.')).toBeInTheDocument();
    });

    it('sends a positive opening balance and the overdraft limit otherwise', async () => {
        mocks.post.mockResolvedValue(ok({ data: CORRENTE }, 201));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        fireEvent.change(within(form).getByLabelText('Cheque especial (opcional)'), {
            target: { value: '500' },
        });
        save(form);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.post.mock.calls[0]![1].body).toMatchObject({
            openingBalanceCents: 123456,
            overdraftLimitCents: 50000,
        });
    });

    it('accepts a zero opening balance, never sending −0', async () => {
        mocks.post.mockResolvedValue(ok({ data: CORRENTE }, 201));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        fireEvent.change(within(form).getByLabelText('Saldo inicial'), {
            target: { value: '0' },
        });
        fireEvent.click(within(form).getByRole('checkbox', { name: 'Saldo inicial negativo' }));
        save(form);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(Object.is(mocks.post.mock.calls[0]![1].body.openingBalanceCents, 0)).toBe(true);
    });

    // INV-0011-04.
    it('offers only the active banks', async () => {
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        const options = within(within(form).getByLabelText('Banco')).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual([
            'Escolha o banco',
            '341 · Itaú',
            '260 · Nubank',
        ]);
    });

    it('validates the required fields before calling the API', async () => {
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        fireEvent.change(within(form).getByLabelText('Cheque especial (opcional)'), {
            target: { value: 'abc' },
        });
        save(form);

        expect(await within(form).findByText('Escolha o banco.')).toBeInTheDocument();
        expect(within(form).getByText('Informe o número da conta.')).toBeInTheDocument();
        expect(within(form).getByText('Informe a descrição.')).toBeInTheDocument();
        expect(within(form).getByText('Informe o valor.')).toBeInTheDocument();
        expect(within(form).getByText('Use o formato 1.234,56.')).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    // AC-0011-05 / ERR-0011-01.
    it('marks the account number on BANK_ACCOUNT_ALREADY_EXISTS', async () => {
        mocks.post.mockResolvedValue(fail(409, 'BANK_ACCOUNT_ALREADY_EXISTS'));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        save(form);

        const number = within(form).getByLabelText('Número da conta');
        await expectFieldError(number, 'Você já tem essa conta neste banco.');
        expect(number).toHaveValue(' 4321-0 ');
        expect(onClose).not.toHaveBeenCalled();
    });

    // ERR-0011-02.
    it('marks the bank on BANK_ARCHIVED', async () => {
        mocks.post.mockResolvedValue(fail(409, 'BANK_ARCHIVED'));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        save(form);

        await expectFieldError(within(form).getByLabelText('Banco'), 'banco está arquivado');
    });

    // ERR-0011-04: VALIDATION_ERROR vai para os campos pelo `path`.
    it('maps VALIDATION_ERROR paths to the fields', async () => {
        mocks.post.mockResolvedValue(
            fail(400, 'VALIDATION_ERROR', [{ path: ['openingBalanceCents'], message: 'x' }]),
        );
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        save(form);

        await waitFor(() =>
            expect(within(form).getByLabelText('Saldo inicial')).toHaveAttribute(
                'aria-invalid',
                'true',
            ),
        );
    });

    it('shows BANK_ACCOUNT_NOT_FOUND in the form alert', async () => {
        mocks.post.mockResolvedValue(fail(404, 'BANK_ACCOUNT_NOT_FOUND'));
        await renderWithApp(<BankAccountFormDialog onClose={onClose} />);
        const form = await dialog('Nova conta');

        await fillNew(form);
        save(form);

        expect(await within(form).findByRole('alert')).toHaveTextContent(
            'Não encontramos essa conta.',
        );
    });
});

describe('BankAccountFormDialog — edit', () => {
    // AC-0011-04, INV-0011-02.
    it('sends only the changed fields, never the bank or the balances', async () => {
        mocks.patch.mockResolvedValue(ok({ data: CORRENTE }));
        await renderWithApp(<BankAccountFormDialog account={CORRENTE} onClose={onClose} />);
        const form = await dialog('Editar conta');

        expect(within(form).queryByLabelText('Banco')).not.toBeInTheDocument();
        expect(within(form).queryByLabelText('Saldo inicial')).not.toBeInTheDocument();
        expect(within(form).getByLabelText('Descrição')).toHaveValue('Conta corrente');
        expect(within(form).getByLabelText('Cheque especial (opcional)')).toHaveValue('1.000,00');

        fireEvent.change(within(form).getByLabelText('Descrição'), {
            target: { value: 'Conta principal' },
        });
        fireEvent.change(within(form).getByLabelText('Cheque especial (opcional)'), {
            target: { value: '' },
        });
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).toHaveBeenCalledWith('/bank-accounts/{id}', {
            params: { path: { id: CORRENTE.id } },
            body: { description: 'Conta principal', overdraftLimitCents: 0 },
        });
        expect(within(notices()).getByText('Conta salva.')).toBeInTheDocument();
    });

    it('sends the type and the number when they change', async () => {
        mocks.patch.mockResolvedValue(ok({ data: POUPANCA }));
        await renderWithApp(<BankAccountFormDialog account={POUPANCA} onClose={onClose} />);
        const form = await dialog('Editar conta');

        fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'INVESTMENT' } });
        fireEvent.change(within(form).getByLabelText('Número da conta'), {
            target: { value: '11111-1' },
        });
        save(form);

        await waitFor(() => expect(mocks.patch).toHaveBeenCalled());
        expect(mocks.patch.mock.calls[0]![1].body).toEqual({
            type: 'INVESTMENT',
            accountNumber: '11111-1',
        });
    });

    it('shows the balances read only, with the note', async () => {
        await renderWithApp(<BankAccountFormDialog account={CORRENTE} onClose={onClose} />);
        const form = await dialog('Editar conta');

        const balances = within(form).getByRole('region', { name: 'Saldos' });
        expect(balances).toHaveTextContent('Saldo inicialR$ 1.000,00');
        expect(balances).toHaveTextContent('Saldo atual−R$ 123,45');
        expect(balances).toHaveTextContent('O saldo só muda por lançamentos.');
    });

    it('closes without calling the API when nothing changed', async () => {
        await renderWithApp(<BankAccountFormDialog account={CORRENTE} onClose={onClose} />);
        const form = await dialog('Editar conta');

        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it('closes with Cancelar', async () => {
        await renderWithApp(<BankAccountFormDialog account={CORRENTE} onClose={onClose} />);
        const form = await dialog('Editar conta');

        fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
        expect(onClose).toHaveBeenCalled();
    });
});
