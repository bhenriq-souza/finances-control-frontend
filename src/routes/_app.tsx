import { createFileRoute } from '@tanstack/react-router';

import { guardApp } from '@/app/routes/guard';
import { AppShell } from '@/app/shell/app-shell';

/** Layout das rotas com sessão e perfil: a guarda e o app shell (spec 0006). */
export const Route = createFileRoute('/_app')({
    beforeLoad: guardApp,
    component: AppShell,
});
