# Arquitetura e decisões · Pixote CRM

## Aplicação independente

Frontend React/TypeScript compilado com Vite, entregue por um servidor Node que usa somente módulos nativos. O Railway hospeda esse servidor. Supabase fornece Auth, Postgres e Data API. Fontes e ícones são empacotados localmente. O modo de demonstração não depende de serviços externos.

Optou-se por SPA porque os módulos operacionais exigem autenticação e não precisam de SEO nem renderização no servidor. Remover TanStack Start, Nitro, Cloudflare e a configuração da Lovable reduz a superfície de infraestrutura; não há código proprietário de preview ou autenticação intermediada.

## Modelo

- `z_contacts`: cadastro de clientes e fornecedores.
- `z_scraps`: origens das peças e custos de aquisição.
- `z_parts`: disponibilidade atual, custo, preço e localização.
- `z_orders`: venda ou ordem de serviço, com totais e status.
- `z_order_items`: nome e preço preservados no momento da operação, origem da peça e quantidade.
- `z_stock_moves`: trilha de ajustes, reservas e devoluções.
- `z_cash`: movimentos financeiros imutáveis com referências de estorno.
- `z_settings`: identidade da operação, meta mensal e texto de garantia da OS.
- `z_locations`: locais do armazém (prateleira, gaveteiro, pallet, área), com número de níveis e cor.
- `z_boxes`: caixas endereçadas em um local e nível; `z_parts.box_id` aponta para a caixa.
- `z_bills`: contas a pagar/receber agendadas; a baixa cria um movimento `conta` em `z_cash`.
- Fotos: arrays `photos` (caminhos no bucket privado `pixote-photos`) em `z_scraps` e `z_parts`.
- OS: `z_orders` ganhou número sequencial por tipo, km, combustível, relato, diagnóstico, `services`, `external_parts`, `checklist`, recomendações, garantia e assinatura (PNG em base64, fora do snapshot).
- `zenith_private.requests`: identificador, conteúdo e resultado de comandos executados, para auditoria e reenvio idempotente.

Cada tabela tem `owner_id` vinculado a `auth.users`. Chaves estrangeiras compostas evitam associação de peças, sucatas, clientes e ordens de contas diferentes. A identidade vem de `auth.uid()`, não de dados de perfil editáveis pelo usuário.

## Escrita e autorização

Usuários autenticados têm somente SELECT nas tabelas públicas da aplicação, limitado por RLS. Não há escrita direta pelo navegador. Todas as mutações passam pela função pública `z_command`, que é SECURITY INVOKER e chama o executor em `zenith_private`.

O executor privado usa SECURITY DEFINER deliberadamente para manter tabelas imutáveis para os clientes e permitir somente operações validadas. Ele verifica `auth.uid()` em cada chamada, fixa `search_path` vazio, qualifica objetos, filtra por proprietário e não usa SQL dinâmico baseado no payload. O schema privado não pode ser exposto pelo PostgREST. A execução é revogada de PUBLIC/anon e concedida apenas a authenticated.

Essa arquitetura exige revisar cada novo ramo de comando: o executor tem privilégios elevados e o isolamento deve permanecer explícito. Não resolver erros concedendo UPDATE/DELETE nas tabelas ou expondo o schema privado.

## Transações e concorrência

Cada chamada RPC executa uma transação. Ela adquire um advisory lock por conta, consulta a chave de idempotência, valida entradas e grava as alterações necessárias. No consumo de peças também usa bloqueio da linha. Uma exceção reverte cabeçalho, itens, estoque, caixa e registro da requisição.

O lock por conta serializa mutações curtas. Isso simplifica consistência para uma operação pequena, mas limita throughput por conta. Não há chamada de rede dentro da transação. As leituras continuam independentes. Para cargas elevadas, medir e redesenhar o bloqueio por recurso com ordem consistente.

Um request_id repetido com o mesmo comando retorna o resultado anterior. Reutilização com payload diferente é rejeitada. O formulário mantém o ID entre tentativas do mesmo conteúdo; alterações no conteúdo geram outro ID.

O snapshot é uma única instrução SQL, respeita RLS e mantém as leituras dos módulos consistentes. Não há truncamento silencioso dos registros pelo limite padrão de SELECT da Data API, pois o retorno RPC é um objeto agregado. Isso tem custo proporcional ao tamanho do histórico e precisa ser substituído para grandes bases.

## Financeiro

Valores em centavos com constraints no banco. Desconto maior que o subtotal é rejeitado. Não há arredondamento visual que esconda centavos. Uma venda paga gera entrada; a entrega de uma OS gera entrada; cancelar gera estorno uma única vez. Alterações de custo de sucata lançam a diferença. O histórico financeiro não pode ser apagado pelo cliente.

O sistema não calcula impostos, taxas de marketplace, contas a receber ou lucro fiscal. Categorias são classificações operacionais. O usuário deve registrar despesas adicionais no caixa.

## Operação

`/healthz` verifica somente o processo e os arquivos carregados, sem depender do banco. Configure monitoramento de disponibilidade e alertas de falha separadamente. `/config.json` expõe apenas URL, chave pública e disponibilidade da demonstração. O servidor rejeita chaves administrativas e não serve arquivos ocultos ou código fora de `dist`.

Não foram executados deploy, migração remota ou alteração de dados existentes. O provisionamento e a homologação real são etapas externas restantes.

## Referências

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Data API: https://supabase.com/docs/guides/api/securing-your-api
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks

## Pixote v2 (28/09/2026)

A migração `20260928120000_pixote_v2.sql` substitui `zenith_private.command` e `z_snapshot` mantendo as mesmas garantias: lock por conta, idempotência, validação de posse em cada ramo e nenhuma escrita direta pelo cliente. Novos comandos: `location.save`, `box.save`, `part.move`, `order.sign`, `bill.save`, `bill.pay`, `bill.cancel`. `cash.reverse` também aceita movimentos `conta` e reabre a conta vinculada.

Para vendas, `fee` (taxa do marketplace) gera um movimento negativo na categoria "Taxas marketplace", ligado ao pedido; o cancelamento estorna todos os movimentos do pedido, inclusive a taxa. Para OS, a mão de obra é recalculada no banco como a soma de `services[].price`, e peças externas somam ao total.

A migração de Storage fica em um arquivo separado porque depende do schema `storage` do Supabase (os testes PGlite não o possuem). As políticas restringem leitura, gravação e remoção à pasta `<auth.uid()>/`, e o executor valida que os caminhos gravados nos registros pertencem à mesma pasta.

A interface é uma SPA com design system próprio (`components/ui.tsx`, `styles.css`): placas de aço com parafusos, textura de concreto, manchas de óleo iridescentes (CSS), profundidade por perspectiva/inclinação 3D e animações que respeitam `prefers-reduced-motion`. A impressão usa um portal (`#print-root`) com CSS `@media print` em A4; o usuário escolhe "Salvar como PDF" no diálogo do navegador, sem dependências de geração de PDF.
