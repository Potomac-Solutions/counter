// Measures every build of the slice the same way, and writes results.json and RESULTS.md.
//   node measure.mjs [zubra nextjs sveltekit nuxt]
// Each build is started with `node` directly (no npm), in production mode, on a fresh in-memory
// shop. See docs/compare/RULES.md for what is measured and why.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { cpus, totalmem } from 'node:os';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import autocannon from 'autocannon';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const here = import.meta.dirname;
const slice = join(here, '..');
const PORT = 3150;
const BASE = `http://localhost:${PORT}`;
const RUNS = { build: 3, start: 5, lighthouse: 3, load: 3 };
const LOAD_SECONDS = Number(process.env.LOAD_SECONDS ?? 10);

const node = process.execPath;
const BUILDS = {
  zubra: { build: null, outputs: [], start: ['server.js'], runtime: ['node_modules'] },
  nextjs: { build: ['node_modules/next/dist/bin/next', 'build'], outputs: ['.next'], start: ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], runtime: ['.next', 'node_modules'] },
  sveltekit: { build: ['node_modules/vite/bin/vite.js', 'build'], outputs: ['.svelte-kit', 'build'], start: ['build'], runtime: ['build'] },
  nuxt: { build: ['node_modules/nuxt/bin/nuxt.mjs', 'build'], outputs: ['.nuxt', '.output'], start: ['.output/server/index.mjs'], runtime: ['.output'] },
  // Web component libraries, each on a plain Node server like the Zubra build.
  lit: { build: ['node_modules/esbuild/bin/esbuild', 'client.js', '--bundle', '--minify', '--format=esm', '--outfile=dist/client.js'], outputs: ['dist'], start: ['server.js'], runtime: ['node_modules', 'dist'] },
  enhance: { build: ['node_modules/esbuild/bin/esbuild', 'client.js', '--bundle', '--minify', '--format=esm', '--outfile=dist/client.js'], outputs: ['dist'], start: ['server.js'], runtime: ['node_modules/@enhance', 'node_modules/counter-slice-backend', 'dist'] },
  stencil: { build: ['node_modules/@stencil/core/bin/stencil', 'build'], outputs: ['www', 'hydrate', '.stencil'], start: ['server.js'], runtime: ['www', 'hydrate'] },
  fast: { build: ['../measure/webui-build.mjs', '--plugin=fast-v3'], outputs: ['dist'], start: ['server.js'], runtime: ['node_modules/@microsoft/webui', 'node_modules/@microsoft/webui-linux-x64', 'dist'] },
  webui: { build: ['../measure/webui-build.mjs', '--plugin=webui', '--dom=light'], outputs: ['dist'], start: ['server.js'], runtime: ['node_modules/@microsoft/webui', 'node_modules/@microsoft/webui-linux-x64', 'dist'] },
};
const OWN = new Set(['.js', '.mjs', '.ts', '.tsx', '.vue', '.svelte', '.zb', '.html']);
const SKIP = new Set(['node_modules', '.next', '.svelte-kit', 'build', '.nuxt', '.output', 'dist', 'www', 'hydrate', '.stencil']);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const duSize = (path) => (existsSync(path) ? Number(execFileSync('du', ['-sk', path]).toString().split('\t')[0]) * 1024 : 0);

/** Non-blank, non-comment lines in the build's own source (configs included, lockfiles not). */
function lines(dir) {
  const files = [];
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      if (SKIP.has(name)) continue;
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (OWN.has(extname(name))) files.push(path);
    }
  };
  walk(dir);
  let total = 0;
  const perFile = {};
  for (const file of files) {
    let inBlock = null;
    let count = 0;
    for (let line of readFileSync(file, 'utf8').split('\n')) {
      line = line.trim();
      if (inBlock) {
        const end = line.indexOf(inBlock);
        if (end < 0) continue;
        line = line.slice(end + inBlock.length).trim();
        inBlock = null;
      }
      if (line.startsWith('/*') || line.startsWith('<!--')) {
        const close = line.startsWith('/*') ? '*/' : '-->';
        const end = line.indexOf(close, 2);
        if (end < 0) {
          inBlock = close;
          continue;
        }
        line = line.slice(end + close.length).trim();
      }
      if (!line || line.startsWith('//')) continue;
      count += 1;
    }
    perFile[relative(dir, file)] = count;
    total += count;
  }
  return { total, files: perFile };
}

function dependencies(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const direct = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) => name !== 'counter-slice-backend');
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  const installed = Object.keys(lock.packages).filter((path) => path.startsWith('node_modules/') && !lock.packages[path].link);
  return { direct: direct.length, installed: installed.length, nodeModules: duSize(join(dir, 'node_modules')) };
}

/** A native binary (esbuild, webui) runs as itself; a script runs through node. */
const native = (path) => {
  try {
    return readFileSync(path).subarray(0, 4).toString('latin1') === '\x7fELF';
  } catch {
    return false;
  }
};

function run(dir, args, env = {}) {
  const [command, ...rest] = native(join(dir, args[0])) ? [join(dir, args[0]), ...args.slice(1)] : [node, ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, rest, { cwd: dir, env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NUXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${out.slice(-800)}`))));
  });
}

async function start(dir, spec) {
  const began = performance.now();
  const child = spawn(node, spec.start, { cwd: dir, env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ORIGIN: BASE, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (chunk) => (errors += chunk));
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited: ${errors.slice(-800)}`);
    try {
      if ((await fetch(`${BASE}/`)).status === 200) break;
    } catch {}
    if (performance.now() - began > 60_000) throw new Error('server did not answer in 60 s');
    await sleep(10);
  }
  return { child, ready: performance.now() - began };
}
const stop = async (child) => {
  child.kill('SIGTERM');
  for (let i = 0; i < 100 && child.exitCode === null && child.signalCode === null; i++) await sleep(20);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await sleep(200);
};
const rss = (pid) => Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))[1]) * 1024;

/** Every script and stylesheet the menu page loads, raw and gzipped here (the same way for all). */
async function payload(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = [];
  page.on('response', async (response) => {
    const type = response.request().resourceType();
    try {
      const body = await response.body();
      seen.push({ url: response.url().replace(BASE, ''), type, raw: body.length, gzip: gzipSync(body).length });
    } catch {}
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(300);
  await context.close();
  const scripts = seen.filter((one) => one.type === 'script');
  const sum = (list, key) => list.reduce((total, one) => total + one[key], 0);
  const doc = seen.find((one) => one.type === 'document');
  return {
    scripts: scripts.length,
    jsRaw: sum(scripts, 'raw'),
    jsGzip: sum(scripts, 'gzip'),
    htmlRaw: doc?.raw ?? 0,
    htmlGzip: doc?.gzip ?? 0,
    requests: seen.filter((one) => one.type !== 'eventsource' && !one.url.startsWith('/live') && !one.url.startsWith('/_zb/sync')).length,
    files: scripts.map(({ url, raw, gzip }) => ({ url, raw, gzip })),
  };
}

async function accessibility(browser) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const found = {};
  await page.goto('/');
  found.menu = (await new AxeBuilder({ page }).analyze()).violations.map((one) => `${one.id} (${one.nodes.length})`);
  await page.getByLabel('How many Country sourdough').fill('2');
  await page.locator('li.item', { hasText: 'Country sourdough' }).getByRole('button', { name: 'Add' }).click();
  await page.waitForURL(/done=/);
  await page.goto('/order');
  found.bag = (await new AxeBuilder({ page }).analyze()).violations.map((one) => `${one.id} (${one.nodes.length})`);
  await context.close();
  return found;
}

async function lighthouseRuns() {
  const results = [];
  for (let i = 0; i < RUNS.lighthouse; i++) {
    const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
    try {
      const { lhr } = await lighthouse(`${BASE}/`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] });
      results.push({ score: lhr.categories.performance.score * 100, lcp: lhr.audits['largest-contentful-paint'].numericValue, tbt: lhr.audits['total-blocking-time'].numericValue, fcp: lhr.audits['first-contentful-paint'].numericValue });
    } finally {
      await chrome.kill();
    }
  }
  return { score: median(results.map((r) => r.score)), lcp: median(results.map((r) => r.lcp)), tbt: median(results.map((r) => r.tbt)), fcp: median(results.map((r) => r.fcp)), runs: results };
}

async function load(pid) {
  const runs = [];
  for (let i = 0; i < RUNS.load; i++) {
    let peak = 0;
    const sampler = setInterval(() => (peak = Math.max(peak, rss(pid))), 100);
    const result = await autocannon({ url: `${BASE}/`, connections: 50, duration: LOAD_SECONDS });
    clearInterval(sampler);
    runs.push({ rps: result.requests.average, p50: result.latency.p50, p975: result.latency.p97_5, p99: result.latency.p99, errors: result.errors + result.non2xx, peakRss: peak });
  }
  return { rps: median(runs.map((r) => r.rps)), p50: median(runs.map((r) => r.p50)), p975: median(runs.map((r) => r.p975)), errors: runs.reduce((t, r) => t + r.errors, 0), peakRss: median(runs.map((r) => r.peakRss)), runs };
}

async function measure(name) {
  const dir = join(slice, name);
  const spec = BUILDS[name];
  const result = { name, lines: lines(dir), dependencies: dependencies(dir) };
  console.log(`\n== ${name}`);

  const builds = [];
  if (spec.build) {
    for (let i = 0; i < RUNS.build; i++) {
      for (const out of spec.outputs) rmSync(join(dir, out), { recursive: true, force: true });
      const began = performance.now();
      await run(dir, spec.build);
      builds.push(performance.now() - began);
    }
  }
  result.build = { ms: builds.length ? median(builds) : 0, runs: builds };
  result.runtimeSize = spec.runtime.reduce((total, path) => total + duSize(join(dir, path)), 0);
  console.log(`  build ${Math.round(result.build.ms)} ms, ${result.lines.total} lines`);

  const readies = [];
  for (let i = 0; i < RUNS.start; i++) {
    const { child, ready } = await start(dir, spec);
    readies.push(ready);
    await stop(child);
  }
  result.start = { ms: median(readies), runs: readies };

  const { child } = await start(dir, spec);
  try {
    await fetch(`${BASE}/`);
    await sleep(2000);
    result.idleRss = rss(child.pid);
    const browser = await chromium.launch();
    try {
      result.payload = await payload(browser);
      result.accessibility = await accessibility(browser);
    } finally {
      await browser.close();
    }
    console.log(`  JS ${kb(result.payload.jsGzip)} KB gzip in ${result.payload.scripts} files; a11y ${JSON.stringify(result.accessibility)}`);
    result.lighthouse = await lighthouseRuns();
    console.log(`  lighthouse ${result.lighthouse.score} LCP ${Math.round(result.lighthouse.lcp)} TBT ${Math.round(result.lighthouse.tbt)}`);
    result.load = await load(child.pid);
    console.log(`  ${Math.round(result.load.rps)} req/s, p97.5 ${result.load.p975} ms`);
  } finally {
    await stop(child);
  }
  return result;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BUILDS);
const machine = { cpus: cpus().length, cpu: cpus()[0]?.model, memoryGb: Math.round(totalmem() / 2 ** 30), node: process.version, date: new Date().toISOString(), loadSeconds: LOAD_SECONDS, runs: RUNS };
const results = [];
for (const name of names) results.push(await measure(name));

const versions = Object.fromEntries(names.map((name) => [name, JSON.parse(readFileSync(join(slice, name, 'package.json'), 'utf8'))]));
writeFileSync(join(here, 'results.json'), `${JSON.stringify({ machine, versions: Object.fromEntries(Object.entries(versions).map(([n, p]) => [n, { ...p.dependencies, ...p.devDependencies }])), results }, null, 2)}\n`);

const row = (label, fn) => `| ${label} | ${results.map(fn).join(' | ')} |`;
const md = `# Slice results

Measured ${machine.date.slice(0, 10)} on ${machine.cpus} × ${machine.cpu}, ${machine.memoryGb} GB, Node ${machine.node}.
Medians of ${RUNS.build} builds, ${RUNS.start} starts, ${RUNS.lighthouse} Lighthouse runs (mobile profile) and ${RUNS.load} load runs of ${LOAD_SECONDS} s at 50 connections.
Raw figures: \`results.json\`.

| | ${results.map((r) => r.name).join(' | ')} |
| --- | ${results.map(() => '---:').join(' | ')} |
${row('JavaScript on the menu, gzip (KB)', (r) => kb(r.payload.jsGzip))}
${row('JavaScript on the menu, raw (KB)', (r) => kb(r.payload.jsRaw))}
${row('Script files on the menu', (r) => r.payload.scripts)}
${row('Menu HTML, gzip (KB)', (r) => kb(r.payload.htmlGzip))}
${row('Lighthouse performance', (r) => Math.round(r.lighthouse.score))}
${row('Largest contentful paint (ms)', (r) => Math.round(r.lighthouse.lcp))}
${row('Total blocking time (ms)', (r) => Math.round(r.lighthouse.tbt))}
${row('Works without JavaScript', () => 'yes (contract)')}
${row('Lines of own code', (r) => r.lines.total)}
${row('Direct dependencies', (r) => r.dependencies.direct)}
${row('Packages installed', (r) => r.dependencies.installed)}
${row('node_modules (MB)', (r) => Math.round(r.dependencies.nodeModules / 2 ** 20))}
${row('What runs in production (MB)', (r) => Math.round(r.runtimeSize / 2 ** 20))}
${row('Build (s)', (r) => (r.build.ms ? (r.build.ms / 1000).toFixed(1) : 'none'))}
${row('Start to first page (ms)', (r) => Math.round(r.start.ms))}
${row('Memory idle (MB)', (r) => Math.round(r.idleRss / 2 ** 20))}
${row('Memory under load (MB)', (r) => Math.round(r.load.peakRss / 2 ** 20))}
${row('Menu requests per second', (r) => Math.round(r.load.rps))}
${row('Latency p50 / p97.5 (ms)', (r) => `${r.load.p50} / ${r.load.p975}`)}
${row('Failed requests under load', (r) => r.load.errors)}
${row('Accessibility violations, menu', (r) => r.accessibility.menu.join(', ') || 'none')}
${row('Accessibility violations, bag', (r) => r.accessibility.bag.join(', ') || 'none')}
`;
writeFileSync(join(here, 'RESULTS.md'), md);
console.log(`\n${md}`);
