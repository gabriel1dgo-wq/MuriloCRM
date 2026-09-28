import {
  addDays,
  shortDate,
  today,
  type Bill,
  type Cash,
  type Channel,
  type Order,
  type State,
} from './types';

export type Range = { from: string; to: string };
export type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'last_month' | 'year' | 'custom';
export const periodLabels: Record<PeriodKey, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  month: 'Este mês',
  last_month: 'Mês passado',
  year: 'Este ano',
  custom: 'Personalizado',
};
export function rangeFor(key: PeriodKey, custom?: Range): Range {
  const t = today();
  if (key === 'today') return { from: t, to: t };
  if (key === '7d') return { from: addDays(t, -6), to: t };
  if (key === '30d') return { from: addDays(t, -29), to: t };
  if (key === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (key === 'last_month') {
    const end = addDays(t.slice(0, 8) + '01', -1);
    return { from: end.slice(0, 8) + '01', to: end };
  }
  if (key === 'year') return { from: t.slice(0, 5) + '01-01', to: t };
  return custom || { from: t.slice(0, 8) + '01', to: t };
}
/** Período anterior de mesma duração, para comparações. */
export function previousRange(r: Range): Range {
  const days = Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400000) + 1;
  return { from: addDays(r.from, -days), to: addDays(r.from, -1) };
}
export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;
export const sum = <T>(rows: T[], fn: (r: T) => number) => rows.reduce((n, r) => n + fn(r), 0);

/** Receita operacional líquida (vendas + oficina, já descontados estornos). */
export const isRevenue = (c: Cash) => c.category === 'Vendas' || c.category === 'Oficina';
export function cashTotals(cash: Cash[], r: Range) {
  const rows = cash.filter((c) => inRange(c.date, r));
  return {
    income: sum(
      rows.filter((c) => c.amount > 0),
      (c) => c.amount,
    ),
    expense: -sum(
      rows.filter((c) => c.amount < 0),
      (c) => c.amount,
    ),
    revenue: sum(rows.filter(isRevenue), (c) => c.amount),
    fees: -sum(
      rows.filter((c) => c.category === 'Taxas marketplace'),
      (c) => c.amount,
    ),
    net: sum(rows, (c) => c.amount),
    rows,
  };
}
export const balanceUntil = (cash: Cash[], date: string) =>
  sum(
    cash.filter((c) => c.date <= date),
    (c) => c.amount,
  );

export function daysBetween(r: Range) {
  const out: string[] = [];
  for (let d = r.from; d <= r.to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}
/** Série diária (ou mensal para períodos longos) de entradas, saídas e saldo, com projeção opcional. */
export function flowSeries(cash: Cash[], r: Range, bills: Bill[] = [], projectDays = 0) {
  const days = daysBetween(r);
  const monthly = days.length > 92;
  const buckets = new Map<
    string,
    { label: string; income: number; expense: number; last: string }
  >();
  for (const d of days) {
    const key = monthly ? d.slice(0, 7) : d;
    if (!buckets.has(key))
      buckets.set(key, {
        label: monthly
          ? new Date(d + 'T12:00:00')
              .toLocaleDateString('pt-BR', { month: 'short' })
              .replace('.', '')
          : shortDate(d),
        income: 0,
        expense: 0,
        last: d,
      });
    buckets.get(key)!.last = d;
  }
  for (const c of cash) {
    if (!inRange(c.date, r)) continue;
    const b = buckets.get(monthly ? c.date.slice(0, 7) : c.date);
    if (!b) continue;
    if (c.amount > 0) b.income += c.amount;
    else b.expense -= c.amount;
  }
  let running = balanceUntil(cash, addDays(r.from, -1));
  const points = [...buckets.entries()].map(([key, b]) => {
    running += b.income - b.expense;
    return {
      key,
      label: b.label,
      income: b.income,
      expense: b.expense,
      balance: running,
      projected: false,
    };
  });
  if (projectDays > 0) {
    const open = bills.filter((b) => b.status === 'aberta');
    for (let i = 1; i <= projectDays; i++) {
      const d = addDays(r.to, i);
      const due = open.filter((b) => (i === 1 ? b.due_date <= d : b.due_date === d));
      const income = sum(
        due.filter((b) => b.direction === 'receber'),
        (b) => b.amount,
      );
      const expense = sum(
        due.filter((b) => b.direction === 'pagar'),
        (b) => b.amount,
      );
      running += income - expense;
      points.push({
        key: d,
        label: shortDate(d),
        income,
        expense,
        balance: running,
        projected: true,
      });
    }
  }
  return points;
}

export function channelStats(orders: Order[], r: Range) {
  const sales = orders.filter(
    (o) => o.kind === 'venda' && o.status !== 'cancelada' && inRange(o.created_at.slice(0, 10), r),
  );
  const by = (ch: Channel) => {
    const rows = sales.filter((o) => o.channel === ch);
    const gross = sum(rows, (o) => o.total);
    const fees = sum(rows, (o) => o.fee);
    return {
      channel: ch,
      count: rows.length,
      gross,
      fees,
      net: gross - fees,
      ticket: rows.length ? Math.round(gross / rows.length) : 0,
    };
  };
  const list = (['balcao', 'mercado_livre', 'shopee'] as Channel[]).map(by);
  return { list, total: sum(list, (c) => c.gross), count: sales.length };
}

export function stockValue(state: State) {
  const active = state.parts.filter((p) => !p.archived);
  return {
    units: sum(active, (p) => p.quantity),
    cost: sum(active, (p) => p.cost * p.quantity),
    price: sum(active, (p) => p.price * p.quantity),
    low: active.filter((p) => p.quantity <= p.minimum),
    active,
  };
}
export function billBuckets(bills: Bill[]) {
  const t = today();
  const open = bills.filter((b) => b.status === 'aberta');
  return {
    open,
    overdue: open.filter((b) => b.due_date < t),
    today: open.filter((b) => b.due_date === t),
    week: open.filter((b) => b.due_date > t && b.due_date <= addDays(t, 7)),
    later: open.filter((b) => b.due_date > addDays(t, 7)),
  };
}
