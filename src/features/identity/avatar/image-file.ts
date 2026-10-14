/** Tipos oferecidos pelo seletor de arquivo (spec 0006). */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Arquivo original acima de 20 MB é recusado antes de decodificar (ERR-0006-08). */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Lado da foto gerada, em pixels. */
export const AVATAR_SIZE = 256;

/** Qualidade da exportação, em WebP ou JPEG. */
export const AVATAR_QUALITY = 0.85;

/** Mensagens do diálogo para o arquivo escolhido (ERR-0006-08). */
export const AVATAR_FILE_MESSAGES = {
    tooLarge: 'Esta imagem é grande demais. Escolha uma de até 20 MB.',
    undecodable: 'Não foi possível abrir esta imagem. Use uma foto em JPEG, PNG ou WebP.',
} as const;

/** A mensagem de recusa do arquivo antes de decodificar, ou `null` se ele pode seguir. */
export function rejectSourceFile(file: Pick<File, 'size'>): string | null {
    return file.size > MAX_SOURCE_BYTES ? AVATAR_FILE_MESSAGES.tooLarge : null;
}

/** Tipo de saída do `canvas`, na ordem de preferência. */
export type AvatarType = 'image/webp' | 'image/jpeg';

/** `canvas.toBlob` em forma de promessa. */
export type EncodeCanvas = (type: AvatarType, quality: number) => Promise<Blob | null>;

/**
 * Exporta em WebP com qualidade 0,85; se o navegador não gerar WebP (o `toBlob` devolve outro
 * tipo, geralmente PNG, ou nada), em JPEG com a mesma qualidade.
 */
export async function encodeAvatar(encode: EncodeCanvas): Promise<Blob> {
    const webp = await encode('image/webp', AVATAR_QUALITY);
    if (webp?.type === 'image/webp') return webp;
    const jpeg = await encode('image/jpeg', AVATAR_QUALITY);
    if (jpeg?.type === 'image/jpeg') return jpeg;
    throw new Error('O navegador não gerou a foto.');
}
