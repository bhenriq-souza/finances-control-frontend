import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiError, type ErrorCode } from './api-error';
import { CLIENT_ERROR_MESSAGES } from './catalog';

/**
 * Onde fica o erro que não é de um campo: `formState.errors.root.api`, mostrado pelo `FormAlert`
 * do topo do formulário. O react-hook-form limpa os erros `root.*` no envio seguinte.
 */
export const FORM_ALERT_KEY = 'root.api';

/** Como os erros da API chegam aos campos de um formulário. */
export interface ApiFieldMap<TValues extends FieldValues> {
    /**
     * Primeiro segmento de `details[].path` de um `VALIDATION_ERROR` → campo do formulário
     * (ex.: `{ name: 'name' }`).
     */
    fields?: Readonly<Record<string, FieldPath<TValues>>>;
    /** Código de erro → campo do formulário (ex.: `{ BANK_ALREADY_EXISTS: 'febrabanCode' }`). */
    codes?: Readonly<Partial<Record<ErrorCode, FieldPath<TValues>>>>;
}

/** O que `applyApiError` usa do formulário: só `setError`, nunca `reset` (INV-0009-06). */
export interface FormErrorTarget<TValues extends FieldValues> {
    setError: UseFormSetError<TValues>;
}

function firstPathSegments(details: unknown): (string | null)[] {
    if (!Array.isArray(details)) return [];
    return details.map((issue: unknown) => {
        if (typeof issue !== 'object' || issue === null) return null;
        const path = (issue as { path?: unknown }).path;
        if (!Array.isArray(path) || path.length === 0) return null;
        const head: unknown = path[0];
        return typeof head === 'string' || typeof head === 'number' ? String(head) : null;
    });
}

/**
 * Leva o erro de uma escrita ao formulário (spec 0009, _Erros da API num formulário_):
 * - `VALIDATION_ERROR`: cada issue cujo primeiro segmento do `path` está em `fieldMap.fields` vira
 *   erro do campo, com a mensagem do catálogo; o que não casar vai para o alerta;
 * - código em `fieldMap.codes`: erro do campo, com a mensagem do catálogo;
 * - qualquer outro código (ou erro que não é `ApiError`): o alerta, com `userMessage`.
 *
 * Só chama `setError`: o formulário continua aberto e com os valores digitados (INV-0009-06).
 */
export function applyApiError<TValues extends FieldValues>(
    error: unknown,
    form: FormErrorTarget<TValues>,
    fieldMap: ApiFieldMap<TValues> = {},
): void {
    function alert(type: string, message: string) {
        form.setError(FORM_ALERT_KEY, { type, message });
    }

    if (!(error instanceof ApiError)) {
        alert('UNEXPECTED_RESPONSE', CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE);
        return;
    }
    const { code, userMessage } = error;
    const fields = fieldMap.fields ?? {};

    if (code === 'VALIDATION_ERROR') {
        const segments = firstPathSegments(error.details);
        let unmatched = segments.length === 0;
        let shouldFocus = true;
        for (const segment of segments) {
            if (segment !== null && Object.hasOwn(fields, segment)) {
                form.setError(
                    fields[segment]!,
                    { type: code, message: userMessage },
                    { shouldFocus },
                );
                shouldFocus = false;
            } else {
                unmatched = true;
            }
        }
        if (unmatched) alert(code, userMessage);
        return;
    }

    const codes: Partial<Record<string, FieldPath<TValues>>> = fieldMap.codes ?? {};
    const field = Object.hasOwn(codes, code) ? codes[code] : undefined;
    if (field) {
        form.setError(field, { type: code, message: userMessage }, { shouldFocus: true });
        return;
    }
    alert(code, userMessage);
}
