import { clsx } from 'clsx';

/**
 * Bloco de carregamento: `superficie-elevada` com pulso, parado com `prefers-reduced-motion`
 * (spec 0009). Decorativo: quem anuncia o carregamento é a região que o contém.
 */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            data-slot="skeleton"
            className={clsx(
                'animate-pulse rounded-md bg-superficie-elevada motion-reduce:animate-none',
                className,
            )}
        />
    );
}

const ROWS = [0, 1, 2] as const;

/**
 * Esqueleto do `EntryList` enquanto a consulta não tem dado: três cartões abaixo de `md`, três
 * linhas a partir de `md`.
 */
export function EntryListSkeleton() {
    return (
        <div role="status" aria-label="Carregando">
            <ul className="flex flex-col gap-3 md:hidden">
                {ROWS.map((row) => (
                    <li
                        key={row}
                        className="flex flex-col gap-2 rounded-md border border-linha bg-superficie p-4"
                    >
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </li>
                ))}
            </ul>
            <div className="hidden overflow-hidden rounded-md border border-linha bg-superficie md:block">
                <div className="h-11 bg-superficie-elevada" />
                {ROWS.map((row) => (
                    <div
                        key={row}
                        className="flex items-center gap-4 border-t border-linha px-4 py-3"
                    >
                        <Skeleton className="h-5 flex-1" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                ))}
            </div>
        </div>
    );
}
