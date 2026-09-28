import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoCommand, seedDemo } from '../src/lib/demo';
import { money, normalizeState } from '../src/lib/types';
const cmd = (action: string, payload: Record<string, unknown>) => ({
  request_id: crypto.randomUUID(),
  action,
  payload,
});
const balance = (s: { cash: { amount: number }[] }) => s.cash.reduce((n, c) => n + c.amount, 0);
test('demo has consistent linked entities and exact currency', () => {
  const s = seedDemo();
  assert.equal(s.parts.length, 15);
  assert.ok(s.orders.some((o) => o.kind === 'venda' && o.channel === 'shopee'));
  assert.ok(s.orders.every((o) => s.contacts.some((c) => c.id === o.contact_id)));
  assert.ok(s.parts.every((p) => s.boxes.some((b) => b.id === p.box_id)));
  assert.ok(s.boxes.every((b) => s.locations.some((l) => l.id === b.location_id)));
  assert.ok(s.scraps.every((x) => x.photos.length === 3));
  assert.match(money(1599), /15,99/);
});
test('failed demo mutation leaves original state unchanged', () => {
  const s = seedDemo();
  const before = JSON.stringify(s);
  assert.throws(
    () => demoCommand(s, cmd('stock.adjust', { id: s.parts[0].id, delta: -999, reason: 'Teste' })),
    /insuficiente/,
  );
  assert.equal(JSON.stringify(s), before);
});
test('demo cancellation reverses a sale, its fee and restores inventory', () => {
  const s = seedDemo();
  const o = s.orders.find((o) => o.kind === 'venda' && o.fee > 0)!;
  const next = demoCommand(s, cmd('order.status', { id: o.id, status: 'cancelada' }));
  assert.equal(balance(next), balance(s) - o.total + o.fee);
  assert.equal(
    next.parts.find((p) => p.id === o.items[0].part_id)!.quantity,
    s.parts.find((p) => p.id === o.items[0].part_id)!.quantity + o.items[0].quantity,
  );
});
test('demo work order sums services and external parts, numbers sequentially', () => {
  const s = seedDemo();
  const last = Math.max(...s.orders.filter((o) => o.kind === 'oficina').map((o) => o.number));
  const next = demoCommand(
    s,
    cmd('order.create', {
      kind: 'oficina',
      customer: 'X',
      payment: 'Pix',
      vehicle: 'Uno',
      discount: 500,
      items: [],
      services: [
        { description: 'A', detail: '', price: 1000 },
        { description: 'B', detail: '', price: 2000 },
      ],
      external_parts: [{ name: 'Óleo', quantity: 2, origin: 'comprada', price: 750, note: '' }],
    }),
  );
  const o = next.orders[0];
  assert.equal(o.number, last + 1);
  assert.equal(o.labor, 3000);
  assert.equal(o.total, 3000 + 1500 - 500);
});
test('demo bills: pay then reverse reopens', () => {
  const s = seedDemo();
  const b = s.bills.find((x) => x.status === 'aberta')!;
  const paid = demoCommand(s, cmd('bill.pay', { id: b.id, payment: 'Pix' }));
  const bill = paid.bills.find((x) => x.id === b.id)!;
  assert.equal(bill.status, 'paga');
  const reopened = demoCommand(paid, cmd('cash.reverse', { id: bill.cash_id }));
  assert.equal(reopened.bills.find((x) => x.id === b.id)!.status, 'aberta');
  assert.equal(balance(reopened), balance(s));
});
test('warehouse rules: boxes need valid level, full boxes cannot be archived', () => {
  const s = seedDemo();
  const loc = s.locations.find((l) => l.code === 'C')!;
  assert.throws(
    () => demoCommand(s, cmd('box.save', { code: 'Z', location_id: loc.id, level: 9 })),
    /nível/,
  );
  const full = s.boxes.find((b) => s.parts.some((p) => p.box_id === b.id && p.quantity > 0))!;
  assert.throws(() => demoCommand(s, cmd('box.save', { ...full, archived: true })), /contém peças/);
});
test('legacy demo state is upgraded', () => {
  const legacy = {
    parts: [{ id: 'p', code: 'x', name: 'y' }],
    orders: [],
    settings: { name: 'L' },
  };
  const s = normalizeState(legacy as never);
  assert.deepEqual(s.parts[0].photos, []);
  assert.equal(s.parts[0].box_id, null);
  assert.equal(s.settings.monthly_goal, 0);
  assert.deepEqual(s.bills, []);
});
