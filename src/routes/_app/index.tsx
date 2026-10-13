import { createFileRoute } from '@tanstack/react-router';

import { Dashboard } from '@/features/reporting';

/** Tela inicial: o dashboard de saldo (spec 0015). */
export const Route = createFileRoute('/_app/')({
    component: Dashboard,
});
