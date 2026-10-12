import type { UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';

type AccountField = 'fromBankAccountId' | 'toBankAccountId';

interface AccountValues {
    fromBankAccountId: string;
    toBankAccountId: string;
}

const ACCOUNT_CODES = new Set(['BANK_ACCOUNT_ARCHIVED', 'BANK_ACCOUNT_NOT_FOUND']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * O campo De ou Para que o `details` de um erro de conta aponta: pelo nome do campo ou pelo id da
 * conta enviada. Sem indicação, nenhum — e o erro vai para o alerta (spec 0018, "Mapa de erros").
 */
export function accountFieldOf(details: unknown, sent: AccountValues): AccountField | null {
    if (!isRecord(details)) return null;
    const { field, bankAccountId } = details;
    if (field === 'fromBankAccountId' || field === 'toBankAccountId') return field;
    if (typeof bankAccountId === 'string') {
        if (bankAccountId === sent.fromBankAccountId) return 'fromBankAccountId';
        if (bankAccountId === sent.toBankAccountId) return 'toBankAccountId';
    }
    return null;
}

/**
 * Leva o erro de uma escrita de transferência ao formulário: conta arquivada ou inexistente no
 * campo De ou Para quando o `details` diz qual; o resto por `applyApiError` (ERR-0018-01/03).
 */
export function applyTransferError<TValues extends AccountValues>(
    error: unknown,
    form: { setError: UseFormSetError<TValues> },
    sent: AccountValues,
    fieldMap: ApiFieldMap<TValues>,
): void {
    if (error instanceof ApiError && ACCOUNT_CODES.has(error.code)) {
        const field = accountFieldOf(error.details, sent);
        if (field) {
            // `field` é chave de `AccountValues`, que `TValues` estende.
            const setError = form.setError as unknown as UseFormSetError<AccountValues>;
            setError(
                field,
                { type: error.code, message: error.userMessage },
                { shouldFocus: true },
            );
            return;
        }
    }
    applyApiError(error, form, fieldMap);
}

/** Mensagem do catálogo de um erro de consulta ou de ação (nunca o `message` da API). */
export function errorMessageOf(error: unknown): string {
    return error instanceof ApiError
        ? error.userMessage
        : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;
}
