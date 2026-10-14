import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { AuthSessionProvider, type AuthSession, type CurrentUser } from '@/features/identity';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';
import { ThemeProvider } from '@/ui/theme/theme-provider';

import { UserMenu } from './user-menu';

function me(avatarUpdatedAt: string | null): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile: 'VIEWER',
        profileGrantedAt: null,
        avatarUpdatedAt,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

async function renderMenu(user: CurrentUser) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createRouter({
        routeTree: createRootRoute({ component: () => <UserMenu user={user} /> }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <ThemeProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthSessionProvider session={{} as AuthSession}>
                        <NoticeProvider store={createNoticeStore()}>
                            <RouterProvider router={router} />
                        </NoticeProvider>
                    </AuthSessionProvider>
                </QueryClientProvider>
            </ThemeProvider>,
        );
    });
}

const trigger = () => screen.getByRole('button', { name: 'Menu do usuário' });
const panel = () => screen.getByRole('region', { name: 'Conta do usuário' });

beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({
        data: new Blob(['webp'], { type: 'image/webp' }),
        response: new Response(null, { status: 200 }),
    });
    let next = 0;
    URL.createObjectURL = vi.fn(() => `blob:foto-${++next}`);
    URL.revokeObjectURL = vi.fn();
});

describe('UserMenu photo (spec 0006)', () => {
    it('without a photo: initials, "Adicionar foto" and no "Remover foto" (AC-0006-15, AC-0006-18)', async () => {
        await renderMenu(me(null));
        expect(trigger()).toHaveTextContent('AS');
        expect(trigger().querySelector('img')).toBeNull();

        fireEvent.click(trigger());
        expect(within(panel()).getByRole('button', { name: 'Adicionar foto' })).toBeVisible();
        expect(within(panel()).queryByRole('button', { name: 'Remover foto' })).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('with a photo: the 32px button and the 48px panel show it, with both actions', async () => {
        await renderMenu(me('2026-10-14T12:00:00Z'));
        await waitFor(() => expect(trigger().querySelector('img')).toHaveAttribute('src'));
        expect(mocks.get).toHaveBeenCalledTimes(1);
        expect(trigger().querySelector('.size-8')).not.toBeNull();

        fireEvent.click(trigger());
        await waitFor(() => expect(panel().querySelector('img')).toHaveAttribute('src'));
        expect(panel().querySelector('.size-12')).not.toBeNull();
        expect(within(panel()).getByRole('button', { name: 'Alterar foto' })).toBeVisible();
        expect(within(panel()).getByRole('button', { name: 'Remover foto' })).toBeVisible();
        // A foto é a mesma consulta: o painel não a pede de novo.
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    it('closes the panel and opens the photo dialog or the removal confirmation', async () => {
        await renderMenu(me('2026-10-14T12:00:00Z'));

        fireEvent.click(trigger());
        fireEvent.click(within(panel()).getByRole('button', { name: 'Alterar foto' }));
        expect(screen.queryByRole('region', { name: 'Conta do usuário' })).toBeNull();
        expect(screen.getByRole('dialog', { name: 'Foto do perfil' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('dialog', { name: 'Foto do perfil' })).toBeNull();

        fireEvent.click(trigger());
        fireEvent.click(within(panel()).getByRole('button', { name: 'Remover foto' }));
        expect(screen.getByRole('alertdialog', { name: 'Remover sua foto?' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});
