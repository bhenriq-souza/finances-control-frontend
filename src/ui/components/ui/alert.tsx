import { cva, type VariantProps } from 'class-variance-authority';
// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import type { ComponentProps } from 'react';

// Alert do shadcn/ui (new-york), com as variantes trocadas pelos tokens semânticos.
const alertVariants = cva('w-full rounded-md border px-4 py-3 text-corpo', {
    variants: {
        variant: {
            info: 'border-info bg-info-fundo text-texto',
            atencao: 'border-atencao bg-atencao-fundo text-texto',
            negativo: 'border-negativo bg-negativo-fundo text-texto',
            positivo: 'border-positivo bg-positivo-fundo text-texto',
        },
    },
    defaultVariants: { variant: 'info' },
});

function Alert({
    className,
    variant,
    ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
    );
}

export { Alert };
