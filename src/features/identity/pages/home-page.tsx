import { PROFILE_LABELS, useCurrentUser } from '../current-user';

/**
 * Tela inicial provisória de `/` (spec 0006), até o dashboard da spec 0015. Renderiza dentro do
 * app shell, que é dono do `<main>`, do fundo e do espaçamento.
 */
export function HomePage() {
    const user = useCurrentUser();
    return (
        <div className="flex flex-col gap-2">
            <h1 className="text-titulo-1">Olá, {user.name}</h1>
            {user.profile && (
                <p className="text-corpo text-texto-apoio">
                    Perfil: <span className="text-texto">{PROFILE_LABELS[user.profile]}</span>
                </p>
            )}
        </div>
    );
}
