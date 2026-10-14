import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

// Página de prova do `FormDialog` e do `ConfirmDialog` (AC-0009-06); o mecanismo está no layout
// `[_]e2e.tsx`.
export const Route = createFileRoute('/_e2e/formulario')({
    component:
        import.meta.env.MODE === 'e2e'
            ? lazyRouteComponent(() => import('./-formulario-page'), 'FormProofPage')
            : undefined,
});
