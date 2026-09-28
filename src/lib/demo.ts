// Motor da demonstração: espelha as regras de zenith_private.command (SQL).
// Qualquer mudança de regra deve ser feita nos dois lugares.
import {
  emptyState,
  today,
  addDays,
  normalizeState,
  type State,
  type Command,
  type Part,
  type Order,
  type Item,
  type Service,
  type ExternalPart,
  type Bill,
} from './types';
import { demoPhoto } from './demoArt';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const number = (value: unknown, min = 0, max = 10000000000) => {
  const n = Number(value);
  assert(Number.isSafeInteger(n) && n >= min && n <= max, 'Valor numérico inválido.');
  return n;
};
const text = (v: unknown) => String(v ?? '').trim();
const channelName = (c: string) =>
  c === 'mercado_livre' ? 'Mercado Livre' : c === 'shopee' ? 'Shopee' : 'de venda';

/** `date` permite montar históricos na demonstração; o padrão é a data de hoje. */
export function demoCommand(original: State, command: Command, date = today()): State {
  const s = normalizeState(structuredClone(original));
  const p = command.payload as Record<string, any>;
  const action = command.action;
  const stamp = date === today() ? new Date().toISOString() : `${date}T${randomTime()}`;
  const row = () => ({ id: crypto.randomUUID(), created_at: stamp });
  const cash = (
    amount: number,
    description: string,
    source: string,
    reference_id: string | null,
    category: string,
    payment = 'Pix',
    on = date,
    reversal_of: string | null = null,
  ) => {
    const entry = {
      ...row(),
      amount,
      description,
      source,
      reference_id,
      date: on,
      payment,
      category,
      reversal_of,
    };
    s.cash.unshift(entry);
    return entry;
  };
  const move = (part: Part, delta: number, reason: string, ref: string | null) => {
    assert(part.quantity + delta >= 0, `Estoque insuficiente: ${part.name}.`);
    part.quantity += delta;
    s.moves.unshift({ ...row(), part_id: part.id, delta, reason, reference_id: ref });
  };
  const photos = (v: unknown, max: number) => {
    const list = (v as string[] | undefined) || [];
    assert(
      Array.isArray(list) && list.length <= max && list.every((x) => typeof x === 'string'),
      'Fotos inválidas.',
    );
    return list;
  };

  if (action === 'contact.save') {
    assert(text(p.name), 'Informe o nome.');
    const old = s.contacts.find((x) => x.id === p.id);
    assert(!p.id || old, 'Cadastro não encontrado.');
    const value = {
      ...row(),
      ...old,
      name: text(p.name),
      kind: p.kind,
      phone: p.phone || '',
      email: p.email || '',
      document: p.document || '',
      notes: p.notes || '',
      archived: p.archived ?? false,
    };
    s.contacts = [value, ...s.contacts.filter((x) => x.id !== value.id)];
  } else if (action === 'location.save') {
    const old = s.locations.find((x) => x.id === p.id);
    assert(!p.id || old, 'Local não encontrado.');
    const code = text(p.code).toUpperCase();
    assert(code && text(p.name), 'Informe código e nome.');
    assert(
      !s.locations.some((x) => x.code === code && x.id !== p.id),
      'Código de local já existe.',
    );
    const levels = number(p.levels, 1, 12);
    const boxes = s.boxes.filter((b) => b.location_id === p.id && !b.archived);
    assert(
      !(p.archived && boxes.length),
      'Mova ou arquive as caixas deste local antes de arquivá-lo.',
    );
    assert(!boxes.some((b) => b.level > levels), 'Existem caixas em níveis acima do novo limite.');
    const value = {
      ...row(),
      ...old,
      code,
      name: text(p.name),
      kind: p.kind || 'prateleira',
      levels,
      color: p.color || 'amber',
      archived: p.archived ?? false,
    };
    s.locations = [...s.locations.filter((x) => x.id !== value.id), value].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  } else if (action === 'box.save') {
    const old = s.boxes.find((x) => x.id === p.id);
    assert(!p.id || old, 'Caixa não encontrada.');
    const code = text(p.code).toUpperCase();
    assert(code, 'Informe o código da caixa.');
    assert(!s.boxes.some((x) => x.code === code && x.id !== p.id), 'Código de caixa já existe.');
    const loc = s.locations.find((l) => l.id === p.location_id && !l.archived);
    const level = number(p.level, 1, 12);
    assert(loc && loc.levels >= level, 'Local ou nível inválido.');
    assert(
      !(p.archived && s.parts.some((x) => x.box_id === p.id && !x.archived && x.quantity > 0)),
      'A caixa ainda contém peças. Mova-as antes de arquivar.',
    );
    const value = {
      ...row(),
      ...old,
      code,
      label: text(p.label),
      location_id: loc.id,
      level,
      archived: p.archived ?? false,
    };
    s.boxes = [...s.boxes.filter((x) => x.id !== value.id), value].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  } else if (action === 'scrap.save') {
    assert(text(p.vehicle) && text(p.code), 'Informe código e veículo.');
    assert(
      !s.scraps.some((x) => x.code === text(p.code) && x.id !== p.id),
      'Código de sucata já cadastrado.',
    );
    const old = s.scraps.find((x) => x.id === p.id);
    assert(!p.id || old, 'Sucata não encontrada.');
    assert(
      !p.supplier_id || s.contacts.some((c) => c.id === p.supplier_id),
      'Fornecedor não encontrado.',
    );
    const cost = number(p.cost);
    const value = {
      ...row(),
      ...old,
      code: text(p.code),
      vehicle: text(p.vehicle),
      plate: p.plate || '',
      year: number(p.year, 1900, 2100),
      date: p.date,
      status: p.status,
      notes: p.notes || '',
      cost,
      brand: p.brand || '',
      model: p.model || '',
      color: p.color || '',
      fuel: p.fuel || '',
      km: p.km === null || p.km === undefined || p.km === '' ? null : number(p.km, 0, 5000000),
      chassis: String(p.chassis || '').toUpperCase(),
      renavam: p.renavam || '',
      engine: p.engine || '',
      origin: p.origin || 'particular',
      lot: p.lot || '',
      supplier_id: p.supplier_id || null,
      detran: p.detran || 'pendente',
      photos: photos(p.photos, 12),
    };
    s.scraps = [value, ...s.scraps.filter((x) => x.id !== value.id)];
    if (cost !== (old?.cost || 0))
      cash(
        (old?.cost || 0) - cost,
        `Aquisição ${value.code}`,
        'sucata',
        value.id,
        'Sucatas',
        'Transferência',
        old ? date : p.date,
      );
  } else if (action === 'part.save') {
    assert(text(p.name) && text(p.code), 'Informe nome e código.');
    assert(
      !s.parts.some((x) => x.code === text(p.code) && x.id !== p.id),
      'Código de peça já cadastrado.',
    );
    assert(!p.scrap_id || s.scraps.some((x) => x.id === p.scrap_id), 'Sucata inválida.');
    assert(
      !p.box_id || s.boxes.some((x) => x.id === p.box_id && !x.archived),
      'Caixa não encontrada.',
    );
    const old = s.parts.find((x) => x.id === p.id);
    assert(!p.id || old, 'Peça não encontrada.');
    if (p.archived)
      assert(
        !s.orders.some(
          (o) =>
            o.kind === 'oficina' &&
            !['entregue', 'cancelada'].includes(o.status) &&
            o.items.some((i) => i.part_id === p.id),
        ),
        'A peça está reservada em uma OS em andamento.',
      );
    const quantity = old?.quantity ?? number(p.quantity, 0, 1000000);
    const value: Part = {
      ...row(),
      ...old,
      code: text(p.code),
      name: text(p.name),
      category: p.category || '',
      scrap_id: p.scrap_id || null,
      box_id: p.box_id || null,
      location: p.location || '',
      condition: p.condition || 'Usada',
      oem: p.oem || '',
      fits: p.fits || '',
      photos: photos(p.photos, 6),
      quantity,
      cost: number(p.cost),
      price: number(p.price),
      minimum: number(p.minimum, 0, 1000000),
      archived: p.archived ?? false,
    };
    s.parts = [value, ...s.parts.filter((x) => x.id !== value.id)];
    if (!old && quantity)
      s.moves.unshift({
        ...row(),
        part_id: value.id,
        delta: quantity,
        reason: 'Estoque inicial',
        reference_id: null,
      });
  } else if (action === 'part.move') {
    const part = s.parts.find((x) => x.id === p.id && !x.archived);
    assert(part, 'Peça não encontrada.');
    assert(
      !p.box_id || s.boxes.some((x) => x.id === p.box_id && !x.archived),
      'Caixa não encontrada.',
    );
    part.box_id = p.box_id || null;
  } else if (action === 'stock.adjust') {
    const part = s.parts.find((x) => x.id === p.id);
    assert(part && !part.archived, 'Peça não encontrada.');
    assert(
      Number.isSafeInteger(p.delta) && p.delta !== 0 && text(p.reason),
      'Informe quantidade e motivo.',
    );
    move(part, p.delta, text(p.reason), null);
  } else if (action === 'order.create' || action === 'order.update') {
    assert(p.kind === 'venda' || p.kind === 'oficina', 'Tipo inválido.');
    assert(action === 'order.update' || !p.id, 'Nova operação não aceita ID existente.');
    const previous = action === 'order.update' ? s.orders.find((o) => o.id === p.id) : undefined;
    if (action === 'order.update') {
      assert(
        previous &&
          previous.kind === 'oficina' &&
          p.kind === 'oficina' &&
          !['entregue', 'cancelada'].includes(previous.status),
        'Somente ordens em andamento podem ser editadas.',
      );
      previous.items.forEach((i) =>
        move(
          s.parts.find((x) => x.id === i.part_id)!,
          i.quantity,
          'Revisão de OS',
          previous.id,
        ),
      );
    }
    const items: Item[] = [];
    const used = new Set<string>();
    assert(
      Array.isArray(p.items) && p.items.length <= 100 && (p.kind === 'oficina' || p.items.length),
      'Adicione uma peça.',
    );
    assert(
      !p.contact_id ||
        s.contacts.some(
          (x) => x.id === p.contact_id && (!x.archived || x.id === previous?.contact_id),
        ),
      'Cliente não encontrado.',
    );
    for (const input of p.items) {
      const part = s.parts.find((x) => x.id === input.part_id && !x.archived);
      assert(part, 'Peça não encontrada.');
      assert(!used.has(part.id), 'Peça duplicada. Ajuste a quantidade.');
      used.add(part.id);
      items.push({
        scrap_id: part.scrap_id,
        part_id: part.id,
        name: part.name,
        quantity: number(input.quantity, 1, 1000000),
        price: number(input.price),
      });
    }
    const workshop = p.kind === 'oficina';
    const services: Service[] = workshop
      ? ((p.services as Service[]) || []).map((x) => {
          assert(text(x.description) && String(x.detail || '').length <= 2000, 'Serviço inválido.');
          return {
            description: text(x.description),
            detail: x.detail || '',
            price: number(x.price),
          };
        })
      : [];
    const external: ExternalPart[] = workshop
      ? ((p.external_parts as ExternalPart[]) || []).map((x) => {
          assert(
            text(x.name) && ['cliente', 'comprada'].includes(x.origin),
            'Peça externa inválida.',
          );
          return {
            name: text(x.name),
            quantity: number(x.quantity, 1, 100000),
            origin: x.origin,
            price: number(x.price || 0),
            note: x.note || '',
          };
        })
      : [];
    assert(services.length <= 50 && external.length <= 50, 'Itens demais.');
    const labor = workshop
      ? services.length
        ? services.reduce((n, x) => n + x.price, 0)
        : number(p.labor)
      : 0;
    const discount = number(p.discount);
    const fee = p.kind === 'venda' ? number(p.fee || 0) : 0;
    const total =
      items.reduce((n, i) => n + i.quantity * i.price, labor) +
      external.reduce((n, e) => n + e.quantity * e.price, 0) -
      discount;
    assert(total >= 0, 'O desconto não pode superar o total.');
    const order: Order = {
      ...row(),
      ...(previous ? { id: previous.id, created_at: previous.created_at } : {}),
      kind: p.kind,
      number:
        previous?.number ??
        Math.max(0, ...s.orders.filter((o) => o.kind === p.kind).map((o) => o.number)) + 1,
      customer: text(p.customer),
      contact_id: p.contact_id || null,
      channel: previous?.channel || p.channel || 'balcao',
      payment: p.payment,
      vehicle: p.vehicle || '',
      plate: String(p.plate || '').toUpperCase(),
      description: p.description || '',
      technician: p.technician || '',
      due_date: p.due_date || null,
      labor,
      discount,
      total,
      fee,
      external_ref: p.external_ref || '',
      km: p.km === null || p.km === undefined || p.km === '' ? null : number(p.km, 0, 5000000),
      fuel_level: p.fuel_level || '',
      complaint: p.complaint || '',
      diagnosis: p.diagnosis || '',
      services,
      external_parts: external,
      checklist: p.checklist || [],
      recommendations: p.recommendations || '',
      warranty_days: p.warranty_days ?? 90,
      has_signature: previous?.has_signature || false,
      signature: previous?.signature,
      signed_name: previous?.signed_name || '',
      signed_at: previous?.signed_at || null,
      items,
      status: previous?.status || (p.kind === 'venda' ? 'confirmada' : 'aberta'),
    };
    assert(order.customer, 'Informe o cliente.');
    items.forEach((i) =>
      move(
        s.parts.find((x) => x.id === i.part_id)!,
        -i.quantity,
        p.kind === 'venda' ? 'Venda' : 'Reserva para OS',
        order.id,
      ),
    );
    s.orders = [order, ...s.orders.filter((o) => o.id !== order.id)];
    if (p.kind === 'venda' && total)
      cash(total, `Venda · ${order.customer}`, 'venda', order.id, 'Vendas', p.payment);
    if (p.kind === 'venda' && fee)
      cash(
        -fee,
        `Taxa ${channelName(order.channel)} · ${order.customer}`,
        'venda',
        order.id,
        'Taxas marketplace',
        p.payment,
      );
  } else if (action === 'order.status') {
    const order = s.orders.find((x) => x.id === p.id);
    assert(order, 'Registro não encontrado.');
    if (order.status === p.status) return s;
    assert(order.status !== 'cancelada', 'Registro já cancelado.');
    if (p.status === 'cancelada') {
      order.items.forEach((i) =>
        move(
          s.parts.find((x) => x.id === i.part_id)!,
          i.quantity,
          'Cancelamento',
          order.id,
        ),
      );
      s.cash
        .filter((c) => c.reference_id === order.id && !c.reversal_of)
        .forEach((c) => {
          if (!s.cash.some((r) => r.reversal_of === c.id))
            cash(
              -c.amount,
              `Estorno · ${c.description}`,
              'estorno',
              order.id,
              c.category,
              c.payment,
              date,
              c.id,
            );
        });
    } else {
      assert(order.kind === 'oficina' && order.status !== 'entregue', 'Transição não permitida.');
      assert(
        ['aberta', 'analise', 'aguardando_peca', 'execucao', 'finalizada', 'entregue'].includes(
          p.status,
        ),
        'Status inválido.',
      );
      if (p.status === 'entregue' && order.total)
        cash(
          order.total,
          `Oficina · OS ${String(order.number).padStart(4, '0')} · ${order.customer}`,
          'oficina',
          order.id,
          'Oficina',
          order.payment,
        );
    }
    order.status = p.status;
  } else if (action === 'order.sign') {
    const order = s.orders.find((x) => x.id === p.id && x.kind === 'oficina');
    assert(order && order.status !== 'cancelada', 'Ordem de serviço indisponível para assinatura.');
    assert(
      text(p.signed_name) && String(p.signature || '').startsWith('data:image/png;base64,'),
      'Assinatura inválida.',
    );
    order.signature = p.signature;
    order.signed_name = text(p.signed_name);
    order.signed_at = new Date().toISOString();
    order.has_signature = true;
  } else if (action === 'cash.create') {
    assert(['entrada', 'saida'].includes(p.direction), 'Valor ou tipo inválido.');
    const amount = number(p.amount, 1) * (p.direction === 'saida' ? -1 : 1);
    assert(text(p.description), 'Informe a descrição.');
    cash(amount, text(p.description), 'manual', null, p.category, p.payment, p.date);
  } else if (action === 'cash.reverse') {
    const c = s.cash.find((x) => x.id === p.id);
    assert(c && ['manual', 'conta'].includes(c.source), 'Lançamento manual não encontrado.');
    assert(!s.cash.some((x) => x.reversal_of === c.id), 'Lançamento já estornado.');
    cash(
      -c.amount,
      `Estorno · ${c.description}`,
      'estorno',
      null,
      c.category,
      c.payment,
      date,
      c.id,
    );
    s.bills.forEach((b) => {
      if (b.cash_id === c.id) {
        b.status = 'aberta';
        b.cash_id = null;
      }
    });
  } else if (action === 'bill.save') {
    const old = s.bills.find((x) => x.id === p.id);
    assert(
      !p.id || (old && old.status === 'aberta'),
      'Somente contas em aberto podem ser editadas.',
    );
    assert(['pagar', 'receber'].includes(p.direction), 'Valor ou tipo inválido.');
    assert(text(p.description) && p.due_date, 'Informe descrição e vencimento.');
    const value: Bill = {
      ...row(),
      ...old,
      description: text(p.description),
      direction: p.direction,
      amount: number(p.amount, 1),
      due_date: p.due_date,
      category: p.category || 'Outros',
      contact_id: p.contact_id || null,
      notes: p.notes || '',
      status: 'aberta',
      cash_id: null,
    };
    s.bills = [...s.bills.filter((x) => x.id !== value.id), value].sort((a, b) =>
      a.due_date.localeCompare(b.due_date),
    );
  } else if (action === 'bill.pay') {
    const bill = s.bills.find((x) => x.id === p.id);
    assert(bill && bill.status === 'aberta', 'Conta não está em aberto.');
    const entry = cash(
      bill.direction === 'pagar' ? -bill.amount : bill.amount,
      bill.description,
      'conta',
      bill.id,
      bill.category,
      p.payment || 'Pix',
      p.date || date,
    );
    bill.status = 'paga';
    bill.cash_id = entry.id;
  } else if (action === 'bill.cancel') {
    const bill = s.bills.find((x) => x.id === p.id);
    assert(bill && bill.status === 'aberta', 'Conta não está em aberto.');
    bill.status = 'cancelada';
  } else if (action === 'settings.save') {
    assert(text(p.name), 'Informe o nome da loja.');
    s.settings = {
      ...s.settings,
      ...(p as Partial<State['settings']>),
      monthly_goal: number(p.monthly_goal || 0),
    };
  } else throw new Error('Operação desconhecida.');
  s.cash.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  return s;
}
function randomTime() {
  const h = 8 + Math.floor(Math.random() * 10);
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
}

export function seedDemo(): State {
  let s = emptyState();
  const t = today();
  const run = (action: string, payload: Record<string, unknown>, daysAgo = 0) => {
    s = demoCommand(s, { action, payload, request_id: crypto.randomUUID() }, addDays(t, -daysAgo));
    return s;
  };
  run(
    'settings.save',
    {
      name: 'Pixote Auto Peças',
      responsible: 'Gabriel',
      phone: '(11) 4002-8922',
      email: 'contato@pixote.com.br',
      document: '00.000.000/0001-00',
      address: 'Rua das Oficinas, 120 · São Paulo/SP',
      monthly_goal: 1500000,
      warranty_text:
        'Garantia legal de 90 dias para serviços e peças fornecidas pela oficina (CDC, art. 26). Não cobre mau uso, peças fornecidas pelo cliente ou desgaste natural.',
    },
    95,
  );
  const contacts = [
    ['Auto Center Paulista', 'cliente'],
    ['Marcos Oliveira', 'cliente'],
    ['Oficina Dois Irmãos', 'cliente'],
    ['Juliana Prado', 'cliente'],
    ['Copart Leilões', 'fornecedor'],
    ['Distribuidora Rota Sul', 'fornecedor'],
  ] as const;
  contacts.forEach(([name, kind], i) =>
    run(
      'contact.save',
      {
        name,
        kind,
        phone: `(11) 99${String(900 + i * 7)}-${String(1000 + i * 131)}`,
        email: '',
        document: '',
        notes: '',
        archived: false,
      },
      94,
    ),
  );
  const contact = (name: string) => s.contacts.find((c) => c.name === name)!.id;

  // Armazém: prateleiras, gaveteiro e pátio.
  [
    ['A', 'Prateleira A · Elétrica', 'prateleira', 4, 'amber'],
    ['B', 'Prateleira B · Motor', 'prateleira', 4, 'orange'],
    ['C', 'Prateleira C · Carroceria', 'prateleira', 3, 'blue'],
    ['G1', 'Gaveteiro de miúdos', 'gaveteiro', 5, 'green'],
    ['P', 'Pátio coberto', 'area', 1, 'steel'],
  ].forEach(([code, name, kind, levels, color]) =>
    run('location.save', { code, name, kind, levels, color }, 94),
  );
  const loc = (code: string) => s.locations.find((l) => l.code === code)!.id;
  (
    [
      ['A-01', 'Alternadores', 'A', 1],
      ['A-02', 'Motores de partida', 'A', 1],
      ['A-03', 'Módulos e sensores', 'A', 2],
      ['A-04', 'Chicotes', 'A', 3],
      ['A-05', 'Faróis', 'A', 4],
      ['B-01', 'Cabeçotes', 'B', 1],
      ['B-02', 'Bombas', 'B', 2],
      ['B-03', 'Radiadores', 'B', 3],
      ['C-01', 'Retrovisores', 'C', 1],
      ['C-02', 'Maçanetas', 'C', 2],
      ['G1-01', 'Relés', 'G1', 1],
      ['G1-02', 'Parafusos e presilhas', 'G1', 2],
      ['P-01', 'Motores e câmbios', 'P', 1],
    ] as const
  ).forEach(([code, label, l, level]) =>
    run('box.save', { code, label, location_id: loc(l), level }, 94),
  );
  const box = (code: string) => s.boxes.find((b) => b.code === code)!.id;

  // Sucatas com ficha completa e fotos ilustrativas.
  const scraps = [
    {
      code: 'SUC-001',
      brand: 'Volkswagen',
      model: 'Gol G6 1.6 MSI',
      year: 2014,
      color: 'Prata',
      plate: 'FQX-4E21',
      km: 168400,
      fuel: 'Flex',
      engine: 'EA211 1.6',
      origin: 'leilao',
      lot: 'Lote 2231',
      cost: 850000,
      status: 'desmontando',
      detran: 'baixado',
      supplier: 'Copart Leilões',
      ago: 88,
      tone: '#b8bec6',
      chassis: '9BWAB45U0ET123456',
      notes: 'Batida traseira. Motor e câmbio íntegros, interior bom.',
    },
    {
      code: 'SUC-002',
      brand: 'Fiat',
      model: 'Palio Fire 1.0',
      year: 2012,
      color: 'Vermelho',
      plate: 'EKL-2B90',
      km: 201300,
      fuel: 'Flex',
      engine: 'Fire 1.0 8V',
      origin: 'particular',
      lot: '',
      cost: 620000,
      status: 'aguardando',
      detran: 'em_andamento',
      supplier: '',
      ago: 40,
      tone: '#c0392b',
      chassis: '9BD17164LC5123987',
      notes: 'Enchente. Verificar parte elétrica antes de liberar peças.',
    },
    {
      code: 'SUC-003',
      brand: 'Chevrolet',
      model: 'Onix LT 1.4',
      year: 2016,
      color: 'Branco',
      plate: 'GHT-7C12',
      km: 97200,
      fuel: 'Flex',
      engine: 'SPE/4 1.4',
      origin: 'seguradora',
      lot: 'Sinistro 88-129',
      cost: 1320000,
      status: 'finalizada',
      detran: 'baixado',
      supplier: 'Copart Leilões',
      ago: 75,
      tone: '#eceff1',
      chassis: '9BGKS48U0GG456789',
      notes: 'Perda total por colisão lateral. Desmontagem concluída.',
    },
  ];
  scraps.forEach((x) =>
    run(
      'scrap.save',
      {
        code: x.code,
        vehicle: `${x.brand} ${x.model}`,
        brand: x.brand,
        model: x.model,
        year: x.year,
        color: x.color,
        plate: x.plate,
        km: x.km,
        fuel: x.fuel,
        engine: x.engine,
        origin: x.origin,
        lot: x.lot,
        cost: x.cost,
        date: addDays(t, -x.ago),
        status: x.status,
        detran: x.detran,
        chassis: x.chassis,
        renavam: '',
        supplier_id: x.supplier ? contact(x.supplier) : null,
        notes: x.notes,
        photos: [
          demoPhoto(x.tone, 0, x.model),
          demoPhoto(x.tone, 1, x.model),
          demoPhoto(x.tone, 2, x.model),
        ],
      },
      x.ago,
    ),
  );
  const scrap = (code: string) => s.scraps.find((x) => x.code === code)!.id;

  const parts: [string, string, string, number, number, string, string | null, string, string][] = [
    [
      'Alternador Bosch 90A',
      'Elétrica',
      'PC-001',
      8,
      45000,
      'A-01',
      'SUC-001',
      '0124325171',
      'Gol/Voyage/Fox 1.6 2013-2016',
    ],
    [
      'Motor de partida Valeo',
      'Elétrica',
      'PC-002',
      2,
      38000,
      'A-02',
      'SUC-003',
      '',
      'Onix/Prisma 1.4 2013-2019',
    ],
    [
      'Módulo de injeção ECU',
      'Elétrica',
      'PC-003',
      1,
      95000,
      'A-03',
      'SUC-001',
      '03C906024',
      'Gol G6 1.6 MSI',
    ],
    [
      'Farol dianteiro esquerdo',
      'Iluminação',
      'PC-004',
      10,
      28000,
      'A-05',
      'SUC-003',
      '',
      'Onix 2016-2019',
    ],
    [
      'Farol dianteiro direito',
      'Iluminação',
      'PC-005',
      6,
      28000,
      'A-05',
      'SUC-003',
      '',
      'Onix 2016-2019',
    ],
    ['Motor parcial 1.6 EA211', 'Motor', 'PC-006', 1, 420000, 'P-01', 'SUC-001', '', 'VW 1.6 MSI'],
    [
      'Caixa de câmbio manual MQ200',
      'Transmissão',
      'PC-007',
      2,
      185000,
      'P-01',
      'SUC-001',
      '',
      'Gol/Fox/Polo 1.6',
    ],
    ['Bomba de combustível', 'Motor', 'PC-008', 2, 32000, 'B-02', 'SUC-002', '', 'Palio/Uno Fire'],
    [
      'Radiador com ventoinha',
      'Arrefecimento',
      'PC-009',
      1,
      36000,
      'B-03',
      'SUC-003',
      '',
      'Onix/Prisma 1.4',
    ],
    [
      'Cabeçote Fire 1.0 8V',
      'Motor',
      'PC-010',
      1,
      68000,
      'B-01',
      'SUC-002',
      '',
      'Palio/Uno/Siena Fire',
    ],
    [
      'Retrovisor direito elétrico',
      'Carroceria',
      'PC-011',
      30,
      16000,
      'C-01',
      'SUC-003',
      '',
      'Onix 2013-2019',
    ],
    [
      'Maçaneta externa dianteira',
      'Carroceria',
      'PC-012',
      30,
      6500,
      'C-02',
      'SUC-001',
      '',
      'Gol G5/G6',
    ],
    ['Relé auxiliar 12V', 'Elétrica', 'PC-013', 60, 2500, 'G1-01', null, '', 'Universal'],
    [
      'Kit presilhas de para-choque',
      'Carroceria',
      'PC-014',
      1,
      1800,
      'G1-02',
      null,
      '',
      'Universal',
    ],
    [
      'Pastilha de freio dianteira',
      'Freios',
      'PC-015',
      30,
      9800,
      'G1-02',
      null,
      'N-1428',
      'Gol/Voyage/Fox',
    ],
  ];
  parts.forEach(([name, category, code, quantity, price, b, sc, oem, fits]) =>
    run(
      'part.save',
      {
        name,
        category,
        code,
        quantity,
        price,
        oem,
        fits,
        cost: Math.round(price * 0.42),
        minimum: 2,
        location: '',
        condition: sc ? 'Usada' : 'Nova',
        scrap_id: sc ? scrap(sc) : null,
        box_id: box(b),
        photos: [],
        archived: false,
      },
      70,
    ),
  );
  const part = (code: string) => s.parts.find((x) => x.code === code)!;

  run(
    'cash.create',
    {
      amount: 6000000,
      direction: 'entrada',
      description: 'Aporte inicial',
      date: addDays(t, -92),
      category: 'Aporte',
      payment: 'Transferência',
    },
    92,
  );

  // Vendas espalhadas pelos três canais nos últimos 90 dias.
  const clients = [
    'Marcos Oliveira',
    'Juliana Prado',
    'Auto Center Paulista',
    'Oficina Dois Irmãos',
  ];
  const saleSpec: [number, string, string, number, number, string][] = [
    [86, 'balcao', 'PC-013', 3, 2500, 'Dinheiro'],
    [81, 'mercado_livre', 'PC-011', 1, 17900, 'Pix'],
    [74, 'shopee', 'PC-012', 2, 6900, 'Pix'],
    [66, 'mercado_livre', 'PC-001', 1, 47900, 'Crédito'],
    [61, 'balcao', 'PC-015', 2, 9800, 'Débito'],
    [55, 'shopee', 'PC-013', 4, 2700, 'Pix'],
    [47, 'mercado_livre', 'PC-004', 1, 29900, 'Pix'],
    [41, 'balcao', 'PC-008', 1, 32000, 'Pix'],
    [33, 'mercado_livre', 'PC-011', 2, 17900, 'Pix'],
    [26, 'shopee', 'PC-012', 1, 6900, 'Crédito'],
    [19, 'balcao', 'PC-001', 1, 45000, 'Pix'],
    [12, 'mercado_livre', 'PC-002', 1, 39900, 'Pix'],
    [8, 'shopee', 'PC-011', 1, 16900, 'Pix'],
    [5, 'balcao', 'PC-013', 2, 2500, 'Dinheiro'],
    [3, 'mercado_livre', 'PC-009', 1, 38900, 'Crédito'],
    [1, 'balcao', 'PC-004', 1, 28000, 'Pix'],
    [0, 'shopee', 'PC-015', 1, 10900, 'Pix'],
  ];
  saleSpec.forEach(([ago, channel, code, quantity, price, payment], i) => {
    const name = clients[i % clients.length];
    const gross = quantity * price;
    run(
      'order.create',
      {
        kind: 'venda',
        customer: name,
        contact_id: contact(name),
        channel,
        payment,
        external_ref:
          channel === 'balcao' ? '' : `${channel === 'shopee' ? 'SP' : 'ML'}-${2400031 + i * 17}`,
        fee:
          channel === 'mercado_livre'
            ? Math.round(gross * 0.16)
            : channel === 'shopee'
              ? Math.round(gross * 0.2)
              : 0,
        vehicle: '',
        plate: '',
        description: '',
        technician: '',
        due_date: null,
        labor: 0,
        discount: 0,
        items: [{ part_id: part(code).id, quantity, price }],
      },
      ago,
    );
  });

  // Giro diário de itens baratos para o gráfico ganhar ritmo.
  const cheap: [string, number][] = [
    ['PC-013', 2500],
    ['PC-015', 9800],
    ['PC-012', 6900],
    ['PC-011', 16900],
  ];
  const rotation = ['balcao', 'mercado_livre', 'balcao', 'shopee', 'mercado_livre'];
  for (let ago = 84, i = 0; ago >= 0; ago -= 3, i++) {
    const [code, price] = cheap[i % cheap.length];
    const channel = rotation[i % rotation.length];
    const quantity = 1 + (i % 3);
    const gross = quantity * price;
    const name = clients[(i + 1) % clients.length];
    run(
      'order.create',
      {
        kind: 'venda',
        customer: name,
        contact_id: contact(name),
        channel,
        payment: i % 4 ? 'Pix' : 'Crédito',
        external_ref:
          channel === 'balcao' ? '' : `${channel === 'shopee' ? 'SP' : 'ML'}-${2500001 + i * 29}`,
        fee:
          channel === 'mercado_livre'
            ? Math.round(gross * 0.16)
            : channel === 'shopee'
              ? Math.round(gross * 0.2)
              : 0,
        vehicle: '',
        plate: '',
        description: '',
        technician: '',
        due_date: null,
        labor: 0,
        discount: 0,
        items: [{ part_id: part(code).id, quantity, price }],
      },
      ago,
    );
  }

  // Oficina com OS em várias etapas.
  const checklist = (bad: string[] = []) =>
    [
      'Estepe',
      'Macaco e chave de roda',
      'Documento do veículo',
      'Rádio / multimídia',
      'Pintura sem avarias',
      'Pneus',
    ].map((label) => ({ label, state: bad.includes(label) ? 'avaria' : 'ok' }));
  const os = (ago: number, payload: Record<string, unknown>) =>
    run(
      'order.create',
      {
        kind: 'oficina',
        channel: 'balcao',
        payment: 'Pix',
        technician: 'Rafael (mecânico)',
        discount: 0,
        labor: 0,
        items: [],
        external_parts: [],
        warranty_days: 90,
        recommendations: '',
        diagnosis: '',
        ...payload,
      },
      ago,
    );
  os(52, {
    customer: 'Auto Center Paulista',
    contact_id: contact('Auto Center Paulista'),
    vehicle: 'Volkswagen Gol 1.6 2015',
    plate: 'FJK2A33',
    km: 132000,
    fuel_level: '1/4',
    due_date: addDays(t, -48),
    complaint: 'Bateria descarregando durante a noite.',
    diagnosis: 'Alternador com diodo em curto.',
    description: 'Substituição do alternador',
    checklist: checklist(),
    services: [
      {
        description: 'Diagnóstico elétrico',
        detail: 'Teste de carga e fuga de corrente',
        price: 12000,
      },
      {
        description: 'Troca do alternador',
        detail: 'Removido original, instalado alternador revisado PC-001',
        price: 18000,
      },
    ],
    items: [{ part_id: part('PC-001').id, quantity: 1, price: 45000 }],
  });
  run('order.status', { id: s.orders[0].id, status: 'entregue' }, 49);
  os(20, {
    customer: 'Juliana Prado',
    contact_id: contact('Juliana Prado'),
    vehicle: 'Chevrolet Onix 1.4 2017',
    plate: 'GBR5F77',
    km: 88210,
    fuel_level: '1/2',
    due_date: addDays(t, -16),
    complaint: 'Barulho na dianteira em lombadas.',
    diagnosis: 'Bieleta e bucha da bandeja gastas.',
    description: 'Revisão da suspensão dianteira',
    checklist: checklist(['Pintura sem avarias']),
    services: [
      {
        description: 'Troca de bieletas (par)',
        detail: 'Peças novas compradas para o serviço',
        price: 16000,
      },
      { description: 'Alinhamento e balanceamento', detail: '', price: 12000 },
    ],
    external_parts: [
      {
        name: 'Bieleta dianteira Nakata',
        quantity: 2,
        origin: 'comprada',
        price: 8900,
        note: 'NF 3321',
      },
    ],
  });
  run('order.status', { id: s.orders[0].id, status: 'entregue' }, 15);
  os(4, {
    customer: 'Marcos Oliveira',
    contact_id: contact('Marcos Oliveira'),
    vehicle: 'Fiat Palio Fire 2011',
    plate: 'DPA3B19',
    km: 176500,
    fuel_level: 'reserva',
    due_date: addDays(t, 1),
    complaint: 'Motor falhando e perda de potência.',
    diagnosis: 'Bomba de combustível com pressão baixa.',
    description: 'Troca da bomba de combustível',
    checklist: checklist(['Estepe']),
    services: [
      { description: 'Teste de pressão de combustível', detail: '', price: 8000 },
      {
        description: 'Substituição da bomba',
        detail: 'Tanque removido, bomba PC-008 instalada',
        price: 15000,
      },
    ],
    items: [{ part_id: part('PC-008').id, quantity: 1, price: 32000 }],
  });
  run('order.status', { id: s.orders[0].id, status: 'execucao' }, 2);
  os(2, {
    customer: 'Oficina Dois Irmãos',
    contact_id: contact('Oficina Dois Irmãos'),
    vehicle: 'Volkswagen Fox 1.6 2014',
    plate: 'EZT9H04',
    km: 143900,
    fuel_level: '3/4',
    due_date: addDays(t, 3),
    complaint: 'Luz de injeção acesa.',
    diagnosis: '',
    description: 'Diagnóstico de injeção eletrônica',
    checklist: checklist(),
    services: [{ description: 'Scanner e diagnóstico', detail: '', price: 9000 }],
  });
  run('order.status', { id: s.orders[0].id, status: 'analise' }, 1);
  os(0, {
    customer: 'Juliana Prado',
    contact_id: contact('Juliana Prado'),
    vehicle: 'Honda Fit 1.4 2010',
    plate: 'EPO1K88',
    km: 190300,
    fuel_level: '1/2',
    due_date: addDays(t, 5),
    complaint: 'Troca de óleo e filtros.',
    description: 'Manutenção preventiva',
    checklist: checklist(),
    services: [{ description: 'Troca de óleo e filtro', detail: '', price: 6000 }],
    external_parts: [
      {
        name: 'Óleo 5W30 sintético (L)',
        quantity: 4,
        origin: 'cliente',
        price: 0,
        note: 'Trazido pelo cliente',
      },
    ],
  });

  // Despesas recorrentes para o financeiro ganhar vida.
  const expenses: [number, string, string, number][] = [
    [85, 'Aluguel do galpão', 'Aluguel', 450000],
    [55, 'Aluguel do galpão', 'Aluguel', 450000],
    [25, 'Aluguel do galpão', 'Aluguel', 450000],
    [80, 'Energia elétrica', 'Energia e água', 68000],
    [50, 'Energia elétrica', 'Energia e água', 72000],
    [20, 'Energia elétrica', 'Energia e água', 70500],
    [60, 'Compra de ferramentas pneumáticas', 'Ferramentas', 138000],
    [34, 'Anúncios patrocinados ML', 'Marketing', 25000],
    [10, 'Frete de peças · transportadora', 'Frete', 18900],
    [6, 'Pró-labore', 'Salários', 300000],
  ];
  expenses.forEach(([ago, description, category, amount]) =>
    run(
      'cash.create',
      { direction: 'saida', amount, description, category, date: addDays(t, -ago), payment: 'Pix' },
      ago,
    ),
  );
  // Contas agendadas.
  const bills: [number, string, 'pagar' | 'receber', string, number][] = [
    [-2, 'Boleto Distribuidora Rota Sul', 'pagar', 'Fornecedores', 128000],
    [0, 'DAS Simples Nacional', 'pagar', 'Impostos', 91000],
    [5, 'Aluguel do galpão', 'pagar', 'Aluguel', 450000],
    [9, 'Energia elétrica', 'pagar', 'Energia e água', 71000],
    [3, 'Auto Center Paulista · faturado', 'receber', 'Oficina', 185000],
    [14, 'Repasse Mercado Livre', 'receber', 'Vendas', 96000],
  ];
  bills.forEach(([due, description, direction, category, amount]) =>
    run(
      'bill.save',
      {
        description,
        direction,
        category,
        amount,
        due_date: addDays(t, due),
        contact_id: null,
        notes: '',
      },
      3,
    ),
  );
  return s;
}
