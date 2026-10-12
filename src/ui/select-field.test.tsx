import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { SelectField } from './select-field';

const OPTIONS = [
    {
        label: 'Contas',
        options: [
            { value: 'cc', label: 'Conta corrente' },
            { value: 'pp', label: 'Poupança' },
        ],
    },
    { label: 'Cartões', options: [{ value: 'visa', label: 'Cartão Visa' }] },
    { value: 'dinheiro', label: 'Dinheiro' },
];

describe('SelectField', () => {
    it('is a native select with a visible label, optional groups and a placeholder', () => {
        render(<SelectField label="Pagar com" placeholder="Escolha" options={OPTIONS} />);

        const select = screen.getByLabelText('Pagar com');
        expect(select.tagName).toBe('SELECT');
        expect(screen.getByRole('group', { name: 'Contas' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Cartões' })).toBeInTheDocument();
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
            'Escolha',
            'Conta corrente',
            'Poupança',
            'Cartão Visa',
            'Dinheiro',
        ]);
        expect(select).toHaveValue('');
        expect(select).not.toHaveAttribute('aria-invalid');
        expect(select).not.toHaveAttribute('aria-describedby');
    });

    it('links the help and the error by aria-describedby and marks aria-invalid', () => {
        render(
            <SelectField
                label="Pagar com"
                id="pagar"
                help="Conta ou cartão."
                error="Escolha a conta ou o cartão."
                options={OPTIONS}
            />,
        );

        const select = screen.getByLabelText('Pagar com');
        expect(select).toHaveAttribute('id', 'pagar');
        expect(select).toHaveAttribute('aria-invalid', 'true');
        expect(select).toHaveAccessibleDescription('Conta ou cartão. Escolha a conta ou o cartão.');
    });

    it('works with register from react-hook-form', () => {
        const onValid = vi.fn();
        function Form() {
            const { register, handleSubmit } = useForm({ defaultValues: { paidWith: 'cc' } });
            return (
                <form onSubmit={(event) => void handleSubmit(onValid)(event)}>
                    <SelectField label="Pagar com" options={OPTIONS} {...register('paidWith')} />
                    <button type="submit">Salvar</button>
                </form>
            );
        }
        render(<Form />);

        const select = screen.getByLabelText('Pagar com');
        expect(select).toHaveValue('cc');
        fireEvent.change(select, { target: { value: 'visa' } });
        expect(select).toHaveValue('visa');
    });
});
