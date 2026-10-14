// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import type { ComponentProps } from 'react';

// Label do shadcn/ui (new-york) com `<label>` nativo, sem a dependência do Radix.
function Label({ className, ...props }: ComponentProps<'label'>) {
    return (
        <label
            data-slot="label"
            className={cn('text-corpo-forte text-texto select-none', className)}
            {...props}
        />
    );
}

export { Label };
