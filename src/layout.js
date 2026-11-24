// The page around the components: the head, the bar across the top, the foot, and the connection
// to the log. The styles are files in public/ (base.css for every page, site.css for the landing
// page, customer.css for the bag, checkout, orders and account); the words come from src/shop.js.
import { CHART_CSS } from '@potomac-solutions/kit/charts';
import { asset, photo, FONT_CSS } from './assets.js';
import { site } from './shop.js';

export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The drawings, as inline SVG: no photos to license, nothing to download, and they take the shop's colours. */
export const art = {
  mark: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1d1a14"/><path d="M12 40c0-11 9-19 20-19s20 8 20 19c0 3-2 5-5 5H17c-3 0-5-2-5-5z" fill="#f5b700"/><path d="M23 29l4 7M31 27l3 8M39 28l3 7" stroke="#1d1a14" stroke-width="3" stroke-linecap="round"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  Bread: '<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 36c0-12 10-20 22-20s22 8 22 20c0 4-3 6-6 6H12c-3 0-6-2-6-6z" fill="rgb(245 183 0 / 0.45)"/><path d="M18 24l5 9M27 21l4 10M36 23l4 9"/></svg>',
  Pastry: '<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 34c2-10 10-18 22-18s20 8 22 18c-4 5-9 2-11-2-3 6-8 8-11 8s-8-2-11-8c-2 4-7 7-11 2z" fill="rgb(245 183 0 / 0.45)"/><path d="M22 18c-3 5-4 9-5 14M34 18c3 5 4 9 5 14M28 16v24"/></svg>',
  Coffee: '<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 24h30v10c0 8-6 13-15 13s-15-5-15-13V24z" fill="rgb(245 183 0 / 0.45)"/><path d="M40 27h3a6 6 0 0 1 0 12h-4M19 8c-2 3 2 5 0 9M28 6c-2 3 2 6 0 10"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  window: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V10a8 8 0 0 1 16 0v11H4z"/><path d="M4 14h16M12 2.5V14"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h4l1.5 5-2.2 1.6a12 12 0 0 0 5.1 5.1L16 12.5l5 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/></svg>',
  // The shelf across the top of the board: three loaves, a baguette and a cup.
  shelf: '<svg class="art" viewBox="0 0 320 70" fill="none" stroke="#f5b700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 62h308" stroke-width="3"/><path d="M18 60c0-16 12-26 28-26s28 10 28 26z" fill="rgb(245 183 0 / 0.18)"/><path d="M34 42l5 9M45 39l4 10M56 41l4 9"/><path d="M88 60c0-13 9-20 20-20s20 7 20 20z" fill="rgb(245 183 0 / 0.18)"/><path d="M101 47l3 7M110 46l3 7"/><path d="M146 60l58-34c5-3 11 5 6 9l-48 25z" fill="rgb(245 183 0 / 0.18)"/><path d="M168 46l5 6M181 39l5 6M194 31l5 6"/><path d="M232 34h34v14c0 8-7 12-17 12s-17-4-17-12V34z" fill="rgb(245 183 0 / 0.18)"/><path d="M266 38h4a6 6 0 0 1 0 12h-5M243 16c-2 4 2 6 0 10M253 13c-2 4 2 7 0 11"/></svg>',
  // The bakehouse front: an arched window, the awning, the side window with a bag on its sill.
  front: '<svg viewBox="0 0 420 320" fill="none" stroke="#f5b700" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="A drawing of the bakehouse: a brick front with an arched window, a striped awning and a paper bag on the side window’s sill."><path d="M30 300V70h360v230" fill="rgb(245 183 0 / 0.06)"/><path d="M10 300h400" stroke-width="3"/><path d="M30 70l20-34h320l20 34"/><path d="M30 104h360" opacity="0.5"/><path d="M60 104l-14 40h150l-14-40" fill="rgb(29 26 20 / 0.45)"/><path d="M88 104l-8 40M121 104v40M154 104l8 40" opacity="0.7"/><path d="M64 300V200a57 57 0 0 1 114 0v100" fill="rgb(245 183 0 / 0.14)"/><path d="M121 143v157M64 214h114M64 258h114" opacity="0.6"/><path d="M238 150h120v96H238z" fill="rgb(245 183 0 / 0.14)"/><path d="M228 246h140v10H228z" fill="rgb(245 183 0 / 0.3)"/><path d="M282 246v-36l8-10h20l8 10v36z" fill="#f5b700" stroke="#1d1a14"/><path d="M290 200l5 10M310 200l-5 10" stroke="#1d1a14"/><path d="M252 132h92" opacity="0.6"/><path d="M252 122h92" opacity="0.6"/><path d="M70 60h80M270 54h60M250 280h110M246 292h60" opacity="0.35"/></svg>',
};

const wordmark = (shop) => {
  const [last, ...first] = shop.name.split(' ').reverse();
  return `<a class="wordmark" href="/">${art.mark}<span><b>${escape(first.reverse().join(' '))}</b><small>${escape(last)}</small></span></a>`;
};

/** What a search engine or a shared link should know about the shop. Off for a made-up shop. */
function listing(shop, canonical) {
  if (!shop.listed) return '<meta name="robots" content="noindex, nofollow">';
  const data = { '@context': 'https://schema.org', '@type': 'Bakery', name: shop.name, description: site.description, telephone: shop.phone, address: { '@type': 'PostalAddress', addressLocality: shop.town.split(',')[0], addressRegion: (shop.town.split(',')[1] ?? '').trim() }, ...(canonical ? { url: canonical } : {}) };
  return `${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/**
 * `nav`: who is looking: `customer` (signed in), `staff` (on the staff). `wide` gives the admin
 * pages more room; `here` marks the current link. `landing` is the landing page: full-width
 * sections and its own stylesheet. `bag` ({ count, cents }) is the guest's order, for the bag in
 * the bar and, on a phone, the bar along the bottom. `toast` is a signed "done" message to float.
 */
export function layout({ title, shop, body, count = null, refresh = 0, nav = {}, wide = false, here = '', landing = false, bag = null, toast = '', description = site.description, canonical = '' }) {
  const link = (href, words, cls = '') => `<a href="${href}"${cls ? ` class="${cls}"` : ''}${here === href ? ' aria-current="page"' : ''}>${words}</a>`;
  const links = [link('/#menu', 'Menu', 'wide'), link('/#story', 'Our story', 'wide'), link('/#visit', 'Visit', 'wide'), nav.customer ? link('/account', 'Account') : link('/account/sign-in', 'Sign in'), ...(nav.staff ? [link('/admin', 'Admin')] : [])].join('');
  const fullTitle = landing ? `${shop.name} · Order ahead in ${shop.town}` : `${title} · ${shop.name}`;
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const bagBar = landing && bag?.count ? `<a class="bagbar" href="/order"><span>${bag.count} in your bag · ${money(bag.cents)}</span><span>Check out</span></a>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${listing(shop, canonical)}${refresh ? `
  <meta http-equiv="refresh" content="${refresh}">` : ""}
  <title>${escape(fullTitle)}</title>
  <meta name="description" content="${escape(description)}">
  <meta property="og:title" content="${escape(fullTitle)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#1d1a14">
  <link rel="icon" href="${asset('favicon.svg')}" type="image/svg+xml">
  <link rel="preload" href="${asset('bricolage-grotesque-latin-700-normal.woff2')}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${asset('figtree-latin-400-normal.woff2')}" as="font" type="font/woff2" crossorigin>${landing && photo('hero') ? `
  <link rel="preload" href="${photo('hero')}" as="image" fetchpriority="high">
  <meta property="og:image" content="${escape(canonical ? new URL(photo('hero'), canonical).href : photo('hero'))}">` : ''}
  <style>${FONT_CSS}</style>
  <link rel="stylesheet" href="${asset('base.css')}">
  <link rel="stylesheet" href="${asset(landing ? 'site.css' : 'customer.css')}">${wide ? `
  <style>${CHART_CSS}</style>` : ''}
</head>
<body${bagBar ? ' class="has-bag"' : ''}>
  <a class="skip" href="#main">Skip to the page</a>
  <header class="site-head"><div class="wrap bar">${wordmark(shop)}<nav aria-label="Site">${links}${count === null ? "" : count ? `<a class="bag" href="/order">${art.bag}Your order (${count})</a>` : `<a class="bag" href="/#menu">${escape(site.order)}</a>`}</nav></div></header>
  <main id="main"${landing ? ' class="landing"' : wide ? ' class="wide"' : ''}>
    ${body}
  </main>
  ${toast ? `<p class="toast" role="status">${escape(toast)}</p>` : ''}${bagBar}
  <footer class="site-foot"><div class="wrap">
    <div class="cols">
      <div>${wordmark(shop)}<p>${escape(site.foot.line)}</p><p>${escape(shop.town)}</p><p><a class="go" href="/#menu">${escape(site.order)}</a></p></div>
      <div><h2>Hours</h2><p>${escape(shop.hours)}</p><p>${escape(shop.pickup)}</p></div>
      <div><h2>Order</h2><ul><li><a href="/#menu">Today’s menu</a></li><li><a href="/order">Your order</a></li><li><a href="/account">Your account</a></li><li><a href="tel:+1${shop.phone.replace(/\D/g, '')}">${escape(shop.phone)}</a></li></ul></div>
      <div><h2>Staff</h2><ul><li><a href="/admin">Staff sign in</a></li><li><a href="/kitchen">The kitchen</a></li></ul></div>
    </div>
    <div class="fine"><p>${escape(shop.concept)}</p><p><a href="${escape(site.foot.builtHref)}">${escape(site.foot.built)}</a></p></div>
  </div></footer>
  <script type="module">
    import { connect } from '@zubra/sync/connect';
    connect();
  </script>
</body>
</html>`;
}
