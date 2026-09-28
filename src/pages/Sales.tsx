import { useMemo, useState } from 'react';
import { Plus, Printer, Receipt, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import {
  channels,
  dateLabel,
  exportCsv,
  includes,
  labels,
  money,
  osNumber,
  payments,
  type Channel,
  type Item,
  type Order,
} from '../lib/types';
import { channelStats, inRange, periodLabels, rangeFor, type PeriodKey } from '../lib/metrics';
import {
  Badge,
  ChannelLogo,
  ChannelPill,
  Confirm,
  Count,
  Empty,
  ExportButton,
  Field,
  Heading,
  Modal,
  Pagination,
  Plate,
  SearchBox,
  Segmented,
  textValue,
  useRequestId,
} from '../components/ui';
import { PrintPortal } from '../components/print';

/** Percentuais aproximados apenas como sugestão; o valor real é editável em cada venda. */
const suggestedFee: Record<Channel, number> = { balcao: 0, mercado_livre: 0.16, shopee: 0.2 };
const channelTagline: Record<Channel, string> = {
  balcao: 'Loja física · retirada',
  mercado_livre: 'Marketplace · anúncios',
  shopee: 'Marketplace · anúncios',
};

export function Sales({
  creating,
  onCreate,
  onClose,
}: {
  creating: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  const { state, execute } = useStore();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<Order>();
  const [cancel, setCancel] = useState<Order>();
  const request = useRequestId();
  const range = rangeFor(period);
  const stats = useMemo(() => channelStats(state.orders, range), [state.orders, period]);
  const rows = state.orders.filter(
    (o) =>
      o.kind === 'venda' &&
      inRange(o.created_at.slice(0, 10), range) &&
      (channel === 'all' || o.channel === channel) &&
      (status === 'all' || o.status === status) &&
      includes(q, o.customer, osNumber(o), o.external_ref, ...o.items.map((i) => i.name)),
  );
  return (
    <>
      <Heading
        eyebrow="VENDAS"
        title="Três balcões, um só caixa."
        description="Balcão, Mercado Livre e Shopee com taxas, líquido e baixa automática de estoque."
      >
        <ExportButton
          onClick={() =>
            exportCsv('vendas-pixote.csv', [
              [
                'Número',
                'Data',
                'Canal',
                'Pedido',
                'Cliente',
                'Itens',
                'Pagamento',
                'Bruto (R$)',
                'Taxa (R$)',
                'Líquido (R$)',
                'Status',
              ],
              ...rows.map((o) => [
                osNumber(o),
                o.created_at.slice(0, 10),
                labels[o.channel],
                o.external_ref,
                o.customer,
                o.items.map((i) => `${i.quantity}x ${i.name}`).join(' | '),
                o.payment,
                (o.total / 100).toFixed(2),
                (o.fee / 100).toFixed(2),
                ((o.total - o.fee) / 100).toFixed(2),
                labels[o.status],
              ]),
            ])
          }
        />
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} /> Nova venda
        </button>
      </Heading>
      <div className="toolbar">
        <Segmented
          label="Período"
          value={period}
          onChange={setPeriod}
          options={(['7d', '30d', 'month', 'year'] as PeriodKey[]).map((p) => ({
            value: p,
            label: periodLabels[p],
          }))}
        />
      </div>
      <section className="channel-cards" aria-label="Resultado por canal">
        {stats.list.map((c) => (
          <Plate
            key={c.channel}
            tilt
            as="article"
            className={`channel-card channel-${c.channel} ${channel === c.channel ? 'selected' : ''} ${channel !== 'all' && channel !== c.channel ? 'faded' : ''}`}
          >
            <button
              className="kpi-hit"
              aria-pressed={channel === c.channel}
              aria-label={`Filtrar vendas do canal ${labels[c.channel]}`}
              onClick={() => setChannel(channel === c.channel ? 'all' : c.channel)}
            />
            <div className="channel-card-head">
              <ChannelLogo channel={c.channel} size={54} />
              <div>
                <h3>{labels[c.channel]}</h3>
                <small>{channelTagline[c.channel]}</small>
              </div>
              <span className="share-pill">
                {stats.total ? Math.round((c.gross / stats.total) * 100) : 0}%
              </span>
            </div>
            <strong className="channel-gross">
              <Count value={c.gross} format={money} />
            </strong>
            <dl className="channel-numbers">
              <div>
                <dt>Vendas</dt>
                <dd>{c.count}</dd>
              </div>
              <div>
                <dt>Ticket</dt>
                <dd>{money(c.ticket)}</dd>
              </div>
              <div>
                <dt>Taxas</dt>
                <dd className={c.fees ? 'negative' : ''}>{money(c.fees)}</dd>
              </div>
              <div>
                <dt>Líquido</dt>
                <dd className="positive">{money(c.net)}</dd>
              </div>
            </dl>
            <span className="channel-bar">
              <i style={{ width: `${stats.total ? (c.gross / stats.total) * 100 : 0}%` }} />
            </span>
          </Plate>
        ))}
      </section>
      <Plate>
        <div className="toolbar">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Buscar cliente, número, pedido ou peça..."
          />
          <select
            aria-label="Filtrar status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="confirmada">Confirmadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          {channel !== 'all' && (
            <button className="button ghost small" onClick={() => setChannel('all')}>
              Mostrar todos os canais
            </button>
          )}
        </div>
        <Pagination
          rows={rows}
          empty={
            <Empty
              icon={<Receipt size={28} />}
              title="Nenhuma venda no período"
              detail="Registre uma venda ou mude o período e os filtros."
            />
          }
        >
          {(page) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Venda / cliente</th>
                    <th>Canal</th>
                    <th>Itens</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th className="numeric">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page.map((o) => (
                    <tr key={o.id} className={o.status === 'cancelada' ? 'cancelled' : ''}>
                      <td>
                        <button className="cell-link" onClick={() => setDetail(o)}>
                          {o.customer}
                        </button>
                        <small>
                          <span className="mono">{osNumber(o)}</span>
                          {o.external_ref && <> · pedido {o.external_ref}</>}
                        </small>
                      </td>
                      <td>
                        <ChannelPill channel={o.channel} />
                      </td>
                      <td className="items-cell">
                        {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                      </td>
                      <td>{dateLabel(o.created_at)}</td>
                      <td>
                        <Badge value={o.status} />
                      </td>
                      <td className="numeric">
                        {money(o.total)}
                        {o.fee > 0 && <small>líq. {money(o.total - o.fee)}</small>}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="text-button" onClick={() => setDetail(o)}>
                            Ver
                          </button>
                          {o.status !== 'cancelada' && (
                            <button
                              className="text-button danger-text"
                              onClick={() => setCancel(o)}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Pagination>
      </Plate>
      {creating && <SaleForm close={onClose} />}
      {detail && <SaleDetail order={detail} close={() => setDetail(undefined)} />}
      {cancel && (
        <Confirm
          title={`Cancelar ${osNumber(cancel)}?`}
          detail="As peças voltam para as caixas de origem e o caixa recebe o estorno da venda e da taxa. O registro fica no histórico."
          danger
          close={() => setCancel(undefined)}
          run={() => {
            const p = { id: cancel.id, status: 'cancelada' };
            return execute('order.status', p, request(p));
          }}
        />
      )}
    </>
  );
}

function SaleDetail({ order: o, close }: { order: Order; close: () => void }) {
  const { state } = useStore();
  const [printing, setPrinting] = useState(false);
  const receipt = (
    <div className="receipt">
      <div className="receipt-head">
        <div>
          <strong>{state.settings.name}</strong>
          <span>{state.settings.document}</span>
          <span>{state.settings.address}</span>
          <span>{state.settings.phone}</span>
        </div>
        <div className="receipt-number">
          <span>Comprovante de venda</span>
          <b>{osNumber(o)}</b>
          <span>{dateLabel(o.created_at)}</span>
        </div>
      </div>
      <div className="receipt-meta">
        <span>
          Cliente: <b>{o.customer}</b>
        </span>
        <span>
          Canal: <b>{labels[o.channel]}</b>
          {o.external_ref && ` · pedido ${o.external_ref}`}
        </span>
        <span>
          Pagamento: <b>{o.payment}</b>
        </span>
        {o.status === 'cancelada' && <span className="negative">VENDA CANCELADA</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Peça</th>
            <th className="numeric">Qtd.</th>
            <th className="numeric">Unitário</th>
            <th className="numeric">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.part_id}>
              <td>{i.name}</td>
              <td className="numeric">{i.quantity}</td>
              <td className="numeric">{money(i.price)}</td>
              <td className="numeric">{money(i.price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt-total">
        {o.discount > 0 && <span>Desconto: − {money(o.discount)}</span>}
        <strong>Total {money(o.total)}</strong>
      </div>
      <p className="fine-print">Documento de controle interno. Não substitui nota fiscal.</p>
    </div>
  );
  return (
    <Modal
      title={`Venda ${osNumber(o)}`}
      description={`${labels[o.channel]} · ${dateLabel(o.created_at)}`}
      close={close}
      wide
      footer={
        <button type="button" className="button ghost" onClick={() => setPrinting(true)}>
          <Printer size={16} /> Imprimir / PDF
        </button>
      }
    >
      <div className="paper-preview">{receipt}</div>
      {o.fee > 0 && (
        <p className="hint">
          Taxa do canal: {money(o.fee)} · líquido {money(o.total - o.fee)} (a taxa não aparece no
          comprovante do cliente).
        </p>
      )}
      {printing && (
        <PrintPortal title={`Venda ${osNumber(o)}`} onDone={() => setPrinting(false)}>
          <div className="print-page">{receipt}</div>
        </PrintPortal>
      )}
    </Modal>
  );
}

function SaleForm({ close }: { close: () => void }) {
  const { state, execute } = useStore();
  const [channel, setChannel] = useState<Channel>('balcao');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState('');
  const [contact, setContact] = useState('');
  const [customer, setCustomer] = useState('');
  const [discount, setDiscount] = useState('0');
  const [fee, setFee] = useState('0');
  const [feeTouched, setFeeTouched] = useState(false);
  const [itemError, setItemError] = useState('');
  const request = useRequestId();
  const available = state.parts.filter((p) => !p.archived && p.quantity > 0);
  const gross =
    items.reduce((n, i) => n + i.price * i.quantity, 0) - Math.round(Number(discount) * 100);
  const feeCents = channel === 'balcao' ? 0 : Math.round(Number(fee) * 100);
  const autoFee = (c: Channel, total: number) =>
    (Math.round(total * suggestedFee[c]) / 100).toFixed(2);
  const syncFee = (c: Channel, total: number) => {
    if (!feeTouched) setFee(autoFee(c, total));
  };
  const add = () => {
    const p = available.find((p) => p.id === selected);
    if (!p) return;
    if (items.some((i) => i.part_id === p.id)) {
      setItemError('Esta peça já está na venda. Ajuste a quantidade.');
      return;
    }
    const next = [...items, { part_id: p.id, name: p.name, quantity: 1, price: p.price }];
    setItems(next);
    syncFee(
      channel,
      next.reduce((n, i) => n + i.price * i.quantity, 0),
    );
    setSelected('');
    setItemError('');
  };
  const update = (next: Item[]) => {
    setItems(next);
    syncFee(
      channel,
      next.reduce((n, i) => n + i.price * i.quantity, 0),
    );
  };
  const boxOf = (partId: string) =>
    state.boxes.find((b) => b.id === state.parts.find((p) => p.id === partId)?.box_id)?.code;
  return (
    <Modal
      title="Registrar venda"
      description="Estoque, caixa e taxa do marketplace atualizados juntos."
      close={close}
      wide
      submit="Confirmar venda recebida"
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        if (!items.length) throw new Error('Adicione pelo menos uma peça.');
        if (gross < 0) throw new Error('O desconto não pode superar o total.');
        if (feeCents > gross) throw new Error('A taxa não pode superar o total da venda.');
        const payload = {
          kind: 'venda',
          contact_id: contact || null,
          customer: customer.trim(),
          channel,
          payment: textValue(f, 'payment'),
          external_ref: textValue(f, 'external_ref'),
          fee: feeCents,
          vehicle: '',
          plate: '',
          description: textValue(f, 'description'),
          technician: '',
          due_date: null,
          labor: 0,
          discount: Math.round(Number(discount) * 100),
          items,
        };
        await execute('order.create', payload, request(payload));
      }}
    >
      <fieldset className="channel-picker">
        <legend className="field-legend">Canal de venda</legend>
        {channels.map((c) => (
          <label key={c} className={`channel-option channel-${c} ${channel === c ? 'active' : ''}`}>
            <input
              type="radio"
              name="channel"
              value={c}
              checked={channel === c}
              onChange={() => {
                setChannel(c);
                setFeeTouched(false);
                setFee(
                  autoFee(
                    c,
                    items.reduce((n, i) => n + i.price * i.quantity, 0),
                  ),
                );
              }}
            />
            <ChannelLogo channel={c} size={44} />
            <span>
              <strong>{labels[c]}</strong>
              <small>
                {c === 'balcao'
                  ? 'Sem taxa'
                  : `Taxa sugerida ~${Math.round(suggestedFee[c] * 100)}%`}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="form-grid">
        <Field label="Cliente cadastrado">
          <select
            value={contact}
            onChange={(e) => {
              setContact(e.target.value);
              const c = state.contacts.find((c) => c.id === e.target.value);
              if (c) setCustomer(c.name);
            }}
          >
            <option value="">Cliente avulso</option>
            {state.contacts
              .filter((c) => !c.archived && c.kind !== 'fornecedor')
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Nome do cliente">
          <input
            required
            maxLength={160}
            value={customer}
            placeholder={channel === 'balcao' ? 'Consumidor' : 'Apelido / nome do comprador'}
            onChange={(e) => {
              setCustomer(e.target.value);
              setContact('');
            }}
          />
        </Field>
        {channel !== 'balcao' && (
          <Field label={`Nº do pedido ${labels[channel]}`}>
            <input
              name="external_ref"
              maxLength={60}
              placeholder={channel === 'shopee' ? '240928ABCDEF' : '2000001234567890'}
            />
          </Field>
        )}
        <Field label="Forma de pagamento">
          <select
            name="payment"
            defaultValue={channel === 'balcao' ? 'Pix' : 'Transferência'}
            key={channel}
          >
            {payments.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-section">
        <h3>Peças</h3>
        <div className="add-item">
          <select
            aria-label="Peça para adicionar"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Selecione uma peça disponível</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name} ({p.quantity} un.)
              </option>
            ))}
          </select>
          <button type="button" className="button ghost" disabled={!selected} onClick={add}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
        {itemError && (
          <p className="error" role="alert">
            {itemError}
          </p>
        )}
        {items.length > 0 && (
          <div className="table-wrap">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Peça</th>
                  <th>Caixa</th>
                  <th>Qtd.</th>
                  <th>Preço (R$)</th>
                  <th className="numeric">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.part_id}>
                    <td>{i.name}</td>
                    <td className="mono">{boxOf(i.part_id) || '—'}</td>
                    <td>
                      <input
                        aria-label={`Quantidade de ${i.name}`}
                        type="number"
                        min="1"
                        max={available.find((p) => p.id === i.part_id)?.quantity}
                        step="1"
                        required
                        value={i.quantity}
                        onChange={(e) =>
                          update(
                            items.map((x) =>
                              x === i ? { ...x, quantity: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Preço de ${i.name}`}
                        type="number"
                        min="0"
                        max="100000000"
                        step="0.01"
                        required
                        value={i.price / 100}
                        onChange={(e) =>
                          update(
                            items.map((x) =>
                              x === i
                                ? { ...x, price: Math.round(Number(e.target.value) * 100) }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="numeric">{money(i.price * i.quantity)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover ${i.name}`}
                        onClick={() => update(items.filter((x) => x !== i))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="form-grid">
        <Field label="Desconto (R$)">
          <input
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            required
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        {channel !== 'balcao' && (
          <Field
            label={`Taxa ${labels[channel]} (R$)`}
            hint="Comissão + tarifa fixa. Gera uma saída no caixa."
          >
            <input
              type="number"
              min="0"
              max="100000000"
              step="0.01"
              value={fee}
              onChange={(e) => {
                setFeeTouched(true);
                setFee(e.target.value);
              }}
            />
          </Field>
        )}
        <Field label="Observações">
          <input name="description" maxLength={2000} />
        </Field>
      </div>
      <div className="order-total">
        <div>
          <span>Total recebido</span>
          <strong>{money(Math.max(0, gross))}</strong>
        </div>
        {channel !== 'balcao' && (
          <div>
            <span>Líquido após taxa</span>
            <strong className="positive">{money(Math.max(0, gross - feeCents))}</strong>
          </div>
        )}
      </div>
    </Modal>
  );
}
