// The slice's contract: what every implementation must do before it is measured.
//   BASE=http://localhost:3101 CONTROL=3199 node --test compare/slice/contract/
// CONTROL is the shared kitchen port (SLICE_CONTROL_PORT) the implementation was started with.
// Start each implementation on a fresh database (SLICE_DB unset is in memory).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3101';
const CONTROL = process.env.CONTROL ?? '3199';
let browser;
before(async () => {
  browser = await chromium.launch();
  // One page first: a build may make its slice (and open the kitchen port) on its first request.
  assert.equal((await fetch(`${BASE}/`)).status, 200, `${BASE} answers`);
});
after(async () => { await browser.close(); });

const phone = async ({ js = true } = {}) => {
  const context = await browser.newContext({ javaScriptEnabled: js, baseURL: BASE });
  return { context, page: await context.newPage() };
};
const stock = async (item, left) => {
  const res = await fetch(`http://127.0.0.1:${CONTROL}/stock?item=${item}&left=${left}`, { method: 'POST' });
  assert.equal(res.status, 200, `the kitchen set ${item} to ${left}`);
};
const row = (page, name) => page.locator('li.item', { has: page.getByRole('heading', { name, exact: true }) });
const add = async (page, name, qty = 1) => {
  await page.getByLabel(`How many ${name}`).fill(String(qty));
  await row(page, name).getByRole('button', { name: 'Add' }).click();
};
const text = async (page) => (await page.locator('main').innerText()).replace(/\s+/g, ' ');

test('S1 the menu shows every section and item, with what is left', async () => {
  const { context, page } = await phone({ js: false });
  await stock('sourdough', 12);
  await page.goto('/');
  await page.getByRole('heading', { name: 'Order ahead', level: 1 }).waitFor();
  for (const section of ['Bread', 'Pastry', 'Coffee']) await page.getByRole('heading', { name: section, level: 2 }).waitFor();
  assert.equal(await page.locator('li.item').count(), 8);
  assert.match(await row(page, 'Country sourdough').innerText(), /\$9\.00[\s\S]*loaf[\s\S]*12 left/);
  assert.doesNotMatch(await row(page, 'Drip coffee').innerText(), /left|Sold out/);
  await context.close();
});

for (const js of [false, true]) {
  test(`S2-S4 add, change, remove and pick a time (JavaScript ${js ? 'on' : 'off'})`, async () => {
    const { context, page } = await phone({ js });
    await page.goto('/');
    await add(page, 'Country sourdough', 2);
    await page.locator('.notice', { hasText: 'Added to your order.' }).waitFor();
    await add(page, 'Butter croissant', 1);
    await page.locator('.notice', { hasText: 'Added to your order.' }).waitFor();
    await page.getByRole('link', { name: /Your order/ }).click();
    await page.getByRole('heading', { name: 'In your bag' }).waitFor();
    assert.match(await text(page), /Country sourdough.*\$18\.00/);
    assert.match(await text(page), /Total \$22\.25/);
    const line = page.locator('li.line', { hasText: 'Country sourdough' });
    await line.getByRole('button', { name: '+' }).click();
    await page.locator('main', { hasText: 'Total $31.25' }).waitFor();
    await page.locator('li.line', { hasText: 'Country sourdough' }).getByRole('button', { name: '−' }).click();
    await page.locator('main', { hasText: 'Total $22.25' }).waitFor();
    await page.locator('li.line', { hasText: 'Butter croissant' }).getByRole('button', { name: 'Remove' }).click();
    await page.locator('main', { hasText: 'Total $18.00' }).waitFor();
    assert.equal(await page.locator('li.line').count(), 1);
    const options = await page.getByLabel('When you’ll come by').locator('option:not([disabled])').allInnerTexts();
    const open = options.filter((o) => /\d/.test(o));
    const pick = open[Math.floor(Math.random() * open.length)];
    await page.getByLabel('When you’ll come by').selectOption({ label: pick });
    await page.getByRole('button', { name: 'Set the time' }).click();
    await page.locator('main', { hasText: `Pickup: ${pick.replace(/^(today|tomorrow) /, '$1 at ')}` }).waitFor();
    await page.reload();
    assert.equal(await page.getByLabel('When you’ll come by').evaluate((select) => select.selectedOptions[0].textContent.trim()), pick);
    await context.close();
  });
}

test('S5 an empty bag says so', async () => {
  const { context, page } = await phone({ js: false });
  await page.goto('/order');
  assert.match(await text(page), /Your bag is empty\./);
  await context.close();
});

test('S5 a sold-out item can\'t be added, even from a page opened before it sold out', async () => {
  await stock('rye', 3);
  const { context, page } = await phone({ js: false });
  await page.goto('/');
  await stock('rye', 0);
  await add(page, 'Seeded rye', 1);
  await page.locator('.notice.problem', { hasText: 'Sold out.' }).waitFor();
  assert.ok(await row(page, 'Seeded rye').getByRole('button', { name: 'Add' }).isDisabled());
  await page.goto('/order');
  assert.match(await text(page), /Your bag is empty\./);
  await context.close();
  await stock('rye', 6);
});

test('S6 the menu is live: the kitchen\'s stock shows on an open page without a reload', async () => {
  await stock('apple-hand-pie', 4);
  const { context, page } = await phone();
  await page.goto('/');
  await row(page, 'Apple hand pie').filter({ hasText: '4 left' }).waitFor();
  await page.waitForTimeout(500); // the live connection open
  await stock('apple-hand-pie', 2);
  await row(page, 'Apple hand pie').filter({ hasText: '2 left' }).waitFor({ timeout: 5000 });
  await stock('apple-hand-pie', 0);
  await row(page, 'Apple hand pie').filter({ hasText: 'Sold out' }).waitFor({ timeout: 5000 });
  assert.ok(await row(page, 'Apple hand pie').getByRole('button', { name: 'Add' }).isDisabled());
  await stock('apple-hand-pie', 4);
  await row(page, 'Apple hand pie').filter({ hasText: '4 left' }).waitFor({ timeout: 5000 });
  assert.ok(await row(page, 'Apple hand pie').getByRole('button', { name: 'Add' }).isEnabled());
  await context.close();
});
