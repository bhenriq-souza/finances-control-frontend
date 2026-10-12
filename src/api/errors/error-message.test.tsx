import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toApiError } from './api-error';
import { CLIENT_ERROR_MESSAGES, ERROR_MESSAGES } from './catalog';
import { ErrorMessage } from './error-message';

describe('ErrorMessage', () => {
    it('shows the catalog text for VALIDATION_ERROR, not the body message (AC-0005-07)', () => {
        const error = toApiError(400, {
            error: { code: 'VALIDATION_ERROR', message: 'name must be a string' },
        });
        render(<ErrorMessage error={error} />);
        expect(screen.getByRole('alert').textContent).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
        expect(screen.queryByText(/name must be a string/)).toBeNull();
    });

    it('falls back to the unexpected-response text for a non-ApiError', () => {
        render(<ErrorMessage error={new Error('boom')} />);
        expect(screen.getByRole('alert').textContent).toBe(
            CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
        );
    });
});
