import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { ApiError } from '@/api/errors/api-error';
import { applyApiError, type ApiFieldMap } from '@/api/errors/form-errors';
import { useAccountLookup, useCardLookup } from '@/api/queries/lookups';
import {
    type BankAccount,
    type CreditCard,
    type ExpenseType,
    useBankAccounts,
    useCreditCards,
    useExpenseTypes,
} from '@/api/queries/reference';
import { today } from '@/shared/dates';
import { formatBRL, type Cents } from '@/shared/money';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { DateField } from '@/ui/date-field';
import { Field } from '@/ui/field';
import { FormAlert } from '@/ui/form-alert';
import { FormDialog } from '@/ui/form-dialog';
import { MoneyInput } from '@/ui/money-input';
import { useNotify } from '@/ui/notice';
import { SelectField, type SelectOption, type SelectOptionGroup } from '@/ui/select-field';

import {
    accountPayment,
    cardPayment,
    expenseCreateSchema,
    expenseEditSchema,
    INSTALLMENTS_MAX,
    INSTALLMENTS_MIN,
    parsePayment,
    type ExpenseCreateOutput,
    type ExpenseCreateValues,
    type ExpenseEditOutput,
    type ExpenseEditValues,
} from '../expense-schema';
import { EXPENSE_KIND_LABELS, EXPENSE_KINDS, type Expense } from '../list/expense-model';

import {
    type CreateExpense,
    type UpdateExpense,
    useCreateExpense,
    useReloadOnConflict,
    useUpdateExpense,
} from './expense-mutations';

const FORM_ID = 'despesa-formulario';
const SAVED = 'Despesa salva.';

const STATUS_OPTIONS: SelectOption[] = [
    { value: 'OPEN', label: 'Pendente' },
    { value: 'FORECAST', label: 'Previsto' },
    { value: 'VERIFYING', label: 'Verificando' },
];

/** O aviso depois de criar: uma despesa ou as n parcelas/ocorrências criadas. */
export function createdMessage(count: number): string {
    return count === 1 ? SAVED : `${count} despesas criadas.`;
}

export interface ExpenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Sem ela, criar; com ela, alterar. */
    expense?: Expense;
    /**
     * Depois de criar: a primeira despesa da resposta (a tela navega para o detalhe dela, o que
     * fecha o diálogo). Sem ele, o diálogo só fecha.
     */
    onCreated?: (first: Expense) => void;
    /** Alterar uma despesa que não existe mais (`EXPENSE_NOT_FOUND`): a tela volta para a lista. */
    onGone?: () => void;
}

/**
 * Formulário de despesa (spec 0012, "Formulário de despesa"): criar uma variável, parcelada ou
 * fixa numa conta ou num cartão, ou alterar uma despesa existente com o escopo de série.
 */
export function ExpenseFormDialog(props: ExpenseFormDialogProps) {
    return props.expense ? (
        <EditExpenseDialog {...props} expense={props.expense} />
    ) : (
        <CreateExpenseDialog {...props} />
    );
}

function Footer({ onCancel, pending }: { onCancel: () => void; pending: boolean }) {
    return (
        <>
            <Button variant="outline" onClick={onCancel}>
                Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} disabled={pending}>
                Salvar
            </Button>
        </>
    );
}

/** Texto do `MoneyInput` para um valor salvo: `1.234,56`, como ele mesmo formata. */
function amountText(cents: number): string {
    return formatBRL(cents as Cents, { sign: 'never' }).replace(/^R\$\s*/, '');
}

const isActiveOr =
    (keep: string | null | undefined) =>
    <T extends { id: string; archivedAt: string | null }>(item: T) =>
        item.archivedAt === null || item.id === keep;

function typeOptions(types: readonly ExpenseType[] | undefined, keep?: string): SelectOption[] {
    return (types ?? [])
        .filter(isActiveOr(keep))
        .map((type) => ({ value: type.id, label: type.name }));
}

/** "Pagar com": os grupos Contas e Cartões, só os ativos. */
function paymentOptions(
    accounts: readonly BankAccount[] | undefined,
    cards: readonly CreditCard[] | undefined,
): SelectOptionGroup[] {
    const groups: SelectOptionGroup[] = [];
    const activeAccounts = (accounts ?? []).filter(isActiveOr(null));
    const activeCards = (cards ?? []).filter(isActiveOr(null));
    if (activeAccounts.length > 0) {
        groups.push({
            label: 'Contas',
            options: activeAccounts.map((account) => ({
                value: accountPayment(account.id),
                label: account.description,
            })),
        });
    }
    if (activeCards.length > 0) {
        groups.push({
            label: 'Cartões',
            options: activeCards.map((card) => ({ value: cardPayment(card.id), label: card.name })),
        });
    }
    return groups;
}

/** Rótulo da data: "Vencimento" na conta, "Data da compra" no cartão. */
function dateLabel(payment: 'account' | 'card' | null): string {
    if (payment === 'card') return 'Data da compra';
    if (payment === 'account') return 'Vencimento';
    return 'Data';
}

const optional = (text: string) => {
    const trimmed = text.trim();
    return trimmed === '' ? undefined : trimmed;
};

/**
 * Corpo do `POST /expenses`: exatamente um de `bankAccountId`/`creditCardId`; `postedOn` só no
 * cartão, `installmentTotal` só na parcelada e `recurrenceEndsOn` só na fixa, e só se informados.
 */
export function createBody(values: ExpenseCreateOutput): CreateExpense {
    const payment = parsePayment(values.payment);
    if (!payment) throw new Error('payment validated by the schema');
    const card = 'creditCardId' in payment;
    const postedOn = card ? optional(values.postedOn) : undefined;
    const recurrenceEndsOn =
        values.kind === 'FIXED' ? optional(values.recurrenceEndsOn) : undefined;
    const notes = optional(values.notes);
    return {
        kind: values.kind,
        description: values.description.trim(),
        expenseTypeId: values.expenseTypeId,
        amountCents: values.amount,
        occurredOn: values.occurredOn,
        ...payment,
        ...(postedOn ? { postedOn } : {}),
        status: values.status,
        ...(values.kind === 'INSTALLMENT'
            ? { installmentTotal: Number(values.installmentTotal.trim()) }
            : {}),
        ...(recurrenceEndsOn ? { recurrenceEndsOn } : {}),
        ...(notes ? { notes } : {}),
    };
}

/**
 * Corpo do `PATCH /expenses/{id}`: só o que mudou, e nunca `kind`, `status`, `paidOn`,
 * `bankAccountId`, `creditCardId` nem campos de parcela (INV-0012-05) — o tipo `UpdateExpense` do
 * contrato nem os tem. O valor não vai na despesa paga; `postedOn`, só na de cartão.
 */
export function changedFields(expense: Expense, values: ExpenseEditOutput): UpdateExpense {
    const body: UpdateExpense = {};
    const description = values.description.trim();
    if (description !== expense.description) body.description = description;
    if (values.expenseTypeId !== expense.expenseType.id) body.expenseTypeId = values.expenseTypeId;
    if (values.amount !== null && values.amount !== expense.amountCents) {
        body.amountCents = values.amount;
    }
    if (values.occurredOn !== expense.occurredOn) body.occurredOn = values.occurredOn;
    const postedOn = optional(values.postedOn);
    if (expense.creditCardId && postedOn && postedOn !== expense.postedOn) {
        body.postedOn = postedOn;
    }
    const notes = optional(values.notes) ?? null;
    if (notes !== expense.notes) body.notes = notes;
    return body;
}

const COMMON_FIELDS = {
    description: 'description',
    expenseTypeId: 'expenseTypeId',
    amountCents: 'amount',
    occurredOn: 'occurredOn',
    postedOn: 'postedOn',
    notes: 'notes',
} as const;

const TYPE_CODES = {
    EXPENSE_TYPE_ARCHIVED: 'expenseTypeId',
    EXPENSE_TYPE_NOT_FOUND: 'expenseTypeId',
} as const;

/** `STATEMENT_CLOSED` vai para Fatura de quando ela foi informada; senão, para a data. */
const statementField = (postedOnSent: boolean) => (postedOnSent ? 'postedOn' : 'occurredOn');

function createFieldMap(postedOnSent: boolean): ApiFieldMap<ExpenseCreateValues> {
    return {
        fields: {
            ...COMMON_FIELDS,
            kind: 'kind',
            bankAccountId: 'payment',
            creditCardId: 'payment',
            installmentTotal: 'installmentTotal',
            recurrenceEndsOn: 'recurrenceEndsOn',
            status: 'status',
        },
        codes: {
            ...TYPE_CODES,
            BANK_ACCOUNT_ARCHIVED: 'payment',
            BANK_ACCOUNT_NOT_FOUND: 'payment',
            CREDIT_CARD_ARCHIVED: 'payment',
            CREDIT_CARD_NOT_FOUND: 'payment',
            STATEMENT_CLOSED: statementField(postedOnSent),
        },
    };
}

function editFieldMap(postedOnSent: boolean): ApiFieldMap<ExpenseEditValues> {
    return {
        fields: COMMON_FIELDS,
        codes: { ...TYPE_CODES, STATEMENT_CLOSED: statementField(postedOnSent) },
    };
}

/** Rádios em linha a partir de `md` (natureza, escopo da série). */
function RadioGroup({
    legend,
    options,
    register,
}: {
    legend: string;
    options: readonly { value: string; label: string }[];
    register: Omit<ComponentProps<'input'>, 'type' | 'value'>;
}) {
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-rotulo text-texto">{legend}</legend>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-6">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="flex min-h-11 items-center gap-2 text-corpo text-texto"
                    >
                        <input
                            type="radio"
                            value={option.value}
                            className="size-4 accent-acento"
                            {...register}
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

/** Texto longo opcional (Observações). */
function NotesField({
    error,
    ...props
}: Omit<ComponentProps<'textarea'>, 'id'> & { error?: string }) {
    return (
        <Field label="Observações" error={error}>
            {(control) => (
                <textarea
                    {...control}
                    {...props}
                    rows={3}
                    className="flex min-h-22 w-full rounded-md border border-linha-forte bg-superficie px-3 py-2 text-corpo text-texto outline-none placeholder:text-texto-apoio focus-visible:ring-2 focus-visible:ring-foco aria-invalid:border-negativo"
                />
            )}
        </Field>
    );
}

/** Um campo que não muda neste formulário, mostrado como texto. */
function ReadOnly({
    label,
    help,
    children,
}: {
    label: string;
    help?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-rotulo text-texto-apoio">{label}</span>
            <span className="text-corpo text-texto">{children}</span>
            {help && <span className="text-pequeno text-texto-apoio">{help}</span>}
        </div>
    );
}

const KIND_OPTIONS = EXPENSE_KINDS.map((kind) => ({
    value: kind,
    label: EXPENSE_KIND_LABELS[kind],
}));

function CreateExpenseDialog({ open, onOpenChange, onCreated }: ExpenseFormDialogProps) {
    const notify = useNotify();
    const types = useExpenseTypes();
    const accounts = useBankAccounts();
    const cards = useCreditCards();
    const create = useCreateExpense();

    const form = useForm<ExpenseCreateValues, unknown, ExpenseCreateOutput>({
        resolver: zodResolver(expenseCreateSchema),
        defaultValues: {
            kind: 'VARIABLE',
            description: '',
            expenseTypeId: '',
            amount: '',
            payment: '',
            occurredOn: today(),
            postedOn: '',
            installmentTotal: '',
            recurrenceEndsOn: '',
            status: 'OPEN',
            notes: '',
        },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;
    const [kind, payment] = useWatch({ control, name: ['kind', 'payment'] });
    const parsed = parsePayment(payment);
    const paymentKind = parsed ? ('creditCardId' in parsed ? 'card' : 'account') : null;

    const onSubmit = handleSubmit(async (values) => {
        const body = createBody(values);
        try {
            const created = await create.mutateAsync(body);
            notify({ tone: 'sucesso', message: createdMessage(created.length) });
            // Com `onCreated`, a tela sai para o detalhe da primeira e o diálogo some com ela.
            if (onCreated) onCreated(created[0]!);
            else onOpenChange(false);
        } catch (error) {
            applyApiError(error, form, createFieldMap(body.postedOn !== undefined));
        }
    });

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Nova despesa"
            footer={<Footer onCancel={() => onOpenChange(false)} pending={create.isPending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <RadioGroup legend="Natureza" options={KIND_OPTIONS} register={register('kind')} />
                <Field label="Descrição" error={errors.description?.message}>
                    {(field) => <Input {...field} {...register('description')} />}
                </Field>
                <SelectField
                    label="Tipo"
                    placeholder="Escolha o tipo"
                    options={typeOptions(types.data)}
                    error={errors.expenseTypeId?.message}
                    {...register('expenseTypeId')}
                />
                <Controller
                    control={control}
                    name="amount"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label={kind === 'INSTALLMENT' ? 'Valor total' : 'Valor'}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            error={fieldState.error?.message}
                        />
                    )}
                />
                <SelectField
                    label="Pagar com"
                    placeholder="Escolha a conta ou o cartão"
                    options={paymentOptions(accounts.data, cards.data)}
                    error={errors.payment?.message}
                    {...register('payment')}
                />
                <DateField
                    label={dateLabel(paymentKind)}
                    error={errors.occurredOn?.message}
                    {...register('occurredOn')}
                />
                {paymentKind === 'card' && (
                    <DateField
                        label="Fatura de"
                        help="Deixe vazio para a fatura do dia da compra."
                        error={errors.postedOn?.message}
                        {...register('postedOn')}
                    />
                )}
                {kind === 'INSTALLMENT' && (
                    <Field label="Parcelas" error={errors.installmentTotal?.message}>
                        {(field) => (
                            <Input
                                {...field}
                                type="number"
                                inputMode="numeric"
                                min={INSTALLMENTS_MIN}
                                max={INSTALLMENTS_MAX}
                                step={1}
                                {...register('installmentTotal')}
                            />
                        )}
                    </Field>
                )}
                {kind === 'FIXED' && (
                    <DateField
                        label="Repetir até"
                        help="Sem data, a série segue mês a mês."
                        error={errors.recurrenceEndsOn?.message}
                        {...register('recurrenceEndsOn')}
                    />
                )}
                <SelectField
                    label="Situação inicial"
                    options={STATUS_OPTIONS}
                    error={errors.status?.message}
                    {...register('status')}
                />
                <NotesField error={errors.notes?.message} {...register('notes')} />
            </form>
        </FormDialog>
    );
}

const SCOPE_OPTIONS = [
    { value: 'single', label: 'Só esta' },
    { value: 'following', label: 'Esta e as próximas previstas' },
] as const;

function EditExpenseDialog({
    open,
    onOpenChange,
    onGone,
    expense,
}: ExpenseFormDialogProps & { expense: Expense }) {
    const notify = useNotify();
    const reloadOnConflict = useReloadOnConflict();
    const types = useExpenseTypes();
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const update = useUpdateExpense(expense.id);
    const card = expense.creditCardId !== null;
    const paid = expense.status === 'PAID';
    const series = expense.recurrenceId !== null;

    const schema = useMemo(() => expenseEditSchema({ amountEditable: !paid, card }), [paid, card]);
    const form = useForm<ExpenseEditValues, unknown, ExpenseEditOutput>({
        resolver: zodResolver(schema),
        defaultValues: {
            description: expense.description,
            expenseTypeId: expense.expenseType.id,
            amount: amountText(expense.amountCents),
            occurredOn: expense.occurredOn,
            postedOn: expense.postedOn ?? '',
            notes: expense.notes ?? '',
            scope: 'single',
        },
    });
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = form;

    const onSubmit = handleSubmit(async (values) => {
        const body = changedFields(expense, values);
        try {
            if (Object.keys(body).length > 0) {
                await update.mutateAsync({
                    body,
                    following: series && values.scope === 'following',
                });
            }
            onOpenChange(false);
            notify({ tone: 'sucesso', message: SAVED });
        } catch (error) {
            if (error instanceof ApiError && error.code === 'EXPENSE_NOT_FOUND' && onGone) {
                onOpenChange(false);
                notify({ tone: 'erro', message: error.userMessage });
                onGone();
                return;
            }
            reloadOnConflict(error);
            applyApiError(error, form, editFieldMap(body.postedOn !== undefined));
        }
    });

    const paymentLabel = expense.creditCardId
        ? cards.label(expense.creditCardId)
        : expense.bankAccountId
          ? accounts.label(expense.bankAccountId)
          : '';

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Alterar despesa"
            description={expense.installment ? 'A alteração vale só para esta parcela.' : undefined}
            footer={<Footer onCancel={() => onOpenChange(false)} pending={update.isPending} />}
        >
            <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
                <FormAlert message={errors.root?.api?.message} />
                <ReadOnly label="Natureza">{EXPENSE_KIND_LABELS[expense.kind]}</ReadOnly>
                <Field label="Descrição" error={errors.description?.message}>
                    {(field) => <Input {...field} {...register('description')} />}
                </Field>
                <SelectField
                    label="Tipo"
                    placeholder="Escolha o tipo"
                    options={typeOptions(types.data, expense.expenseType.id)}
                    error={errors.expenseTypeId?.message}
                    {...register('expenseTypeId')}
                />
                <Controller
                    control={control}
                    name="amount"
                    render={({ field, fieldState }) => (
                        <MoneyInput
                            label="Valor"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            disabled={paid}
                            error={fieldState.error?.message}
                        />
                    )}
                />
                {paid && (
                    <p className="-mt-2 text-pequeno text-texto-apoio">
                        Despesa paga: o valor não muda.
                    </p>
                )}
                <ReadOnly
                    label="Pagar com"
                    help={paid ? undefined : 'Para trocar, use Trocar forma de pagamento.'}
                >
                    {paymentLabel}
                </ReadOnly>
                <DateField
                    label={card ? 'Data da compra' : 'Vencimento'}
                    error={errors.occurredOn?.message}
                    {...register('occurredOn')}
                />
                {card && (
                    <DateField
                        label="Fatura de"
                        help="Deixe vazio para a fatura do dia da compra."
                        error={errors.postedOn?.message}
                        {...register('postedOn')}
                    />
                )}
                <NotesField error={errors.notes?.message} {...register('notes')} />
                {series && (
                    <RadioGroup
                        legend="Aplicar a alteração a"
                        options={SCOPE_OPTIONS}
                        register={register('scope')}
                    />
                )}
            </form>
        </FormDialog>
    );
}
