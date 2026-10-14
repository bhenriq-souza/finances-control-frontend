import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { useCardLookup } from '@/api/queries/lookups';
import { formatMonth, monthOf } from '@/shared/dates';
import { EmptyState } from '@/ui/empty-state';
import { Skeleton } from '@/ui/skeleton';

import { asApiError, statementDetailQuery } from '../panel/statement-model';
import { usePaymentActions } from '../payment/payment-actions';
import { StatementBadge, StatementBody, StatementDates } from '../panel/statement-parts';
import { RefundActions } from '../refunds/refund-actions';

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

/**
 * Detalhe de uma fatura persistida (`/cartoes/$cartaoId/faturas/$faturaId`, spec 0013), só
 * leitura: período, vencimento, selo, valores, por tipo, despesas (cada uma leva ao detalhe dela),
 * estornos e pagamentos. `404 STATEMENT_NOT_FOUND` mostra o `nao-encontrado` (ERR-0009-02);
 * outra falha, o `erro` (ERR-0009-01).
 */
export function StatementDetailPage({
    cardId,
    statementId,
}: {
    cardId: string;
    statementId: string;
}) {
    const query = useQuery(statementDetailQuery(statementId));
    const cards = useCardLookup();
    const payment = usePaymentActions(query.data);
    const cardHref = `/cartoes/${cardId}`;

    let content;
    if (query.isError) {
        const error = asApiError(query.error);
        content = error.code.endsWith('_NOT_FOUND') ? (
            <EmptyState
                variant="nao-encontrado"
                backTo={cardHref}
                backLabel="Voltar para o cartão"
            />
        ) : (
            <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />
        );
    } else if (!query.data) {
        content = (
            <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    } else {
        const statement = query.data;
        content = (
            <RefundActions cardId={cardId}>
                {(refunds) => (
                    <article className="flex flex-col gap-6">
                        <header className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-titulo-1">
                                    Fatura de {formatMonth(monthOf(statement.closesOn))}
                                </h1>
                                <StatementBadge statement={statement} />
                            </div>
                            <StatementDates statement={statement} />
                            {refunds.newRefund && (
                                <div className="flex flex-wrap gap-3">{refunds.newRefund}</div>
                            )}
                        </header>
                        {payment.actions}
                        <StatementBody
                            statement={statement}
                            level={2}
                            refundActions={refunds.rowActions}
                            paymentAction={payment.paymentAction}
                        />
                    </article>
                )}
            </RefundActions>
        );
    }

    return (
        <div className="flex max-w-4xl flex-col gap-4">
            <Link
                to={cardHref}
                className={`inline-flex min-h-11 items-center gap-1 self-start ${LINK_CLASS}`}
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {cards.label(cardId) || 'Cartão'}
            </Link>
            {content}
            {payment.dialogs}
        </div>
    );
}
