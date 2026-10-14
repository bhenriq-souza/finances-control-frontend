import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { moneySchema } from '@/shared/money';

import { MoneyInput } from './money-input';

const formSchema = z.object({ amount: moneySchema() });

function TestForm({ onValid }: { onValid: (cents: number) => void }) {
    const { control, handleSubmit } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: { amount: '' },
    });
    return (
        <form
            onSubmit={(event) => {
                void handleSubmit((data) => {
                    onValid(data.amount);
                })(event);
            }}
        >
            <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                    <MoneyInput
                        label="Valor"
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={fieldState.error?.message}
                    />
                )}
            />
            <button type="submit">Salvar</button>
        </form>
    );
}

function setup() {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);
    return { onValid, input: screen.getByLabelText('Valor') as HTMLInputElement };
}

async function submit() {
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
}

describe('MoneyInput with moneySchema', () => {
    it('renders an accessible decimal text field with the R$ prefix', () => {
        const { input } = setup();
        expect(input).toHaveAttribute('inputmode', 'decimal');
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.getByText('R$')).toBeInTheDocument();
    });

    it('AC-0008-05: delivers 123450 on submitting 1234,5', async () => {
        const { onValid, input } = setup();
        fireEvent.change(input, { target: { value: '1234,5' } });
        await submit();
        await waitFor(() => {
            expect(onValid).toHaveBeenCalledWith(123450);
        });
    });

    it('AC-0008-05: reformats valid text to 1.234,50 on blur', () => {
        const { input } = setup();
        fireEvent.change(input, { target: { value: '1234,5' } });
        expect(input.value).toBe('1234,5');
        fireEvent.blur(input);
        expect(input.value).toBe('1.234,50');
    });

    it('keeps invalid text untouched on blur', () => {
        const { input } = setup();
        fireEvent.change(input, { target: { value: '12.34' } });
        fireEvent.blur(input);
        expect(input.value).toBe('12.34');
    });

    it.each([
        ['', 'Informe o valor.'],
        ['12.34', 'Use o formato 1.234,56.'],
        ['0', 'O valor precisa ser maior que zero.'],
    ])('AC-0008-05: shows the message for %j', async (text, message) => {
        const { onValid, input } = setup();
        fireEvent.change(input, { target: { value: text } });
        await submit();
        const error = await screen.findByText(message);
        expect(onValid).not.toHaveBeenCalled();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription(message);
        expect(error).toHaveAttribute('id', input.getAttribute('aria-describedby'));
    });
});
