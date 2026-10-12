import { defineConfig } from '@playwright/test';

// Porta configurável para que worktrees de execução paralela rodem o e2e ao mesmo tempo (spec 0003).
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: BASE_URL,
        browserName: 'chromium',
        trace: 'retain-on-failure',
    },
    // Tamanhos dos artboards aprovados do Design (spec 0002, gate e2e).
    projects: [
        { name: 'celular', use: { viewport: { width: 390, height: 844 } } },
        { name: 'tablet', use: { viewport: { width: 834, height: 1112 } } },
        { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    ],
    webServer: {
        command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
        url: BASE_URL,
        // Nunca reaproveita um servidor já no ar: o e2e testa sempre o build desta cópia.
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
