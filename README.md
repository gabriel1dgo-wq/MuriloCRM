# Pixote CRM

Sistema para **loja de peças automotivas e oficina**: armazém com prateleiras e caixas, sucatas com fotos e documentação, vendas no Balcão, Mercado Livre e Shopee, ordens de serviço completas com impressão em PDF e assinatura do cliente, e um financeiro com fluxo de caixa, previsão e contas a pagar e a receber.

Feito em React + TypeScript (Vite), servido por um servidor Node próprio, com Supabase (Auth, Postgres e Storage) como banco. Tem um modo demonstração que funciona sem nenhuma configuração.

## Abrir na sua máquina

Requisito: Node.js 22.12 ou superior.

```sh
npm ci
npm run dev
```

Abra **http://localhost:5173** e clique em **Explorar demonstração**. No Mac, dê dois cliques em `Iniciar Pixote.command`.

A demonstração tem dados fictícios (prateleiras, sucatas com fotos ilustrativas, 90 dias de vendas e caixa) salvos só no navegador. Em **Configurações → Restaurar demonstração** tudo volta ao estado inicial.

Build de produção local:

```sh
npm run build
DEMO_ENABLED=true npm start
```

## O que o sistema faz

| Módulo         | Destaques                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Painel**     | Receita do mês com comparação, saldo, OS atrasadas, valor do estoque, fluxo de 30 dias, meta mensal com medidor, vendas por canal, estoque crítico e contas da semana.                                                                                                                                                                                                                                                                            |
| **Estoque**    | Mapa visual do armazém: **locais** (prateleira, gaveteiro, pallet ou área) com **níveis**, e **caixas** em cada nível. A busca acende as caixas onde a peça está. Clique na caixa para ver as peças, ajustar a quantidade com + e −, mover para outra caixa, ver o histórico e imprimir a etiqueta. Peças com código OEM, aplicação (veículos compatíveis) e até 6 fotos.                                                                         |
| **Sucatas**    | Ficha completa: marca, modelo, ano, cor, combustível, motor, km, placa, chassi, Renavam, situação da **baixa no DETRAN**, origem (leilão, seguradora…), lote, fornecedor e até 12 fotos. Mostra quanto foi investido, quanto já voltou em vendas e o retorno em %.                                                                                                                                                                                |
| **Vendas**     | Cards de **Balcão, Mercado Livre e Shopee** com logo, bruto, taxas, líquido, ticket e participação. Na venda, o canal é escolhido pelo logo; nos marketplaces, informe o nº do pedido e a taxa (há uma sugestão editável). A taxa vira saída no caixa, e o cancelamento estorna venda e taxa.                                                                                                                                                     |
| **Oficina**    | Quadro kanban para arrastar a OS entre as etapas. A OS numerada (OS-0001) tem recepção (km, combustível, relato), checklist de entrada, diagnóstico, **serviços executados com "como foi feito"**, peças do estoque, peças externas ou trazidas pelo cliente, recomendações e garantia. **Imprimir / PDF** gera uma folha A4 com os campos de assinatura do cliente e do responsável. A assinatura digital pode ser colhida no tablet ou celular. |
| **Financeiro** | Períodos rápidos, saldo atual com **previsão para 30 dias**, entradas, saídas e resultado com comparação ao período anterior, fluxo de caixa com projeção pelas contas agendadas, receitas por origem (canal ou oficina), despesas por categoria, formas de recebimento, **contas a pagar e a receber** (vencidas, hoje, 7 dias) com baixa em um clique, e extrato agrupado por dia.                                                              |
| **Busca**      | `Ctrl K` / `⌘ K` procura peça, código OEM, caixa, placa, OS e cliente em todo o sistema.                                                                                                                                                                                                                                                                                                                                                          |

## Regras de negócio

1. Uma conta autenticada equivale a uma operação. Ainda não há vários usuários por empresa.
2. Valores são inteiros em centavos (R$ 15,99 = `1599`).
3. Uma venda registrada significa recebimento integral. A taxa do marketplace entra como saída separada.
4. Peças da OS saem do estoque (ficam reservadas) na abertura. A **entrega** lança o total no caixa. O **cancelamento** devolve as peças e estorna o que foi recebido.
5. A mão de obra da OS é a soma dos serviços executados. Peças externas cobradas entram no total; peças trazidas pelo cliente entram com valor zero.
6. OS entregue ou cancelada não pode ser editada. A assinatura pode ser colhida até o cancelamento.
7. A compra de sucata gera saída no caixa. Corrigir o custo depois lança só a diferença.
8. Contas agendadas não mexem no caixa até a baixa. Estornar a baixa reabre a conta.
9. Nada do financeiro é apagado: correções viram estornos.
10. Caixas só podem ser arquivadas vazias, e locais só sem caixas ativas.
11. Comprovantes e OS são documentos internos, não notas fiscais. Mercado Livre e Shopee são classificações de canal, sem integração por API.

## Conectar ao Supabase

Use primeiro um projeto de homologação.

### 1. Banco

No **SQL Editor** do projeto, execute estes arquivos **em ordem**, uma vez cada:

1. `supabase/migrations/20260927184355_zenith_core.sql`: estrutura base
2. `supabase/migrations/20260928120000_pixote_v2.sql`: armazém, fotos, OS detalhada, taxas e contas
3. `supabase/migrations/20260928120100_pixote_storage.sql`: bucket privado `pixote-photos` e as políticas de acesso

Os nomes internos `z_*` e `zenith_private` foram mantidos por compatibilidade. Nenhum arquivo apaga dados.

Em **Settings → API → Exposed schemas**, deixe `public` e **não** exponha `zenith_private`.

### 2. Autenticação

Em **Authentication → URL Configuration**:

- **Site URL**: o domínio de produção (ex.: `https://pixote.up.railway.app`)
- **Redirect URLs**: o mesmo domínio e `http://localhost:5173` para desenvolvimento

Em **Authentication → Providers → Email**, mantenha a confirmação de e-mail ligada. A tela de login oferece:

- entrar com e-mail e senha;
- **criar conta**, informando nome e nome da loja (a loja é configurada sozinha no primeiro acesso);
- **entrar com link por e-mail** (sem senha, só para contas existentes);
- **recuperar senha** por link, com a tela de nova senha.

Para um uso só interno, depois de criar a conta da loja você pode desligar **Allow new users to sign up**.

### 3. Variáveis

Copie `.env.example` para `.env`:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
DEMO_ENABLED=false
PORT=3000
```

**Use só a chave publicável** (ou a `anon` legada). O servidor se recusa a subir com uma chave `service_role`. Nunca envie `.env` ao GitHub.

## Segurança

- O navegador só lê as tabelas (com RLS por `owner_id`). Toda escrita passa pela função `z_command`, que valida, trava por conta, é idempotente (`request_id`) e grava em uma transação.
- As fotos ficam em um bucket **privado**, na pasta `<id do usuário>/`, e são exibidas por URLs assinadas válidas por 1 hora. O banco só aceita caminhos de foto dentro da pasta do próprio usuário. Antes do envio, as imagens são reduzidas no navegador (até 1600 px, JPEG).
- As assinaturas são guardadas como PNG pequeno (até ~130 KB), ficam fora da leitura geral e só são carregadas na hora de imprimir.
- O CSP do servidor libera imagens e conexões apenas para o próprio domínio e o Supabase configurado.

## Publicar no Railway

O projeto inclui `Dockerfile` e `railway.json`. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `DEMO_ENABLED=false`. O Railway fornece `PORT`. O endpoint `/healthz` serve para o healthcheck. Adicione o domínio gerado às URLs do Supabase Auth.

## Verificar

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

- `check`: TypeScript, build e 29 testes de banco (PGlite) e demonstração: armazém, fotos, numeração e assinatura de OS, taxas de marketplace, contas, RLS, idempotência e estornos.
- `test:e2e`: 7 testes Chromium, com endereçamento de peça e busca no mapa, venda no Mercado Livre com taxa e cancelamento, OS com serviços, assinatura e entrega, extrato, celular e servidor.

## Organização

```text
src/
  App.tsx                 Estrutura, navegação e busca global (Ctrl K)
  components/ui.tsx       Design system Pixote: placas, 3D, logos de canal, fotos, diálogos
  components/charts.tsx   Gráficos SVG (fluxo, rosca, medidor, barras)
  components/print.tsx    Impressão A4 / PDF e bloco de assinatura
  lib/types.ts            Modelo de dados e formatação
  lib/store.tsx           Sessão Supabase, comandos, upload de fotos
  lib/metrics.ts          Cálculos de período, fluxo, canais e previsão
  lib/demo.ts             Motor da demonstração (espelha o SQL)
  pages/                  Uma tela por módulo
  styles.css, pages.css   Identidade visual e telas
public/channels/          Logos de Balcão, Mercado Livre e Shopee (substituíveis)
supabase/migrations/      Schema, regras transacionais e Storage
tests/                    Testes SQL, demonstração e navegador
```

Os logos em `public/channels/` são marcas simplificadas. Para usar os oficiais, basta substituir os arquivos `mercado-livre.svg` e `shopee.svg`, mantendo os nomes, conforme as diretrizes de marca de cada marketplace.

**Importante:** a demonstração (`src/lib/demo.ts`) reimplementa as regras do SQL. Qualquer mudança de regra precisa ser feita nos dois lugares.

## Limites conhecidos

- O snapshot carrega todo o histórico da conta. Para volumes grandes (dezenas de milhares de vendas), trocar por consultas paginadas no servidor.
- Não há parcelamento de vendas, emissão fiscal nem integração de pedidos com os marketplaces.
- A instalação no Supabase real, os e-mails de Auth e o deploy não foram executados nesta entrega. Os testes de banco usam PGlite local.
