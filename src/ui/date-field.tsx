import { CalendarDays } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type ChangeEvent } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import {
    dateInputToValue,
    isIsoDate,
    maskDateInput,
    today,
    valueToDateInput,
} from '@/shared/dates';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Field } from './field';

// O calendário (`react-day-picker`, `date-fns`) só é baixado quando abre (INV-0009-07).
const DatePickerSurface = lazy(() => import('./calendar/date-picker-surface'));

/** `md` do Tailwind: daqui para cima o calendário é um balão; abaixo, uma folha. */
const BALLOON_QUERY = '(min-width: 48rem)';

export interface DateFieldProps<T extends FieldValues, N extends FieldPath<T>, O = T> {
    /** `form.control`; com `zodResolver`, `O` é a saída do schema. */
    control: Control<T, unknown, O>;
    /** Campo do formulário; o valor é `YYYY-MM-DD`, `''` ou o texto ainda inválido. */
    name: N;
    /** Rótulo visível, que também nomeia o calendário. */
    label: string;
    /** Texto de ajuda abaixo do campo. */
    help?: string;
    /** Primeiro dia que o calendário deixa escolher (`YYYY-MM-DD`). */
    min?: string;
    /** Último dia que o calendário deixa escolher (`YYYY-MM-DD`). */
    max?: string;
    disabled?: boolean;
    /** `id` do campo de texto; sem ele, um gerado. */
    id?: string;
}

/**
 * Data própria (spec 0009, ADR 0001 local): texto com máscara `dd/mm/aaaa` e o botão **Escolher
 * data**, que abre o calendário em pt-BR (folha abaixo de `md`, balão a partir dele). Controlado
 * pelo react-hook-form (`useController`); valide com `dateSchema`/`optionalDateSchema`.
 */
export function DateField<T extends FieldValues, N extends FieldPath<T>, O = T>({
    control,
    name,
    label,
    help,
    min,
    max,
    disabled,
    id,
}: DateFieldProps<T, N, O>) {
    const { field, fieldState } = useController({ control, name });
    const value = typeof field.value === 'string' ? field.value : '';
    // O texto digitado; quando o valor do formulário muda por fora (`reset`, valor inicial), o
    // campo mostra o valor novo.
    const [text, setText] = useState(() => valueToDateInput(value));
    const shown = dateInputToValue(text) === value ? text : valueToDateInput(value);

    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [variant, setVariant] = useState<'folha' | 'balao'>('folha');
    const anchorRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const picked = useRef(false);

    function update(next: string) {
        setText(next);
        field.onChange(dateInputToValue(next));
    }

    function toggle() {
        if (!open) {
            setVariant(window.matchMedia?.(BALLOON_QUERY).matches ? 'balao' : 'folha');
            setLoaded(true);
            picked.current = false;
        }
        setOpen(!open);
    }

    return (
        <Field label={label} help={help} error={fieldState.error?.message} id={id}>
            {(controlProps) => (
                <div ref={anchorRef} className="flex gap-2">
                    <Input
                        {...controlProps}
                        ref={(element) => {
                            inputRef.current = element;
                            field.ref(element);
                        }}
                        name={field.name}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="dd/mm/aaaa"
                        disabled={disabled}
                        value={shown}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            update(maskDateInput(event.target.value))
                        }
                        onBlur={field.onBlur}
                        className="flex-1"
                    />
                    <Button
                        ref={triggerRef}
                        variant="outline"
                        aria-label="Escolher data"
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        disabled={disabled}
                        onClick={toggle}
                        className="size-11 shrink-0 px-0"
                    >
                        <CalendarDays aria-hidden="true" className="size-5" />
                    </Button>
                    {loaded && (
                        <Suspense fallback={null}>
                            <DatePickerSurface
                                open={open}
                                onOpenChange={setOpen}
                                variant={variant}
                                anchorRef={anchorRef}
                                triggerRef={triggerRef}
                                label={label}
                                value={isIsoDate(value) ? value : undefined}
                                today={today()}
                                min={min}
                                max={max}
                                onPick={(date) => {
                                    picked.current = true;
                                    update(valueToDateInput(date));
                                    setOpen(false);
                                }}
                                onCloseAutoFocus={(event) => {
                                    event.preventDefault();
                                    // Escolher devolve o foco ao campo; `Esc` (ou fora), ao botão.
                                    (picked.current
                                        ? inputRef.current
                                        : triggerRef.current
                                    )?.focus();
                                }}
                            />
                        </Suspense>
                    )}
                </div>
            )}
        </Field>
    );
}
