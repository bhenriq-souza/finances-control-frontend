import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiErrorCode } from '@/api/errors/api-error';
import { ERROR_MESSAGES } from '@/api/errors/catalog';
import type { AuthClient } from '@/features/identity';
import { createNoticeStore } from '@/ui/notice';

const mocks = vi.hoisted(() => ({ client: undefined as unknown as AuthClient }));

vi.mock('@/features/identity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/identity')>()),
    getAuthClient: () => mocks.client,
}));

import { createAppContext } from './app';
import { AppNotices, authUnavailableNotice } from './notices';

function signedOutClient(): AuthClient {
    return {
        onAuthStateChanged: (listener) => {
            listener(null);
            return () => undefined;
        },
        signInWithEmail: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn().mockResolvedValue(undefined),
        getIdToken: vi.fn().mockResolvedValue(null),
        signUpWithEmail: vi.fn(),
        sendEmailVerification: vi.fn(),
        sendPasswordReset: vi.fn(),
        reloadUser: vi.fn(),
    };
}

beforeEach(() => {
    mocks.client = signedOutClient();
});

async function failQuery(context: ReturnType<typeof createAppContext>, code: ApiErrorCode) {
    await act(async () => {
        await context.queryClient
            .fetchQuery({
                queryKey: ['x', code],
                queryFn: () => Promise.reject(new ApiError({ status: 503, code })),
                retry: false,
            })
            .catch(() => undefined);
    });
}

// AC-0009-09, ERR-0009-07.
describe('global notices', () => {
    it('an AUTH_UNAVAILABLE in a query shows the global error notice with the catalog message', async () => {
        const context = createAppContext();
        render(
            <AppNotices store={context.notices}>
                <p>tela</p>
            </AppNotices>,
        );

        await failQuery(context, 'AUTH_UNAVAILABLE');

        const region = screen.getByRole('region', { name: 'Avisos' });
        const message = within(region).getByText(ERROR_MESSAGES.AUTH_UNAVAILABLE);
        expect(message.closest('[data-tone]')).toHaveAttribute('data-tone', 'erro');
        // A consulta continua em erro: a tela mostra o seu estado de erro (ERR-0009-01).
        expect(context.queryClient.getQueryState(['x', 'AUTH_UNAVAILABLE'])?.status).toBe('error');
    });

    it('other codes do not show a global notice', async () => {
        const context = createAppContext();
        render(
            <AppNotices store={context.notices}>
                <p>tela</p>
            </AppNotices>,
        );

        await failQuery(context, 'INTERNAL_ERROR');

        expect(screen.getByRole('region', { name: 'Avisos' })).toBeEmptyDOMElement();
    });

    it('authUnavailableNotice turns the user message into an error notice', () => {
        const store = createNoticeStore();
        authUnavailableNotice(store)('Mensagem do catálogo.');
        expect(store.getSnapshot()).toEqual([
            { id: 1, tone: 'erro', message: 'Mensagem do catálogo.' },
        ]);
    });
});
