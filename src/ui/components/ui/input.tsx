// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import type { ComponentProps } from 'react';

// Input do shadcn/ui (new-york), com as cores trocadas pelos tokens semânticos.
function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'flex min-h-11 w-full min-w-0 rounded-md border border-linha-forte bg-superficie px-3 py-2 text-corpo text-texto outline-none placeholder:text-texto-apoio focus-visible:ring-2 focus-visible:ring-foco disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negativo',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
