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
import { emailSchema } from '../validation';

const schema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Informe a senha.'),
});

type SignInValues = z.infer<typeof schema>;

interface SignInPageProps {
    /** Chamado depois do login; a rota leva ao destino do `redirect`. */
    onSignedIn: () => void;
}

/** `/entrar`: email e senha ou Google (spec 0006). */
export function SignInPage({ onSignedIn }: SignInPageProps) {
    const session = useAuthSession();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const {
        register,
        handleSubmit,
        resetField,
        formState: { errors },
    } = useForm<SignInValues>({ resolver: zodResolver(schema) });

    async function attempt(signIn: () => Promise<void>, onFailure?: () => void) {
        setError(null);
        setBusy(true);
        try {
            await signIn();
            onSignedIn();
        } catch (cause) {
            // Popup fechado pelo usuário devolve `null`: nada aparece (ERR-0006-03).
            setError(authErrorMessage(cause));
            onFailure?.();
        } finally {
            setBusy(false);
        }
    }

    const onSubmit = handleSubmit((values) =>
        attempt(
            () => session.signInWithEmail(values.email, values.password),
            // ERR-0006-01: o email fica, a senha sai.
            () => resetField('password'),
        ),
    );

    return (
        <AuthLayout title="Entrar no FTech Finance">
            <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                <FormAlert message={error} />
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
                    autoComplete="current-password"
                    registration={register('password')}
                    error={errors.password}
                />
                <Button type="submit" disabled={busy}>
                    Entrar
                </Button>
                <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void attempt(() => session.signInWithGoogle())}
                >
                    Entrar com Google
                </Button>
            </form>
            <nav
                aria-label="Outras opções"
                className="flex flex-col gap-3 text-corpo md:flex-row md:justify-between"
            >
                <Link to="/criar-conta" className="text-acento underline-offset-4 hover:underline">
                    Criar conta
                </Link>
                <Link
                    to="/redefinir-senha"
                    className="text-acento underline-offset-4 hover:underline"
                >
                    Esqueci a senha
                </Link>
            </nav>
        </AuthLayout>
    );
}
