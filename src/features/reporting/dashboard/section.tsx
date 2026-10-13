import { clsx } from 'clsx';
import { useId, type ReactNode } from 'react';

import { EmptyState } from '@/ui/empty-state';

import { asApiError } from './dashboard-queries';

/** O mínimo de uma consulta do TanStack Query que a seção lê. */
export interface Loadable {
    data: unknown;
    error: unknown;
    isError: boolean;
    refetch: () => unknown;
}

export type SectionState = 'loading' | 'error' | 'ready';

/** Estado de uma seção: erro se alguma consulta falhou, carregando enquanto falta dado. */
export function sectionState(queries: readonly Loadable[]): SectionState {
    if (queries.some((query) => query.isError)) return 'error';
    if (queries.some((query) => query.data === undefined)) return 'loading';
    return 'ready';
}

/**
 * O que a seção mostra: o `EmptyState` de erro (ERR-0015-01) com **Tentar de novo** para as
 * consultas que falharam, o esqueleto enquanto carrega, ou o conteúdo. Cada seção tem o seu: a
 * falha de uma consulta não derruba as outras (INV-0015-04).
 */
export function SectionContent({
    queries,
    skeleton,
    children,
}: {
    queries: readonly Loadable[];
    skeleton: ReactNode;
    children: () => ReactNode;
}) {
    const state = sectionState(queries);
    if (state === 'error') {
        const failed = queries.filter((query) => query.isError);
        return (
            <EmptyState
                variant="erro"
                error={asApiError(failed[0]?.error)}
                onRetry={() => {
                    for (const query of failed) void query.refetch();
                }}
            />
        );
    }
    if (state === 'loading') {
        return (
            <div role="status" aria-label="Carregando">
                {skeleton}
            </div>
        );
    }
    return <>{children()}</>;
}

/** `SectionContent` de uma consulta só, com o dado já presente para o conteúdo. */
export function QueryContent<T>({
    query,
    skeleton,
    children,
}: {
    query: Loadable & { data: T | undefined };
    skeleton: ReactNode;
    children: (data: T) => ReactNode;
}) {
    return (
        <SectionContent queries={[query]} skeleton={skeleton}>
            {() => (query.data === undefined ? null : children(query.data))}
        </SectionContent>
    );
}

/** Uma seção do dashboard: `<section>` nomeada pelo seu título `h2`, com ação opcional. */
export function Section({
    title,
    action,
    className,
    children,
}: {
    title: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    const id = useId();
    return (
        <section aria-labelledby={id} className={clsx('flex min-w-0 flex-col gap-3', className)}>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
                <h2 id={id} className="text-titulo-3 text-texto">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/** Painel com borda e superfície, no desenho dos cartões do Design System. */
export const PANEL = 'rounded-lg border border-linha bg-superficie p-4 md:p-5';
