import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { getRuntimeConfig, RuntimeConfigError } from '@/shared/config';

import { App } from './app';
import { FATAL_MESSAGES, FatalError } from './fatal-error';

/**
 * Lê a configuração de runtime e monta a aplicação. Sem configuração válida, monta só a tela de
 * erro fatal (ERR-0003-01 e ERR-0003-02).
 */
export function bootstrap(container: HTMLElement): Root {
    const root = createRoot(container);
    try {
        getRuntimeConfig();
    } catch (error) {
        if (!(error instanceof RuntimeConfigError)) throw error;
        if (error.kind === 'invalid') {
            console.error('Configuração de runtime inválida:', error.issues);
        }
        const message =
            error.kind === 'missing' ? FATAL_MESSAGES.missingConfig : FATAL_MESSAGES.invalidConfig;
        root.render(<FatalError message={message} />);
        return root;
    }

    root.render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
    return root;
}
