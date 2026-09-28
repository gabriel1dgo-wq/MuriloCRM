import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useStore } from '../lib/store';
import {
  addDays,
  cashCategories,
  dateLabel,
  exportCsv,
  includes,
  labels,
  money,
  payments,
  today,
  type Bill,
  type Cash,
} from '../lib/types';
import {
  balanceUntil,
  billBuckets,
  cashTotals,
  flowSeries,
  inRange,
  isRevenue,
  periodLabels,
  previousRange,
  rangeFor,
  sum,
  type PeriodKey,
  type Range,
} from '../lib/metrics';
import {
  Badge,
  Confirm,
  Count,
  Delta,
  Empty,
  ExportButton,
  Field,
  Heading,
  Modal,
  Plate,
  SearchBox,
  Segmented,
  amountValue,
  textValue,
  useRequestId,
} from '../components/ui';
import { Donut, FlowChart, HBars } from '../components/charts';

const originColors: Record<string, string> = {
  Balcão: '#ffb400',
  'Mercado Livre': '#ffe600',
  Shopee: '#ee4d2d',
  Oficina: '#4da3ff',
  'Outras entradas': '#8f6bff',
};
const expenseColors = [
  '#ff5448',
  '#ff6b1a',
  '#ffb400',
  '#8f6bff',
  '#4da3ff',
  '#35d07f',
  '#e05ab6',
  '#9aa3ad',
];

export function Finance() {
  const { state, execute } = useStore();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [custom, setCustom] = useState<Range>({ from: addDays(today(), -29), to: today() });
  const [q, setQ] = useState('');
  const [flow, setFlow] = useState<'all' | 'in' | 'out'>('all');
  const [create, setCreate] = useState<'entrada' | 'saida' | null>(null);
  const [bill, setBill] = useState<Bill | null | undefined>();
  const [pay, setPay] = useState<Bill>();
  const [cancelBill, setCancelBill] = useState<Bill>();
  const [reverse, setReverse] = useState<Cash>();
  const [billTab, setBillTab] = useState<'overdue' | 'today' | 'week' | 'later' | 'paid'>(
    'overdue',
  );
  const request = useRequestId();
  const range = rangeFor(period, custom);
  const invalid = range.from > range.to;
  const m = useMemo(() => {
    const now = cashTotals(state.cash, range);
    const before = cashTotals(state.cash, previousRange(range));
    const opening = balanceUntil(state.cash, addDays(range.from, -1));
    const closing = balanceUntil(state.cash, range.to);
    const current = balanceUntil(state.cash, '9999-12-31');
    const buckets = billBuckets(state.bills);
    const projected =
      current +
      sum(
        buckets.open.filter((b) => b.due_date <= addDays(today(), 30)),
        (b) => (b.direction === 'receber' ? b.amount : -b.amount),
      );
    const series = flowSeries(
      state.cash,
      range,
      state.bills,
      range.to === today() && period !== 'year' ? 14 : 0,
    );
    // Origem da receita: canal da venda, oficina ou outras entradas.
    const orderChannel = new Map(state.orders.map((o) => [o.id, o.channel]));
    const origins: Record<string, number> = {};
    for (const c of now.rows) {
      let key: string | null = null;
      if (c.category === 'Vendas') key = labels[orderChannel.get(c.reference_id || '') || 'balcao'];
      else if (c.category === 'Oficina') key = 'Oficina';
      else if (c.amount > 0 && c.source !== 'estorno') key = 'Outras entradas';
      if (key) origins[key] = (origins[key] || 0) + c.amount;
    }
    const byCategory: Record<string, number> = {};
    for (const c of now.rows)
      if (!isRevenue(c)) byCategory[c.category] = (byCategory[c.category] || 0) + c.amount;
    const expenses = Object.entries(byCategory)
      .filter(([, v]) => v < 0)
      .map(([label, v]) => ({ label, value: -v, color: '' }))
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({ ...x, color: expenseColors[i % expenseColors.length] }));
    const payMethods: Record<string, number> = {};
    for (const c of now.rows)
      if (c.amount > 0 && c.source !== 'estorno')
        payMethods[c.payment] = (payMethods[c.payment] || 0) + c.amount;
    return {
      now,
      before,
      opening,
      closing,
      current,
      projected,
      series,
      buckets,
      origins: Object.entries(origins)
        .filter(([, v]) => v > 0)
        .map(([label, value]) => ({ label, value, color: originColors[label] || '#9aa3ad' }))
        .sort((a, b) => b.value - a.value),
      expenses,
      payMethods: Object.entries(payMethods)
        .map(([label, value]) => ({ label, value, color: '' }))
        .sort((a, b) => b.value - a.value)
        .map((x, i) => ({
          ...x,
          color: ['#35d07f', '#4da3ff', '#ffb400', '#8f6bff', '#ff6b1a', '#9aa3ad'][i % 6],
        })),
    };
  }, [state, period, custom.from, custom.to]);
  const reversed = new Set(state.cash.map((c) => c.reversal_of).filter(Boolean));
  const statement = m.now.rows
    .filter(
      (c) =>
        (flow === 'all' || (flow === 'in' ? c.amount > 0 : c.amount < 0)) &&
        includes(q, c.description, c.category, c.payment),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const days = [...new Set(statement.map((c) => c.date))];
  const [shown, setShown] = useState(8);
  const billRows =
    billTab === 'paid'
      ? state.bills
          .filter((b) => b.status === 'paga')
          .slice(-15)
          .reverse()
      : m.buckets[billTab];
  const margin = m.now.income ? Math.round((m.now.net / m.now.income) * 100) : 0;
  return (
    <>
      <Heading
        eyebrow="FINANCEIRO"
        title="O dinheiro da operação, em movimento."
        description="Caixa, previsão, contas e de onde vem (e para onde vai) cada real."
      >
        <ExportButton
          onClick={() =>
            exportCsv(`caixa-${range.from}-a-${range.to}.csv`, [
              ['Data', 'Descrição', 'Categoria', 'Origem', 'Pagamento', 'Valor (R$)'],
              ...statement.map((c) => [
                c.date,
                c.description,
                c.category,
                labels[c.source] || c.source,
                c.payment,
                (c.amount / 100).toFixed(2),
              ]),
            ])
          }
        />
        <button className="button ghost" onClick={() => setBill(null)}>
          <CalendarClock size={16} /> Agendar conta
        </button>
        <button className="button ghost" onClick={() => setCreate('saida')}>
          <Minus size={16} /> Saída
        </button>
        <button className="button primary" onClick={() => setCreate('entrada')}>
          <Plus size={16} /> Entrada
        </button>
      </Heading>
      <div className="toolbar period-bar">
        <Segmented
          label="Período"
          value={period}
          onChange={setPeriod}
          options={(
            ['today', '7d', '30d', 'month', 'last_month', 'year', 'custom'] as PeriodKey[]
          ).map((p) => ({ value: p, label: periodLabels[p] }))}
        />
        {period === 'custom' && (
          <>
            <label className="inline-field">
              De
              <input
                aria-label="Data inicial"
                type="date"
                value={custom.from}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
            </label>
            <label className="inline-field">
              Até
              <input
                aria-label="Data final"
                type="date"
                value={custom.to}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </label>
          </>
        )}
        <span className="period-range">
          {dateLabel(range.from)} → {dateLabel(range.to)}
        </span>
      </div>
      {invalid && <p className="error">A data inicial deve ser anterior à data final.</p>}

      <section className="finance-hero">
        <Plate tilt className="balance-card" as="article">
          <span className="kpi-label">
            <Wallet size={17} /> Saldo atual em caixa
          </span>
          <strong className={`balance-value ${m.current < 0 ? 'negative' : ''}`}>
            <Count value={m.current} format={money} />
          </strong>
          <div className="balance-sub">
            <span>
              Previsão em 30 dias{' '}
              <b className={m.projected < 0 ? 'negative' : ''}>{money(m.projected)}</b>
            </span>
            <span>
              {m.buckets.open.length} conta(s) em aberto · {m.buckets.overdue.length} vencida(s)
            </span>
          </div>
          <div className="odometer" aria-hidden="true">
            <TrendingUp size={120} />
          </div>
        </Plate>
        <Plate tilt className="kpi" as="article">
          <span className="kpi-label">
            <ArrowDownLeft size={17} /> Entradas
          </span>
          <strong className="kpi-value positive">
            <Count value={m.now.income} format={money} />
          </strong>
          <span className="kpi-note">
            <Delta current={m.now.income} previous={m.before.income} /> vs. período anterior
          </span>
        </Plate>
        <Plate tilt className="kpi" as="article">
          <span className="kpi-label">
            <ArrowUpRight size={17} /> Saídas
          </span>
          <strong className="kpi-value negative">
            <Count value={m.now.expense} format={money} />
          </strong>
          <span className="kpi-note">
            <span className="delta-inverse">
              <Delta current={m.now.expense} previous={m.before.expense} />
            </span>{' '}
            vs. período anterior
          </span>
        </Plate>
        <Plate tilt className="kpi" as="article">
          <span className="kpi-label">
            <TrendingUp size={17} /> Resultado do período
          </span>
          <strong className={`kpi-value ${m.now.net < 0 ? 'negative' : ''}`}>
            <Count value={m.now.net} format={money} />
          </strong>
          <span className="kpi-note">
            margem de caixa {margin}% · taxas de marketplace {money(m.now.fees)}
          </span>
        </Plate>
      </section>

      <Plate className="flow-panel">
        <div className="panel-head">
          <div>
            <h2>Fluxo de caixa</h2>
            <p className="subtle">
              Saldo inicial {money(m.opening)} → final {money(m.closing)}
              {m.series.some((p) => p.projected) &&
                ' · área tracejada = previsão pelas contas agendadas'}
            </p>
          </div>
          <div className="legend">
            <span>
              <i style={{ ['--c' as string]: 'var(--green)' }} /> Entradas
            </span>
            <span>
              <i style={{ ['--c' as string]: 'var(--red)' }} /> Saídas
            </span>
            <span>
              <i className="line" style={{ ['--c' as string]: 'var(--amber)' }} /> Saldo
            </span>
          </div>
        </div>
        {!invalid && <FlowChart data={m.series} height={230} />}
      </Plate>

      <div className="finance-grid">
        <Plate>
          <div className="panel-head">
            <div>
              <h2>De onde vem</h2>
              <p className="subtle">Receitas por origem no período</p>
            </div>
          </div>
          {m.origins.length ? (
            <div className="donut-wrap">
              <Donut
                data={m.origins}
                center={money(sum(m.origins, (o) => o.value))}
                sub="receitas"
              />
              <div className="legend vertical">
                {m.origins.map((o) => (
                  <span key={o.label}>
                    <i style={{ ['--c' as string]: o.color }} />
                    {o.label}
                    <b>{money(o.value)}</b>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <Empty title="Sem receitas" detail="Nenhuma entrada no período." />
          )}
        </Plate>
        <Plate>
          <div className="panel-head">
            <div>
              <h2>Para onde vai</h2>
              <p className="subtle">Despesas por categoria</p>
            </div>
          </div>
          {m.expenses.length ? (
            <HBars data={m.expenses} />
          ) : (
            <Empty title="Sem despesas" detail="Nenhuma saída no período." />
          )}
        </Plate>
        <Plate>
          <div className="panel-head">
            <div>
              <h2>Como recebe</h2>
              <p className="subtle">Entradas por forma de pagamento</p>
            </div>
          </div>
          {m.payMethods.length ? (
            <HBars data={m.payMethods} />
          ) : (
            <Empty title="Sem entradas" detail="Nada recebido no período." />
          )}
        </Plate>
      </div>

      <div className="finance-columns">
        <Plate className="bills-panel">
          <div className="panel-head">
            <div>
              <h2>Contas a pagar e receber</h2>
              <p className="subtle">Agende boletos, aluguel, repasses e recebimentos futuros</p>
            </div>
            <button className="button ghost small" onClick={() => setBill(null)}>
              <Plus size={14} /> Agendar
            </button>
          </div>
          <Segmented
            label="Situação das contas"
            value={billTab}
            onChange={setBillTab}
            options={[
              { value: 'overdue', label: 'Vencidas', count: m.buckets.overdue.length },
              { value: 'today', label: 'Hoje', count: m.buckets.today.length },
              { value: 'week', label: '7 dias', count: m.buckets.week.length },
              { value: 'later', label: 'Depois', count: m.buckets.later.length },
              { value: 'paid', label: 'Quitadas' },
            ]}
          />
          <div className="list bill-list">
            {billRows.length ? (
              billRows.map((b) => (
                <div className={`bill-row ${b.direction}`} key={b.id}>
                  <span className="bill-date">
                    <b>{b.due_date.slice(8, 10)}</b>
                    <small>
                      {new Date(b.due_date + 'T12:00:00')
                        .toLocaleDateString('pt-BR', { month: 'short' })
                        .replace('.', '')}
                    </small>
                  </span>
                  <span className="grow">
                    <strong>{b.description}</strong>
                    <small>
                      {labels[b.direction]} · {b.category}
                      {b.status === 'aberta' && b.due_date < today() && (
                        <span className="negative"> · vencida</span>
                      )}
                    </small>
                  </span>
                  <b className={b.direction === 'pagar' ? 'negative' : 'positive'}>
                    {b.direction === 'pagar' ? '−' : '+'} {money(b.amount)}
                  </b>
                  {b.status === 'aberta' ? (
                    <span className="bill-actions">
                      <button className="button primary small" onClick={() => setPay(b)}>
                        <CheckCircle2 size={14} /> {b.direction === 'pagar' ? 'Pagar' : 'Receber'}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Editar ${b.description}`}
                        onClick={() => setBill(b)}
                      >
                        <CalendarClock size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Cancelar ${b.description}`}
                        onClick={() => setCancelBill(b)}
                      >
                        <X size={15} />
                      </button>
                    </span>
                  ) : (
                    <Badge value={b.status} />
                  )}
                </div>
              ))
            ) : (
              <Empty
                title="Nada aqui"
                detail="Nenhuma conta nesta situação."
                icon={<CalendarClock size={28} />}
              />
            )}
          </div>
        </Plate>

        <Plate className="statement">
          <div className="panel-head">
            <div>
              <h2>Extrato</h2>
              <p className="subtle">{statement.length} movimento(s) no período</p>
            </div>
          </div>
          <div className="toolbar">
            <Segmented
              label="Tipo de movimento"
              value={flow}
              onChange={setFlow}
              options={[
                { value: 'all', label: 'Tudo' },
                { value: 'in', label: 'Entradas' },
                { value: 'out', label: 'Saídas' },
              ]}
            />
            <SearchBox value={q} onChange={setQ} placeholder="Buscar descrição ou categoria..." />
          </div>
          {days.length ? (
            <div className="timeline-days">
              {days.slice(0, shown).map((d) => {
                const rows = statement.filter((c) => c.date === d);
                const net = sum(rows, (c) => c.amount);
                return (
                  <section key={d} className="day">
                    <header>
                      <span>{dateLabel(d)}</span>
                      <b className={net >= 0 ? 'positive' : 'negative'}>
                        {net >= 0 ? '+' : ''}
                        {money(net)}
                      </b>
                    </header>
                    {rows.map((c) => (
                      <div className={`entry src-${c.source}`} key={c.id}>
                        <span className={`list-icon ${c.amount > 0 ? 'income' : 'expense'}`}>
                          {c.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </span>
                        <span className="grow">
                          <strong>{c.description}</strong>
                          <small>
                            {c.category} · {c.payment} · {labels[c.source] || c.source}
                            {reversed.has(c.id) && <span className="negative"> · estornado</span>}
                          </small>
                        </span>
                        <b className={c.amount > 0 ? 'positive' : 'negative'}>{money(c.amount)}</b>
                        {['manual', 'conta'].includes(c.source) && !reversed.has(c.id) ? (
                          <button
                            className="icon-button"
                            title="Estornar"
                            aria-label={`Estornar ${c.description}`}
                            onClick={() => setReverse(c)}
                          >
                            <RotateCcw size={15} />
                          </button>
                        ) : (
                          <span className="icon-spacer" />
                        )}
                      </div>
                    ))}
                  </section>
                );
              })}
              {days.length > shown && (
                <button className="button ghost full" onClick={() => setShown(shown + 10)}>
                  Carregar mais dias ({days.length - shown})
                </button>
              )}
            </div>
          ) : (
            <Empty
              title="Sem movimentos"
              detail="Nada encontrado no período e filtros escolhidos."
            />
          )}
        </Plate>
      </div>

      {create && (
        <Modal
          title={create === 'entrada' ? 'Nova entrada' : 'Nova saída'}
          description="Lançamento manual. Vendas, OS entregues, sucatas e contas pagas entram automaticamente."
          close={() => setCreate(null)}
          onSubmit={async (e) => {
            const f = new FormData(e.currentTarget);
            const p = {
              direction: create,
              amount: amountValue(f, 'amount'),
              description: textValue(f, 'description'),
              date: textValue(f, 'date'),
              payment: textValue(f, 'payment'),
              category: textValue(f, 'category'),
            };
            await execute('cash.create', p, request(p));
          }}
        >
          <div className="form-grid">
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                max="100000000"
                step="0.01"
                autoFocus
              />
            </Field>
            <Field label="Descrição">
              <input name="description" required maxLength={200} />
            </Field>
            <Field label="Categoria">
              <select
                name="category"
                defaultValue={create === 'entrada' ? 'Aporte' : 'Fornecedores'}
              >
                {cashCategories.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input name="date" type="date" required defaultValue={today()} />
            </Field>
            <Field label="Pagamento">
              <select name="payment">
                {payments.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
      {bill !== undefined && (
        <Modal
          title={bill ? 'Editar conta' : 'Agendar conta'}
          description="Contas agendadas não mexem no caixa até serem baixadas. Elas alimentam a previsão."
          close={() => setBill(undefined)}
          onSubmit={async (e) => {
            const f = new FormData(e.currentTarget);
            const p = {
              ...(bill ? { id: bill.id } : {}),
              direction: textValue(f, 'direction'),
              description: textValue(f, 'description'),
              amount: amountValue(f, 'amount'),
              due_date: textValue(f, 'due_date'),
              category: textValue(f, 'category'),
              contact_id: textValue(f, 'contact_id') || null,
              notes: textValue(f, 'notes'),
            };
            await execute('bill.save', p, request(p));
          }}
        >
          <div className="form-grid">
            <Field label="Tipo">
              <select name="direction" defaultValue={bill?.direction || 'pagar'}>
                <option value="pagar">A pagar</option>
                <option value="receber">A receber</option>
              </select>
            </Field>
            <Field label="Descrição">
              <input
                name="description"
                required
                maxLength={200}
                defaultValue={bill?.description}
                placeholder="Boleto fornecedor, aluguel..."
              />
            </Field>
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                defaultValue={bill ? bill.amount / 100 : ''}
              />
            </Field>
            <Field label="Vencimento">
              <input
                name="due_date"
                type="date"
                required
                defaultValue={bill?.due_date || today()}
              />
            </Field>
            <Field label="Categoria">
              <select name="category" defaultValue={bill?.category || 'Fornecedores'}>
                {[...cashCategories, 'Vendas', 'Oficina'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Contato">
              <select name="contact_id" defaultValue={bill?.contact_id || ''}>
                <option value="">Nenhum</option>
                {state.contacts
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Observações" wide>
              <input name="notes" maxLength={1000} defaultValue={bill?.notes} />
            </Field>
          </div>
        </Modal>
      )}
      {pay && (
        <Modal
          title={pay.direction === 'pagar' ? 'Pagar conta' : 'Receber conta'}
          description={`${pay.description} · ${money(pay.amount)} · vencimento ${dateLabel(pay.due_date)}`}
          close={() => setPay(undefined)}
          submit={pay.direction === 'pagar' ? 'Confirmar pagamento' : 'Confirmar recebimento'}
          onSubmit={async (e) => {
            const f = new FormData(e.currentTarget);
            const p = { id: pay.id, date: textValue(f, 'date'), payment: textValue(f, 'payment') };
            await execute('bill.pay', p, request(p));
          }}
        >
          <div className="form-grid">
            <Field label="Data do pagamento">
              <input name="date" type="date" required defaultValue={today()} />
            </Field>
            <Field label="Forma">
              <select name="payment">
                {payments.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="hint">
            Gera o lançamento no caixa. Se precisar desfazer, estorne o lançamento no extrato e a
            conta volta a ficar em aberto.
          </p>
        </Modal>
      )}
      {cancelBill && (
        <Confirm
          title="Cancelar conta agendada?"
          detail="Ela deixa de contar na previsão. Nada é lançado no caixa."
          close={() => setCancelBill(undefined)}
          run={() => execute('bill.cancel', { id: cancelBill.id })}
        />
      )}
      {reverse && (
        <Confirm
          title="Estornar lançamento?"
          detail={`Será criado um movimento inverso de ${money(-reverse.amount)}. O original continua no histórico.${reverse.source === 'conta' ? ' A conta vinculada volta a ficar em aberto.' : ''}`}
          close={() => setReverse(undefined)}
          run={() => {
            const p = { id: reverse.id };
            return execute('cash.reverse', p, request(p));
          }}
        />
      )}
    </>
  );
}
