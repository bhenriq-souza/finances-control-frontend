import { createRouter, type RouterHistory } from '@tanstack/react-router';

import { routeTree } from '../routeTree.gen';

import type { RouterContext } from './router-context';
import { GuardError, GuardLoading } from './routes/guard-screens';

/** `history` só nos testes; a aplicação usa o histórico do navegador. */
export function createAppRouter(context: RouterContext, history?: RouterHistory) {
    return createRouter({
        routeTree,
        context,
        history,
        // A espera da sessão e de `/users/me` mostra o símbolo da marca, nunca o login (spec 0006).
        defaultPendingComponent: GuardLoading,
        defaultPendingMs: 0,
        defaultPendingMinMs: 0,
        defaultErrorComponent: GuardError,
    });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
    interface Register {
        router: AppRouter;
    }
}
