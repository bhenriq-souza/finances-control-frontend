import type { components } from '../generated/schema';

import { CLIENT_ERROR_MESSAGES, ERROR_MESSAGES } from './catalog';

/** Código de erro do contrato (`components.schemas.ErrorCode`). */
export type ErrorCode = components['schemas']['ErrorCode'];

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';

interface ApiErrorInit {
    status: number;
    code: ApiErrorCode;
    details?: unknown;
}

function messageFor(code: ApiErrorCode): string {
    return code === 'NETWORK_ERROR' || code === 'UNEXPECTED_RESPONSE'
        ? CLIENT_ERROR_MESSAGES[code]
        : ERROR_MESSAGES[code];
}

/**
 * Erro de toda chamada à API (spec 0005). `userMessage` vem sempre do catálogo pelo `code`
 * (INV-0005-03): o `message` do backend nunca é guardado nem exibido.
 */
export class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode;
    readonly details?: unknown;
    readonly userMessage: string;

    constructor({ status, code, details }: ApiErrorInit) {
        const userMessage = messageFor(code);
        super(userMessage);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.userMessage = userMessage;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
    return typeof value === 'string' && Object.hasOwn(ERROR_MESSAGES, value);
}

/** Falha de rede, DNS ou servidor inalcançável (ERR-0005-01). */
export function networkError(): ApiError {
    return new ApiError({ status: 0, code: 'NETWORK_ERROR' });
}

/** Converte o corpo de uma resposta não-2xx (schema `Error` do contrato) em `ApiError`. */
export function toApiError(status: number, body: unknown): ApiError {
    const error = isRecord(body) ? body.error : undefined;
    if (isRecord(error) && isErrorCode(error.code)) {
        return new ApiError({ status, code: error.code, details: error.details });
    }
    return new ApiError({ status, code: 'UNEXPECTED_RESPONSE' });
}

interface ClientResult<T> {
    data?: T;
    error?: unknown;
    response: Response;
}

/** Devolve `data` ou lança o `ApiError`: é o que `queryFn` e `mutationFn` usam. */
export function unwrap<T>(result: ClientResult<T>): T {
    if (result.error === undefined && result.response.ok) return result.data as T;
    throw toApiError(result.response.status, result.error);
}
