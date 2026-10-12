import { Alert } from '@/ui/components/ui/alert';

/** Erro do formulário inteiro (ex.: credencial inválida), anunciado aos leitores de tela. */
export function FormAlert({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <Alert role="alert" variant="negativo">
            {message}
        </Alert>
    );
}
