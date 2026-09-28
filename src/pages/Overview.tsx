import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Plus,
  ShoppingBag,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { compactMoney, dateLabel, labels, money, osNumber, today, type Page } from '../lib/types';
import {
  balanceUntil,
  billBuckets,
  cashTotals,
  channelStats,
  flowSeries,
  previousRange,
  rangeFor,
  stockValue,
} from '../lib/metrics';
import { Badge, ChannelLogo, Count, Delta, Empty, Heading, Plate } from '../components/ui';
import { FlowChart, Gauge, Sparkline } from '../components/charts';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
export function Overview({
  navigate,
  create,
}: {
  navigate: (p: Page, target?: string) => void;
  create: (p: Page) => void;
}) {
  const { state } = useStore();
  const month = rangeFor('month');
  const t = today();
  const m = useMemo(() => {
    const now = cashTotals(state.cash, month);
    const before = cashTotals(state.cash, previousRange(month));
    const daily = flowSeries(state.cash, rangeFor('30d'));
    const stock = stockValue(state);
    const open = state.orders.filter(
      (o) => o.kind === 'oficina' && !['cancelada', 'entregue'].includes(o.status),
    );
    return {
      now,
      before,
      daily,
      stock,
      open,
      late: open.filter((o) => o.due_date && o.due_date < t),
      ready: open.filter((o) => o.status === 'finalizada'),
      balance: balanceUntil(state.cash, '9999-12-31'),
      channels: channelStats(state.orders, month),
      bills: billBuckets(state.bills),
    };
  }, [state]);
  const first = state.settings.responsible.split(' ')[0];
  return (
    <>
      <Heading
        eyebrow="PAINEL DA OPERAÇÃO"
        title={`${greeting()}${first ? `, ${first}` : ''}.`}
        description="O pulso da loja e da oficina, atualizado a cada operação."
      >
        <button className="button ghost" onClick={() => create('workshop')}>
          <Wrench size={17} /> Nova OS
        </button>
        <button className="button primary" onClick={() => create('sales')}>
          <Plus size={17} /> Nova venda
        </button>
      </Heading>

      <section className="kpi-grid">
        <Plate tilt className="kpi featured" as="article">
          <button
            className="kpi-hit"
            onClick={() => navigate('cash')}
            aria-label="Ver financeiro"
          />
          <span className="kpi-label">
            <ShoppingBag size={17} /> Receita do mês
          </span>
          <strong className="kpi-value">
            <Count value={m.now.revenue} format={money} />
          </strong>
          <span className="kpi-note">
            <Delta current={m.now.revenue} previous={m.before.revenue} /> vs. mês anterior
          </span>
          <Sparkline values={m.daily.map((d) => d.income)} />
        </Plate>
        <Plate tilt className="kpi" as="article">
          <button className="kpi-hit" onClick={() => navigate('cash')} aria-label="Ver caixa" />
          <span className="kpi-label">
            <Wallet size={17} /> Saldo em caixa
          </span>
          <strong className={`kpi-value ${m.balance < 0 ? 'negative' : ''}`}>
            <Count value={m.balance} format={money} />
          </strong>
          <span className="kpi-note">
            {m.bills.overdue.length ? (
              <span className="negative">{m.bills.overdue.length} conta(s) vencida(s)</span>
            ) : (
              'Nenhuma conta vencida'
            )}
          </span>
          <Sparkline values={m.daily.map((d) => d.balance)} className="green" />
        </Plate>
        <Plate tilt className="kpi" as="article">
          <button
            className="kpi-hit"
            onClick={() => navigate('workshop')}
            aria-label="Ver oficina"
          />
          <span className="kpi-label">
            <Wrench size={17} /> OS em andamento
          </span>
          <strong className="kpi-value">
            <Count value={m.open.length} format={(n) => String(n).padStart(2, '0')} />
          </strong>
          <span className="kpi-note">
            {m.late.length ? (
              <span className="negative">{m.late.length} atrasada(s)</span>
            ) : (
              'Nenhuma atrasada'
            )}
            {' · '}
            {m.ready.length} pronta(s)
          </span>
        </Plate>
        <Plate tilt className="kpi" as="article">
          <button className="kpi-hit" onClick={() => navigate('parts')} aria-label="Ver estoque" />
          <span className="kpi-label">
            <Boxes size={17} /> Estoque (preço de venda)
          </span>
          <strong className="kpi-value">
            <Count value={m.stock.price} format={compactMoney} />
          </strong>
          <span className="kpi-note">
            {m.stock.units} un. · custo {compactMoney(m.stock.cost)} ·{' '}
            <span className={m.stock.low.length ? 'negative' : ''}>
              {m.stock.low.length} no mínimo
            </span>
          </span>
        </Plate>
      </section>

      <div className="overview-grid">
        <Plate className="span-2">
          <div className="panel-head">
            <div>
              <h2>Fluxo dos últimos 30 dias</h2>
              <p className="subtle">Entradas, saídas e o saldo acumulado dia a dia</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ ['--c' as string]: 'var(--green)' }} />
                Entradas
              </span>
              <span>
                <i style={{ ['--c' as string]: 'var(--red)' }} />
                Saídas
              </span>
              <span>
                <i className="line" style={{ ['--c' as string]: 'var(--amber)' }} />
                Saldo
              </span>
            </div>
          </div>
          <FlowChart data={m.daily} height={240} />
        </Plate>
        <Plate className="goal-card">
          <div className="panel-head">
            <div>
              <h2>Meta do mês</h2>
              <p className="subtle">Receita de vendas e oficina</p>
            </div>
          </div>
          <Gauge value={m.now.revenue} goal={state.settings.monthly_goal} />
          {state.settings.monthly_goal > 0 && (
            <p className="goal-foot">
              {m.now.revenue >= state.settings.monthly_goal
                ? 'Meta batida. Bora pra próxima!'
                : `Faltam ${money(state.settings.monthly_goal - m.now.revenue)}`}
            </p>
          )}
        </Plate>

        <Plate className="span-3 channel-strip">
          <div className="panel-head">
            <div>
              <h2>Vendas por canal · este mês</h2>
              <p className="subtle">
                {m.channels.count} vendas · {money(m.channels.total)} bruto
              </p>
            </div>
            <button className="text-button" onClick={() => navigate('sales')}>
              Abrir vendas <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="channel-mini">
            {m.channels.list.map((c) => (
              <div key={c.channel} className={`channel-mini-item channel-${c.channel}`}>
                <ChannelLogo channel={c.channel} size={40} />
                <div className="grow">
                  <strong>{labels[c.channel]}</strong>
                  <small>
                    {c.count} vendas · líquido {money(c.net)}
                  </small>
                  <span className="share">
                    <i
                      style={{
                        width: `${m.channels.total ? (c.gross / m.channels.total) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </div>
                <b>{m.channels.total ? Math.round((c.gross / m.channels.total) * 100) : 0}%</b>
              </div>
            ))}
          </div>
        </Plate>

        <Plate>
          <div className="panel-head">
            <div>
              <h2>Oficina</h2>
              <p className="subtle">Próximas entregas</p>
            </div>
            <button className="text-button" onClick={() => navigate('workshop')}>
              Quadro <ArrowUpRight size={15} />
            </button>
          </div>
          {m.open.length ? (
            <div className="list">
              {[...m.open]
                .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
                .slice(0, 5)
                .map((o) => (
                  <button
                    className="list-row"
                    key={o.id}
                    onClick={() => navigate('workshop', o.id)}
                  >
                    <span className="list-icon">
                      <Wrench size={17} />
                    </span>
                    <span className="grow">
                      <strong>
                        {osNumber(o)} · {o.vehicle || o.customer}
                      </strong>
                      <small className={o.due_date && o.due_date < t ? 'negative' : ''}>
                        {o.plate && <span className="plate-tag">{o.plate}</span>}{' '}
                        {o.due_date ? `entrega ${dateLabel(o.due_date)}` : 'sem prazo'}
                      </small>
                    </span>
                    <Badge value={o.status} />
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              title="Oficina em dia"
              detail="Nenhuma OS em andamento."
              icon={<Wrench size={28} />}
            />
          )}
        </Plate>
        <Plate>
          <div className="panel-head">
            <div>
              <h2>Estoque crítico</h2>
              <p className="subtle">No mínimo ou abaixo</p>
            </div>
            <button className="text-button" onClick={() => navigate('parts')}>
              Armazém <ArrowUpRight size={15} />
            </button>
          </div>
          {m.stock.low.length ? (
            <div className="list">
              {m.stock.low.slice(0, 5).map((p) => (
                <button className="list-row" key={p.id} onClick={() => navigate('parts', p.id)}>
                  <span className="list-icon warn">
                    <AlertTriangle size={17} />
                  </span>
                  <span className="grow">
                    <strong>{p.name}</strong>
                    <small>
                      {p.code} · caixa {state.boxes.find((b) => b.id === p.box_id)?.code || '—'}
                    </small>
                  </span>
                  <b className={p.quantity ? 'warn-text' : 'negative'}>{p.quantity} un.</b>
                </button>
              ))}
            </div>
          ) : (
            <Empty title="Tudo abastecido" detail="Nenhuma peça abaixo do mínimo." />
          )}
        </Plate>
        <Plate>
          <div className="panel-head">
            <div>
              <h2>Contas</h2>
              <p className="subtle">Vencidas e próximos 7 dias</p>
            </div>
            <button className="text-button" onClick={() => navigate('cash')}>
              Financeiro <ArrowUpRight size={15} />
            </button>
          </div>
          {[...m.bills.overdue, ...m.bills.today, ...m.bills.week].length ? (
            <div className="list">
              {[...m.bills.overdue, ...m.bills.today, ...m.bills.week].slice(0, 5).map((b) => (
                <div className="list-row" key={b.id}>
                  <span className={`list-icon ${b.direction === 'pagar' ? 'expense' : 'income'}`}>
                    {b.direction === 'pagar' ? (
                      <ArrowUpRight size={17} />
                    ) : (
                      <ArrowDownLeft size={17} />
                    )}
                  </span>
                  <span className="grow">
                    <strong>{b.description}</strong>
                    <small className={b.due_date < t ? 'negative' : ''}>
                      <CalendarClock size={12} /> {b.due_date < t ? 'venceu' : 'vence'}{' '}
                      {dateLabel(b.due_date)}
                    </small>
                  </span>
                  <b className={b.direction === 'pagar' ? 'negative' : 'positive'}>
                    {money(b.amount)}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Sem pendências" detail="Nenhuma conta vencendo nesta semana." />
          )}
        </Plate>
      </div>
    </>
  );
}
