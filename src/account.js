// A customer's account pages: sign in, sign up, a forgotten password, and their own page.
import { escape } from './layout.js';
import { timeLabel } from './counter.js';

export const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
const badge = (status, words) => `<span class="badge ${status}">${escape(words)}</span>`;

export function signIn({ problem = '', email = '' } = {}) {
  return `<section><h1>Sign in</h1><p class="lede">See your orders on any device. No account? <a href="/account/sign-up">Make one</a>.</p></section>
${problem}
<form class="panel" method="post" action="/account/sign-in">
  <label>Email<input name="email" type="email" autocomplete="email" required value="${escape(email)}"></label>
  <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
  <p><a href="/account/forgot">Forgot your password?</a></p>
</form>`;
}

export function signUp({ problem = '', form = null } = {}) {
  return `<section><h1>Make an account</h1><p class="lede">Your orders follow you to any device, and checkout fills in your name. Orders from this browser join your account.</p></section>
${problem}
<form class="panel" method="post" action="/account/sign-up">
  <label>Your name<input name="name" autocomplete="name" required maxlength="80" value="${escape(form?.get('name') ?? '')}"></label>
  <label>Email<input name="email" type="email" autocomplete="email" required value="${escape(form?.get('email') ?? '')}"></label>
  <label>Password (at least 10 characters)<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
  <button type="submit">Make my account</button>
  <p>Already have one? <a href="/account/sign-in">Sign in</a>.</p>
</form>`;
}

export function forgot({ sent = false } = {}) {
  return `<section><h1>Reset your password</h1><p class="lede">We’ll email a link that works once, for an hour.</p></section>
${sent ? '<p class="ok" role="status">If there’s an account with that email, a link is on its way.</p>' : ''}
<form class="panel" method="post" action="/account/forgot">
  <label>Email<input name="email" type="email" autocomplete="email" required></label>
  <button type="submit">Send the link</button>
</form>`;
}

export function reset({ token, problem = '', works = true }) {
  if (!works) return `<section><h1>That link has expired</h1><p class="lede">It may have been used already. <a href="/account/forgot">Ask for a new one</a>.</p></section>`;
  return `<section><h1>Choose a new password</h1></section>
${problem}
<form class="panel" method="post" action="/account/reset">
  <input type="hidden" name="token" value="${escape(token)}">
  <label>New password (at least 10 characters)<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
  <button type="submit">Save and sign in</button>
</form>`;
}

/** The customer's own page: orders, coming and past; their details. */
export function account({ counter, guest, customer, said }) {
  const orders = counter.ordersFor(guest).slice().reverse();
  const open = orders.filter((order) => order.status !== 'picked-up');
  const past = orders.filter((order) => order.status === 'picked-up');
  const spent = orders.reduce((sum, order) => sum + order.cents, 0);
  const when = (order) => `${new Date(`${order.slot.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}, ${timeLabel(order.slot)}`;
  const rows = (list) =>
    `<div class="table-wrap"><table><thead><tr><th scope="col">Pickup</th><th scope="col">What</th><th scope="col">Status</th><th scope="col" class="num">Paid</th></tr></thead><tbody>${list
      .map((order) => `<tr><td><a href="/orders/${order.key}">${escape(when(order))}</a></td><td>${order.lines.map((line) => `${line.qty} × ${escape(line.name)}`).join(', ')}</td><td>${badge(order.status === 'picked-up' ? 'past' : 'booked', order.status.replace('-', ' '))}</td><td class="num">${money(order.cents)}</td></tr>`)
      .join('')}</tbody></table></div>`;
  return `<section><h1>Hello, ${escape(customer.name.split(' ')[0])}</h1><p class="lede">${orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'} with us, ${money(spent)} in all.` : 'No orders yet.'} <a href="/#menu">Order ahead</a>.</p></section>
${said}
${open.length ? `<section class="panel"><h2>On its way</h2>${rows(open)}</section>` : ''}
<section class="panel"><h2>Past orders</h2>${past.length ? rows(past.slice(0, 25)) : '<p>None yet.</p>'}</section>
<section class="two">
  <form class="panel" method="post" action="/account/profile"><h2>Your details</h2><label>Name<input name="name" autocomplete="name" required maxlength="80" value="${escape(customer.name)}"></label><p class="muted">Email: ${escape(customer.email)}</p><button type="submit">Save</button></form>
  <div class="panel"><h2>Signing in</h2><p><a href="/account/forgot">Change your password</a> by email.</p><form method="post" action="/account/sign-out"><button class="button light" type="submit">Sign out</button></form></div>
</section>`;
}
