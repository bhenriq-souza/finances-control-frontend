import { createFileRoute } from '@tanstack/react-router';

import { MorePage } from '@/app/shell/more-page';

/** Página **Mais** da navegação no celular e no tablet; no desktop, redireciona para `/` (spec 0009). */
export const Route = createFileRoute('/_app/mais')({
    component: MorePage,
});
