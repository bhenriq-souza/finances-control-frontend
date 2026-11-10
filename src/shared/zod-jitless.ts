import { z } from 'zod';

/**
 * Desliga a compilação JIT do zod (spec 0022). Com a CSP sem `unsafe-eval`, a sonda `new Function`
 * do zod é bloqueada e reportada como violação mesmo com o erro capturado. Precisa rodar antes de
 * qualquer schema ser criado: importe este módulo primeiro em `main.tsx`.
 */
z.config({ jitless: true });
