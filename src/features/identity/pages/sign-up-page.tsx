import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/ui/components/ui/button';

import { authErrorMessage } from '../auth-errors';
import { useAuthSession } from '../auth-session';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { TextField } from '../components/text-field';
import { emailSchema, MIN_PASSWORD_LENGTH } from '../validation';

const schema = z
    .object({
        name: z.string().trim().min(1, 'Informe seu nome.'),
        email: emailSchema,
        password: z
            .string()
            .min(
                MIN_PASSWORD_LENGTH,
                `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
            ),
        confirmation: z.string(),
    })
    .refine((values) => values.password === values.confirmation, {
        message: 'As senhas não conferem.',
        path: ['confirmation'],
    });

type SignUpValues = z.infer<typeof schema>;

interface SignUpPageProps {
    /** Chamado depois do cadastro; a rota leva à guarda de `_app` (AC-0006-05). */
    onSignedUp: () => void;
}

/** `/criar-conta`: nome, email, senha e confirmação (spec 0006). */
export function SignUpPage({ onSignedUp }: SignUpPageProps) {
    const session = useAuthSession();
    const [error, setError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignUpValues>({ resolver: zodResolver(schema) });

    const onSubmit = handleSubmit(async (values) => {
        setError(null);
        try {
            await session.signUpWithEmail(values.name, values.email, values.password);
        } catch (cause) {
            setError(authErrorMessage(cause));
            return;
        }
        onSignedUp();
    });

    return (
        <AuthLayout title="Criar conta">
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                <FormAlert message={error} />
                <TextField
                    label="Nome"
                    autoComplete="name"
                    registration={register('name')}
                    error={errors.name}
                />
                <TextField
                    label="Email"
                    type="email"
                    autoComplete="email"
                    registration={register('email')}
                    error={errors.email}
                />
                <TextField
                    label="Senha"
                    type="password"
                    autoComplete="new-password"
                    registration={register('password')}
                    error={errors.password}
                />
                <TextField
                    label="Confirme a senha"
                    type="password"
                    autoComplete="new-password"
                    registration={register('confirmation')}
                    error={errors.confirmation}
                />
                <Button type="submit" disabled={isSubmitting}>
                    Criar conta
                </Button>
            </form>
            <p className="text-corpo text-texto-apoio">
                Já tem conta?{' '}
                <Link to="/entrar" className="text-acento underline-offset-4 hover:underline">
                    Entrar
                </Link>
            </p>
        </AuthLayout>
    );
}
