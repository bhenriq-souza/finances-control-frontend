import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors/api-error';
import {
    AuthSessionProvider,
    createAuthSession,
    type AuthClient,
    type AuthUser,
    type CurrentUser,
} from '@/features/identity';
import { ThemeProvider } from '@/ui/theme/theme-provider';

const mocks = vi.hoisted(() => ({ queryFn: vi.fn() }));

// `GET /users/me` simulado no cliente da API: `queryFn` devolve o `UserResponse` ou falha. As
// consultas do dashboard de `/` (spec 0015) ficam pendentes: aqui só importa a rota.
vi.mock('@/api/client', () => ({
    api: {
        GET: async (path: string) =>
            path === '/users/me'
                ? {
                      data: { data: (await mocks.queryFn()) as unknown },
                      response: new Response(null, { status: 200 }),
                  }
                : new Promise(() => undefined),
    },
}));

import { createQueryClient } from '../query-client';
import { createAppRouter } from '../router';

const USER: AuthUser = { uid: 'u1', email: 'ana@example.com', emailVerified: true };

function me(profile: CurrentUser['profile']): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

/** Porta em memória: começa com `initial` e entra como `USER`. */
function fakeClient(initial: AuthUser | null) {
    let current = initial;
    const listeners = new Set<(user: AuthUser | null) => void>();
    const set = (user: AuthUser | null) => {
        current = user;
        listeners.forEach((listener) => listener(user));
    };
    const signIn = vi.fn(() => {
        set(USER);
        return Promise.resolve();
    });
    return {
        onAuthStateChanged(listener) {
            listeners.add(listener);
            listener(current);
            return () => listeners.delete(listener);
        },
        signInWithEmail: signIn,
        signInWithGoogle: signIn,
        signUpWithEmail: signIn,
        signOut: vi.fn(() => {
            set(null);
            return Promise.resolve();
        }),
        getIdToken: vi.fn().mockResolvedValue('tok'),
        sendEmailVerification: vi.fn().mockResolvedValue(undefined),
        sendPasswordReset: vi.fn().mockResolvedValue(undefined),
        reloadUser: vi.fn(() => Promise.resolve(current)),
    } satisfies AuthClient;
}

function renderAt(path: string, user: AuthUser | null) {
    const client = fakeClient(user);
    const queryClient = createQueryClient({
        onUnauthenticated: vi.fn(),
        onProfilePending: vi.fn(),
        onEmailNotVerified: vi.fn(),
        onAuthUnavailable: vi.fn(),
    });
    queryClient.setDefaultOptions({ queries: { retry: false } });
    const auth = createAuthSession(client, queryClient);
    const history = createMemoryHistory({ initialEntries: [path] });
    const router = createAppRouter({ queryClient, auth }, history);
    render(
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <AuthSessionProvider session={auth}>
                    <RouterProvider router={router} />
                </AuthSessionProvider>
            </QueryClientProvider>
        </ThemeProvider>,
    );
    return { client, router };
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { name });

/** O perfil do usuário atual, no menu do usuário do shell. */
async function profileInMenu(label: string) {
    fireEvent.click(await screen.findByRole('button', { name: 'Menu do usuário' }));
    return screen.findByText(label);
}

beforeEach(() => {
    mocks.queryFn.mockReset();
});

describe('routes (spec 0006)', () => {
    it('/entrar signs in and follows an internal redirect to the home', async () => {
        mocks.queryFn.mockResolvedValue(me('ADMIN'));
        const { router } = renderAt('/entrar?redirect=%2F', null);

        await heading('Entrar no FTech Finance');
        fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
        fireEvent.input(screen.getByLabelText('Senha'), { target: { value: 'segredo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        expect(await heading('Início')).toBeInTheDocument();
        expect(await profileInMenu('Administrador')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });

    it('/entrar ignores an external redirect (ERR-0006-07)', async () => {
        mocks.queryFn.mockResolvedValue(me('BILLER'));
        const { router } = renderAt('/entrar?redirect=%2F%2Fexemplo.com', null);

        await heading('Entrar no FTech Finance');
        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

        expect(await heading('Início')).toBeInTheDocument();
        expect(await profileInMenu('Lançador')).toBeInTheDocument();
        expect(router.state.location.href).toBe('/');
    });

    it('/criar-conta leads to the _app guard after sign-up (AC-0006-05)', async () => {
        mocks.queryFn.mockResolvedValue(me(null));
        const { client, router } = renderAt('/criar-conta', null);

        await heading('Criar conta');
        fireEvent.input(screen.getByLabelText('Nome'), { target: { value: 'Ana' } });
        fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
        fireEvent.input(screen.getByLabelText('Senha'), { target: { value: '12345678' } });
        fireEvent.input(screen.getByLabelText('Confirme a senha'), {
            target: { value: '12345678' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

        expect(await heading('Aguardando aprovação')).toBeInTheDocument();
        expect(client.signUpWithEmail).toHaveBeenCalledWith('Ana', 'ana@example.com', '12345678');
        expect(router.state.location.pathname).toBe('/aguardando-aprovacao');
    });

    it('/redefinir-senha renders without a session', async () => {
        renderAt('/redefinir-senha', null);
        expect(await heading('Redefinir senha')).toBeInTheDocument();
    });

    it('/verificar-email goes to / once the backend accepts the email, and signs out', async () => {
        mocks.queryFn.mockResolvedValue(me('VIEWER'));
        const { router } = renderAt('/verificar-email', USER);

        await heading('Verifique seu email');
        fireEvent.click(screen.getByRole('button', { name: 'Já verifiquei' }));
        expect(await heading('Início')).toBeInTheDocument();
        expect(await profileInMenu('Leitor')).toBeInTheDocument();

        await router.navigate({ to: '/verificar-email' });
        fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
        expect(await heading('Entrar no FTech Finance')).toBeInTheDocument();
    });

    it('/aguardando-aprovacao goes to / once there is a profile, and signs out', async () => {
        mocks.queryFn.mockResolvedValue(me('ADMIN'));
        const { router } = renderAt('/aguardando-aprovacao', USER);

        await heading('Aguardando aprovação');
        fireEvent.click(screen.getByRole('button', { name: 'Verificar de novo' }));
        expect(await heading('Início')).toBeInTheDocument();

        await router.navigate({ to: '/aguardando-aprovacao' });
        fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
        expect(await heading('Entrar no FTech Finance')).toBeInTheDocument();
    });

    it('shows the error screen with the catalog message and retries keeping the session (ERR-0006-04)', async () => {
        mocks.queryFn.mockRejectedValueOnce(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
        mocks.queryFn.mockResolvedValue(me('ADMIN'));
        const { client } = renderAt('/', USER);

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Algo deu errado do nosso lado. Tente de novo em instantes.',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

        expect(await heading('Início')).toBeInTheDocument();
        expect(client.signOut).not.toHaveBeenCalled();
    });

    it('shows a generic catalog message for an error that is not an ApiError', async () => {
        mocks.queryFn.mockRejectedValue(new TypeError('boom'));
        renderAt('/', USER);

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
        );
        expect(screen.queryByText('boom')).not.toBeInTheDocument();
    });

    it('shows the brand loading screen while /users/me is pending (INV-0006-01)', async () => {
        mocks.queryFn.mockReturnValue(new Promise(() => undefined));
        renderAt('/', USER);

        expect(await screen.findByRole('status', { name: 'Carregando' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Início' })).not.toBeInTheDocument();
    });
});
