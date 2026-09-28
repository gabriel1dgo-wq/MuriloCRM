# Migração do sistema anterior

## Estado da entrega

O repositório original permanece separado, no diretório `work/zenith-financial-hub` da conversa. A reconstrução não modificou o original, não copiou `.env` e não executou scripts no banco remoto.

A nova migração cria objetos `z_*` e `zenith_private`, sem excluir as tabelas antigas. Prefira homologar em um projeto Supabase separado. Não execute a cadeia antiga de migrações: há comandos destrutivos e criações repetidas no histórico analisado.

## Roteiro antes de importar dados reais

1. Identificar o projeto Supabase de origem e exportar schema, registros e vínculos de usuários. Fazer backup e validar restauração em ambiente separado.
2. Definir o usuário proprietário de cada operação. Os IDs de Auth não devem ser inferidos por nome ou e-mail sem validação.
3. Mapear os campos abaixo e gerar um relatório de inconsistências: referências ausentes, saldos negativos, códigos duplicados, registros sem proprietário e valores nulos.
4. Validar as regras de negócio: no sistema novo, venda significa recebimento integral e estoque de OS é reservado na abertura. Verificar como o sistema antigo tratava esses eventos.
5. Importar em uma cópia com um script dedicado e revisado. Não usar as RPCs de operação para reprocessar vendas históricas indiscriminadamente: elas baixariam estoque e gerariam recebimentos novamente.
6. Reconciliar quantidades por peça, itens por venda/OS, caixa acumulado, total de sucatas e contagem por proprietário.
7. Ensaiar o corte, estabelecer a última operação aceita no sistema antigo e capturar as mudanças finais.
8. Trocar a aplicação apenas após conciliar os números. Preservar a base anterior e registrar como reverter a troca sem duplicar novas movimentações.

## Mapeamento inicial

| Origem             | Destino                 | Transformação                                                     |
| ------------------ | ----------------------- | ----------------------------------------------------------------- |
| `perfil`           | `z_settings`            | Dados da loja por proprietário                                    |
| `sucatas`          | `z_scraps`              | Marca + modelo; custo total convertido para centavos              |
| `pecas`            | `z_parts`               | Quantidade atual; localização unificada; valores em centavos      |
| `vendas`           | `z_orders` kind=venda   | Revisar significado do recebimento e status                       |
| `venda_itens`      | `z_order_items`         | Preservar snapshots de preço, nome e origem                       |
| `ordens_servico`   | `z_orders` kind=oficina | Mapear etapa, mão de obra, descontos e prazo                      |
| `os_pecas`         | `z_order_items`         | Determinar se a quantidade já saiu do saldo                       |
| `caixa_movimentos` | `z_cash`                | Converter entrada/saída em valor com sinal; conciliar referências |
| Nomes avulsos      | `z_contacts`            | Não unir pessoas somente pelo nome                                |

Não foi entregue um importador automático porque o banco real e suas divergências não foram inspecionados. Inventar essa equivalência poderia duplicar vendas, caixa ou estoque. A aplicação nova está pronta para iniciar uma base nova; migrar dados exige o ensaio descrito acima.
