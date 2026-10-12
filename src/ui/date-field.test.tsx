import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DateField } from './date-field';

describe('DateField', () => {
    it('is a native date input whose value is already YYYY-MM-DD', () => {
        render(<DateField label="Data" defaultValue="2026-10-12" />);

        const input = screen.getByLabelText('Data');
        expect(input).toHaveAttribute('type', 'date');
        expect(input).toHaveValue('2026-10-12');
        fireEvent.change(input, { target: { value: '2026-11-01' } });
        expect(input).toHaveValue('2026-11-01');
        expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('links the error by aria-describedby and marks aria-invalid', () => {
        render(<DateField label="Data" error="Informe a data." />);

        const input = screen.getByLabelText('Data');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAccessibleDescription('Informe a data.');
    });
});
