import { describe, expect, it } from 'vitest';

import { ApiError, networkError, toApiError, unwrap } from './api-error';
import { CLIENT_ERROR_MESSAGES, ERROR_MESSAGES } from './catalog';

describe('ApiError conversion', () => {
    it('NETWORK_ERROR has status 0 and the client catalog message (ERR-0005-01)', () => {
        const error = networkError();
        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(0);
        expect(error.code).toBe('NETWORK_ERROR');
        expect(error.userMessage).toBe(CLIENT_ERROR_MESSAGES.NETWORK_ERROR);
    });

    it.each([
        ['HTML from a proxy', 502, '<html>Bad gateway</html>'],
        ['JSON without error.code', 500, { error: { message: 'x' } }],
        ['JSON with an unknown code', 500, { error: { code: 'NOPE' } }],
        ['a non-object body', 500, undefined],
    ])('UNEXPECTED_RESPONSE for %s (ERR-0005-02)', (_name, status, body) => {
        const error = toApiError(status, body);
        expect(error.code).toBe('UNEXPECTED_RESPONSE');
        expect(error.status).toBe(status);
        expect(error.userMessage).toBe(CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE);
    });

    it('uses the catalog message and never the backend message (INV-0005-03)', () => {
        const details = [{ path: ['name'] }];
        const error = toApiError(400, {
            error: { code: 'VALIDATION_ERROR', message: 'body message', details },
        });
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.status).toBe(400);
        expect(error.details).toBe(details);
        expect(error.userMessage).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
        expect(error.message).not.toContain('body message');
    });

    it('unwrap returns data on success', () => {
        expect(unwrap({ data: { a: 1 }, response: new Response() })).toEqual({ a: 1 });
    });

    it('unwrap throws the ApiError on a non-2xx result', () => {
        const response = new Response(null, { status: 404 });
        expect(() =>
            unwrap({ error: { error: { code: 'ROUTE_NOT_FOUND' } }, response }),
        ).toThrowError(expect.objectContaining({ code: 'ROUTE_NOT_FOUND', status: 404 }));
    });

    it('unwrap throws UNEXPECTED_RESPONSE for a non-2xx result without a body', () => {
        const response = new Response(null, { status: 500 });
        expect(() => unwrap({ response })).toThrowError(
            expect.objectContaining({ code: 'UNEXPECTED_RESPONSE', status: 500 }),
        );
    });
});
