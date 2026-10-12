import { z } from 'zod';

/** Email obrigatório e bem formado, com a mensagem pt-BR dos formulários de autenticação. */
export const emailSchema = z.string().trim().pipe(z.email('Informe um email válido.'));

export const MIN_PASSWORD_LENGTH = 8;
