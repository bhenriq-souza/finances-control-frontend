import { Alert } from './components/ui/alert';

/**
 * Alerta do topo do formulário (spec 0009): o erro da API que não é de um campo, com a mensagem
 * do catálogo, anunciado aos leitores de tela.
 */
export function FormAlert({ message }: { message?: string | null }) {
    if (!message) return null;
    return (
        <Alert role="alert" variant="negativo">
            {message}
        </Alert>
    );
}
