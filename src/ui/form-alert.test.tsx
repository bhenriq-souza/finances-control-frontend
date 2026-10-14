import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormAlert } from './form-alert';

describe('FormAlert', () => {
    it('announces the form error', () => {
        render(<FormAlert message="Você não tem permissão para fazer isso." />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Você não tem permissão para fazer isso.',
        );
    });

    it('renders nothing without a message', () => {
        const { container } = render(<FormAlert message={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
});
