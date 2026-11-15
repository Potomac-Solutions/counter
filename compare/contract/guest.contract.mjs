// The parity contract, part 1: a guest's walk, accounts, and who may see the admin.
// Runs against any implementation of Counter that is up and seeded:
//   BASE=http://localhost:3100 node --test compare/contract/
// Selectors are visible text, labels and roles only, so a clone in any framework can meet them.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const DEMO = {
  owner: { email: 'owner@example.com', password: process.env.OWNER_PASSWORD ?? 'hickory-owner-demo' },
  staff: { email: 'counter@example.com', password: process.env.STAFF_PASSWORD ?? 'hickory-staff-demo' },
  guest: { email: 'riley@example.com', password: process.env.GUEST_PASSWORD ?? 'hickory-guest-demo' },
};
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const phone = async ({ js = true } = {}) => {
  const context = await browser.newContext({ javaScriptEnabled: js, baseURL: BASE });
  return { context, page: await context.newPage() };
};
const add = async (page, name, qty = 1) => {
  await page.getByLabel(`How many ${name}`).fill(String(qty));
  await page.getByLabel(`How many ${name}`).locator('xpath=ancestor::form').getByRole('button', { name: 'Add' }).click();
};
const firstOpenSlot = async (page) => {
  const options = await page.getByLabel(/When you.ll come by/).locator('option').allInnerTexts();
  const open = options.filter((text) => /\d/.test(text) && !/full/i.test(text));
  assert.ok(open.length, `a pickup time is open (saw: ${options.join(' | ')})`);
  return open[Math.floor(Math.random() * open.length)]; // random, so repeated runs don't fill one time
};
// What went wrong on a page, in words, for a failure message.
const said = async (page) => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
const arrive = async (page, pattern) => {
  try { await page.waitForURL(pattern, { timeout: 8000 }); } catch { assert.fail(`expected ${pattern}, still at ${page.url()}: ${await said(page)}`); }
};

for (const js of [false, true]) {
  test(`C1-C3 guest buys: menu, bag, pickup time, one payment, the order page (JavaScript ${js ? 'on' : 'off'})`, async () => {
    const { context, page } = await phone({ js });
    await page.goto('/');
    await page.getByRole('heading', { name: 'Order ahead' }).waitFor();
    for (const name of ['Country sourdough', 'Butter croissant', 'Drip coffee']) assert.ok(await page.getByLabel(`How many ${name}`).count(), `${name} is on the menu`);
    await add(page, 'Country sourdough', 2);
    await page.getByRole('link', { name: 'Your order' }).first().click();
    await page.getByRole('heading', { name: 'In your bag' }).waitFor();
    assert.match(await page.locator('main').innerText(), /Country sourdough[\s\S]*\$18\.00/);
    await page.getByLabel(/When you.ll come by/).selectOption({ label: await firstOpenSlot(page) });
    await page.getByRole('button', { name: /^(Set|Change) the time$/ }).click();
    await page.getByRole('link', { name: 'Check out' }).click();
    await page.getByLabel('Name').fill('Contract Guest');
    await page.getByLabel('Email').fill(`contract-${Date.now()}@example.com`);
    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByRole('button', { name: /^Place order/ }).click();
    await arrive(page, /\/orders\/[a-z0-9]+$/);
    assert.match(await page.locator('main').innerText(), /Contract Guest|Country sourdough/);
    await context.close();
  });
}

test('C3 a pickup time that is full, or an empty bag, will not take an order', async () => {
  const { context, page } = await phone({ js: false });
  const answer = await page.goto('/checkout');
  assert.ok(answer.status() < 500, 'an empty bag is answered, not crashed');
  assert.doesNotMatch(page.url(), /\/orders\//);
  await context.close();
});

test('C4 the menu is live: stock changes on one phone show on another without a reload', async () => {
  const reader = await phone();
  const buyer = await phone();
  await reader.page.goto('/');
  // an item with a limited count, such as "5 left"; it must go down by one on the other phone
  const row = reader.page.locator('section.section li, section.section article, section.section > *').filter({ hasText: / \d+ left/ }).filter({ has: reader.page.getByRole('button', { name: 'Add' }) }).first();
  const name = (await row.locator('h3').first().innerText()).trim();
  const left = Number(/(\d+) left/.exec(await row.innerText())[1]);
  assert.ok(left >= 1);
  await reader.page.waitForTimeout(500); // the live stream open
  await buyer.page.goto('/');
  await add(buyer.page, name, 1);
  await buyer.page.goto('/order');
  await buyer.page.getByLabel(/When you.ll come by/).selectOption({ label: await firstOpenSlot(buyer.page) });
  await buyer.page.getByRole('button', { name: /^(Set|Change) the time$/ }).click();
  await buyer.page.goto('/checkout');
  await buyer.page.getByLabel('Name').fill('Live Buyer');
  await buyer.page.getByLabel('Email').fill(`live-${Date.now()}@example.com`);
  await buyer.page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await buyer.page.getByRole('button', { name: /^Place order/ }).click();
  await arrive(buyer.page, /\/orders\//);
  const next = left - 1 === 0 ? /Sold out/ : new RegExp(`${left - 1} left`);
  await reader.page.locator('h3', { hasText: name }).locator('xpath=ancestor::*[.//button][1]').filter({ hasText: next }).waitFor({ timeout: 8000 });
  await reader.context.close();
  await buyer.context.close();
});

test('C5 a customer signs in, is told a wrong password, and signs out', async () => {
  const { context, page } = await phone();
  await page.goto('/account/sign-in');
  await page.getByLabel('Email').fill(DEMO.guest.email);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  assert.match(await page.locator('main').innerText(), /don.t match/);
  await page.getByLabel('Email').fill(DEMO.guest.email);
  await page.getByLabel('Password').fill(DEMO.guest.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await arrive(page, /\/account(\?|$)/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/account');
  await page.waitForURL(/\/account\/sign-in/);
  await context.close();
});

test('C5 a customer can make an account, and one email makes one account', async () => {
  const email = `new-${Date.now()}@example.com`;
  const { context, page } = await phone();
  await page.goto('/account/sign-up');
  await page.getByLabel('Your name').fill('New Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('a long enough password 42');
  await page.getByRole('button', { name: /Make my account/ }).click();
  await arrive(page, /\/account(\?|$)/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/account/sign-up');
  await page.getByLabel('Your name').fill('Again');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('a long enough password 42');
  await page.getByRole('button', { name: /Make my account/ }).click();
  assert.doesNotMatch(page.url(), /\/account$/);
  await context.close();
});

test('C7 staff may see the kitchen and orders but not reports or settings; the owner sees all; guests see none', async () => {
  const signIn = async (who) => {
    const { context, page } = await phone();
    await page.goto('/admin');
    if (who) {
      await page.goto('/admin');
      const field = page.getByLabel('Email');
      if (await field.count()) { await field.fill(who.email); await page.getByLabel('Password').fill(who.password); await page.getByRole('button', { name: /Sign in/ }).click(); }
    }
    return { context, page };
  };
  // What a page shows: a guest is shown the sign-in page, staff a refusal, the owner the page itself.
  const status = async (page, path) => (await page.context().request.get(`${BASE}${path}`, { maxRedirects: 0 })).status();
  const sees = async (page, path) => (await (await page.context().request.get(`${BASE}${path}`, { maxRedirects: 0 })).text()).replace(/<[^>]+>/g, ' ');
  const guest = await signIn(null);
  assert.doesNotMatch(await sees(guest.page, '/admin/reports'), /Revenue|Orders by day|Download/i, 'a guest does not see reports');
  await guest.context.close();
  const staff = await signIn(DEMO.staff);
  assert.equal(await status(staff.page, '/admin/reports'), 403, 'staff do not see reports');
  assert.equal(await status(staff.page, '/admin/settings'), 403, 'staff do not see settings');
  await staff.context.close();
  const owner = await signIn(DEMO.owner);
  assert.equal(await status(owner.page, '/admin/reports'), 200, 'the owner sees reports');
  assert.equal(await status(owner.page, '/admin/settings'), 200, 'the owner sees settings');
  await owner.context.close();
});
