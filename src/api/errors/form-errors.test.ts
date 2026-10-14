import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { CLIENT_ERROR_MESSAGES, ERROR_MESSAGES } from './catalog';
import { applyApiError, FORM_ALERT_KEY, type ApiFieldMap } from './form-errors';

interface BankForm {
    name: string;
    febrabanCode: string;
}

const TYPED: BankForm = { name: 'Nubank', febrabanCode: '260' };

const FIELD_MAP: ApiFieldMap<BankForm> = {
    fields: { name: 'name', febrabanCode: 'febrabanCode' },
    codes: { BANK_ALREADY_EXISTS: 'febrabanCode' },
};

function setup() {
    const { result } = renderHook(() => {
        const form = useForm<BankForm>({ defaultValues: TYPED });
        // Lido no render, como um formulário faz: assina o `formState.errors`.
        return { form, errors: form.formState.errors };
    });
    function apply(error: unknown, fieldMap: ApiFieldMap<BankForm> = FIELD_MAP) {
        act(() => applyApiError(error, result.current.form, fieldMap));
    }
    const errors = () => result.current.errors;
    const values = () => result.current.form.getValues();
    return { apply, errors, values };
}

const validation = (details: unknown) =>
    new ApiError({ status: 400, code: 'VALIDATION_ERROR', details });

// AC-0009-07, INV-0009-06.
describe('applyApiError', () => {
    it('puts a VALIDATION_ERROR on the field of its first path segment, with the catalog message', () => {
        const { apply, errors, values } = setup();

        apply(validation([{ path: ['name'], code: 'too_small', message: 'Too small' }]));

        expect(errors().name).toMatchObject({
            type: 'VALIDATION_ERROR',
            message: ERROR_MESSAGES.VALIDATION_ERROR,
        });
        expect(errors().febrabanCode).toBeUndefined();
        expect(errors().root).toBeUndefined();
        expect(values()).toEqual(TYPED);
    });

    it('maps nested paths by their first segment and sends unmatched issues to the alert', () => {
        const { apply, errors } = setup();

        apply(
            validation([
                { path: ['febrabanCode', 0], code: 'invalid', message: 'x' },
                { path: ['owner', 'id'], code: 'invalid', message: 'x' },
            ]),
        );

        expect(errors().febrabanCode?.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
        expect(errors().root?.api?.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    });

    it('sends a VALIDATION_ERROR without usable details to the alert', () => {
        for (const details of [undefined, [], [null], [{ path: [] }], [{ path: [{}] }], [{}]]) {
            const { apply, errors } = setup();
            apply(validation(details));
            expect(errors().root?.api).toMatchObject({
                type: 'VALIDATION_ERROR',
                message: ERROR_MESSAGES.VALIDATION_ERROR,
            });
            expect(errors().name).toBeUndefined();
        }
    });

    it('ignores path segments that only exist on the object prototype', () => {
        const { apply, errors } = setup();
        apply(validation([{ path: ['constructor'] }]), { fields: { name: 'name' } });
        expect(errors().root?.api?.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    });

    it('puts a code from fieldMap.codes on its field, with the catalog message', () => {
        const { apply, errors, values } = setup();

        apply(new ApiError({ status: 409, code: 'BANK_ALREADY_EXISTS' }));

        expect(errors().febrabanCode).toMatchObject({
            type: 'BANK_ALREADY_EXISTS',
            message: ERROR_MESSAGES.BANK_ALREADY_EXISTS,
        });
        expect(errors().root).toBeUndefined();
        expect(values()).toEqual(TYPED);
    });

    it('sends any other code to the form alert, keeping the typed values', () => {
        const { apply, errors, values } = setup();

        apply(new ApiError({ status: 403, code: 'FORBIDDEN' }));

        expect(FORM_ALERT_KEY).toBe('root.api');
        expect(errors().root?.api).toMatchObject({
            type: 'FORBIDDEN',
            message: ERROR_MESSAGES.FORBIDDEN,
        });
        expect(errors().name).toBeUndefined();
        expect(errors().febrabanCode).toBeUndefined();
        expect(values()).toEqual(TYPED);
    });

    it('works without a field map', () => {
        const { apply, errors } = setup();
        apply(new ApiError({ status: 409, code: 'BANK_ALREADY_EXISTS' }), {});
        expect(errors().root?.api?.message).toBe(ERROR_MESSAGES.BANK_ALREADY_EXISTS);

        const second = setup();
        second.apply(validation([{ path: ['name'] }]), {});
        expect(second.errors().root?.api?.message).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    });

    it('sends a network failure and a non-ApiError to the alert with a catalog message', () => {
        const network = setup();
        network.apply(new ApiError({ status: 0, code: 'NETWORK_ERROR' }));
        expect(network.errors().root?.api?.message).toBe(CLIENT_ERROR_MESSAGES.NETWORK_ERROR);

        const unknown = setup();
        unknown.apply(new Error('boom'));
        expect(unknown.errors().root?.api).toMatchObject({
            type: 'UNEXPECTED_RESPONSE',
            message: CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE,
        });
        expect(unknown.values()).toEqual(TYPED);
    });
});
