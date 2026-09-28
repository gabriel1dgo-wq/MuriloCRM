export type Page =
  'overview' | 'parts' | 'scraps' | 'sales' | 'workshop' | 'cash' | 'contacts' | 'settings';
export type Row = { id: string; owner_id?: string; created_at: string };
export type Contact = Row & {
  name: string;
  kind: 'cliente' | 'fornecedor' | 'ambos';
  phone: string;
  email: string;
  document: string;
  notes: string;
  archived: boolean;
};
export type LocationKind = 'prateleira' | 'gaveteiro' | 'pallet' | 'area';
export type Tone = 'amber' | 'orange' | 'blue' | 'green' | 'red' | 'steel';
export type StockLocation = Row & {
  code: string;
  name: string;
  kind: LocationKind;
  levels: number;
  color: Tone;
  archived: boolean;
};
export type Box = Row & {
  code: string;
  label: string;
  location_id: string;
  level: number;
  archived: boolean;
};
export type Scrap = Row & {
  code: string;
  vehicle: string;
  plate: string;
  year: number;
  cost: number;
  date: string;
  status: 'aguardando' | 'desmontando' | 'finalizada';
  notes: string;
  brand: string;
  model: string;
  color: string;
  fuel: string;
  km: number | null;
  chassis: string;
  renavam: string;
  engine: string;
  origin: 'leilao' | 'particular' | 'seguradora' | 'troca' | 'outro';
  lot: string;
  supplier_id: string | null;
  detran: 'pendente' | 'em_andamento' | 'baixado';
  photos: string[];
};
export type Part = Row & {
  code: string;
  name: string;
  category: string;
  scrap_id: string | null;
  box_id: string | null;
  quantity: number;
  minimum: number;
  cost: number;
  price: number;
  location: string;
  condition: string;
  oem: string;
  fits: string;
  photos: string[];
  archived: boolean;
};
export type Item = {
  scrap_id?: string | null;
  part_id: string;
  name: string;
  quantity: number;
  price: number;
};
export type Service = { description: string; detail: string; price: number };
export type ExternalPart = {
  name: string;
  quantity: number;
  origin: 'cliente' | 'comprada';
  price: number;
  note: string;
};
export type CheckState = 'ok' | 'avaria' | 'ausente';
export type CheckItem = { label: string; state: CheckState };
export type Channel = 'balcao' | 'mercado_livre' | 'shopee';
export type Order = Row & {
  kind: 'venda' | 'oficina';
  number: number;
  contact_id: string | null;
  customer: string;
  channel: Channel;
  payment: string;
  vehicle: string;
  plate: string;
  description: string;
  technician: string;
  due_date: string | null;
  status: string;
  labor: number;
  discount: number;
  total: number;
  fee: number;
  external_ref: string;
  km: number | null;
  fuel_level: string;
  complaint: string;
  diagnosis: string;
  services: Service[];
  external_parts: ExternalPart[];
  checklist: CheckItem[];
  recommendations: string;
  warranty_days: number;
  has_signature: boolean;
  signature?: string;
  signed_name: string;
  signed_at: string | null;
  items: Item[];
};
export type Cash = Row & {
  description: string;
  amount: number;
  date: string;
  category: string;
  payment: string;
  source: string;
  reference_id: string | null;
  reversal_of: string | null;
};
export type Bill = Row & {
  description: string;
  direction: 'pagar' | 'receber';
  amount: number;
  due_date: string;
  category: string;
  contact_id: string | null;
  status: 'aberta' | 'paga' | 'cancelada';
  cash_id: string | null;
  notes: string;
};
export type StockMove = Row & {
  part_id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
};
export type Settings = {
  name: string;
  responsible: string;
  phone: string;
  email: string;
  document: string;
  address: string;
  monthly_goal: number;
  warranty_text: string;
};
export type State = {
  contacts: Contact[];
  locations: StockLocation[];
  boxes: Box[];
  scraps: Scrap[];
  parts: Part[];
  orders: Order[];
  cash: Cash[];
  bills: Bill[];
  moves: StockMove[];
  settings: Settings;
};
export type Command = { request_id: string; action: string; payload: Record<string, unknown> };
export const defaultSettings = (): Settings => ({
  name: 'Minha operação',
  responsible: '',
  phone: '',
  email: '',
  document: '',
  address: '',
  monthly_goal: 0,
  warranty_text: '',
});
export const emptyState = (): State => ({
  contacts: [],
  locations: [],
  boxes: [],
  scraps: [],
  parts: [],
  orders: [],
  cash: [],
  bills: [],
  moves: [],
  settings: defaultSettings(),
});
/** Completa campos ausentes (snapshots antigos, demonstrações salvas na versão anterior). */
export function normalizeState(input: Partial<State> | null | undefined): State {
  const base = emptyState();
  if (!input) return base;
  return {
    ...base,
    ...input,
    settings: { ...base.settings, ...(input.settings || {}) },
    scraps: ((input.scraps || []) as Partial<Scrap>[]).map((s) => ({
      brand: '',
      model: '',
      color: '',
      fuel: '',
      km: null,
      chassis: '',
      renavam: '',
      engine: '',
      origin: 'particular',
      lot: '',
      supplier_id: null,
      detran: 'pendente',
      ...s,
      photos: s.photos || [],
    })) as Scrap[],
    parts: ((input.parts || []) as Partial<Part>[]).map((p) => ({
      box_id: null,
      oem: '',
      fits: '',
      ...p,
      photos: p.photos || [],
    })) as Part[],
    orders: ((input.orders || []) as Partial<Order>[]).map((o, _i, all) => ({
      fee: 0,
      external_ref: '',
      km: null,
      fuel_level: '',
      complaint: '',
      diagnosis: '',
      recommendations: '',
      warranty_days: 90,
      signed_name: '',
      signed_at: null,
      ...o,
      number:
        o.number ??
        all.filter((x) => x.kind === o.kind && (x.created_at || '') <= (o.created_at || '')).length,
      services: o.services || [],
      external_parts: o.external_parts || [],
      checklist: o.checklist || [],
      has_signature: o.has_signature ?? Boolean(o.signature),
    })) as Order[],
    locations: input.locations || [],
    boxes: input.boxes || [],
    bills: input.bills || [],
  };
}
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const compactMoney = (cents: number) =>
  Math.abs(cents) >= 100000_00
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(cents / 100)
    : money(cents);
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
export const dateLabel = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
export const shortDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00`)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
export const osNumber = (o: Pick<Order, 'number' | 'kind'>) =>
  `${o.kind === 'venda' ? 'VD' : 'OS'}-${String(o.number || 0).padStart(4, '0')}`;
export const labels: Record<string, string> = {
  aberta: 'Aberta',
  analise: 'Em análise',
  aguardando_peca: 'Aguardando peça',
  execucao: 'Em execução',
  finalizada: 'Pronta p/ entrega',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
  confirmada: 'Confirmada',
  aguardando: 'Aguardando',
  desmontando: 'Desmontando',
  balcao: 'Balcão',
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  ambos: 'Cliente e fornecedor',
  leilao: 'Leilão',
  particular: 'Particular',
  seguradora: 'Seguradora',
  troca: 'Troca',
  outro: 'Outro',
  pendente: 'Baixa pendente',
  em_andamento: 'Baixa em andamento',
  baixado: 'Baixa concluída',
  prateleira: 'Prateleira',
  gaveteiro: 'Gaveteiro',
  pallet: 'Pallet',
  area: 'Área',
  pagar: 'A pagar',
  receber: 'A receber',
  paga: 'Quitada',
  comprada: 'Comprada p/ serviço',
  manual: 'Manual',
  venda: 'Venda',
  oficina: 'Oficina',
  sucata: 'Sucata',
  estorno: 'Estorno',
  conta: 'Conta',
};
export const workflow = [
  'aberta',
  'analise',
  'aguardando_peca',
  'execucao',
  'finalizada',
  'entregue',
] as const;
export const channels: Channel[] = ['balcao', 'mercado_livre', 'shopee'];
export const payments = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência'];
export const partCategories = [
  'Motor',
  'Elétrica',
  'Transmissão',
  'Iluminação',
  'Carroceria',
  'Suspensão',
  'Freios',
  'Arrefecimento',
  'Interior',
  'Outros',
];
export const cashCategories = [
  'Outros',
  'Aporte',
  'Fornecedores',
  'Peças',
  'Aluguel',
  'Salários',
  'Impostos',
  'Energia e água',
  'Frete',
  'Ferramentas',
  'Marketing',
];
export const defaultChecklist = [
  'Estepe',
  'Macaco e chave de roda',
  'Triângulo',
  'Documento do veículo',
  'Rádio / multimídia',
  'Tapetes',
  'Pintura sem avarias',
  'Vidros e retrovisores',
  'Luzes do painel',
  'Pneus',
];
export const toCents = (value: string | number) => Math.round(Number(value) * 100);
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const csv =
    '﻿' +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(';'),
      )
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
export const includes = (q: string, ...values: unknown[]) => {
  const n = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return n(values.join(' ')).includes(n(q.trim()));
};
/** Receita recuperada estimada de uma sucata: itens vendidos/entregues com desconto rateado. */
export function scrapRecovery(orders: Order[], scrapId: string) {
  return orders
    .filter((o) => o.status !== 'cancelada' && (o.kind === 'venda' || o.status === 'entregue'))
    .reduce((n, o) => {
      const subtotal =
        o.items.reduce((a, i) => a + i.price * i.quantity, 0) +
        o.labor +
        o.external_parts.reduce((a, e) => a + e.price * e.quantity, 0);
      return (
        n +
        o.items
          .filter((i) => i.scrap_id === scrapId)
          .reduce(
            (a, i) => a + Math.round(i.price * i.quantity * (subtotal ? o.total / subtotal : 0)),
            0,
          )
      );
    }, 0);
}
