// The landing page: what a guest sees at `/`. The words are in src/shop.js (`site`); this file
// only lays them out around the live parts: the shelf board, today's note and the menu.
import { escape, art } from './layout.js';
import { site } from './shop.js';

/** Fill `{lead}`, `{slot}` and `{perSlot}` from the shop's own numbers. */
const fill = (shop) => (words) => escape(String(words).replace(/\{(\w+)\}/g, (_, name) => ({ lead: shop.leadMinutes, slot: shop.slotMinutes, perSlot: shop.perSlot })[name] ?? ''));

/**
 * `p` is the Zubra page (it renders the components). `menu` is `counter.menu()`, `next` the first
 * pickup time with room (`{ label, day }`) or null, `mine` the guest's open orders with their
 * pickup words, `today` the kitchen's note, `problem` a signed message to show.
 */
export function landing(p, { shop, menu, next, mine = [], today, account = null, problem = '' }) {
  const say = fill(shop);
  const { hero, board, menu: words, steps, story, questions, visit } = site;
  const items = menu.flatMap(({ items: list }) => list);
  // The board leads with what's running low, then what's already gone: what a guest came to check.
  const shelf = items.filter((item) => item.left !== null).sort((a, b) => (a.left === 0) - (b.left === 0) || a.left - b.left).slice(0, 6);
  const tel = `tel:+1${shop.phone.replace(/\D/g, '')}`;

  return `<section class="hero"><div class="wrap hero-grid">
  <div>
    <p class="kicker">${escape(hero.kicker)}</p>
    <h1>${escape(hero.title)} <em>${escape(hero.titleSoft)}</em></h1>
    <p class="lede">${escape(hero.lede)}</p>
    <p class="live"><span class="dot"></span>${next ? `Next pickup <a href="#menu">${escape(next.day)} at ${escape(next.label)}</a>` : 'Every pickup time is taken for now'}</p>
    <div class="actions"><a class="go lg" href="#menu">${escape(hero.primary)}</a><a class="button ghost lg" href="#how">${escape(hero.secondary)}</a></div>
  </div>
  <aside class="board" aria-label="${escape(board.heading)}">
    ${art.shelf}
    <h2>${escape(board.heading)}</h2>
    <p>${escape(shop.hours)}</p>
    <div class="lines">${shelf.map((item) => p.render('shelf-line', { item: item.key, name: item.name, leftNow: item.left, plenty: board.all, none: board.none })).join('')}</div>
    <p class="foot">${escape(board.foot)}</p>
  </aside>
</div></section>
${mine.length ? `<div class="wrap mine"><section class="panel"><h2>Your orders</h2><ul>${mine.map((order) => `<li><a href="/orders/${order.key}">Pickup ${escape(order.when)} <span>${escape(order.status.replace('-', ' '))}</span></a></li>`).join('')}</ul></section></div>` : ''}
<div class="wrap said">${problem ? `<p class="notice" role="alert">${escape(problem)}</p>` : ''}${p.render('kitchen-note', { note: 'today', textNow: today.text, atNow: today.at, atLabel: today.at ? new Date(today.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: shop.timeZone }) : '', timeZone: shop.timeZone })}</div>
<div class="band"><ul class="wrap facts">${site.facts.map(([big, small]) => `<li><strong>${say(big)}</strong><span>${say(small)}</span></li>`).join('')}</ul></div>

<div class="sec" id="menu"><div class="wrap">
  <header class="head"><p class="kicker">${escape(words.kicker)}</p><h2 class="big">${escape(words.heading)}</h2><p>${escape(words.lede)}</p></header>
  <div class="menu-sections">${menu
    .map(({ section, items: list }) => `<section class="section" aria-labelledby="s-${escape(section.toLowerCase())}"><div class="label">${art[section] ?? ''}<h2 id="s-${escape(section.toLowerCase())}">${escape(section)}</h2><p>${escape(words.sections[section] ?? '')}</p></div><div class="items">${list.map((item) => `<div id="item-${escape(item.key)}">${p.render('menu-item', { item: item.key, name: item.name, unit: item.unit, cents: item.cents, leftNow: item.left, add: '/cart/add', about: site.about[item.key] ?? '' })}</div>`).join('')}</div></section>`)
    .join('')}</div>
</div></div>

<div class="sec alt" id="how"><div class="wrap">
  <header class="head"><p class="kicker">${escape(steps.kicker)}</p><h2 class="big">${escape(steps.heading)}</h2></header>
  <ol class="steps">${steps.list.map(([title, text]) => `<li><h3>${say(title)}</h3><p>${say(text)}</p></li>`).join('')}</ol>
</div></div>

<div class="sec dark"><div class="wrap story">
  <div><p class="kicker">${escape(story.kicker)}</p><h2>${escape(story.heading)}</h2>${story.paragraphs.map((text) => `<p>${escape(text)}</p>`).join('')}<p class="sign">${escape(story.sign)}</p></div>
  <div class="pic">${art.front}</div>
</div></div>

<div class="sec"><div class="wrap qa">
  <header class="head"><p class="kicker">${escape(questions.kicker)}</p><h2 class="big">${escape(questions.heading)}</h2></header>
  <div>${questions.list.map(([question, answer]) => `<details><summary>${say(question)}</summary><p>${say(answer)}</p></details>`).join('')}</div>
</div></div>

<div class="sec alt" id="visit"><div class="wrap">
  <header class="head"><p class="kicker">${escape(visit.kicker)}</p><h2 class="big">${escape(visit.heading)}</h2></header>
  <div class="visit">
    <div class="panel">${art.clock}<h3>Hours</h3><p><strong>${escape(shop.hours)}</strong></p><p>${next ? `Next pickup ${escape(next.day)} at ${escape(next.label)}.` : 'Every pickup time is taken for now.'}</p></div>
    <div class="panel">${art.window}<h3>The side window</h3><p><strong>${escape(shop.town)}</strong></p><p>${escape(visit.where)}</p><p>${escape(shop.pickup)}</p></div>
    <div class="panel">${art.phone}<h3>${escape(visit.call)}</h3><p><a class="tel" href="${tel}">${escape(shop.phone)}</a></p><p>${account ? '<a href="/account">Your orders</a> are in your account.' : 'Order often? <a href="/account/sign-up">Make an account</a> and your orders follow you.'}</p></div>
  </div>
</div></div>

<div class="sec closer"><div class="wrap"><h2>${next ? `Ready ${escape(next.day)} at ${escape(next.label)}` : 'Tomorrow’s bake starts at four'}</h2><p>${escape(hero.lede)}</p><a class="go lg" href="#menu">${escape(hero.primary)}</a></div></div>`;
}
