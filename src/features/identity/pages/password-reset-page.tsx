import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';

import { authErrorMessage, isUnknownAccount } from '../auth-errors';
import { useAuthSession } from '../auth-session';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { TextField } from '../components/text-field';
import { emailSchema } from '../validation';

const schema = z.object({ email: emailSchema });

type PasswordResetValues = z.infer<typeof schema>;

/** Mesma confirmação exista a conta ou não (spec 0006). */
export const PASSWORD_RESET_SENT =
    'Se existir uma conta com este email, você vai receber um link para criar uma nova senha.';

/** `/redefinir-senha`: confirma o envio sem revelar se a conta existe. */
export function PasswordResetPage() {
    const session = useAuthSession();
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<PasswordResetValues>({ resolver: zodResolver(schema) });

    const onSubmit = handleSubmit(async ({ email }) => {
        setError(null);
        try {
            await session.sendPasswordReset(email);
        } catch (cause) {
            if (!isUnknownAccount(cause)) {
                setError(authErrorMessage(cause));
                return;
            }
        }
        setSent(true);
    });

    return (
        <AuthLayout
            title="Redefinir senha"
            description="Informe o email da conta para receber o link de redefinição."
        >
            {sent ? (
                <Alert role="status" variant="positivo">
                    {PASSWORD_RESET_SENT}
                </Alert>
            ) : (
                <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                    <FormAlert message={error} />
                    <TextField
                        label="Email"
                        type="email"
                        autoComplete="email"
                        registration={register('email')}
                        error={errors.email}
                    />
                    <Button type="submit" disabled={isSubmitting}>
                        Enviar link
                    </Button>
                </form>
            )}
            <Link
                to="/entrar"
                className="text-corpo text-acento underline-offset-4 hover:underline"
            >
                Voltar para entrar
            </Link>
        </AuthLayout>
    );
}
