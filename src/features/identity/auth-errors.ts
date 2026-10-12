const INVALID_CREDENTIAL = 'Email ou senha incorretos.';

/** Mensagens pt-BR por `code` do Firebase (spec 0006). O texto do SDK nunca aparece (INV-0006-05). */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
    'auth/invalid-credential': INVALID_CREDENTIAL,
    'auth/user-not-found': INVALID_CREDENTIAL,
    'auth/wrong-password': INVALID_CREDENTIAL,
    'auth/invalid-email': 'Informe um email válido.',
    'auth/user-disabled': 'Esta conta foi desativada. Fale com o administrador.',
    'auth/email-already-in-use': 'Já existe uma conta com este email. Entre ou redefina a senha.',
    'auth/weak-password': 'A senha é fraca demais. Use pelo menos 8 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com o servidor. Verifique a rede e tente de novo.',
    'auth/popup-blocked':
        'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
    'auth/account-exists-with-different-credential':
        'Já existe uma conta com este email. Entre com email e senha.',
};

/** Código sem entrada no catálogo. */
export const GENERIC_AUTH_ERROR = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Popup do Google fechado ou substituído pelo usuário: nada visível (ERR-0006-03). */
const SILENT_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

function codeOf(error: unknown): string | undefined {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : undefined;
}

/** Mensagem a mostrar para uma falha do provedor de autenticação, ou `null` quando nada aparece. */
export function authErrorMessage(error: unknown): string | null {
    const code = codeOf(error);
    if (code && SILENT_CODES.has(code)) return null;
    return (
        (code && Object.hasOwn(AUTH_ERROR_MESSAGES, code) && AUTH_ERROR_MESSAGES[code]) ||
        GENERIC_AUTH_ERROR
    );
}

/** O provedor disse que a conta não existe (redefinição de senha não revela isso). */
export function isUnknownAccount(error: unknown): boolean {
    return codeOf(error) === 'auth/user-not-found';
}
