import type { components } from '../generated/schema';

/** Código de erro do contrato (`components.schemas.ErrorCode`). */
type ErrorCode = components['schemas']['ErrorCode'];

// Uma entrada por valor do `ErrorCode` da tag fixada em sources.json (INV-0005-04). O `Record`
// reprova código faltando no gate `types`; o gate `contract` (passo 4) reprova chave sobrando.
// O gate lê as chaves daqui: mantenha uma por linha, sem aspas, no formato `CODIGO: 'texto'`.
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    AUTH_UNAVAILABLE: 'Não foi possível validar seu acesso agora. Tente de novo em instantes.',
    AVATAR_NOT_FOUND: 'Você ainda não tem foto.',
    AVATAR_TOO_LARGE: 'A foto é grande demais. Escolha outra imagem e tente de novo.',
    AVATAR_UNSUPPORTED_TYPE: 'Formato de imagem não aceito. Use uma foto em JPEG, PNG ou WebP.',
    BANK_ACCOUNT_ALREADY_EXISTS: 'Você já tem essa conta neste banco. Use a conta existente.',
    BANK_ACCOUNT_ARCHIVED: 'Essa conta está arquivada. Reative a conta ou escolha outra.',
    BANK_ACCOUNT_NOT_FOUND: 'Não encontramos essa conta. Atualize a página e tente de novo.',
    BANK_ALREADY_EXISTS: 'Esse banco já está cadastrado. Use o banco existente.',
    BANK_ARCHIVED: 'Esse banco está arquivado. Reative o banco ou escolha outro.',
    BANK_NOT_FOUND: 'Não encontramos esse banco. Atualize a página e tente de novo.',
    BANK_TRANSFER_ALREADY_COMPLETED:
        'Essa transferência já foi concluída e não pode mais ser alterada nem excluída.',
    BANK_TRANSFER_NOT_FOUND:
        'Não encontramos essa transferência. Atualize a página e tente de novo.',
    BANK_TRANSFER_STATUS_UNCHANGED: 'A transferência já está nesse status. Atualize a página.',
    CANNOT_CHANGE_OWN_PROFILE: 'Você não pode alterar nem remover o seu próprio perfil.',
    CREDIT_CARD_ALREADY_EXISTS:
        'Você já tem um cartão com esse nome neste banco. Escolha outro nome.',
    CREDIT_CARD_ARCHIVED: 'Esse cartão está arquivado. Reative o cartão ou escolha outro.',
    CREDIT_CARD_EXPENSE_PAID_BY_STATEMENT:
        'Despesa de cartão é paga pela fatura. Registre o pagamento na fatura do cartão.',
    CREDIT_CARD_NOT_FOUND: 'Não encontramos esse cartão. Atualize a página e tente de novo.',
    CREDIT_CARD_REFUND_NOT_FOUND:
        'Não encontramos esse estorno. Atualize a página e tente de novo.',
    EARNING_ALREADY_RECEIVED:
        'Essa receita já foi recebida e não pode mais ter o valor ou a conta alterados, nem ser excluída.',
    EARNING_NOT_FOUND: 'Não encontramos essa receita. Atualize a página e tente de novo.',
    EARNING_RECURRENCE_NOT_FOUND:
        'Não encontramos essa receita recorrente. Atualize a página e tente de novo.',
    EARNING_STATUS_TRANSITION_NOT_ALLOWED:
        'Não é possível mudar a receita para esse status. Atualize a página e confira o status atual.',
    EARNING_TYPE_ALREADY_EXISTS: 'Já existe um tipo de receita com esse nome. Escolha outro nome.',
    EARNING_TYPE_ARCHIVED: 'Esse tipo de receita está arquivado. Reative o tipo ou escolha outro.',
    EARNING_TYPE_NOT_FOUND:
        'Não encontramos esse tipo de receita. Atualize a página e tente de novo.',
    EMAIL_NOT_VERIFIED: 'Seu email ainda não foi verificado. Confirme o email e entre de novo.',
    EXPENSE_ALREADY_PAID:
        'Essa despesa já foi paga e não pode mais ter o valor alterado nem ser excluída.',
    EXPENSE_NOT_FOUND: 'Não encontramos essa despesa. Atualize a página e tente de novo.',
    EXPENSE_RECURRENCE_NOT_FOUND:
        'Não encontramos essa despesa recorrente. Atualize a página e tente de novo.',
    EXPENSE_STATUS_TRANSITION_NOT_ALLOWED:
        'Não é possível mudar a despesa para esse status. Atualize a página e confira o status atual.',
    EXPENSE_TYPE_ALREADY_EXISTS: 'Já existe um tipo de despesa com esse nome. Escolha outro nome.',
    EXPENSE_TYPE_ARCHIVED: 'Esse tipo de despesa está arquivado. Reative o tipo ou escolha outro.',
    EXPENSE_TYPE_NOT_FOUND:
        'Não encontramos esse tipo de despesa. Atualize a página e tente de novo.',
    FORBIDDEN: 'Você não tem permissão para fazer isso.',
    INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    INVALID_JSON: 'Não foi possível enviar os dados. Atualize a página e tente de novo.',
    LAST_ADMIN: 'Essa ação deixaria o sistema sem administrador. Mantenha ao menos um.',
    NOT_READY: 'O serviço ainda está iniciando. Tente de novo em instantes.',
    PAYLOAD_TOO_LARGE: 'Os dados enviados são grandes demais. Reduza o conteúdo e tente de novo.',
    PROFILE_GUARD_WITHOUT_AUTHENTICATION:
        'Algo deu errado do nosso lado. Tente de novo em instantes.',
    PROFILE_PENDING: 'Seu cadastro aguarda a aprovação de um administrador.',
    REFUND_EXCEEDS_EXPENSE:
        'O valor do estorno passa do que ainda pode ser estornado nessa despesa.',
    REFUND_EXPENSE_MISMATCH:
        'Essa despesa não pertence ao cartão do estorno. Escolha outra despesa.',
    ROUTE_NOT_FOUND: 'Não encontramos o que você procura. Atualize a página e tente de novo.',
    ROUTE_WITHOUT_AUTHENTICATION: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    STATEMENT_ALREADY_PAID: 'Essa fatura já está paga.',
    STATEMENT_CLOSED:
        'Essa fatura já está fechada e a alteração mudaria o total dela. Use uma data da fatura aberta.',
    STATEMENT_NOT_FOUND: 'Não encontramos essa fatura. Atualize a página e tente de novo.',
    STATEMENT_PAYMENT_EXCEEDS_REMAINING:
        'O valor do pagamento passa do que falta pagar na fatura. Informe um valor menor.',
    STATEMENT_PAYMENT_LOCKED:
        'Só é possível desfazer o último pagamento da fatura, enquanto não houver outro depois dele.',
    STATEMENT_PAYMENT_NOT_FOUND:
        'Não encontramos esse pagamento. Atualize a página e tente de novo.',
    STATEMENT_PREVIOUS_UNPAID: 'Há uma fatura anterior fechada sem pagar. Pague essa fatura antes.',
    STATEMENT_ROLLED_OVER: 'Essa fatura foi rolada para a seguinte. Pague a fatura seguinte.',
    TOKEN_EXPIRED: 'Sua sessão expirou. Entre de novo para continuar.',
    UNAUTHENTICATED: 'Você precisa entrar para continuar.',
    USER_NOT_FOUND: 'Não encontramos esse usuário. Atualize a página e tente de novo.',
    VALIDATION_ERROR: 'Alguns dados são inválidos. Corrija os campos indicados e tente de novo.',
};

/** Erros que nascem no cliente, sem corpo da API (spec 0005). */
export const CLIENT_ERROR_MESSAGES = {
    NETWORK_ERROR: 'Sem conexão com o servidor. Verifique a rede e tente de novo.',
    UNEXPECTED_RESPONSE: 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
};
