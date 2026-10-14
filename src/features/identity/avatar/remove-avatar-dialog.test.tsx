import { QueryObserver } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get, DELETE: mocks.del } }));

import { ERROR_MESSAGES } from '@/api/errors/catalog';
import { currentUserQueryOptions } from '@/api/queries/current-user';

import { RemoveAvatarDialog } from './remove-avatar-dialog';
import { currentUser, fail, ok, renderWithUser } from './test-utils';

const WITH_PHOTO = currentUser({ avatarUpdatedAt: '2026-10-14T12:00:00Z' });
const WITHOUT_PHOTO = currentUser();

beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue(ok({ data: WITHOUT_PHOTO }));
    mocks.del.mockReset().mockResolvedValue(ok(undefined, 204));
});

async function open() {
    const onClose = vi.fn();
    const result = await renderWithUser(<RemoveAvatarDialog onClose={onClose} />, WITH_PHOTO);
    // `GET /users/me` ativo, como no shell: a invalidação o consulta de novo.
    new QueryObserver(result.queryClient, currentUserQueryOptions()).subscribe(() => undefined);
    return { onClose, ...result };
}

describe('RemoveAvatarDialog (AC-0006-18)', () => {
    it('confirms, sends DELETE, asks /users/me again and shows "Foto removida."', async () => {
        const { onClose } = await open();
        expect(screen.getByRole('alertdialog', { name: 'Remover sua foto?' })).toHaveTextContent(
            'As iniciais voltam a aparecer.',
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
        });

        expect(mocks.del).toHaveBeenCalledWith('/users/me/avatar');
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.get).toHaveBeenCalledWith('/users/me');
        expect(screen.getByText('Foto removida.')).toBeInTheDocument();
    });

    it('keeps the confirmation open with the catalog message on an error', async () => {
        mocks.del.mockResolvedValue(fail(403, 'FORBIDDEN'));
        const { onClose } = await open();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
        });

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.FORBIDDEN),
        );
        expect(onClose).not.toHaveBeenCalled();
    });

    it('shows the generic message for a non-API failure, and Cancelar closes', async () => {
        mocks.del.mockRejectedValue(new Error('boom'));
        const { onClose } = await open();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
        });
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onClose).toHaveBeenCalled();
    });
});
