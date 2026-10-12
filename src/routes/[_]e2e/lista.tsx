import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

// Página de prova do `EntryList` (AC-0009-05); o mecanismo está no layout `[_]e2e.tsx`.
export const Route = createFileRoute('/_e2e/lista')({
    component:
        import.meta.env.MODE === 'e2e'
            ? lazyRouteComponent(() => import('./-lista-page'), 'ListProofPage')
            : undefined,
});
