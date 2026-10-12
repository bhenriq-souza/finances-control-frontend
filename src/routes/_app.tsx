import { createFileRoute, Outlet } from '@tanstack/react-router';

import { guardApp } from '@/app/routes/guard';

/** Layout das rotas com sessão e perfil; o app shell entra aqui na T-0006-03. */
export const Route = createFileRoute('/_app')({
    beforeLoad: guardApp,
    component: Outlet,
});
