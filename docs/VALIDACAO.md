# Validação da entrega · Pixote CRM v2

Data: 28/09/2026. Ambiente: macOS ARM64, Node 22.23.3.

## Verificado

- TypeScript e build Vite de produção: aprovados.
- 29 testes de banco (PGlite, com as migrações core e v2) e de demonstração: aprovados.
- 7 testes Chromium: aprovados. Cobrem a navegação entre todas as telas sem erros JS, a peça endereçada em caixa com a busca acendendo a caixa e o ajuste +1, a venda no Mercado Livre com taxa, cancelamento e estorno da taxa, a OS com dois serviços, assinatura desenhada e entrega com lançamento no caixa, a entrada manual com estorno persistindo após recarregar, o layout em 390 px sem rolagem horizontal e a proteção do servidor.
- Inspeção visual em 1440 px e 375 px das telas de login, painel, armazém (mapa, busca e caixa), sucatas (cards e ficha), vendas, oficina (quadro, OS, assinatura) e financeiro, além do documento A4 da OS.

## Não executado

- Migrações em um Supabase real, incluindo o bucket de Storage e as políticas em `storage.objects`.
- Login real, e-mails de confirmação, link mágico e recuperação de senha.
- Upload real de fotos para o Storage (na demonstração, as fotos são comprimidas e guardadas no navegador).
- Impressão física. O layout A4 foi conferido na tela; o diálogo do navegador não foi acionado nos testes automatizados.
- Deploy no Railway e teste de carga.

---

# Validação da entrega

Data: 27/09/2026. Ambiente: macOS ARM64, Node 22.23.3.

## Verificado

- Compilação TypeScript e build Vite de produção: aprovados.
- 20 testes automatizados de banco/demonstração: aprovados.
- 5 testes de navegador Chromium: aprovados.
- Formatação Prettier: aprovada.
- Instalação das dependências: npm informou zero vulnerabilidades conhecidas no momento da instalação. Isso não constitui garantia permanente.
- Inspeção visual dos screenshots do painel em 1440 px e 390 px: realizada. Navegação e diálogo móvel testados.
- Busca em código-fonte, servidor, configuração e manifestos: nenhuma dependência de Lovable, Cloudflare, Nitro ou TanStack.
- Servidor de produção local iniciado na porta 3000, com dados demonstrativos.

## Cobertura relevante

Os testes SQL aplicam a migração completa em uma instância PGlite descartável. Verificam gravação atômica, valores monetários, requisições repetidas, insuficiência de estoque, rollback de itens duplicados, desconto inválido, cancelamento, entrega/edição de OS, estornos, correção de custo, isolamento entre usuários, negação de acesso anônimo, ausência de escrita direta e RLS em todas as tabelas públicas da aplicação.

Os testes de navegador registram cliente, peça, venda, cancelamento, OS, edição, entrega e lançamento manual com estorno. Verificam persistência da demonstração, navegação entre módulos, ausência de erros JavaScript no percurso principal, dimensões móveis e proteção de arquivos do servidor.

## Não executado nesta entrega

- Deploy no Railway ou build da imagem Docker.
- Instalação da migração em projeto Supabase remoto.
- Login real, entrega de e-mails, recuperação de senha e PostgREST contra um projeto real.
- Migração e reconciliação de registros do banco antigo.
- Teste de carga ou concorrência real com várias conexões Postgres. O lock por conta foi implementado, mas PGlite não reproduz uma implantação com múltiplas conexões.
- Auditoria externa ou certificação fiscal/contábil.

A versão está entregue como aplicação local independente com implementação de integração e configuração de hospedagem. A homologação dos serviços reais permanece necessária antes do uso operacional.
