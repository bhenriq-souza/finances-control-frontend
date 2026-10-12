import { PROFILE_LABELS, useCurrentUser } from '../current-user';

/** Tela inicial provisória de `/` (spec 0006), até o dashboard da spec 0015. */
export function HomePage() {
    const user = useCurrentUser();
    return (
        <main className="flex min-h-dvh flex-col gap-2 bg-fundo px-4 py-8 text-texto md:px-8 lg:px-12">
            <h1 className="text-titulo-1">Olá, {user.name}</h1>
            {user.profile && (
                <p className="text-corpo text-texto-apoio">
                    Perfil: <span className="text-texto">{PROFILE_LABELS[user.profile]}</span>
                </p>
            )}
        </main>
    );
}
