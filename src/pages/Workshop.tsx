import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  ClipboardCheck,
  Columns3,
  FileSignature,
  List,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Stethoscope,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useStore } from '../lib/store';
import {
  dateLabel,
  defaultChecklist,
  includes,
  labels,
  money,
  osNumber,
  payments,
  today,
  workflow,
  type CheckItem,
  type CheckState,
  type ExternalPart,
  type Item,
  type Order,
  type Service,
} from '../lib/types';
import {
  Badge,
  Confirm,
  Drawer,
  Empty,
  Field,
  Heading,
  LicensePlate,
  Logo,
  Modal,
  Pagination,
  Plate,
  SearchBox,
  Segmented,
  intOrNull,
  textValue,
  useRequestId,
} from '../components/ui';
import { PrintPortal, SignaturePad } from '../components/print';

const fuelLevels = ['reserva', '1/4', '1/2', '3/4', 'cheio'];
const originLabel: Record<ExternalPart['origin'], string> = {
  cliente: 'Trazida pelo cliente',
  comprada: 'Comprada para o serviço',
};
const columns = workflow.filter((s) => s !== 'entregue');
const partsTotal = (o: Pick<Order, 'items' | 'external_parts'>) =>
  o.items.reduce((n, i) => n + i.price * i.quantity, 0) +
  o.external_parts.reduce((n, e) => n + e.price * e.quantity, 0);

export function Workshop({
  focus,
  creating,
  onCreate,
  onClose,
}: {
  focus?: string;
  creating: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  const { state, execute } = useStore();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<string | undefined>(focus);
  const [edit, setEdit] = useState<Order>();
  const [deliver, setDeliver] = useState<Order>();
  const [dragging, setDragging] = useState<string>();
  const [error, setError] = useState('');
  const request = useRequestId();
  useEffect(() => setDetail(focus), [focus]);
  const t = today();
  const all = state.orders.filter((o) => o.kind === 'oficina');
  const filtered = all.filter((o) =>
    includes(q, o.customer, osNumber(o), o.vehicle, o.plate, o.technician, o.complaint),
  );
  const move = async (o: Order, to: string) => {
    if (o.status === to) return;
    if (to === 'entregue') return setDeliver(o);
    setError('');
    try {
      const p = { id: o.id, status: to };
      await execute('order.status', p, request(p));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const current = state.orders.find((o) => o.id === detail && o.kind === 'oficina');
  const deliveredRecent = filtered.filter((o) => o.status === 'entregue').slice(0, 6);
  return (
    <>
      <Heading
        eyebrow="OFICINA"
        title="Cada serviço registrado e assinado."
        description="Da recepção do veículo à entrega: diagnóstico, serviços, peças trocadas e assinatura."
      >
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} /> Nova ordem de serviço
        </button>
      </Heading>
      <div className="stat-strip">
        {columns.map((s) => (
          <span key={s}>
            <strong>{all.filter((o) => o.status === s).length}</strong> {labels[s].toLowerCase()}
          </span>
        ))}
        <span
          className={
            all.some(
              (o) => !['entregue', 'cancelada'].includes(o.status) && o.due_date && o.due_date < t,
            )
              ? 'alert'
              : ''
          }
        >
          <strong>
            {
              all.filter(
                (o) =>
                  !['entregue', 'cancelada'].includes(o.status) && o.due_date && o.due_date < t,
              ).length
            }
          </strong>{' '}
          atrasadas
        </span>
      </div>
      <div className="toolbar">
        <Segmented
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            {
              value: 'board',
              label: (
                <>
                  <Columns3 size={15} /> Quadro
                </>
              ),
            },
            {
              value: 'list',
              label: (
                <>
                  <List size={15} /> Lista
                </>
              ),
            },
          ]}
        />
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Buscar OS, cliente, veículo, placa ou técnico..."
        />
        {view === 'list' && (
          <select
            aria-label="Filtrar status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos os status</option>
            {[...workflow, 'cancelada'].map((x) => (
              <option key={x} value={x}>
                {labels[x]}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view === 'board' ? (
        <div className="board">
          {[...columns, 'entregue' as const].map((col) => {
            const cards =
              col === 'entregue' ? deliveredRecent : filtered.filter((o) => o.status === col);
            return (
              <section
                key={col}
                className={`board-col col-${col} ${dragging ? 'droppable' : ''}`}
                onDragOver={(e) => {
                  if (dragging) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const o = all.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                  setDragging(undefined);
                  if (o && !['entregue', 'cancelada'].includes(o.status)) void move(o, col);
                }}
                aria-label={labels[col]}
              >
                <header>
                  <Badge value={col} />
                  <span className="col-count">{cards.length}</span>
                </header>
                <div className="board-cards">
                  {cards.map((o) => (
                    <article
                      key={o.id}
                      className={`os-card ${o.due_date && o.due_date < t && col !== 'entregue' ? 'late' : ''}`}
                      draggable={col !== 'entregue'}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', o.id);
                        setDragging(o.id);
                      }}
                      onDragEnd={() => setDragging(undefined)}
                    >
                      <button
                        className="os-card-hit"
                        onClick={() => setDetail(o.id)}
                        aria-label={`Abrir ${osNumber(o)} de ${o.customer}`}
                      />
                      <div className="os-card-top">
                        <span className="os-number">{osNumber(o)}</span>
                        {o.has_signature && (
                          <FileSignature size={14} className="signed-icon" aria-label="Assinada" />
                        )}
                      </div>
                      <strong>{o.vehicle || 'Veículo não informado'}</strong>
                      <span className="os-customer">{o.customer}</span>
                      <div className="os-card-meta">
                        <LicensePlate plate={o.plate} small />
                        <b>{money(o.total)}</b>
                      </div>
                      <div className="os-card-foot">
                        <span
                          className={
                            o.due_date && o.due_date < t && col !== 'entregue' ? 'negative' : ''
                          }
                        >
                          <CalendarClock size={12} />{' '}
                          {o.due_date ? dateLabel(o.due_date) : 'sem prazo'}
                        </span>
                        {o.technician && <span>{o.technician.split(' ')[0]}</span>}
                      </div>
                      {col !== 'entregue' && (
                        <select
                          className="os-card-move"
                          aria-label={`Mover ${osNumber(o)} para outra etapa`}
                          value={o.status}
                          onChange={(e) => void move(o, e.target.value)}
                        >
                          {workflow.map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </article>
                  ))}
                  {!cards.length && (
                    <p className="col-empty">
                      {col === 'entregue' ? 'Nenhuma entrega recente' : 'Arraste uma OS para cá'}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Plate>
          <Pagination
            rows={filtered.filter((o) => status === 'all' || o.status === status)}
            empty={
              <Empty
                icon={<Wrench size={28} />}
                title="Nenhuma ordem de serviço"
                detail="Abra uma OS para o primeiro veículo."
              />
            }
          >
            {(page) => (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>OS / cliente</th>
                      <th>Veículo</th>
                      <th>Prazo</th>
                      <th>Status</th>
                      <th className="numeric">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {page.map((o) => (
                      <tr key={o.id} className={o.status === 'cancelada' ? 'cancelled' : ''}>
                        <td>
                          <button className="cell-link" onClick={() => setDetail(o.id)}>
                            {o.customer}
                          </button>
                          <small className="mono">{osNumber(o)}</small>
                        </td>
                        <td>
                          {o.vehicle || '—'}
                          <small>{o.plate}</small>
                        </td>
                        <td
                          className={
                            o.due_date &&
                            o.due_date < t &&
                            !['entregue', 'cancelada'].includes(o.status)
                              ? 'negative'
                              : ''
                          }
                        >
                          {o.due_date ? dateLabel(o.due_date) : '—'}
                        </td>
                        <td>
                          <Badge value={o.status} />
                        </td>
                        <td className="numeric">{money(o.total)}</td>
                        <td>
                          <div className="row-actions">
                            <button className="text-button" onClick={() => setDetail(o.id)}>
                              Abrir
                            </button>
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
      )}
      {current && (
        <OsDrawer
          order={current}
          close={() => setDetail(undefined)}
          edit={() => setEdit(current)}
          advance={(to) => void move(current, to)}
        />
      )}
      {creating && <OsForm close={onClose} />}
      {edit && <OsForm order={edit} close={() => setEdit(undefined)} />}
      {deliver && (
        <Confirm
          title={`Entregar ${osNumber(deliver)}?`}
          detail={`O veículo será marcado como entregue e ${money(deliver.total)} entra no caixa como recebido (${deliver.payment}). Depois disso a OS não pode mais ser editada.`}
          close={() => setDeliver(undefined)}
          run={() => {
            const p = { id: deliver.id, status: 'entregue' };
            return execute('order.status', p, request(p));
          }}
        />
      )}
    </>
  );
}

function OsDrawer({
  order: o,
  close,
  edit,
  advance,
}: {
  order: Order;
  close: () => void;
  edit: () => void;
  advance: (to: string) => void;
}) {
  const { state, execute, loadSignature } = useStore();
  const [printing, setPrinting] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState('');
  const open = !['entregue', 'cancelada'].includes(o.status);
  const idx = workflow.indexOf(o.status as (typeof workflow)[number]);
  const next = idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;
  const print = async () => {
    setError('');
    try {
      setPrinting(o.has_signature ? await loadSignature(o.id) : '');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Drawer
      title={
        <>
          {osNumber(o)} <Badge value={o.status} />
        </>
      }
      subtitle={`${o.customer} · aberta em ${dateLabel(o.created_at)}`}
      close={close}
      actions={
        <>
          <button className="button primary small" onClick={() => void print()}>
            <Printer size={15} /> Imprimir / PDF
          </button>
          {o.status !== 'cancelada' && (
            <button className="button ghost small" onClick={() => setSigning(true)}>
              <FileSignature size={15} />{' '}
              {o.has_signature ? 'Assinar de novo' : 'Coletar assinatura'}
            </button>
          )}
          {open && (
            <button className="button ghost small" onClick={edit}>
              <Pencil size={14} /> Editar OS
            </button>
          )}
          {open && next && (
            <button className="button ghost small" onClick={() => advance(next)}>
              Avançar para {labels[next]}
            </button>
          )}
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="progress-steps" aria-label="Etapas da OS">
        {workflow.map((s, i) => (
          <span key={s} className={`${i <= idx ? 'done' : ''} ${s === o.status ? 'current' : ''}`}>
            <i />
            {labels[s]}
          </span>
        ))}
      </div>
      <div className="vehicle-card">
        <LicensePlate plate={o.plate} />
        <div>
          <strong>{o.vehicle || 'Veículo não informado'}</strong>
          <small>
            {o.km !== null ? `${o.km.toLocaleString('pt-BR')} km` : 'km não informado'} ·
            combustível {o.fuel_level || '—'}
          </small>
        </div>
      </div>
      <OsSection icon={<ClipboardCheck size={17} />} title="Relato do cliente">
        <p className="note-box">{o.complaint || o.description || '—'}</p>
      </OsSection>
      {o.checklist.length > 0 && (
        <OsSection icon={<ClipboardCheck size={17} />} title="Checklist de entrada">
          <div className="checklist-view">
            {o.checklist.map((c) => (
              <span key={c.label} className={`check-${c.state}`}>
                <i />
                {c.label}
                <small>
                  {c.state === 'ok' ? 'OK' : c.state === 'avaria' ? 'Avaria' : 'Ausente'}
                </small>
              </span>
            ))}
          </div>
        </OsSection>
      )}
      {o.diagnosis && (
        <OsSection icon={<Stethoscope size={17} />} title="Diagnóstico">
          <p className="note-box">{o.diagnosis}</p>
        </OsSection>
      )}
      <OsSection icon={<Wrench size={17} />} title="Serviços executados">
        {o.services.length ? (
          <div className="service-list">
            {o.services.map((s, i) => (
              <div key={i}>
                <span className="grow">
                  <strong>{s.description}</strong>
                  {s.detail && <small>{s.detail}</small>}
                </span>
                <b>{money(s.price)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">Mão de obra: {money(o.labor)}</p>
        )}
      </OsSection>
      <OsSection icon={<PackageSearch size={17} />} title="Peças trocadas">
        {o.items.length || o.external_parts.length ? (
          <div className="service-list">
            {o.items.map((i) => (
              <div key={i.part_id}>
                <span className="grow">
                  <strong>
                    {i.quantity}× {i.name}
                  </strong>
                  <small>
                    Estoque Pixote · caixa{' '}
                    {state.boxes.find(
                      (b) => b.id === state.parts.find((p) => p.id === i.part_id)?.box_id,
                    )?.code || '—'}
                  </small>
                </span>
                <b>{money(i.price * i.quantity)}</b>
              </div>
            ))}
            {o.external_parts.map((e, i) => (
              <div key={`e${i}`}>
                <span className="grow">
                  <strong>
                    {e.quantity}× {e.name}
                  </strong>
                  <small>
                    {originLabel[e.origin]}
                    {e.note && ` · ${e.note}`}
                  </small>
                </span>
                <b>{money(e.price * e.quantity)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">Nenhuma peça.</p>
        )}
      </OsSection>
      {o.recommendations && (
        <OsSection icon={<ClipboardCheck size={17} />} title="Recomendações">
          <p className="note-box">{o.recommendations}</p>
        </OsSection>
      )}
      <div className="os-totals">
        <span>Serviços {money(o.labor)}</span>
        <span>Peças {money(partsTotal(o))}</span>
        {o.discount > 0 && <span>Desconto − {money(o.discount)}</span>}
        <strong>Total {money(o.total)}</strong>
      </div>
      <dl className="spec-grid compact">
        <div>
          <dt>Responsável</dt>
          <dd>{o.technician || '—'}</dd>
        </div>
        <div>
          <dt>Previsão</dt>
          <dd>{o.due_date ? dateLabel(o.due_date) : '—'}</dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{o.payment}</dd>
        </div>
        <div>
          <dt>Garantia</dt>
          <dd>{o.warranty_days} dias</dd>
        </div>
        <div>
          <dt>Assinatura</dt>
          <dd>
            {o.has_signature
              ? `${o.signed_name} · ${o.signed_at ? dateLabel(o.signed_at) : ''}`
              : 'Pendente'}
          </dd>
        </div>
      </dl>
      {o.status !== 'cancelada' && (
        <button className="text-button danger-text cancel-link" onClick={() => setCancel(true)}>
          Cancelar esta OS
        </button>
      )}
      {signing && <SignModal order={o} close={() => setSigning(false)} />}
      {printing !== null && (
        <PrintPortal title={`${osNumber(o)} ${o.customer}`} onDone={() => setPrinting(null)}>
          <OsDocument order={o} signature={printing} />
        </PrintPortal>
      )}
      {cancel && (
        <Confirm
          title={`Cancelar ${osNumber(o)}?`}
          detail="As peças reservadas voltam para as caixas e, se houve recebimento, o caixa recebe o estorno. O registro permanece no histórico."
          danger
          close={() => setCancel(false)}
          run={() => execute('order.status', { id: o.id, status: 'cancelada' })}
        />
      )}
    </Drawer>
  );
}
function OsSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="os-section">
      <h3 className="section-title">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function SignModal({ order, close }: { order: Order; close: () => void }) {
  const { execute } = useStore();
  const [signature, setSignature] = useState('');
  return (
    <Modal
      title="Assinatura do cliente"
      description={`${osNumber(order)} · ${order.vehicle}. Peça ao cliente para assinar com o dedo, caneta ou mouse.`}
      close={close}
      submit="Salvar assinatura"
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        if (!signature) throw new Error('Faça a assinatura na área indicada.');
        await execute('order.sign', {
          id: order.id,
          signed_name: textValue(f, 'signed_name'),
          signature,
        });
      }}
    >
      <Field label="Nome de quem assina">
        <input name="signed_name" required maxLength={160} defaultValue={order.customer} />
      </Field>
      <SignaturePad onChange={setSignature} />
      <p className="hint">
        Ao assinar, o cliente declara estar de acordo com os serviços, valores e condições de
        garantia desta ordem.
      </p>
    </Modal>
  );
}

/** Documento A4 impresso / salvo em PDF. */
export function OsDocument({ order: o, signature }: { order: Order; signature: string }) {
  const { state } = useStore();
  const s = state.settings;
  const contact = state.contacts.find((c) => c.id === o.contact_id);
  const warranty =
    s.warranty_text ||
    `Garantia de ${o.warranty_days} dias para os serviços executados e peças fornecidas pela oficina, contados da entrega do veículo. Não cobre peças fornecidas pelo cliente, mau uso ou desgaste natural.`;
  return (
    <div className="print-page os-doc">
      <header className="doc-head">
        <div className="doc-brand">
          <Logo size={46} />
          <div>
            <strong>{s.name}</strong>
            <span>{[s.document, s.phone, s.email].filter(Boolean).join(' · ')}</span>
            <span>{s.address}</span>
          </div>
        </div>
        <div className="doc-number">
          <span>Ordem de serviço</span>
          <b>{osNumber(o)}</b>
          <span>Aberta em {dateLabel(o.created_at)}</span>
          <span>Status: {labels[o.status]}</span>
        </div>
      </header>
      <section className="doc-grid">
        <div>
          <h4>Cliente</h4>
          <p>
            <b>{o.customer}</b>
          </p>
          {contact?.phone && <p>Tel.: {contact.phone}</p>}
          {contact?.document && <p>CPF/CNPJ: {contact.document}</p>}
        </div>
        <div>
          <h4>Veículo</h4>
          <p>
            <b>{o.vehicle || '—'}</b>
          </p>
          <p>
            Placa: <b>{o.plate || '—'}</b> · Km:{' '}
            {o.km !== null ? o.km.toLocaleString('pt-BR') : '—'} · Combustível:{' '}
            {o.fuel_level || '—'}
          </p>
        </div>
        <div>
          <h4>Serviço</h4>
          <p>Responsável: {o.technician || '—'}</p>
          <p>Previsão: {o.due_date ? dateLabel(o.due_date) : '—'}</p>
          <p>Pagamento: {o.payment}</p>
        </div>
      </section>
      <section>
        <h4>Relato do cliente</h4>
        <p className="doc-box">{o.complaint || o.description || '—'}</p>
      </section>
      {o.checklist.length > 0 && (
        <section>
          <h4>Checklist de entrada</h4>
          <div className="doc-checklist">
            {o.checklist.map((c) => (
              <span key={c.label}>
                <i className={c.state}>
                  {c.state === 'ok' ? '✓' : c.state === 'avaria' ? '!' : '×'}
                </i>
                {c.label}
              </span>
            ))}
          </div>
        </section>
      )}
      {o.diagnosis && (
        <section>
          <h4>Diagnóstico</h4>
          <p className="doc-box">{o.diagnosis}</p>
        </section>
      )}
      <section>
        <h4>Serviços executados</h4>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Como foi feito</th>
              <th className="numeric">Valor</th>
            </tr>
          </thead>
          <tbody>
            {o.services.length ? (
              o.services.map((s, i) => (
                <tr key={i}>
                  <td>{s.description}</td>
                  <td>{s.detail || '—'}</td>
                  <td className="numeric">{money(s.price)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>Mão de obra</td>
                <td>{o.description}</td>
                <td className="numeric">{money(o.labor)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {(o.items.length > 0 || o.external_parts.length > 0) && (
        <section>
          <h4>Peças trocadas / aplicadas</h4>
          <table>
            <thead>
              <tr>
                <th>Peça</th>
                <th>Origem</th>
                <th className="numeric">Qtd.</th>
                <th className="numeric">Unitário</th>
                <th className="numeric">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.part_id}>
                  <td>{i.name}</td>
                  <td>Estoque da loja</td>
                  <td className="numeric">{i.quantity}</td>
                  <td className="numeric">{money(i.price)}</td>
                  <td className="numeric">{money(i.price * i.quantity)}</td>
                </tr>
              ))}
              {o.external_parts.map((e, i) => (
                <tr key={`e${i}`}>
                  <td>
                    {e.name}
                    {e.note && <small> · {e.note}</small>}
                  </td>
                  <td>{originLabel[e.origin]}</td>
                  <td className="numeric">{e.quantity}</td>
                  <td className="numeric">{money(e.price)}</td>
                  <td className="numeric">{money(e.price * e.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="doc-totals">
        <span>Serviços: {money(o.labor)}</span>
        <span>Peças: {money(partsTotal(o))}</span>
        {o.discount > 0 && <span>Desconto: − {money(o.discount)}</span>}
        <strong>Total: {money(o.total)}</strong>
      </section>
      {o.recommendations && (
        <section>
          <h4>Recomendações</h4>
          <p className="doc-box">{o.recommendations}</p>
        </section>
      )}
      <section className="doc-terms">
        <h4>Garantia e condições</h4>
        <p>{warranty}</p>
        <p>
          Autorizo a execução dos serviços descritos e declaro que recebi o veículo nas condições
          acima. Peças substituídas ficam à disposição do cliente por 7 dias.
        </p>
      </section>
      <section className="doc-signatures">
        <div>
          <div className="sig-area">
            {signature && <img src={signature} alt="Assinatura do cliente" />}
          </div>
          <span className="sig-line" />
          <b>{o.signed_name || o.customer}</b>
          <small>Cliente{o.signed_at ? ` · assinado em ${dateLabel(o.signed_at)}` : ''}</small>
        </div>
        <div>
          <div className="sig-area" />
          <span className="sig-line" />
          <b>{o.technician || s.responsible || s.name}</b>
          <small>Responsável técnico</small>
        </div>
      </section>
      <footer className="doc-foot">
        Documento de controle interno · não substitui nota fiscal · emitido em {dateLabel(today())}{' '}
        · Pixote CRM
      </footer>
    </div>
  );
}

function OsForm({ order, close }: { order?: Order; close: () => void }) {
  const { state, execute } = useStore();
  const request = useRequestId();
  const [contact, setContact] = useState(order?.contact_id || '');
  const [customer, setCustomer] = useState(order?.customer || '');
  const [services, setServices] = useState<Service[]>(
    order?.services.length
      ? order.services
      : order
        ? [{ description: 'Mão de obra', detail: order.description, price: order.labor }]
        : [{ description: '', detail: '', price: 0 }],
  );
  const [items, setItems] = useState<Item[]>(order?.items || []);
  const [external, setExternal] = useState<ExternalPart[]>(order?.external_parts || []);
  const [checklist, setChecklist] = useState<CheckItem[]>(
    order?.checklist.length
      ? order.checklist
      : defaultChecklist.map((label) => ({ label, state: 'ok' as CheckState })),
  );
  const [fuel, setFuel] = useState(order?.fuel_level || '');
  const [selected, setSelected] = useState('');
  const [discount, setDiscount] = useState(String((order?.discount || 0) / 100));
  const available = state.parts
    .filter((p) => !p.archived)
    .map((p) => ({
      ...p,
      quantity: p.quantity + (order?.items.find((i) => i.part_id === p.id)?.quantity || 0),
    }))
    .filter((p) => p.quantity > 0);
  const labor = services.reduce((n, s) => n + (s.price || 0), 0);
  const total =
    labor +
    items.reduce((n, i) => n + i.price * i.quantity, 0) +
    external.reduce((n, e) => n + e.price * e.quantity, 0) -
    Math.round(Number(discount) * 100);
  const setService = (i: number, patch: Partial<Service>) =>
    setServices(services.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const setExt = (i: number, patch: Partial<ExternalPart>) =>
    setExternal(external.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const cycle: Record<CheckState, CheckState> = { ok: 'avaria', avaria: 'ausente', ausente: 'ok' };
  return (
    <Modal
      title={order ? `Editar ${osNumber(order)}` : 'Nova ordem de serviço'}
      description="Peças do estoque ficam reservadas na abertura. O recebimento entra no caixa na entrega."
      close={close}
      size="xl"
      submit={order ? 'Salvar ordem de serviço' : 'Abrir ordem de serviço'}
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        const cleanServices = services.filter((s) => s.description.trim());
        if (!cleanServices.length)
          throw new Error('Informe pelo menos um serviço (pode ser só o diagnóstico).');
        if (total < 0) throw new Error('O desconto não pode superar o total.');
        const payload = {
          ...(order ? { id: order.id } : {}),
          kind: 'oficina',
          contact_id: contact || null,
          customer: customer.trim(),
          channel: 'balcao',
          payment: textValue(f, 'payment'),
          vehicle: textValue(f, 'vehicle'),
          plate: textValue(f, 'plate').toUpperCase(),
          km: intOrNull(f, 'km'),
          fuel_level: fuel,
          technician: textValue(f, 'technician'),
          due_date: textValue(f, 'due_date') || null,
          complaint: textValue(f, 'complaint'),
          diagnosis: textValue(f, 'diagnosis'),
          description: cleanServices
            .map((s) => s.description)
            .join(', ')
            .slice(0, 2000),
          recommendations: textValue(f, 'recommendations'),
          warranty_days: Number(f.get('warranty_days') || 90),
          services: cleanServices.map((s) => ({ ...s, description: s.description.trim() })),
          external_parts: external.filter((x) => x.name.trim()),
          checklist,
          labor,
          discount: Math.round(Number(discount) * 100),
          items,
        };
        await execute(order ? 'order.update' : 'order.create', payload, request(payload));
      }}
    >
      <div className="os-form">
        <div className="os-form-main">
          <h3 className="section-title">Cliente e veículo</h3>
          <div className="form-grid three">
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
                  .filter(
                    (c) => (!c.archived && c.kind !== 'fornecedor') || c.id === order?.contact_id,
                  )
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
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setContact('');
                }}
              />
            </Field>
            <Field label="Veículo">
              <input
                name="vehicle"
                defaultValue={order?.vehicle}
                required
                maxLength={160}
                placeholder="Marca modelo motor ano"
              />
            </Field>
            <Field label="Placa">
              <input
                name="plate"
                defaultValue={order?.plate}
                maxLength={12}
                className="mono"
                placeholder="ABC1D23"
              />
            </Field>
            <Field label="Quilometragem">
              <input name="km" type="number" min="0" max="5000000" defaultValue={order?.km ?? ''} />
            </Field>
            <Field label="Responsável pelo serviço">
              <input name="technician" defaultValue={order?.technician} maxLength={120} />
            </Field>
            <Field label="Previsão de entrega">
              <input name="due_date" defaultValue={order?.due_date || ''} type="date" />
            </Field>
            <Field label="Forma de pagamento">
              <select name="payment" defaultValue={order?.payment || 'Pix'}>
                {payments.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Garantia (dias)">
              <input
                name="warranty_days"
                type="number"
                min="0"
                max="3650"
                defaultValue={order?.warranty_days ?? 90}
              />
            </Field>
          </div>
          <div
            className="fuel-picker"
            role="radiogroup"
            aria-label="Nível de combustível na entrada"
          >
            <span className="field-legend">Combustível na entrada</span>
            <div>
              {fuelLevels.map((f, i) => (
                <button
                  type="button"
                  key={f}
                  role="radio"
                  aria-checked={fuel === f}
                  className={fuel && fuelLevels.indexOf(fuel) >= i ? 'on' : ''}
                  onClick={() => setFuel(fuel === f ? '' : f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <h3 className="section-title spaced">Recepção</h3>
          <Field label="Relato do cliente / sintoma" wide>
            <textarea
              name="complaint"
              defaultValue={order?.complaint}
              maxLength={2000}
              rows={2}
              placeholder="O que o cliente percebeu? Quando acontece?"
            />
          </Field>
          <div
            className="checklist"
            aria-label="Checklist de entrada: clique para alternar entre OK, avaria e ausente"
          >
            {checklist.map((c, i) => (
              <button
                type="button"
                key={c.label}
                className={`check-${c.state}`}
                onClick={() =>
                  setChecklist(
                    checklist.map((x, n) => (n === i ? { ...x, state: cycle[x.state] } : x)),
                  )
                }
              >
                <i />
                {c.label}
                <small>
                  {c.state === 'ok' ? 'OK' : c.state === 'avaria' ? 'Avaria' : 'Ausente'}
                </small>
              </button>
            ))}
          </div>

          <h3 className="section-title spaced">Diagnóstico</h3>
          <Field label="O que foi constatado" wide>
            <textarea name="diagnosis" defaultValue={order?.diagnosis} maxLength={4000} rows={2} />
          </Field>

          <h3 className="section-title spaced">
            <Wrench size={17} /> Serviços executados
          </h3>
          <div className="line-items">
            {services.map((s, i) => (
              <div className="line-item" key={i}>
                <input
                  aria-label={`Serviço ${i + 1}`}
                  placeholder="Serviço (ex.: troca de pastilhas)"
                  value={s.description}
                  maxLength={300}
                  onChange={(e) => setService(i, { description: e.target.value })}
                />
                <input
                  aria-label={`Como foi feito ${i + 1}`}
                  placeholder="Como foi feito / o que foi trocado"
                  value={s.detail}
                  maxLength={2000}
                  onChange={(e) => setService(i, { detail: e.target.value })}
                />
                <input
                  aria-label={`Valor do serviço ${i + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={s.price / 100}
                  onChange={(e) =>
                    setService(i, { price: Math.round(Number(e.target.value) * 100) })
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover serviço ${i + 1}`}
                  onClick={() => setServices(services.filter((_, n) => n !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button ghost small"
              onClick={() => setServices([...services, { description: '', detail: '', price: 0 }])}
            >
              <Plus size={14} /> Adicionar serviço
            </button>
          </div>

          <h3 className="section-title spaced">
            <PackageSearch size={17} /> Peças do estoque
          </h3>
          <div className="add-item">
            <select
              aria-label="Peça para adicionar"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Selecione uma peça do armazém</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name} ({p.quantity} un.)
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button ghost"
              disabled={!selected || items.some((i) => i.part_id === selected)}
              onClick={() => {
                const p = available.find((p) => p.id === selected);
                if (p)
                  setItems([
                    ...items,
                    { part_id: p.id, name: p.name, quantity: 1, price: p.price },
                  ]);
                setSelected('');
              }}
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>
          {items.length > 0 && (
            <div className="line-items">
              {items.map((i) => (
                <div className="line-item stock" key={i.part_id}>
                  <span className="line-name">{i.name}</span>
                  <input
                    aria-label={`Quantidade de ${i.name}`}
                    type="number"
                    min="1"
                    max={available.find((p) => p.id === i.part_id)?.quantity}
                    value={i.quantity}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x === i ? { ...x, quantity: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Preço de ${i.name}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={i.price / 100}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x === i ? { ...x, price: Math.round(Number(e.target.value) * 100) } : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remover ${i.name}`}
                    onClick={() => setItems(items.filter((x) => x !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className="section-title spaced">Peças externas ou do cliente</h3>
          <div className="line-items">
            {external.map((x, i) => (
              <div className="line-item external" key={i}>
                <input
                  aria-label={`Peça externa ${i + 1}`}
                  placeholder="Peça"
                  value={x.name}
                  maxLength={160}
                  onChange={(e) => setExt(i, { name: e.target.value })}
                />
                <input
                  aria-label={`Quantidade externa ${i + 1}`}
                  type="number"
                  min="1"
                  value={x.quantity}
                  onChange={(e) => setExt(i, { quantity: Number(e.target.value) })}
                />
                <select
                  aria-label={`Origem ${i + 1}`}
                  value={x.origin}
                  onChange={(e) =>
                    setExt(i, {
                      origin: e.target.value as ExternalPart['origin'],
                      price: e.target.value === 'cliente' ? 0 : x.price,
                    })
                  }
                >
                  <option value="comprada">Comprada p/ serviço</option>
                  <option value="cliente">Trazida pelo cliente</option>
                </select>
                <input
                  aria-label={`Valor cobrado ${i + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={x.origin === 'cliente'}
                  value={x.price / 100}
                  onChange={(e) => setExt(i, { price: Math.round(Number(e.target.value) * 100) })}
                />
                <input
                  aria-label={`Observação ${i + 1}`}
                  placeholder="Obs. (NF, marca)"
                  value={x.note}
                  maxLength={200}
                  onChange={(e) => setExt(i, { note: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover peça externa ${i + 1}`}
                  onClick={() => setExternal(external.filter((_, n) => n !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button ghost small"
              onClick={() =>
                setExternal([
                  ...external,
                  { name: '', quantity: 1, origin: 'comprada', price: 0, note: '' },
                ])
              }
            >
              <Plus size={14} /> Adicionar peça externa
            </button>
          </div>

          <h3 className="section-title spaced">Recomendações</h3>
          <Field label="Próximas revisões, alertas ao cliente" wide>
            <textarea
              name="recommendations"
              defaultValue={order?.recommendations}
              maxLength={2000}
              rows={2}
            />
          </Field>
        </div>
        <aside className="os-form-summary">
          <div className="summary-card">
            <span className="overline">Resumo da OS</span>
            <div>
              <span>Serviços</span>
              <b>{money(labor)}</b>
            </div>
            <div>
              <span>Peças do estoque</span>
              <b>{money(items.reduce((n, i) => n + i.price * i.quantity, 0))}</b>
            </div>
            <div>
              <span>Peças externas</span>
              <b>{money(external.reduce((n, e) => n + e.price * e.quantity, 0))}</b>
            </div>
            <Field label="Desconto (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </Field>
            <div className="summary-total">
              <span>Total</span>
              <strong className={total < 0 ? 'negative' : ''}>{money(total)}</strong>
            </div>
            <p className="hint">O total entra no caixa quando a OS for marcada como entregue.</p>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
