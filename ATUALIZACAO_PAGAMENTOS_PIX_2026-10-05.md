# Escola Conecta — Pagamentos e PIX manual

## O que foi implementado
- Aluno: menu **Pagamentos**, valores a pagar/pagos e botão **Pagar com PIX**.
- Professor: **Meus recebimentos**, somente consulta; não pode dar baixa financeira.
- Admin: confirmação de pagamento com **forma**, **data/hora** e **observação**.
- Admin: resumo financeiro por professor.
- Cancelamento e ausência do professor: **não cobrados**.
- Remarcação: mantém o valor original contratado.

## 1. Supabase
Execute no SQL Editor o arquivo `SQL_COBRANCAS_2026-10-05.sql` desta versão.

## 2. PIX no .env.local
Adicione, por exemplo:

```env
PAYMENT_PIX_KEY=sua-chave-pix
PAYMENT_PIX_RECEIVER=Escola Conecta
```

Reinicie `npm.cmd run dev` após editar o `.env.local`.

## Regra de baixa
Somente admin/financeiro confirma ou desfaz um pagamento. O professor apenas acompanha.
