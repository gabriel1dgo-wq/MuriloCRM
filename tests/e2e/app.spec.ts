import { test, expect, type Page } from '@playwright/test';
async function enter(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Gabriel\./ })).toBeVisible();
}
async function nav(page: Page, name: string) {
  if (await page.getByRole('button', { name: 'Abrir navegação' }).isVisible())
    await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: new RegExp(`^${name}( \\(|$)`) })
    .click();
}
test('desktop navigation and screenshots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  for (const [label, title] of [
    ['Estoque', 'Cada peça na caixa certa.'],
    ['Sucatas', 'Da sucata ao lucro.'],
    ['Vendas', 'Três balcões, um só caixa.'],
    ['Oficina', 'Cada serviço registrado e assinado.'],
    ['Financeiro', 'O dinheiro da operação, em movimento.'],
    ['Clientes e fornecedores', 'Clientes e fornecedores.'],
    ['Configurações', 'A cara da sua operação.'],
  ]) {
    await nav(page, label);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.screenshot({
      path: `test-results/${label.split(' ')[0].toLowerCase()}-desktop.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test('warehouse: new part goes into a box, search lights it up', async ({ page }) => {
  await enter(page);
  await nav(page, 'Estoque');
  await page.getByRole('button', { name: 'Nova peça' }).click();
  await page.getByLabel('Código', { exact: true }).fill('TEST-001');
  await page.getByLabel('Nome da peça').fill('Sensor teste E2E');
  await page
    .getByLabel('Caixa (endereço)')
    .selectOption({ label: 'A-03 · N2 · Módulos e sensores' });
  await page.getByLabel('Quantidade inicial').fill('3');
  await page.getByLabel('Preço de venda (R$)').fill('15.99');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Buscar peça, código, OEM, aplicação ou caixa...').fill('teste E2E');
  const box = page.getByRole('button', { name: /^Caixa A-03/ });
  await expect(box).toHaveClass(/lit/);
  await box.click();
  await expect(page.getByRole('button', { name: 'Sensor teste E2E', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar 1 unidade de Sensor teste E2E' }).click();
  await expect(page.getByLabel('Quantidade de Sensor teste E2E')).toContainText('4');
});
test('sale on Mercado Livre posts fee and cancellation restores stock', async ({ page }) => {
  await enter(page);
  await nav(page, 'Vendas');
  await page.getByRole('button', { name: 'Nova venda', exact: true }).click();
  await page.locator('label.channel-option', { hasText: 'Mercado Livre' }).click();
  await page.getByLabel('Nome do cliente').fill('Comprador E2E');
  await page.getByLabel('Peça para adicionar').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar venda recebida' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Comprador E2E', exact: true }) });
  await expect(row).toContainText('Mercado Livre');
  await expect(row).toContainText('líq.');
  await row.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(row).toContainText('Cancelada');
  await nav(page, 'Financeiro');
  await expect(
    page.getByText('Estorno · Taxa Mercado Livre · Comprador E2E').first(),
  ).toBeVisible();
});
test('work order with services, signature, delivery into cash', async ({ page }) => {
  await enter(page);
  await nav(page, 'Oficina');
  await page.getByRole('button', { name: 'Nova ordem de serviço' }).click();
  await page.getByLabel('Nome do cliente').fill('Oficina E2E');
  await page.getByLabel('Veículo', { exact: true }).fill('Fiat Uno 1.0 2010');
  await page.getByLabel('Placa', { exact: true }).fill('abc1d23');
  await page.getByLabel('Serviço 1', { exact: true }).fill('Troca de óleo');
  await page.getByLabel('Como foi feito 1').fill('Drenado e reabastecido com 5W30');
  await page.getByLabel('Valor do serviço 1').fill('150');
  await page.getByRole('button', { name: 'Adicionar serviço' }).click();
  await page.getByLabel('Serviço 2', { exact: true }).fill('Filtro de ar');
  await page.getByLabel('Valor do serviço 2').fill('25');
  await page.getByRole('button', { name: 'Abrir ordem de serviço' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Abrir OS-\d+ de Oficina E2E/ }).click();
  await expect(page.getByText('Total R$ 175,00')).toBeVisible();
  await page.getByRole('button', { name: 'Coletar assinatura' }).click();
  const pad = page.getByLabel('Área para assinatura com o dedo, caneta ou mouse');
  const b = (await pad.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + 100);
  await page.mouse.down();
  await page.mouse.move(b.x + 160, b.y + 60, { steps: 8 });
  await page.mouse.move(b.x + 260, b.y + 120, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Salvar assinatura' }).click();
  await expect(page.getByRole('button', { name: 'Assinar de novo' })).toBeVisible();
  await page.keyboard.press('Escape');
  const card = page.locator('.os-card', { hasText: 'Oficina E2E' });
  await card.getByLabel(/Mover OS-\d+ para outra etapa/).selectOption('entregue');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await nav(page, 'Financeiro');
  await expect(page.getByText(/Oficina · OS \d+ · Oficina E2E/).first()).toBeVisible();
});
test('manual cash entry and reversal', async ({ page }) => {
  await enter(page);
  await nav(page, 'Financeiro');
  await page.getByRole('button', { name: 'Entrada', exact: true }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Aporte E2E');
  await page.getByLabel('Valor (R$)').fill('25.50');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await page.getByRole('button', { name: 'Estornar Aporte E2E' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Estorno · Aporte E2E', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  await nav(page, 'Financeiro');
  await expect(page.getByText('Estorno · Aporte E2E', { exact: true })).toBeVisible();
});
test('mobile navigation, modal layout and screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Explorar demonstração' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await nav(page, 'Estoque');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Nova peça' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.width).toBeLessThan(390);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.screenshot({ path: 'test-results/stock-mobile.png', fullPage: true });
});
test('server exposes only public config and protects static files', async ({ request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe('ok');
  const cfg = await request.get('/config.json');
  expect(Object.keys(await cfg.json()).sort()).toEqual([
    'demoEnabled',
    'supabaseKey',
    'supabaseUrl',
  ]);
  expect((await request.get('/.env')).status()).toBe(404);
  expect((await request.get('/server/index.mjs')).status()).toBe(404);
  expect((await request.post('/healthz')).status()).toBe(405);
  expect(health.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});
