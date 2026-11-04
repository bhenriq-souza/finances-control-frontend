import { createFileRoute, redirect } from '@tanstack/react-router';

import { Dashboard } from '@/features/reporting';

/** Tela inicial: o dashboard de saldo (spec 0015). Admin da plataforma sem espaço vai a `/usuarios` (spec 0021). */
export const Route = createFileRoute('/_app/')({
    beforeLoad: ({ context }) => {
        if (context.currentUser.profile === null)
            throw redirect({ to: '/usuarios', replace: true });
    },
    component: Dashboard,
});
