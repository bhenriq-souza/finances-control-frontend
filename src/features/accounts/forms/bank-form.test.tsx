import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch },
}));

import { BankFormDialog } from './bank-form';
import { BANKS, expectFieldError, fail, ITAU, notices, ok, renderWithApp } from './test-utils';

const onClose = vi.fn();

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    onClose.mockReset();
    mocks.get.mockResolvedValue(ok({ data: BANKS }));
});

const save = (form: HTMLElement) =>
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));

describe('BankFormDialog', () => {
    it('creates a bank with the FEBRABAN code and the name', async () => {
        mocks.post.mockResolvedValue(ok({ data: ITAU }, 201));
        const { client } = await renderWithApp(<BankFormDialog onClose={onClose} />);
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const form = await screen.findByRole('dialog', { name: 'Novo banco' });

        fireEvent.change(within(form).getByLabelText('Código FEBRABAN'), {
            target: { value: '077' },
        });
        fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: ' Inter ' } });
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.post).toHaveBeenCalledWith('/banks', {
            body: { febrabanCode: '077', name: 'Inter' },
        });
        // Toda escrita invalida pela matriz, domínio `accounts`.
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['banks'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['credit-cards'] });
        expect(within(notices()).getByText('Banco salvo.')).toBeInTheDocument();
    });

    it('requires a three-digit code and a name', async () => {
        await renderWithApp(<BankFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo banco' });

        fireEvent.change(within(form).getByLabelText('Código FEBRABAN'), {
            target: { value: '77' },
        });
        save(form);

        expect(
            await within(form).findByText('Use os três dígitos do código FEBRABAN.'),
        ).toBeInTheDocument();
        expect(within(form).getByText('Informe o nome.')).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    // AC-0011-05 / ERR-0011-01.
    it('marks the code field on BANK_ALREADY_EXISTS and keeps the form open', async () => {
        mocks.post.mockResolvedValue(fail(409, 'BANK_ALREADY_EXISTS'));
        await renderWithApp(<BankFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo banco' });

        fireEvent.change(within(form).getByLabelText('Código FEBRABAN'), {
            target: { value: '341' },
        });
        fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Itaú' } });
        save(form);

        const code = within(form).getByLabelText('Código FEBRABAN');
        await expectFieldError(code, 'Esse banco já está cadastrado.');
        expect(code).toHaveValue('341');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('edits only the name', async () => {
        mocks.patch.mockResolvedValue(ok({ data: ITAU }));
        await renderWithApp(<BankFormDialog bank={ITAU} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar banco' });

        expect(form).toHaveAccessibleDescription('Código FEBRABAN 341.');
        expect(within(form).queryByLabelText('Código FEBRABAN')).not.toBeInTheDocument();
        fireEvent.change(within(form).getByLabelText('Nome'), {
            target: { value: 'Itaú Unibanco' },
        });
        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).toHaveBeenCalledWith('/banks/{id}', {
            params: { path: { id: ITAU.id } },
            body: { name: 'Itaú Unibanco' },
        });
    });

    it('closes without calling the API when the name did not change', async () => {
        await renderWithApp(<BankFormDialog bank={ITAU} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar banco' });

        save(form);

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it('shows an unexpected error in the form alert', async () => {
        mocks.patch.mockRejectedValue(new TypeError('boom'));
        await renderWithApp(<BankFormDialog bank={ITAU} onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Editar banco' });

        fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Outro' } });
        save(form);

        expect(await within(form).findByRole('alert')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes with Esc through the dialog', async () => {
        await renderWithApp(<BankFormDialog onClose={onClose} />);
        const form = await screen.findByRole('dialog', { name: 'Novo banco' });

        fireEvent.keyDown(form, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
