import { ApiError } from './api-error';
import { CLIENT_ERROR_MESSAGES } from './catalog';

interface ErrorMessageProps {
    error: unknown;
}

/** Mostra a mensagem do catálogo de um `ApiError`; nunca o `message` do corpo (INV-0005-03). */
export function ErrorMessage({ error }: ErrorMessageProps) {
    const message =
        error instanceof ApiError ? error.userMessage : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;
    return <p role="alert">{message}</p>;
}
