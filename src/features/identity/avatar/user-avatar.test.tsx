import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { fail, ok, renderWithUser, stubObjectUrls } from './test-utils';
import { UserAvatar } from './user-avatar';

const V1 = '2026-10-14T12:00:00Z';
const V2 = '2026-10-14T13:00:00Z';
const PHOTO = new Blob(['webp'], { type: 'image/webp' });

let urls: ReturnType<typeof stubObjectUrls>;

beforeEach(() => {
    mocks.get.mockReset();
    urls = stubObjectUrls();
});

const avatar = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]')!;
const photo = (container: HTMLElement) =>
    container.querySelector<HTMLImageElement>('img[data-slot="foto"]');

describe('UserAvatar (AC-0006-15, ERR-0006-10)', () => {
    it('shows the initials and asks for nothing without a photo', async () => {
        const { container } = await renderWithUser(
            <UserAvatar avatarUpdatedAt={null} fallback="AS" size="sm" />,
        );
        expect(avatar(container)).toHaveTextContent('AS');
        expect(photo(container)).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it('reads the photo as a Blob with the version in the URL and shows it once loaded', async () => {
        mocks.get.mockResolvedValue(ok(PHOTO));
        const { container } = await renderWithUser(
            <UserAvatar avatarUpdatedAt={V1} fallback="AS" size="sm" />,
        );

        await waitFor(() => expect(photo(container)).toHaveAttribute('src', 'blob:foto-1'));
        expect(mocks.get).toHaveBeenCalledWith('/users/me/avatar', {
            params: { query: { v: V1 } },
            parseAs: 'blob',
        });
        expect(urls.create).toHaveBeenCalledWith(PHOTO);
        // Até a imagem carregar, as iniciais continuam.
        expect(avatar(container)).toHaveTextContent('AS');
        expect(photo(container)).toHaveClass('invisible');

        fireEvent.load(photo(container)!);
        expect(avatar(container)).not.toHaveTextContent('AS');
        expect(photo(container)).not.toHaveClass('invisible');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each([
        [404, 'AVATAR_NOT_FOUND'],
        [500, 'INTERNAL_ERROR'],
    ])('keeps the initials, without an alert, when the photo answers %i', async (status, code) => {
        mocks.get.mockResolvedValue(fail(status, code));
        const { container } = await renderWithUser(
            <UserAvatar avatarUpdatedAt={V1} fallback="AS" size="lg" />,
        );

        await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
        expect(avatar(container)).toHaveTextContent('AS');
        expect(photo(container)).toBeNull();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the initials when the browser cannot show the photo', async () => {
        mocks.get.mockResolvedValue(ok(PHOTO));
        const { container } = await renderWithUser(
            <UserAvatar avatarUpdatedAt={V1} fallback="AS" size="sm" />,
        );
        await waitFor(() => expect(photo(container)).toHaveAttribute('src'));

        fireEvent.error(photo(container)!);
        expect(avatar(container)).toHaveTextContent('AS');
    });

    it('asks again only when the version changes, revoking the old URL', async () => {
        mocks.get.mockResolvedValue(ok(PHOTO));
        const { container, rerender, unmount } = await renderWithUser(
            <UserAvatar avatarUpdatedAt={V1} fallback="AS" size="sm" />,
        );
        await waitFor(() => expect(photo(container)).toHaveAttribute('src', 'blob:foto-1'));

        rerender(<UserAvatar avatarUpdatedAt={V1} fallback="AS" size="sm" />);
        expect(mocks.get).toHaveBeenCalledTimes(1);

        const next = new Blob(['novo'], { type: 'image/webp' });
        mocks.get.mockResolvedValue(ok(next));
        rerender(<UserAvatar avatarUpdatedAt={V2} fallback="AS" size="sm" />);
        await waitFor(() => expect(photo(container)).toHaveAttribute('src', 'blob:foto-2'));
        expect(mocks.get).toHaveBeenCalledTimes(2);
        expect(mocks.get).toHaveBeenLastCalledWith('/users/me/avatar', {
            params: { query: { v: V2 } },
            parseAs: 'blob',
        });
        expect(urls.revoke).toHaveBeenCalledWith('blob:foto-1');

        unmount();
        expect(urls.revoke).toHaveBeenCalledWith('blob:foto-2');
    });
});
