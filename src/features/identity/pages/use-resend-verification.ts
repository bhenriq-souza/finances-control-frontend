import { useEffect, useState } from 'react';

import { useAuthSession } from '../auth-session';

/** Um reenvio por minuto (spec 0006, ERR-0006-06). */
export const RESEND_COOLDOWN_SECONDS = 60;

function useCountdown(): [number, () => void] {
    const [until, setUntil] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const remaining = Math.max(0, Math.ceil((until - now) / 1000));

    useEffect(() => {
        if (until === 0) return;
        const timer = setInterval(() => {
            const current = Date.now();
            setNow(current);
            if (current >= until) {
                setUntil(0);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [until]);

    const start = () => {
        const current = Date.now();
        setNow(current);
        setUntil(current + RESEND_COOLDOWN_SECONDS * 1000);
    };
    return [remaining, start];
}

interface ResendVerification {
    /** Segundos até poder reenviar; `0` libera o botão. */
    remaining: number;
    /** Rótulo do botão **Reenviar email**, com a contagem regressiva. */
    label: string;
    /** Envia o email de verificação e inicia a espera de um minuto; uma falha sobe ao chamador. */
    resend(): Promise<void>;
}

/** **Reenviar email** de `/verificar-email` e `/aguardando-aprovacao` (spec 0006). */
export function useResendVerification(): ResendVerification {
    const session = useAuthSession();
    const [remaining, startCooldown] = useCountdown();

    return {
        remaining,
        label: remaining > 0 ? `Reenviar email (${remaining} s)` : 'Reenviar email',
        async resend() {
            await session.sendEmailVerification();
            startCooldown();
        },
    };
}
