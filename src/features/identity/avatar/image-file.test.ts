import { describe, expect, it, vi } from 'vitest';

import {
    AVATAR_FILE_MESSAGES,
    AVATAR_QUALITY,
    encodeAvatar,
    MAX_SOURCE_BYTES,
    rejectSourceFile,
    type EncodeCanvas,
} from './image-file';

describe('source file check (ERR-0006-08)', () => {
    it('refuses a file above 20 MB before decoding', () => {
        expect(rejectSourceFile({ size: MAX_SOURCE_BYTES + 1 })).toBe(
            'Esta imagem é grande demais. Escolha uma de até 20 MB.',
        );
        expect(rejectSourceFile({ size: MAX_SOURCE_BYTES })).toBeNull();
        expect(rejectSourceFile({ size: 1200 })).toBeNull();
    });

    it('has the contract message for a file the browser cannot decode', () => {
        expect(AVATAR_FILE_MESSAGES.undecodable).toBe(
            'Não foi possível abrir esta imagem. Use uma foto em JPEG, PNG ou WebP.',
        );
    });
});

describe('output format (INV-0006-07)', () => {
    const blob = (type: string) => new Blob(['x'], { type });

    it('exports WebP with quality 0.85 when the browser generates it', async () => {
        const encode = vi.fn<EncodeCanvas>().mockResolvedValue(blob('image/webp'));
        const result = await encodeAvatar(encode);
        expect(result.type).toBe('image/webp');
        expect(encode).toHaveBeenCalledTimes(1);
        expect(encode).toHaveBeenCalledWith('image/webp', AVATAR_QUALITY);
        expect(AVATAR_QUALITY).toBe(0.85);
    });

    it('falls back to JPEG 0.85 when the browser answers WebP with another type', async () => {
        const encode = vi
            .fn<EncodeCanvas>()
            .mockImplementation((type) =>
                Promise.resolve(blob(type === 'image/webp' ? 'image/png' : type)),
            );
        const result = await encodeAvatar(encode);
        expect(result.type).toBe('image/jpeg');
        expect(encode).toHaveBeenLastCalledWith('image/jpeg', 0.85);
    });

    it('falls back to JPEG when WebP gives nothing, and fails if nothing is generated', async () => {
        const jpeg = vi
            .fn<EncodeCanvas>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(blob('image/jpeg'));
        expect((await encodeAvatar(jpeg)).type).toBe('image/jpeg');

        const none = vi.fn<EncodeCanvas>().mockResolvedValue(null);
        await expect(encodeAvatar(none)).rejects.toThrow();
    });
});
