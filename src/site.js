// The landing page: what a guest sees at `/`. It sells the way a good restaurant's page does:
// a full-screen photograph, a few words, and "Order now" never more than a thumb away. Then the
// thing other restaurants send you elsewhere for: the menu itself, with a photograph of
// everything and what's left of it, live, to order right here.
//
// The words are in src/shop.js (`site`); the photographs are files in public/photos/.
import { escape, art } from './layout.js';
import { photo } from './assets.js';
import { site } from './shop.js';

/** Fill `{lead}`, `{slot}` and `{perSlot}` from the shop's own numbers. */
const fill = (shop) => (words) => escape(String(words).replace(/\{(\w+)\}/g, (_, name) => ({ lead: shop.leadMinutes, slot: shop.slotMinutes, perSlot: shop.perSlot })[name] ?? ''));
const picture = (name, alt, { eager = false, cls = '' } = {}) => (photo(name) ? `<img${cls ? ` class="${cls}"` : ''} src="${photo(name)}" alt="${escape(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">` : '');

/**
 * `p` is the Zubra page (it renders the components). `menu` is `counter.menu()`, `next` the first
 * pickup time with room (`{ label, day }`) or null, `mine` the guest's open orders with their
 * pickup words, `today` the kitchen's note, `problem` a signed message to show.
 */
export function landing(p, { shop, menu, next, mine = [], today, account = null, problem = '' }) {
  const say = fill(shop);
  const { hero, carryout, menu: words, steps, story, visit } = site;
  const tel = `tel:+1${shop.phone.replace(/\D/g, '')}`;
  const order = (cls = 'go lg') => `<a class="${cls}" href="#menu">${escape(site.order)}</a>`;
  const pickup = next ? `Next pickup ${escape(next.day)} at ${escape(next.label)}` : 'Every pickup time is taken for now';

  return `<section class="hero">${picture('hero', '', { eager: true, cls: 'bg' })}
  <div class="wrap hero-words">
    <p class="kicker">${escape(hero.kicker)}</p>
    <h1>${escape(hero.title)} <em>${escape(hero.titleSoft)}</em></h1>
    <p class="lede">${escape(hero.lede)}</p>
    <div class="actions">${order()}<a class="button ghost lg" href="#visit">${escape(hero.secondary)}</a></div>
  </div>
  <div class="hero-strip"><div class="wrap"><p class="live"><span class="dot"></span>${pickup}</p><p>${escape(shop.hours)}</p><p><a href="${tel}">${escape(shop.phone)}</a></p></div></div>
</section>
${mine.length ? `<div class="wrap mine"><section class="panel"><h2>Your orders</h2><ul>${mine.map((order) => `<li><a href="/orders/${order.key}">Pickup ${escape(order.when)} <span>${escape(order.status.replace('-', ' '))}</span></a></li>`).join('')}</ul></section></div>` : ''}
<div class="wrap said">${problem ? `<p class="notice" role="alert">${escape(problem)}</p>` : ''}${p.render('kitchen-note', { note: 'today', textNow: today.text, atNow: today.at, atLabel: today.at ? new Date(today.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: shop.timeZone }) : '', timeZone: shop.timeZone })}</div>

<section class="split"><div class="wrap">
  <div class="pic">${picture('window', 'A paper bag and a coffee waiting on the sill of the side window')}</div>
  <div class="words"><p class="kicker">${escape(carryout.kicker)}</p><h2>${escape(carryout.heading)}</h2><p>${escape(carryout.text)}</p><a class="go lg" href="#menu">${escape(carryout.button)}</a></div>
</div></section>

<div class="sec menu" id="menu"><div class="wrap">
  <header class="head center"><p class="kicker">${escape(words.kicker)}</p><h2 class="big">${escape(words.heading)}</h2><p>${escape(words.lede)} ${pickup}.</p></header>
  <div class="menu-sections">${menu
    .map(({ section, items: list }) => `<section class="section" aria-labelledby="s-${escape(section.toLowerCase())}"><div class="label"><h2 id="s-${escape(section.toLowerCase())}">${escape(section)}</h2><p>${escape(words.sections[section] ?? '')}</p></div><div class="items">${list.map((item) => `<div id="item-${escape(item.key)}">${p.render('menu-item', { item: item.key, name: item.name, unit: item.unit, cents: item.cents, leftNow: item.left, add: '/cart/add', about: site.about[item.key] ?? '', photo: photo(item.key) })}</div>`).join('')}</div></section>`)
    .join('')}</div>
</div></div>

<section class="banner" id="story">${picture('bakers', '', { cls: 'bg' })}<div class="wrap"><p class="kicker">${escape(story.kicker)}</p><h2>${escape(story.heading)}</h2>${story.paragraphs.map((text) => `<p>${escape(text)}</p>`).join('')}${order()}</div></section>

<div class="sec how" id="how"><div class="wrap">
  <h2 class="big">${escape(steps.heading)}</h2>
  <ol class="steps">${steps.list.map(([title, text]) => `<li><h3>${say(title)}</h3><p>${say(text)}</p></li>`).join('')}</ol>
</div></div>

<div class="sec dark" id="visit"><div class="wrap">
  <header class="head"><p class="kicker">${escape(visit.kicker)}</p><h2 class="big">${escape(visit.heading)}</h2></header>
  <div class="visit">
    <div>${art.clock}<h3>Hours</h3><p><strong>${escape(shop.hours)}</strong></p><p>${pickup}.</p></div>
    <div>${art.window}<h3>The side window</h3><p><strong>${escape(shop.town)}</strong></p><p>${escape(visit.where)}</p></div>
    <div>${art.phone}<h3>${escape(visit.call)}</h3><p><a class="tel" href="${tel}">${escape(shop.phone)}</a></p><p>${account ? '<a href="/account">Your orders</a> are in your account.' : 'Order often? <a href="/account/sign-up">Make an account</a>.'}</p></div>
  </div>
  <p class="visit-cta">${order()}</p>
</div></div>`;
}
