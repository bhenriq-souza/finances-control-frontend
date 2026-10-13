import { Link } from '@tanstack/react-router';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { Alert } from '@/ui/components/ui/alert';

export const PAID_BY_STATEMENT = 'CREDIT_CARD_EXPENSE_PAID_BY_STATEMENT';

/** Mensagem do catálogo e código de um erro de ação (nunca o `message` da API). */
export function describeError(error: unknown): { message: string; code: string } {
    return error instanceof ApiError
        ? { message: error.userMessage, code: error.code }
        : { message: CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE, code: 'UNEXPECTED_RESPONSE' };
}

/**
 * O alerta de um erro de ação (spec 0012, "Mapa de erros"), com a mensagem do catálogo; em
 * `CREDIT_CARD_EXPENSE_PAID_BY_STATEMENT`, com o link para o cartão.
 */
export function ActionAlert({
    message,
    code,
    cardId,
}: {
    message?: string | null;
    /** O `code` da API (no formulário, o `type` do erro `root.api`). */
    code?: string | number;
    cardId: string | null;
}) {
    if (!message) return null;
    return (
        <Alert role="alert" variant="negativo" className="flex flex-col gap-2">
            <span>{message}</span>
            {code === PAID_BY_STATEMENT && cardId && (
                <Link
                    to="/cartoes/$cartaoId"
                    params={{ cartaoId: cardId }}
                    className="self-start rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco"
                >
                    Ver o cartão
                </Link>
            )}
        </Alert>
    );
}
