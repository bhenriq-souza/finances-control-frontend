import { act, screen } from '@testing-library/react';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRuntimeConfigForTests } from '@/shared/config';

import { bootstrap } from './bootstrap';

const VALID = {
    environment: 'local',
    firebase: {
        apiKey: 'api-key',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
};

let container: HTMLElement;
let root: Root | undefined;

async function mount() {
    await act(async () => {
        root = bootstrap(container);
    });
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    container.remove();
    delete window.__FTECH_CONFIG__;
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
});

describe('bootstrap — fatal configuration errors', () => {
    it('shows the ERR-0003-01 screen and nothing else when /config.js is missing', async () => {
        await mount();

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Configuração da aplicação ausente. Avise o administrador.',
        );
        expect(screen.queryByText('FTech Finance')).not.toBeInTheDocument();
        expect(container.children).toHaveLength(1);
    });

    it('shows the ERR-0003-02 screen and logs the invalid fields when firebase.apiKey is missing', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { apiKey: _omitted, ...firebase } = VALID.firebase;
        window.__FTECH_CONFIG__ = { ...VALID, firebase };

        await mount();

        expect(screen.getByRole('alert')).toHaveTextContent('Configuração da aplicação inválida.');
        expect(screen.queryByText('FTech Finance')).not.toBeInTheDocument();
        expect(consoleError).toHaveBeenCalledWith('Configuração de runtime inválida:', [
            expect.stringMatching(/^firebase\.apiKey: /),
        ]);
    });

    it('mounts the application when the configuration is valid', async () => {
        window.__FTECH_CONFIG__ = VALID;

        await mount();

        expect(await screen.findByRole('heading', { name: /FTech Finance/ })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
