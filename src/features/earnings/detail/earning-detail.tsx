import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAccountLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { EmptyState } from '@/ui/empty-state';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { earningBadge } from '@/ui/status-labels';

import { EARNING_KIND_LABELS, type Earning } from '../list/earning-model';
import { asApiError, earningDetailQuery } from '../list/earnings-query';

import { EarningActions } from './actions/earning-actions';

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

function Row({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-linha py-3 first:border-t-0 md:flex-row md:gap-4">
            <dt className="text-rotulo text-texto-apoio md:w-44 md:shrink-0">{term}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

function Fields({ earning }: { earning: Earning }) {
    const accounts = useAccountLookup();
    return (
        <dl className="flex flex-col rounded-md border border-linha bg-superficie px-4">
            <Row term="Natureza">{EARNING_KIND_LABELS[earning.kind]}</Row>
            <Row term="Tipo">{earning.earningType.name}</Row>
            <Row term="Conta">{accounts.label(earning.bankAccountId)}</Row>
            <Row term="Data prevista">{formatDate(earning.occurredOn, 'longa')}</Row>
            <Row term="Recebida em">
                {earning.receivedOn ? formatDate(earning.receivedOn, 'longa') : '—'}
            </Row>
            {earning.installment && (
                <Row term="Parcela">
                    <span className="flex flex-col gap-1 md:flex-row md:gap-3">
                        <span>
                            {earning.installment.number} de {earning.installment.total}
                        </span>
                        <Link
                            to="/receitas"
                            search={{ grupo: earning.installment.groupId }}
                            className={LINK_CLASS}
                        >
                            Ver todas as parcelas
                        </Link>
                    </span>
                </Row>
            )}
            <Row term="Observações">
                <span className="whitespace-pre-line">{earning.notes ?? '—'}</span>
            </Row>
        </dl>
    );
}

function DetailSkeleton() {
    return (
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export interface EarningDetailProps {
    earningId: string;
}

/**
 * Detalhe de uma receita, só leitura (spec 0014, "Detalhe"): todos os campos da resposta, o selo,
 * a conta por nome e, numa parcela, o link para o parcelamento inteiro. `404 EARNING_NOT_FOUND`
 * vira o estado "não encontrado" (ERR-0009-02); outra falha, o estado de erro (ERR-0009-01).
 */
export function EarningDetail({ earningId }: EarningDetailProps) {
    const query = useQuery(earningDetailQuery(earningId));

    let content: ReactNode;
    if (query.isError) {
        const error = asApiError(query.error);
        content =
            error.code === 'EARNING_NOT_FOUND' ? (
                <EmptyState variant="nao-encontrado" backTo="/receitas" />
            ) : (
                <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />
            );
    } else if (!query.data) {
        content = <DetailSkeleton />;
    } else {
        const earning = query.data;
        content = (
            <article className="flex flex-col gap-4 md:gap-6">
                <header className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-titulo-1">{earning.description}</h1>
                        <StatusBadge badge={earningBadge(earning)} />
                    </div>
                    <Money
                        cents={earning.amountCents}
                        sign="always"
                        tone="auto"
                        size="valor-destaque"
                    />
                    <EarningActions earning={earning} />
                </header>
                <Fields earning={earning} />
            </article>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <Link
                to="/receitas"
                className="inline-flex min-h-11 items-center gap-1 self-start text-corpo-forte text-texto-apoio outline-none hover:text-texto focus-visible:ring-2 focus-visible:ring-foco"
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Receitas
            </Link>
            {content}
        </div>
    );
}
