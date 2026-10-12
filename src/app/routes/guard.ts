import { redirect, type ParsedLocation } from '@tanstack/react-router';

import { ApiError } from '@/api/errors/api-error';
import { currentUserQueryOptions, type CurrentUser } from '@/features/identity';

import type { RouterContext } from '../router-context';

interface GuardArgs {
    context: RouterContext;
    location: ParsedLocation;
}

const toSignIn = (location: ParsedLocation) =>
    redirect({ to: '/entrar', search: { redirect: location.href } });

/**
 * `beforeLoad` do layout `_app` (spec 0006, "Guarda das rotas autenticadas"): nada de `_app`
 * renderiza antes de `/users/me` responder com perfil (INV-0006-01), e cada estado da conta só
 * vê a sua tela (INV-0006-02). Rede, 5xx e `AUTH_UNAVAILABLE` sobem para a tela de erro com a
 * sessão mantida (ERR-0006-04, ERR-0006-05).
 */
export async function guardApp({
    context,
    location,
}: GuardArgs): Promise<{ currentUser: CurrentUser }> {
    const user = await context.auth.ready();
    if (!user) throw toSignIn(location);

    let currentUser: CurrentUser;
    try {
        currentUser = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    } catch (error) {
        if (error instanceof ApiError) {
            if (error.code === 'EMAIL_NOT_VERIFIED') throw redirect({ to: '/verificar-email' });
            if (error.code === 'UNAUTHENTICATED' || error.code === 'TOKEN_EXPIRED') {
                await context.auth.signOut();
                throw toSignIn(location);
            }
        }
        throw error;
    }
    if (currentUser.profile === null) throw redirect({ to: '/aguardando-aprovacao' });
    return { currentUser };
}

/** `beforeLoad` de `/entrar`, `/criar-conta` e `/redefinir-senha`: com sessão, vai para `/`. */
export async function redirectIfSignedIn({ context }: Pick<GuardArgs, 'context'>): Promise<void> {
    if (await context.auth.ready()) throw redirect({ to: '/' });
}

/** `beforeLoad` de `/verificar-email` e `/aguardando-aprovacao`: exigem sessão. */
export async function requireSession({ context, location }: GuardArgs): Promise<void> {
    if (!(await context.auth.ready())) throw toSignIn(location);
}
