import { getRuntimeConfig } from '@/shared/config';

/** Página provisória de `/` até a página do spike (T-0003-02). */
export function ProvisionalHome() {
    const { environment } = getRuntimeConfig();
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6">
            <h1 className="text-2xl font-semibold">FTech Finance</h1>
            <p>
                Ambiente: <span data-testid="environment">{environment}</span>
            </p>
        </main>
    );
}
