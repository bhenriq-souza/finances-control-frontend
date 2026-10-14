import { cva, type VariantProps } from 'class-variance-authority';
// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import type { ComponentProps } from 'react';

// Botão do shadcn/ui (new-york), sem `asChild`, com as cores trocadas pelos tokens semânticos.
const buttonVariants = cva(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-corpo-forte whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: 'bg-acento text-sobre-acento hover:bg-acento-hover',
                // Ação destrutiva cheia (spec 0009, decisão de 2026-10-12): `negativo` com o texto
                // `sobre-acento`.
                negativo: 'bg-negativo text-sobre-acento hover:bg-negativo/90',
                outline:
                    'border border-linha-forte bg-superficie text-texto hover:bg-superficie-elevada',
                ghost: 'text-texto hover:bg-superficie-elevada',
                link: 'min-h-0 px-0 text-acento underline-offset-4 hover:underline',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

function Button({
    className,
    variant,
    type = 'button',
    ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            data-slot="button"
            type={type}
            className={cn(buttonVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Button, buttonVariants };
