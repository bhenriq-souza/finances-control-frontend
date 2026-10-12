import { beforeEach, describe, expect, it, vi } from 'vitest';

// `openapi-fetch` captura `fetch` e `Request` globais ao criar o cliente: os mocks vêm antes dos
// imports (`vi.hoisted`).
const fetchMock = vi.hoisted(() => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    // O `Request` do Node não aceita URL relativa (o navegador resolve pela origem da página).
    const NativeRequest = Request;
    vi.stubGlobal(
        'Request',
        class extends NativeRequest {
            constructor(input: RequestInfo | URL, init?: RequestInit) {
                super(
                    typeof input === 'string' ? new URL(input, 'http://localhost').href : input,
                    init,
                );
            }
        },
    );
    return mock;
});

import { setTokenProvider } from './auth';
import { api } from './client';
import { unwrap } from './errors/api-error';

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const expired = () => json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
const ok = () => json(200, { data: { id: 'u1' } });

function sent(call: number): Request {
    return fetchMock.mock.calls[call]![0] as Request;
}

beforeEach(() => {
    fetchMock.mockReset();
    setTokenProvider(() => Promise.resolve(null));
});

describe('api client', () => {
    it('uses the same-origin /api base URL (INV-0005-02)', async () => {
        fetchMock.mockResolvedValueOnce(ok());
        await api.GET('/users/me');
        expect(new URL(sent(0).url).pathname).toBe('/api/users/me');
    });

    it('sends the bearer token when the provider returns one (AC-0005-02)', async () => {
        const provider = vi.fn().mockResolvedValue('tok-1');
        setTokenProvider(provider);
        fetchMock.mockResolvedValueOnce(ok());
        await api.GET('/users/me');
        expect(provider).toHaveBeenCalledWith(false);
        expect(sent(0).headers.get('Authorization')).toBe('Bearer tok-1');
    });

    it('sends no Authorization header when the provider returns null (AC-0005-02)', async () => {
        fetchMock.mockResolvedValueOnce(ok());
        await api.GET('/users/me');
        expect(sent(0).headers.has('Authorization')).toBe(false);
    });

    it('retries once with forceRefresh on TOKEN_EXPIRED (AC-0005-03, INV-0005-05)', async () => {
        const provider = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('fresh');
        setTokenProvider(provider);
        fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok());
        const result = await api.GET('/users/me');
        expect(provider.mock.calls).toEqual([[false], [true]]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sent(0).headers.get('Authorization')).toBe('Bearer old');
        expect(sent(1).headers.get('Authorization')).toBe('Bearer fresh');
        expect(unwrap(result)).toEqual({ data: { id: 'u1' } });
    });

    it('resends the body on the retry', async () => {
        setTokenProvider(() => Promise.resolve('t'));
        fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok());
        await api.POST('/banks', { body: { febrabanCode: '001', name: 'Banco' } });
        expect(await sent(1).text()).toBe('{"febrabanCode":"001","name":"Banco"}');
    });

    it('turns a second 401 into ApiError without another retry (AC-0005-03)', async () => {
        setTokenProvider(() => Promise.resolve('t'));
        fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(expired());
        const result = await api.GET('/users/me');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(() => unwrap(result)).toThrowError(
            expect.objectContaining({ name: 'ApiError', code: 'TOKEN_EXPIRED', status: 401 }),
        );
    });

    it('does not retry other 401 codes', async () => {
        fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHENTICATED' } }));
        await api.GET('/users/me');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 401 with a non-JSON body', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 401 }));
        await api.GET('/users/me');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries without header when the refreshed token is null', async () => {
        const provider = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce(null);
        setTokenProvider(provider);
        fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok());
        await api.GET('/users/me');
        expect(sent(1).headers.has('Authorization')).toBe(false);
    });

    it('maps a network failure to NETWORK_ERROR', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('failed'));
        await expect(api.GET('/users/me')).rejects.toMatchObject({
            code: 'NETWORK_ERROR',
            status: 0,
        });
    });

    it('maps a network failure on the retry to NETWORK_ERROR', async () => {
        fetchMock.mockResolvedValueOnce(expired()).mockRejectedValueOnce(new TypeError('failed'));
        await expect(api.GET('/users/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
});
