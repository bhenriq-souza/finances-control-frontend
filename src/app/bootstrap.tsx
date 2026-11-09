import { setNonce } from 'get-nonce';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { setTokenProvider } from '@/api/auth';
import { getAuthClient } from '@/features/identity';
import { getRuntimeConfig, RuntimeConfigError } from '@/shared/config';

import { App } from './app';
import { FATAL_MESSAGES, FatalError } from './fatal-error';

/**
 * Entrega ao `react-style-singleton` (Radix: scroll-lock dos diálogos) o nonce da CSP que o nginx
 * pôs na meta `csp-nonce` (spec 0022). Sem a meta (dev, testes), não faz nada.
 */
function applyCspNonce(): void {
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
    if (nonce) setNonce(nonce);
}

/**
 * Lê a configuração de runtime e monta a aplicação. Sem configuração válida, monta só a tela de
 * erro fatal (ERR-0003-01 e ERR-0003-02).
 */
export function bootstrap(container: HTMLElement): Root {
    applyCspNonce();
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

    // Antes de o roteador montar: nenhuma chamada à API sai sem o provider.
    setTokenProvider((forceRefresh) => getAuthClient().getIdToken(forceRefresh));
    root.render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
    return root;
}
