import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { BrandSymbol } from '@/ui/brand/brand';
import { Button } from '@/ui/components/ui/button';

/** Espera da sessão e de `/users/me`: só o símbolo da marca, sem piscar o login (spec 0006). */
export function GuardLoading() {
    return (
        <main
            role="status"
            aria-label="Carregando"
            className="flex min-h-dvh items-center justify-center bg-fundo"
        >
            <BrandSymbol className="size-12 animate-pulse motion-reduce:animate-none" />
        </main>
    );
}

/**
 * Falha que a guarda não resolve com um redirecionamento: rede, 5xx, `AUTH_UNAVAILABLE`
 * (ERR-0006-04, ERR-0006-05). A mensagem vem do catálogo; **Tentar de novo** refaz a navegação
 * com a sessão mantida.
 */
export function GuardError({ error, reset }: ErrorComponentProps) {
    const router = useRouter();
    const message =
        error instanceof ApiError ? error.userMessage : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;
    return (
        <main className="flex min-h-dvh items-center justify-center bg-fundo px-4 text-texto">
            <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
                <BrandSymbol className="size-12" />
                <p role="alert" className="text-corpo">
                    {message}
                </p>
                <Button
                    onClick={() => {
                        reset();
                        void router.invalidate();
                    }}
                >
                    Tentar de novo
                </Button>
            </div>
        </main>
    );
}
