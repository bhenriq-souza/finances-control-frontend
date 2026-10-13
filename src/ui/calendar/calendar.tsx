// `clsx` e não `cn`: o tailwind-merge trataria `text-corpo` (tamanho) e `text-texto` (cor)
// como conflito e descartaria um deles.
import { clsx as cn } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { DayPicker, type ChevronProps } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';

/**
 * Calendar do shadcn/ui sobre `react-day-picker` (ADR 0001 local), em pt-BR e desenhado só com os
 * tokens do tema: cada parte do DayPicker recebe as classes do tema, nada do CSS dele. Dias e
 * botões de mês com alvo de toque de 44px.
 *
 * Só é carregado com o calendário aberto (INV-0009-07): importe pelo `date-picker-surface`, que o
 * `DateField` traz por import dinâmico.
 */
export function Calendar({ className, classNames, ...props }: ComponentProps<typeof DayPicker>) {
    return (
        <DayPicker
            locale={ptBR}
            showOutsideDays
            className={cn('w-fit p-3', className)}
            classNames={{
                months: 'relative flex flex-col',
                month: 'flex flex-col gap-2',
                nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
                button_previous: NAV_BUTTON,
                button_next: NAV_BUTTON,
                month_caption: 'flex h-11 items-center justify-center px-12',
                caption_label: 'text-corpo-forte text-texto first-letter:uppercase',
                month_grid: 'border-collapse',
                weekdays: 'flex',
                weekday: 'w-11 text-pequeno text-texto-apoio',
                week: 'flex',
                day: 'size-11 p-0 text-center',
                day_button:
                    'inline-flex size-11 items-center justify-center rounded-md text-corpo text-texto tabular-nums outline-none hover:bg-superficie-elevada focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:cursor-not-allowed disabled:hover:bg-transparent',
                today: '[&>button]:border [&>button]:border-acento [&>button]:text-corpo-forte',
                selected:
                    '[&>button]:bg-acento [&>button]:text-sobre-acento [&>button]:hover:bg-acento-hover',
                outside: '[&>button]:text-texto-apoio',
                disabled: '[&>button]:opacity-40',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{ Chevron: CalendarChevron }}
            {...props}
        />
    );
}

const NAV_BUTTON =
    'inline-flex size-11 items-center justify-center rounded-md text-texto outline-none hover:bg-superficie-elevada focus-visible:ring-2 focus-visible:ring-foco disabled:opacity-40 aria-disabled:opacity-40';

function CalendarChevron({ orientation, className }: ChevronProps) {
    const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
    return <Icon aria-hidden="true" className={cn('size-5', className)} />;
}
