# Atualização — Cobranças por aula (05/10/2026)

## Antes de abrir as telas financeiras
Execute no SQL Editor do Supabase o arquivo `SQL_COBRANCAS_2026-10-05.sql`.

Essa atualização:
- adiciona `payment_status` (`pending` / `paid`) em `lesson_bookings`;
- adiciona `paid_at`;
- permite somente ao administrador confirmar/reverter pagamento;
- preserva o `lesson_price` original quando uma aula é remarcada para outro slot;
- não cobra aulas com status `cancelled` nos totais das telas.

## Telas
- Admin: `/admin/cobrancas`
- Professor: `/professor/recebimentos`

## Regra
O preço é definido no horário disponibilizado pelo professor e copiado para `lesson_bookings` na reserva. Depois da reserva, este preço passa a ser o valor histórico/financeiro da aula.

## Observação
Ainda não foi criada a regra de "vencido", pois o projeto não possui uma regra de data de vencimento definida. Nesta etapa os estados financeiros são `Pendente` e `Pago`.
