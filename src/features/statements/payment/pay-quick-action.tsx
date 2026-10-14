import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { useCardLookup } from '@/api/queries/lookups';
import { RowMenu } from '@/ui/row-menu';

import { statementDetailQuery, type Statement } from '../panel/statement-model';

import { PayDialog } from './pay-dialog';
import { canPay } from './payment-model';

/** A fatura cujo pagamento está aberto: o id da fatura e o do cartão. */
export interface StatementPayRequest {
    statementId: string;
    cardId: string;
}

export interface StatementPayQuickAction {
    /** O menu da linha com **Pagar fatura**; `undefined` sem `entries.write`. */
    rowMenu: ((statement: Statement) => ReactNode) | undefined;
    /** O diálogo de pagamento aberto por `request`; `null` sem `entries.write`. */
    dialogs: ReactNode;
}

/** **Pagar fatura** numa linha: só a fatura fechada, persistida, com restante a pagar. */
function payableFromRow(statement: Statement): statement is Statement & { id: string } {
    return statement.id !== null && statement.status === 'CLOSED' && canPay(statement);
}

/**
 * **Pagar fatura** sobre outra tela (spec 0015, fluxo de caixa): o menu da linha e o mesmo
 * diálogo e a mesma mutação do detalhe da fatura (spec 0013, "Pagar"; INV-0015-06). A fatura
 * aberta vem de `request`, independente da rota: quem usa traduz os seus parâmetros de busca (o
 * fluxo de caixa, `?acao=pagar&fatura=<id>&cartao=<id>`). Só com `entries.write`.
 */
export function useStatementPayQuickAction(
    request: StatementPayRequest | undefined,
    onRequestChange: (next: StatementPayRequest | undefined) => void,
): StatementPayQuickAction {
    const writable = useCan('entries.write');
    const cards = useCardLookup();
    if (!writable) return { rowMenu: undefined, dialogs: null };

    return {
        rowMenu: (statement) =>
            payableFromRow(statement) ? (
                <RowMenu
                    label={`Ações da fatura ${cards.label(statement.creditCardId)}`}
                    items={[
                        {
                            label: 'Pagar fatura',
                            onSelect: () =>
                                onRequestChange({
                                    statementId: statement.id,
                                    cardId: statement.creditCardId,
                                }),
                        },
                    ]}
                />
            ) : null,
        dialogs: request && (
            <PayHost
                key={request.statementId}
                request={request}
                onClose={() => onRequestChange(undefined)}
            />
        ),
    };
}

/**
 * Lê a fatura (`GET /statements/{id}`) e abre o pagamento. Id desconhecido, cartão que não é o da
 * fatura ou fatura que não se paga pela linha: ignorado e o pedido removido. Aberto, o diálogo
 * continua aberto mesmo que a recarga tire a ação (o alerta do erro fica à vista).
 */
function PayHost({ request, onClose }: { request: StatementPayRequest; onClose: () => void }) {
    const query = useQuery(statementDetailQuery(request.statementId));
    const statement = query.data;
    const allowed =
        statement !== undefined &&
        statement.creditCardId === request.cardId &&
        payableFromRow(statement);
    const [latched, setLatched] = useState(false);
    if (allowed && !latched) setLatched(true);
    const open = allowed || latched;
    const dead = !open && (query.isError || (statement !== undefined && !allowed));

    useEffect(() => {
        if (dead) onClose();
    }, [dead, onClose]);

    if (!open || !statement) return null;
    return <PayDialog statement={statement} onClose={onClose} />;
}
