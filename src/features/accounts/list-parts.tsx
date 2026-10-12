import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiError, networkError } from '@/api/errors/api-error';
import type { BankAccount } from '@/api/queries/reference';
import { EmptyState } from '@/ui/empty-state';
import { EntryListSkeleton } from '@/ui/skeleton';

/** `type` da conta bancária em pt-BR (spec 0011, "Contas"). */
export const ACCOUNT_TYPE_LABELS: Readonly<Record<BankAccount['type'], string>> = {
    CHECKING: 'Corrente',
    SAVINGS: 'Poupança',
    INVESTMENT: 'Investimento',
};

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Cópia ordenada pelo texto de `textOf`, na ordem do pt-BR. */
export function sortByText<T>(items: readonly T[], textOf: (item: T) => string): T[] {
    return [...items].sort((a, b) => collator.compare(textOf(a), textOf(b)));
}

/** Os ativos (`archivedAt === null`), ou todos quando a tela mostra os arquivados. */
export function visibleItems<T extends { archivedAt: string | null }>(
    items: readonly T[],
    showArchived: boolean,
): T[] {
    return showArchived ? [...items] : items.filter((item) => item.archivedAt === null);
}

/**
 * Carregando, erro (ERR-0009-01) ou o conteúdo com o dado da consulta de referência. Sem dado,
 * o esqueleto; com falha, o `EmptyState` `erro` com **Tentar de novo**.
 */
export function QueryContent<T>({
    query,
    children,
}: {
    query: Pick<UseQueryResult<T>, 'data' | 'error' | 'refetch'>;
    children: (data: T) => ReactNode;
}) {
    if (query.data !== undefined) return <>{children(query.data)}</>;
    if (query.error) {
        const error = query.error instanceof ApiError ? query.error : networkError();
        return <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />;
    }
    return <EntryListSkeleton />;
}

/** "Mostrar arquivadas"/"Mostrar arquivados": a caixa que liga `?arquivadas=1`/`?arquivados=1`. */
export function ArchivedToggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-corpo text-texto">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="size-5 accent-acento"
            />
            {label}
        </label>
    );
}
