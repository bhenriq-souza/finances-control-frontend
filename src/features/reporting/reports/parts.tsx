import { clsx } from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';

import { useBankAccounts } from '@/api/queries/reference';
import { Input } from '@/ui/components/ui/input';
import { EmptyState } from '@/ui/empty-state';
import { Field } from '@/ui/field';
import { useNotify } from '@/ui/notice';
import { SelectField } from '@/ui/select-field';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';

import { periodError, type Period } from './period';
import { asApiError } from './queries';

export interface Segment<T extends string> {
    value: T;
    label: string;
}

/** Controle segmentado: um grupo de botões `aria-pressed`, como o filtro de usuários. */
export function SegmentedControl<T extends string>({
    label,
    segments,
    value,
    onChange,
}: {
    label: string;
    segments: readonly Segment<T>[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="flex w-full gap-1 rounded-md border border-linha bg-superficie p-1 md:w-auto md:self-start"
        >
            {segments.map((segment) => (
                <button
                    key={segment.value}
                    type="button"
                    aria-pressed={value === segment.value}
                    onClick={() => onChange(segment.value)}
                    className={clsx(
                        'min-h-11 flex-1 rounded-sm px-3 text-corpo-forte whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-foco md:flex-none',
                        value === segment.value
                            ? 'bg-superficie-elevada text-texto'
                            : 'text-texto-apoio hover:text-texto',
                    )}
                >
                    {segment.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Os dois seletores de mês do período (`de`, `ate`). Só um período válido sobe para a URL e chega
 * à API; com `de` depois de `ate`, ou mais de 120 meses, o erro aparece e nada é pedido
 * (AC-0015-09).
 */
export function PeriodFields({
    period,
    onChange,
}: {
    period: Period;
    onChange: (period: Period) => void;
}) {
    const [draft, setDraft] = useState(period);
    const [error, setError] = useState<string | null>(null);

    const change = (next: Period) => {
        setDraft(next);
        const message = periodError(next.from, next.to);
        setError(message);
        if (message === null) onChange(next);
    };

    return (
        <div role="group" aria-label="Período" className="grid grid-cols-2 gap-3 md:max-w-md">
            <Field label="De">
                {(control) => (
                    <Input
                        {...control}
                        type="month"
                        value={draft.from}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => change({ ...draft, from: event.target.value })}
                    />
                )}
            </Field>
            <Field label="Até" error={error ?? undefined}>
                {(control) => (
                    <Input
                        {...control}
                        type="month"
                        value={draft.to}
                        onChange={(event) => change({ ...draft, to: event.target.value })}
                    />
                )}
            </Field>
        </div>
    );
}

/** Aviso do mapa de erros da spec 0015 para `BANK_ACCOUNT_NOT_FOUND`. */
export const ACCOUNT_NOT_FOUND_NOTICE = 'Conta não encontrada.';

/** Seletor "Conta" das abas de saldo e de fluxo: as contas ativas e a escolhida, se arquivada. */
export function AccountSelect({
    value,
    onChange,
}: {
    value: string | undefined;
    onChange: (bankAccountId: string | undefined) => void;
}) {
    const accounts = useBankAccounts().data ?? [];
    const options = accounts
        .filter((account) => account.archivedAt === null || account.id === value)
        .map((account) => ({ value: account.id, label: account.description }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return (
        <div className="md:w-72">
            <SelectField
                label="Conta"
                placeholder="Todas as contas"
                options={options}
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value || undefined)}
            />
        </div>
    );
}

/**
 * `BANK_ACCOUNT_NOT_FOUND` com uma conta escolhida: o aviso "Conta não encontrada." e o filtro de
 * conta é removido (spec 0015, "Mapa de erros"). `onAccountChange` deve ser estável (um `setState`).
 */
export function useAccountNotFound(
    error: Error | null,
    onAccountChange: (bankAccountId: undefined) => void,
) {
    const notify = useNotify();
    const notFound = error !== null && asApiError(error).code === 'BANK_ACCOUNT_NOT_FOUND';
    useEffect(() => {
        if (!notFound) return;
        notify({ tone: 'erro', message: ACCOUNT_NOT_FOUND_NOTICE });
        onAccountChange(undefined);
    }, [notFound, notify, onAccountChange]);
    return notFound;
}

/**
 * O estado da consulta de uma aba: erro (ERR-0009-01), carregando ou o conteúdo. Com
 * `BANK_ACCOUNT_NOT_FOUND`, segue carregando enquanto o filtro de conta é removido.
 */
export function ReportState<T>({
    query,
    pending = false,
    children,
}: {
    query: { data: T | undefined; error: Error | null; refetch: () => unknown };
    pending?: boolean;
    children: (data: T) => ReactNode;
}) {
    if (query.error && !pending) {
        return (
            <EmptyState
                variant="erro"
                error={asApiError(query.error)}
                onRetry={() => void query.refetch()}
            />
        );
    }
    if (query.data === undefined || pending) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-48 w-full" />
                <EntryListSkeleton />
            </div>
        );
    }
    return <>{children(query.data)}</>;
}

/**
 * Gráfico e tabela com os mesmos números (INV-0015-03): lado a lado a partir de `lg`, a tabela
 * abaixo do gráfico antes disso.
 */
export function ChartWithTable({
    title,
    chart,
    table,
}: {
    title: string;
    chart: ReactNode;
    table: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
            <section
                aria-label={title}
                className="flex flex-col gap-3 rounded-md border border-linha bg-superficie p-4"
            >
                <h2 className="text-titulo-3">{title}</h2>
                {chart}
            </section>
            <div className="min-w-0 md:overflow-x-auto">{table}</div>
        </div>
    );
}

/** Rótulo e valor de um cartão de mês, no celular. */
export function CardRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-pequeno text-texto-apoio">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}
