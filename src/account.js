// A customer's account pages: sign in, sign up, a forgotten password, and their own page.
import { escape } from './layout.js';
import { timeLabel } from './counter.js';

export const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
const badge = (status, words) => `<span class="badge ${status}">${escape(words)}</span>`;

export function signIn({ problem = '', email = '' } = {}) {
  return `<div class="auth">
<section class="page-head"><h1>Sign in</h1><p class="lede">See your orders on any device, and skip typing your name at checkout.</p></section>
${problem}
<form class="panel" method="post" action="/account/sign-in">
  <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required value="${escape(email)}"></label>
  <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
  <p class="alt"><a href="/account/forgot">Forgot your password?</a></p>
</form>
<p class="alt">New here? <a href="/account/sign-up">Make an account</a>, or <a href="/#menu">order as a guest</a>.</p>
</div>`;
}

export function signUp({ problem = '', form = null } = {}) {
  return `<div class="auth">
<section class="page-head"><h1>Make an account</h1><p class="lede">Your orders follow you to any device, and checkout fills in your name. Orders from this browser join your account.</p></section>
${problem}
<form class="panel" method="post" action="/account/sign-up">
  <label>Your name<input name="name" autocomplete="name" required maxlength="80" value="${escape(form?.get('name') ?? '')}"></label>
  <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required value="${escape(form?.get('email') ?? '')}"></label>
  <label>Password<span class="hint">At least 10 characters. A few words run together is fine.</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
  <button type="submit">Make my account</button>
</form>
<p class="alt">Already have one? <a href="/account/sign-in">Sign in</a>. You can also <a href="/#menu">order as a guest</a>.</p>
</div>`;
}

export function forgot({ sent = false } = {}) {
  return `<div class="auth">
<section class="page-head"><h1>Reset your password</h1><p class="lede">We’ll email a link that works once, for an hour.</p></section>
${sent ? '<p class="ok" role="status">If there’s an account with that email, a link is on its way.</p>' : ''}
<form class="panel" method="post" action="/account/forgot">
  <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required></label>
  <button type="submit">Send the link</button>
</form>
<p class="alt"><a href="/account/sign-in">Back to sign in</a></p>
</div>`;
}

export function reset({ token, problem = '', works = true }) {
  if (!works) return `<div class="auth"><section class="page-head"><h1>That link has expired</h1><p class="lede">It may have been used already, or be more than an hour old.</p></section><a class="go" href="/account/forgot">Ask for a new one</a></div>`;
  return `<div class="auth">
<section class="page-head"><h1>Choose a new password</h1></section>
${problem}
<form class="panel" method="post" action="/account/reset">
  <input type="hidden" name="token" value="${escape(token)}">
  <label>New password<span class="hint">At least 10 characters.</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
  <button type="submit">Save and sign in</button>
</form>
</div>`;
}

const STATE = { placed: 'Placed', making: 'Being made', ready: 'Ready at the window', 'picked-up': 'Picked up' };

/** The customer's own page: what's on its way first, then what's been; their details. */
export function account({ counter, guest, customer, said }) {
  const orders = counter.ordersFor(guest).slice().reverse();
  const open = orders.filter((order) => order.status !== 'picked-up').reverse();
  const past = orders.filter((order) => order.status === 'picked-up');
  const spent = orders.reduce((sum, order) => sum + order.cents, 0);
  const when = (order) => `${new Date(`${order.slot.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}, ${timeLabel(order.slot)}`;
  // What they order most, by how many: a small thing that shows the account knows them.
  const counts = new Map();
  for (const line of orders.flatMap((order) => order.lines)) counts.set(line.name, (counts.get(line.name) ?? 0) + line.qty);
  const usual = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const rows = (list) =>
    `<ul class="olist">${list
      .map((order) => `<li><a href="/orders/${order.key}"><span class="when">${escape(when(order))}</span><span class="paid">${money(order.cents)}</span><span class="what">${order.lines.map((line) => `${line.qty} × ${escape(line.name)}`).join(', ')}</span><span class="state">${badge(order.status === 'picked-up' ? 'past' : 'booked', STATE[order.status] ?? order.status)}</span></a></li>`)
      .join('')}</ul>`;
  return `<section class="page-head"><h1>Hello, ${escape(customer.name.split(' ')[0])}</h1><p class="lede">${open.length ? `You have ${open.length === 1 ? 'an order' : `${open.length} orders`} on the way.` : 'Nothing on the way right now.'}</p></section>
${said}
${open.length ? `<section class="panel live-orders"><h2>On its way</h2>${rows(open)}</section>` : `<section class="panel empty-bag"><h2>Hungry?</h2><p>Today’s menu shows what’s left, live.</p><a class="go" href="/#menu">Order ahead</a></section>`}
${orders.length ? `<ul class="figures"><li><strong>${orders.length}</strong><span>order${orders.length === 1 ? '' : 's'} with us</span></li><li><strong>${money(spent)}</strong><span>in all</span></li>${usual ? `<li><strong>${escape(usual)}</strong><span>your usual</span></li>` : ''}</ul>` : ''}
<section class="panel"><h2>Past orders</h2>${past.length ? `${rows(past.slice(0, 25))}${past.length > 25 ? `<p class="muted">Your last 25 of ${past.length}.</p>` : ''}` : '<p class="muted">None yet. Your first one will show here once it’s picked up.</p>'}</section>
<section class="two">
  <form class="panel" method="post" action="/account/profile"><h2>Your details</h2><label>Name<input name="name" autocomplete="name" required maxlength="80" value="${escape(customer.name)}"></label><p class="muted">Email: ${escape(customer.email)}</p><button type="submit">Save</button></form>
  <div class="panel"><h2>Signing in</h2><p><a href="/account/forgot">Change your password</a> by email.</p><form method="post" action="/account/sign-out"><button class="button light" type="submit">Sign out</button></form></div>
</section>`;
}
