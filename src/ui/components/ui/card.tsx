// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import type { ComponentProps } from 'react';

// Card do shadcn/ui (new-york), com as cores trocadas pelos tokens semânticos.
function Card({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            data-slot="card"
            className={cn(
                'flex flex-col gap-6 rounded-lg border border-linha bg-superficie p-6 text-texto',
                className,
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div data-slot="card-header" className={cn('flex flex-col gap-2', className)} {...props} />
    );
}

function CardTitle({ className, ...props }: ComponentProps<'h1'>) {
    return <h1 data-slot="card-title" className={cn('text-titulo-1', className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
    return (
        <p
            data-slot="card-description"
            className={cn('text-corpo text-texto-apoio', className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div data-slot="card-content" className={cn('flex flex-col gap-4', className)} {...props} />
    );
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
