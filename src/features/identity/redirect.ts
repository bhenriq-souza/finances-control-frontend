/**
 * Destino do `redirect` do login: só caminhos internos (INV-0006-06). Externo, relativo ao
 * protocolo (`//host`), com esquema ou com barra invertida vira `/` (ERR-0006-07).
 */
export function safeRedirect(value: unknown): string {
    if (typeof value !== 'string') return '/';
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    // `/\host` é tratado como `//host` pelos navegadores; caracteres de controle também enganam.
    if (/[\\\s]/.test(value)) return '/';
    return value;
}
