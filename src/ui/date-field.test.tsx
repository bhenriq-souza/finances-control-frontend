import { zodResolver } from '@hookform/resolvers/zod';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { dateSchema, optionalDateSchema } from '@/shared/dates';

import { DateField } from './date-field';

const schema = z.object({
    occurredOn: dateSchema('Informe a data.'),
    dueOn: optionalDateSchema(),
});
type Values = z.infer<typeof schema>;

function Harness({
    defaults = { occurredOn: '', dueOn: '' },
    onSubmit = () => {},
    min,
    max,
}: {
    defaults?: Values;
    onSubmit?: (values: Values) => void;
    min?: string;
    max?: string;
}) {
    const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
    return (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <DateField
                control={form.control}
                name="occurredOn"
                label="Data"
                help="Quando aconteceu."
                min={min}
                max={max}
            />
            <DateField control={form.control} name="dueOn" label="Vencimento" />
            <button type="submit">Salvar</button>
            <button
                type="button"
                onClick={() => form.reset({ occurredOn: '2026-03-07', dueOn: '' })}
            >
                Recarregar
            </button>
        </form>
    );
}

async function submit() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });
}

const type = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('DateField (AC-0009-12)', () => {
    it('is a numeric text field with the dd/mm/aaaa mask over a YYYY-MM-DD value', () => {
        render(<Harness defaults={{ occurredOn: '2026-10-12', dueOn: '' }} />);

        const input = screen.getByLabelText('Data');
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('inputmode', 'numeric');
        expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa');
        expect(input).toHaveValue('12/10/2026');
        expect(input).toHaveAccessibleDescription('Quando aconteceu.');
        expect(screen.getByLabelText('Vencimento')).toHaveValue('');
    });

    it('masks the typed digits and submits YYYY-MM-DD; pasting aaaa-mm-dd is the same', async () => {
        const onSubmit = vi.fn();
        render(<Harness onSubmit={onSubmit} />);

        type('Data', '0511');
        expect(screen.getByLabelText('Data')).toHaveValue('05/11');
        type('Data', '05112026');
        expect(screen.getByLabelText('Data')).toHaveValue('05/11/2026');
        await submit();
        expect(onSubmit).toHaveBeenLastCalledWith(
            { occurredOn: '2026-11-05', dueOn: '' },
            expect.anything(),
        );

        type('Data', '2026-12-24');
        expect(screen.getByLabelText('Data')).toHaveValue('24/12/2026');
        await submit();
        expect(onSubmit).toHaveBeenLastCalledWith(
            { occurredOn: '2026-12-24', dueOn: '' },
            expect.anything(),
        );
    });

    it.each(['31/02/2026', '05/11/20'])(
        'refuses %s with "Data inválida." and submits nothing',
        async (text) => {
            const onSubmit = vi.fn();
            render(<Harness onSubmit={onSubmit} />);

            type('Data', text);
            await submit();

            const input = screen.getByLabelText('Data');
            expect(input).toHaveValue(text);
            expect(input).toHaveAttribute('aria-invalid', 'true');
            expect(input).toHaveAccessibleDescription('Quando aconteceu. Data inválida.');
            expect(onSubmit).not.toHaveBeenCalled();
        },
    );

    it('asks for a required date and sends an emptied optional one as an empty string', async () => {
        const onSubmit = vi.fn();
        render(<Harness defaults={{ occurredOn: '', dueOn: '2026-10-20' }} onSubmit={onSubmit} />);

        await submit();
        expect(screen.getByLabelText('Data')).toHaveAccessibleDescription(
            'Quando aconteceu. Informe a data.',
        );

        type('Data', '01102026');
        type('Vencimento', '');
        await submit();
        expect(onSubmit).toHaveBeenCalledWith(
            { occurredOn: '2026-10-01', dueOn: '' },
            expect.anything(),
        );
    });

    it('follows the form value when it changes from outside (reset)', async () => {
        render(<Harness />);
        type('Data', '0511');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
        });

        expect(screen.getByLabelText('Data')).toHaveValue('07/03/2026');
    });
});

describe('DateField calendar (AC-0009-13)', () => {
    // O calendário é carregado sob demanda (`React.lazy`, INV-0009-07). Carregue o módulo antes,
    // para que a primeira abertura não dependa do tempo de transformação dele numa máquina lenta (CI).
    beforeAll(async () => {
        await import('./calendar/date-picker-surface');
    });

    async function openCalendar(index = 0) {
        const button = screen.getAllByRole('button', { name: 'Escolher data' })[index]!;
        fireEvent.click(button);
        const dialog = await screen.findByRole('dialog', {
            name: index === 0 ? 'Data' : 'Vencimento',
        });
        return { button, dialog };
    }

    it('opens in pt-BR on the month of the value and picking a day fills, closes and focuses the field', async () => {
        const onSubmit = vi.fn();
        render(<Harness defaults={{ occurredOn: '2026-10-12', dueOn: '' }} onSubmit={onSubmit} />);

        const { dialog } = await openCalendar();
        expect(within(dialog).getByRole('grid', { name: /outubro 2026/i })).toBeInTheDocument();
        const selected = within(dialog).getByRole('button', {
            name: /, 12 de outubro de 2026.*selecionado/,
        });
        await waitFor(() => expect(selected).toHaveFocus());

        fireEvent.click(within(dialog).getByRole('button', { name: /, 20 de outubro de 2026/ }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        const input = screen.getByLabelText('Data');
        expect(input).toHaveValue('20/10/2026');
        await waitFor(() => expect(input).toHaveFocus());
        await submit();
        expect(onSubmit).toHaveBeenCalledWith(
            { occurredOn: '2026-10-20', dueOn: '' },
            expect.anything(),
        );
    });

    it('closes with Esc without changing the value and focuses the button', async () => {
        render(<Harness defaults={{ occurredOn: '2026-10-12', dueOn: '' }} />);

        const { button, dialog } = await openCalendar();
        fireEvent.keyDown(dialog, { key: 'Escape' });

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByLabelText('Data')).toHaveValue('12/10/2026');
        await waitFor(() => expect(button).toHaveFocus());
    });

    it('disables the days outside min and max', async () => {
        render(
            <Harness
                defaults={{ occurredOn: '2026-10-12', dueOn: '' }}
                min="2026-10-05"
                max="2026-10-25"
            />,
        );

        const { dialog } = await openCalendar();
        expect(
            within(dialog).getByRole('button', { name: /, 4 de outubro de 2026/ }),
        ).toBeDisabled();
        expect(
            within(dialog).getByRole('button', { name: /, 26 de outubro de 2026/ }),
        ).toBeDisabled();
        expect(
            within(dialog).getByRole('button', { name: /, 5 de outubro de 2026/ }),
        ).toBeEnabled();
    });
});
