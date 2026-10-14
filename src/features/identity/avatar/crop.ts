/** Zoom do recorte (spec 0006): de 1× (o lado menor da imagem cabe inteiro) a 3×. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** Tamanho da imagem decodificada, já na orientação certa. */
export interface ImageSize {
    width: number;
    height: number;
}

/** Estado do recorte: o centro do quadrado, em pixels da imagem, e o zoom. */
export interface CropState {
    centerX: number;
    centerY: number;
    zoom: number;
}

/** A área da imagem que vai para o `canvas`: um quadrado de lado `size` a partir de `(x, y)`. */
export interface CropRect {
    x: number;
    y: number;
    size: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Lado do quadrado recortado, em pixels da imagem: o lado menor dividido pelo zoom. */
export function cropSize(image: ImageSize, zoom: number): number {
    return Math.min(image.width, image.height) / clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

/**
 * Prende o zoom ao intervalo e o centro de modo que o quadrado fique inteiro dentro da imagem: o
 * recorte nunca deixa área vazia.
 */
export function clampCrop(image: ImageSize, state: CropState): CropState {
    const zoom = clamp(state.zoom, MIN_ZOOM, MAX_ZOOM);
    const half = cropSize(image, zoom) / 2;
    return {
        zoom,
        centerX: clamp(state.centerX, half, image.width - half),
        centerY: clamp(state.centerY, half, image.height - half),
    };
}

/** Recorte inicial: centralizado, com o zoom mínimo. */
export function initialCrop(image: ImageSize): CropState {
    return { centerX: image.width / 2, centerY: image.height / 2, zoom: MIN_ZOOM };
}

/** A área recortada do estado, sempre inteira dentro da imagem. */
export function cropRect(image: ImageSize, state: CropState): CropRect {
    const { centerX, centerY, zoom } = clampCrop(image, state);
    const size = cropSize(image, zoom);
    return { x: centerX - size / 2, y: centerY - size / 2, size };
}

/**
 * Arrastar: `dx`/`dy` em pixels da tela, sobre um quadro de `viewport` pixels. A imagem acompanha
 * o ponteiro, então o recorte anda no sentido oposto.
 */
export function panCrop(
    image: ImageSize,
    state: CropState,
    dx: number,
    dy: number,
    viewport: number,
): CropState {
    const current = clampCrop(image, state);
    const scale = cropSize(image, current.zoom) / viewport;
    return clampCrop(image, {
        ...current,
        centerX: current.centerX - dx * scale,
        centerY: current.centerY - dy * scale,
    });
}

/** Muda o zoom mantendo o centro (preso de novo, porque um quadrado maior pode sair da imagem). */
export function zoomCrop(image: ImageSize, state: CropState, zoom: number): CropState {
    return clampCrop(image, { ...state, zoom });
}
