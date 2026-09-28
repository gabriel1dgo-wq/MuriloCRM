import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const userA = '11111111-1111-4111-8111-111111111111',
  userB = '22222222-2222-4222-8222-222222222222';
let partId: string, scrapId: string;
async function user(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function cmd(action: string, payload: Record<string, unknown>, id = crypto.randomUUID()) {
  const r = await db.query<{ result: { id: string; ok: boolean } }>(
    'select public.z_command($1::uuid,$2::text,$3::jsonb) as result',
    [id, action, JSON.stringify(payload)],
  );
  return r.rows[0].result;
}
async function scalar(sql: string) {
  return (await db.query<Record<string, any>>(sql)).rows[0];
}
const order = (overrides: Record<string, unknown> = {}) => ({
  kind: 'venda',
  customer: 'Cliente teste',
  contact_id: null,
  channel: 'balcao',
  payment: 'Pix',
  vehicle: 'Gol',
  plate: '',
  description: 'Teste',
  technician: '',
  due_date: null,
  labor: 0,
  discount: 0,
  items: [{ part_id: partId, quantity: 1, price: 1599 }],
  ...overrides,
});
before(async () => {
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);insert into auth.users values('${userA}'),('${userB}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const file of ['20260927184355_zenith_core.sql', '20260928120000_pixote_v2.sql'])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'),
    );
  await user(userA);
  scrapId = (
    await cmd('scrap.save', {
      code: 'S-1',
      vehicle: 'Gol',
      plate: '',
      year: 2014,
      cost: 10000,
      date: '2026-09-27',
      status: 'desmontando',
      notes: '',
    })
  ).id;
  partId = (
    await cmd('part.save', {
      code: 'P-1',
      name: 'Alternador',
      category: 'Elétrica',
      scrap_id: scrapId,
      quantity: 10,
      minimum: 1,
      cost: 500,
      price: 1599,
      location: 'A1',
      condition: 'Usada',
      archived: false,
    })
  ).id;
});
after(() => db.close());
test('schema applies cleanly and purchase records a cash outflow', async () => {
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -10000,
  );
});
test('sale commits exact cents, stock and ledger once for repeated request', async () => {
  const id = crypto.randomUUID();
  const a = await cmd('order.create', order(), id);
  const b = await cmd('order.create', order(), id);
  assert.equal(a.id, b.id);
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 9);
  assert.equal((await scalar('select count(*)::integer as n from public.z_orders')).n, 1);
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -8401,
  );
  await assert.rejects(cmd('order.create', order({ discount: 100 }), id), /Identificador/);
});
test('overselling rolls back header, cash and previous item changes', async () => {
  const before = await scalar('select count(*)::integer as n from public.z_orders');
  await assert.rejects(
    cmd('order.create', order({ items: [{ part_id: partId, quantity: 50, price: 1599 }] })),
    /Estoque insuficiente/,
  );
  assert.equal((await scalar('select count(*)::integer as n from public.z_orders')).n, before.n);
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 9);
});
test('duplicate item rolls back the entire sale', async () => {
  await assert.rejects(
    cmd(
      'order.create',
      order({
        items: [
          { part_id: partId, quantity: 1, price: 100 },
          { part_id: partId, quantity: 1, price: 100 },
        ],
      }),
    ),
    /duplicate key/,
  );
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 9);
});
test('discount cannot exceed total', async () => {
  await assert.rejects(cmd('order.create', order({ discount: 999999 })), /desconto/);
});
test('cancellation restores stock and records a single reversal', async () => {
  const o = await scalar('select id from public.z_orders limit 1');
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 10);
  assert.equal(
    (await scalar("select count(*)::integer as n from public.z_cash where source='estorno'")).n,
    1,
  );
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -10000,
  );
});
test('work order reserves pieces, receives on delivery, reverses on cancellation', async () => {
  const o = await cmd('order.create', order({ kind: 'oficina', labor: 2500 }));
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 9);
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -10000,
  );
  await cmd('order.status', { id: o.id, status: 'entregue' });
  await cmd('order.status', { id: o.id, status: 'entregue' });
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -5901,
  );
  await assert.rejects(cmd('order.status', { id: o.id, status: 'aberta' }), /Transição/);
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    -10000,
  );
});
test('editing an open work order replaces reservations atomically', async () => {
  const o = await cmd('order.create', order({ kind: 'oficina', labor: 1000 }));
  await cmd(
    'order.update',
    order({
      id: o.id,
      kind: 'oficina',
      labor: 2000,
      items: [{ part_id: partId, quantity: 2, price: 1599 }],
    }),
  );
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 8);
  await assert.rejects(
    cmd(
      'order.update',
      order({ id: o.id, kind: 'oficina', items: [{ part_id: partId, quantity: 99, price: 1599 }] }),
    ),
    /Estoque insuficiente/,
  );
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 8);
  assert.equal(
    (await scalar(`select total::integer as total from public.z_orders where id='${o.id}'`)).total,
    5198,
  );
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 10);
  await assert.rejects(cmd('order.update', order({ id: o.id, kind: 'oficina' })), /Somente ordens/);
});
test('missing identity cannot invoke privileged writer', async () => {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated;",
  );
  await assert.rejects(cmd('settings.save', { name: 'Test' }), /Autenticação necessária/);
  await user(userA);
});
test('invalid numeric values do not create ledger entries', async () => {
  await assert.rejects(
    cmd('cash.create', {
      amount: -1,
      direction: 'entrada',
      description: 'Invalid',
      date: '2026-09-27',
      category: 'Outros',
      payment: 'Pix',
    }),
  );
  await assert.rejects(cmd('stock.adjust', { id: partId, delta: 0, reason: 'Invalid' }));
});
test('authenticated users cannot directly change stock or ledger', async () => {
  await assert.rejects(db.exec('update public.z_parts set quantity=100'), /permission denied/);
  await assert.rejects(db.exec('delete from public.z_cash'), /permission denied/);
});
test('RLS isolates reads and commands cannot mutate another account', async () => {
  await user(userB);
  assert.equal((await scalar('select count(*)::integer as n from public.z_parts')).n, 0);
  await assert.rejects(
    cmd('stock.adjust', { id: partId, delta: 1, reason: 'Cross account' }),
    /indisponível/,
  );
  await assert.rejects(cmd('order.create', order()), /Peça não encontrada/);
  await assert.rejects(
    cmd('part.save', {
      code: 'OTHER',
      name: 'Test',
      category: '',
      scrap_id: scrapId,
      quantity: 1,
      minimum: 0,
      cost: 1,
      price: 1,
      location: '',
      condition: 'Usada',
    }),
    /foreign key/,
  );
  await user(userA);
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, 10);
});
test('manual cash reverses only once and keeps original record', async () => {
  const c = await cmd('cash.create', {
    amount: 100,
    direction: 'entrada',
    description: 'Aporte',
    date: '2026-09-27',
    category: 'Outros',
    payment: 'Pix',
  });
  await cmd('cash.reverse', { id: c.id });
  await assert.rejects(cmd('cash.reverse', { id: c.id }), /duplicate key/);
});
test('anonymous cannot access tables or RPCs', async () => {
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.exec('select * from public.z_parts'), /permission denied/);
  await assert.rejects(db.exec('select public.z_snapshot()'), /permission denied/);
  await assert.rejects(cmd('settings.save', { name: 'Hacked' }), /permission denied/);
  await user(userA);
});
test('snapshot returns nested items and all functional modules', async () => {
  const r = await scalar('select public.z_snapshot() as data');
  for (const k of ['contacts', 'scraps', 'parts', 'orders', 'cash', 'moves'])
    assert.ok(Array.isArray(r.data[k]));
  assert.equal(r.data.orders[0].items[0].part_id, partId);
});

test('schema audit: RLS on every application table and no direct writes for API roles', async () => {
  await db.exec('reset role;');
  const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
    "select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r' and relname like 'z_%'",
  );
  assert.equal(tables.rows.length, 11);
  assert.ok(tables.rows.every((t) => t.relrowsecurity));
  for (const table of tables.rows) {
    const r = await scalar(
      `select has_table_privilege('authenticated','public.${table.relname}','INSERT,UPDATE,DELETE') as writes, has_table_privilege('anon','public.${table.relname}','SELECT') as anonymous`,
    );
    assert.equal(r.writes, false);
    assert.equal(r.anonymous, false);
  }
  const functions = await db.query<{ nspname: string; proname: string; prosecdef: boolean }>(
    "select nspname,proname,prosecdef from pg_proc join pg_namespace on pg_namespace.oid=pronamespace where proname in ('z_command','z_snapshot')",
  );
  assert.equal(functions.rows.length, 2);
  assert.ok(functions.rows.every((f) => !f.prosecdef));
  await user(userA);
});

test('scrap cost corrections post only the difference and preserve prior cash', async () => {
  const before = (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount;
  await cmd('scrap.save', {
    id: scrapId,
    code: 'S-1',
    vehicle: 'Gol',
    plate: '',
    year: 2014,
    cost: 12000,
    date: '2026-09-27',
    status: 'finalizada',
    notes: '',
  });
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    before - 2000,
  );
});

test('warehouse: boxes live in locations and parts move between boxes', async () => {
  const loc = await cmd('location.save', {
    code: 'a',
    name: 'Prateleira A',
    kind: 'prateleira',
    levels: 3,
    color: 'amber',
  });
  await assert.rejects(
    cmd('box.save', { code: 'CX-X', label: '', location_id: loc.id, level: 9 }),
    /nível inválido/,
  );
  const box = await cmd('box.save', {
    code: 'cx-01',
    label: 'Elétrica',
    location_id: loc.id,
    level: 2,
  });
  assert.equal(
    (await scalar(`select code from public.z_boxes where id='${box.id}'`)).code,
    'CX-01',
  );
  await cmd('part.move', { id: partId, box_id: box.id });
  assert.equal((await scalar('select box_id from public.z_parts')).box_id, box.id);
  await assert.rejects(
    cmd('box.save', {
      id: box.id,
      code: 'CX-01',
      label: '',
      location_id: loc.id,
      level: 2,
      archived: true,
    }),
    /ainda contém peças/,
  );
  await assert.rejects(
    cmd('location.save', {
      id: loc.id,
      code: 'A',
      name: 'Prateleira A',
      levels: 3,
      archived: true,
    }),
    /caixas deste local/,
  );
  await user(userB);
  await assert.rejects(cmd('part.move', { id: partId, box_id: null }), /Peça não encontrada/);
  await assert.rejects(cmd('box.save', { code: 'B', location_id: loc.id, level: 1 }), /Local/);
  await user(userA);
});

test('scrap photos must live inside the owner folder', async () => {
  const base = {
    id: scrapId,
    code: 'S-1',
    vehicle: 'Gol',
    plate: '',
    year: 2014,
    cost: 10000,
    date: '2026-09-27',
    status: 'finalizada',
    notes: '',
  };
  await assert.rejects(
    cmd('scrap.save', { ...base, photos: [`${userB}/scraps/x.jpg`] }),
    /Fotos inválidas/,
  );
  await cmd('scrap.save', {
    ...base,
    brand: 'VW',
    model: 'Gol 1.6',
    km: 150000,
    origin: 'leilao',
    detran: 'baixado',
    chassis: '9bw123',
    photos: [`${userA}/scraps/a.jpg`],
  });
  const s = await scalar(
    `select photos, chassis, detran from public.z_scraps where id='${scrapId}'`,
  );
  assert.deepEqual(s.photos, [`${userA}/scraps/a.jpg`]);
  assert.equal(s.chassis, '9BW123');
  assert.equal(s.detran, 'baixado');
});

test('work order: numbered, labor from services, external parts and signature', async () => {
  const before = (await scalar('select quantity from public.z_parts')).quantity;
  const o = await cmd(
    'order.create',
    order({
      kind: 'oficina',
      labor: 99999,
      plate: 'abc1d23',
      km: 120500,
      fuel_level: '1/2',
      complaint: 'Barulho na suspensão',
      services: [
        { description: 'Troca de amortecedor', detail: 'Par dianteiro', price: 15000 },
        { description: 'Alinhamento', detail: '', price: 5000 },
      ],
      external_parts: [
        { name: 'Óleo 5W30', quantity: 4, origin: 'comprada', price: 3500, note: '' },
      ],
    }),
  );
  const row = await scalar(
    `select number, labor::integer, total::integer, plate from public.z_orders where id='${o.id}'`,
  );
  assert.ok(row.number >= 1);
  assert.equal(row.labor, 20000);
  assert.equal(row.total, 20000 + 14000 + 1599);
  assert.equal(row.plate, 'ABC1D23');
  await assert.rejects(
    cmd('order.sign', { id: o.id, signed_name: 'X', signature: 'javascript:alert(1)' }),
    /Assinatura/,
  );
  await cmd('order.sign', {
    id: o.id,
    signed_name: 'Cliente',
    signature: 'data:image/png;base64,AAAA',
  });
  const snap = await scalar('select public.z_snapshot() as data');
  const found = snap.data.orders.find((x: { id: string }) => x.id === o.id);
  assert.equal(found.has_signature, true);
  assert.equal(found.signature, undefined);
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  assert.equal((await scalar('select quantity from public.z_parts')).quantity, before);
});

test('marketplace fee posts an outflow and is reversed with the sale', async () => {
  const before = (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount;
  const o = await cmd(
    'order.create',
    order({ channel: 'mercado_livre', fee: 250, external_ref: 'ML-123' }),
  );
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    before + 1599 - 250,
  );
  await cmd('order.status', { id: o.id, status: 'cancelada' });
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    before,
  );
});

test('bills: pay posts to cash once, reversal reopens the bill', async () => {
  const before = (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount;
  const b = await cmd('bill.save', {
    description: 'Aluguel',
    direction: 'pagar',
    amount: 150000,
    due_date: '2026-10-05',
    category: 'Aluguel',
  });
  await cmd('bill.pay', { id: b.id, payment: 'Pix' });
  await assert.rejects(cmd('bill.pay', { id: b.id }), /não está em aberto/);
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    before - 150000,
  );
  const bill = await scalar(`select status, cash_id from public.z_bills where id='${b.id}'`);
  assert.equal(bill.status, 'paga');
  await cmd('cash.reverse', { id: bill.cash_id });
  assert.equal(
    (await scalar(`select status from public.z_bills where id='${b.id}'`)).status,
    'aberta',
  );
  assert.equal(
    (await scalar('select sum(amount)::integer as amount from public.z_cash')).amount,
    before,
  );
  await cmd('bill.cancel', { id: b.id });
  await assert.rejects(cmd('bill.cancel', { id: b.id }), /não está em aberto/);
});
