/** Textos das telas de erro fatal da configuração de runtime (spec 0003). */
export const FATAL_MESSAGES = {
    /** ERR-0003-01 */
    missingConfig: 'Configuração da aplicação ausente. Avise o administrador.',
    /** ERR-0003-02 */
    invalidConfig: 'Configuração da aplicação inválida.',
} as const;

interface FatalErrorProps {
    message: string;
}

/** Tela de erro fatal: sem tema, sem shell, sem roteador — nada mais é montado. */
export function FatalError({ message }: FatalErrorProps) {
    return (
        <main role="alert" className="flex min-h-screen items-center justify-center p-6">
            <p className="max-w-md text-center text-lg">{message}</p>
        </main>
    );
}
