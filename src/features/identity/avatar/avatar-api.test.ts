import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get, PUT: mocks.put, DELETE: mocks.del } }));

import { ApiError } from '@/api/errors/api-error';

import { avatarQueryKey, avatarQueryOptions, removeAvatar, uploadAvatar } from './avatar-api';
import { currentUser, fail, ok } from './test-utils';

beforeEach(() => {
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.del.mockReset();
});

describe('avatar API (spec 0006)', () => {
    it('keys the photo by avatarUpdatedAt, outside the users root', () => {
        expect(avatarQueryKey('v1')).toEqual(['user-avatar', 'v1']);
        expect(avatarQueryOptions('v1')).toMatchObject({
            queryKey: ['user-avatar', 'v1'],
            staleTime: Infinity,
            retry: false,
        });
    });

    it('fails the read when the answer is not a Blob', async () => {
        mocks.get.mockResolvedValue(ok(undefined));
        const { queryFn } = avatarQueryOptions('v1');
        await expect((queryFn as () => Promise<Blob>)()).rejects.toMatchObject({
            code: 'UNEXPECTED_RESPONSE',
        });
    });

    it('sends the generated Blob raw, with its Content-Type (INV-0006-07)', async () => {
        const user = currentUser({ avatarUpdatedAt: '2026-10-14T12:00:00Z' });
        mocks.put.mockResolvedValue(ok({ data: user }));
        const photo = new Blob(['webp'], { type: 'image/webp' });

        await expect(uploadAvatar(photo)).resolves.toEqual(user);

        const [path, init] = mocks.put.mock.calls[0] as [
            string,
            { bodySerializer: (body: unknown) => unknown; headers: Record<string, string> },
        ];
        expect(path).toBe('/users/me/avatar');
        expect(init.headers).toEqual({ 'Content-Type': 'image/webp' });
        expect(init.bodySerializer('')).toBe(photo);
    });

    it('throws the catalog error of a rejected upload', async () => {
        mocks.put.mockResolvedValue(fail(413, 'AVATAR_TOO_LARGE'));
        const error = await uploadAvatar(new Blob(['x'], { type: 'image/jpeg' })).catch(
            (e: unknown) => e,
        );
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ code: 'AVATAR_TOO_LARGE' });

        mocks.put.mockResolvedValue(ok({}));
        await expect(uploadAvatar(new Blob(['x']))).rejects.toMatchObject({
            code: 'UNEXPECTED_RESPONSE',
        });
    });

    it('removes the photo with DELETE', async () => {
        mocks.del.mockResolvedValue(ok(undefined, 204));
        await removeAvatar();
        expect(mocks.del).toHaveBeenCalledWith('/users/me/avatar');
    });
});
