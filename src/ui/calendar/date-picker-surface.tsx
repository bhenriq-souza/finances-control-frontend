import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import type { RefObject } from 'react';

import { buttonVariants } from '../components/ui/button';
import { Calendar } from './calendar';

export interface DatePickerSurfaceProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Folha presa à base (abaixo de `md`) ou balão ancorado ao campo (a partir de `md`). */
    variant: 'folha' | 'balao';
    /** O campo inteiro (texto e botão), onde o balão se ancora. */
    anchorRef: RefObject<HTMLElement | null>;
    /** O botão **Escolher data**: clicar nele com o balão aberto não conta como "fora". */
    triggerRef: RefObject<HTMLElement | null>;
    /** O rótulo do campo, que nomeia o calendário. */
    label: string;
    /** `YYYY-MM-DD` válido do campo, se houver. */
    value: string | undefined;
    /** Hoje, `YYYY-MM-DD` (de `today()`). */
    today: string;
    min?: string;
    max?: string;
    onPick: (date: string) => void;
    /** Para onde o foco volta ao fechar (o `DateField` decide: o campo ou o botão). */
    onCloseAutoFocus: (event: Event) => void;
}

/**
 * O calendário aberto pelo `DateField` (spec 0009, ADR 0001 local). Este módulo, com o
 * `react-day-picker` e o `date-fns`, só é baixado quando o calendário abre (INV-0009-07).
 */
export default function DatePickerSurface({
    open,
    onOpenChange,
    variant,
    anchorRef,
    triggerRef,
    label,
    value,
    today,
    min,
    max,
    onPick,
    onCloseAutoFocus,
}: DatePickerSurfaceProps) {
    const selected = value ? fromIso(value) : undefined;
    const disabled = [
        ...(min ? [{ before: fromIso(min) }] : []),
        ...(max ? [{ after: fromIso(max) }] : []),
    ];
    const calendar = (
        <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected ?? fromIso(today)}
            today={fromIso(today)}
            disabled={disabled}
            onSelect={(date) => onPick(toIso(date))}
        />
    );

    if (variant === 'folha') {
        return (
            <Dialog.Root open={open} onOpenChange={onOpenChange}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-60 bg-veu" />
                    <Dialog.Content
                        aria-describedby={undefined}
                        onOpenAutoFocus={focusDay}
                        onCloseAutoFocus={onCloseAutoFocus}
                        className="fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 rounded-t-lg border-t border-linha bg-superficie pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-texto shadow-[var(--ft-sombra-flutuante)] outline-none"
                    >
                        <Dialog.Title className="self-stretch px-4 text-titulo-3">
                            {label}
                        </Dialog.Title>
                        {calendar}
                        <div className="flex self-stretch px-4 *:flex-1">
                            <Dialog.Close className={buttonVariants({ variant: 'outline' })}>
                                Cancelar
                            </Dialog.Close>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        );
    }

    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Anchor virtualRef={anchorRef as RefObject<HTMLElement>} />
            <Popover.Portal>
                <Popover.Content
                    aria-label={label}
                    align="start"
                    sideOffset={4}
                    collisionPadding={8}
                    onOpenAutoFocus={focusDay}
                    onCloseAutoFocus={onCloseAutoFocus}
                    onInteractOutside={(event) => {
                        if (triggerRef.current?.contains(event.target as Node))
                            event.preventDefault();
                    }}
                    className="z-60 rounded-lg border border-linha bg-superficie text-texto shadow-[var(--ft-sombra-flutuante)] outline-none"
                >
                    {calendar}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

/**
 * Ao abrir, o foco vai ao dia que o DayPicker deixa na ordem de tabulação (o escolhido, hoje ou o
 * primeiro do mês). Feito aqui, e não pelo `autoFocus` do DayPicker, porque só agora o foco preso
 * do diálogo de fora já cedeu a vez a esta camada.
 */
function focusDay(event: Event) {
    event.preventDefault();
    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) return;
    container.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]')?.focus();
}

/** `YYYY-MM-DD` → `Date` local à meia-noite: o DayPicker trabalha em datas locais. */
function fromIso(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
    const pad = (value: number, size: number) => String(value).padStart(size, '0');
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}
