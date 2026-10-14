import type { CropRect } from './crop';
import { AVATAR_SIZE, encodeAvatar, type AvatarType } from './image-file';

/**
 * Decodifica o arquivo escolhido já na orientação do EXIF (spec 0006). Rejeita se o navegador não
 * decodifica o formato (HEIC num navegador sem suporte, por exemplo).
 */
export function decodeImage(file: Blob): Promise<ImageBitmap> {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Desenha a área recortada ocupando o `canvas` inteiro. */
export function drawCrop(canvas: HTMLCanvasElement, image: CanvasImageSource, rect: CropRect) {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        image,
        rect.x,
        rect.y,
        rect.size,
        rect.size,
        0,
        0,
        canvas.width,
        canvas.height,
    );
}

/**
 * A foto enviada (INV-0006-07): o recorte redesenhado num `canvas` de 256 × 256 e exportado em
 * WebP (ou JPEG). Desenhar no `canvas` descarta os metadados do arquivo original.
 */
export function renderAvatar(image: CanvasImageSource, rect: CropRect): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    drawCrop(canvas, image, rect);
    return encodeAvatar(
        (type: AvatarType, quality: number) =>
            new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
    );
}
