// The upgrade drill: for each build, a copy goes back to the previous minor release of its main
// packages, builds and runs the contract, then upgrades to the version the slice uses, builds and runs
// the contract again. No code is changed by hand: a failure is recorded, not fixed.
//   node upgrade.mjs [build…]   → upgrade.json and UPGRADE.md
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = import.meta.dirname;
const slice = join(here, '..');
const PORT = 3160;
const CONTROL = 3161;

/** The previous minor of each build's main packages (the latest patch of it), from npm on the day. */
const DRILLS = {
  zubra: { '@zubra/runtime': '5.18.0', '@zubra/server': '5.18.0', '@zubra/sync': '5.18.0' },
  'zubra-stream': { '@zubra/runtime': '5.18.0', '@zubra/server': '5.18.0' },
  nextjs: { next: '16.3.8' },
  'nextjs-tuned': { next: '16.3.8' },
  'nuxt-tuned': { nuxt: '4.5.2' },
  // kit 3.1.1 needs svelte ^5.57.1, so svelte goes back to the lowest release it accepts.
  sveltekit: { '@sveltejs/kit': '3.1.1', svelte: '5.57.1' },
  nuxt: { nuxt: '4.5.2' },
  lit: { lit: '3.2.1', '@lit-labs/ssr': '4.0.0' },
  enhance: { '@enhance/ssr': '3.5.2', '@enhance/element': '1.4.5' },
  stencil: { '@stencil/core': '4.44.2' },
  fast: { '@microsoft/fast-element': '3.0.4', '@microsoft/webui': '3.0.5' },
  webui: { '@microsoft/webui': '3.0.5', '@microsoft/webui-framework': '3.0.5' },
};
const START = {
  nextjs: ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)],
  'nextjs-tuned': ['.next/standalone/compare/slice/nextjs-tuned/server.js'],
  sveltekit: ['build'],
  nuxt: ['.output/server/index.mjs'],
  'nuxt-tuned': ['.output/server/index.mjs'],
};

const run = (command, args, cwd, env = {}) =>
  new Promise((resolve) => {
    const began = performance.now();
    const child = spawn(command, args, { cwd, env: { ...process.env, NODE_ENV: '', NEXT_TELEMETRY_DISABLED: '1', NUXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('exit', (code) => resolve({ ok: code === 0, ms: Math.round(performance.now() - began), out: out.slice(-1500) }));
  });

async function check(dir, name) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const build = pkg.scripts.build ? await run('npm', ['run', 'build'], dir) : { ok: true, ms: 0, out: '' };
  if (!build.ok) return { build, contract: null };
  const server = spawn(process.execPath, START[name] ?? ['server.js'], { cwd: dir, env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ORIGIN: `http://localhost:${PORT}`, SLICE_CONTROL_PORT: String(CONTROL) }, stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  server.stderr.on('data', (chunk) => (errors += chunk));
  let up = false;
  for (let i = 0; i < 300 && !up && server.exitCode === null; i++) {
    try {
      up = (await fetch(`http://localhost:${PORT}/`)).status === 200;
    } catch {}
    if (!up) await new Promise((done) => setTimeout(done, 100));
  }
  let contract = { pass: 0, total: 11, out: `server did not start: ${errors.slice(-800)}` };
  if (up) {
    const result = await run(process.execPath, ['--test', join(slice, 'contract', 'slice.contract.mjs')], here, { BASE: `http://localhost:${PORT}`, CONTROL: String(CONTROL) });
    const pass = Number(/^ℹ pass (\d+)/m.exec(result.out)?.[1] ?? 0);
    contract = { pass, total: pass + Number(/^ℹ fail (\d+)/m.exec(result.out)?.[1] ?? 0), failed: [...new Set([...result.out.matchAll(/^✖ (S\d[^(]*)/gm)].map((m) => m[1].trim()))] };
  }
  server.kill('SIGKILL');
  await new Promise((done) => setTimeout(done, 500));
  return { build: { ok: true, ms: build.ms }, contract };
}

async function drill(name) {
  const temp = mkdtempSync(join(tmpdir(), `drill-${name}-`));
  const dir = join(temp, 'compare', 'slice', name);
  // The shared backend and Counter's own code are reached by relative paths, so copy the same layout.
  cpSync(join(slice, '..', '..', 'src'), join(temp, 'src'), { recursive: true });
  cpSync(join(slice, '..', '..', 'node_modules'), join(temp, 'node_modules'), { recursive: true });
  // The repo's lockfile too: without it Next.js takes the app's folder as the whole project and can't
  // follow the link to the shared backend.
  for (const file of ['package.json', 'package-lock.json']) cpSync(join(slice, '..', '..', file), join(temp, file));
  cpSync(join(slice, 'shared'), join(temp, 'compare', 'slice', 'shared'), { recursive: true });
  cpSync(join(slice, 'measure'), join(temp, 'compare', 'slice', 'measure'), { recursive: true, filter: (path) => !path.includes('node_modules') });
  cpSync(join(slice, name), dir, { recursive: true, filter: (path) => !/node_modules|\/\.next|\/\.nuxt|\/\.output|\/build$|\/dist$|\/www$|\/hydrate$|\/\.stencil|\/\.svelte-kit/.test(path) });
  const current = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const versions = { ...current.dependencies, ...current.devDependencies };
  const previous = DRILLS[name];
  const result = { name, from: previous, to: Object.fromEntries(Object.keys(previous).map((one) => [one, versions[one]])) };
  console.log(`\n== ${name}: ${JSON.stringify(previous)} → ${JSON.stringify(result.to)}`);

  const install = await run('npm', ['install', '--no-audit', '--no-fund'], dir);
  const down = await run('npm', ['install', '--no-audit', '--no-fund', '--save-exact', ...Object.entries(previous).map(([pkg, v]) => `${pkg}@${v}`)], dir);
  result.previous = down.ok ? { install: down.ms, ...(await check(dir, name)) } : { install: down.ms, error: down.out };
  console.log(`  previous: ${JSON.stringify({ build: result.previous.build?.ok, contract: result.previous.contract?.pass })}`);
  const up = await run('npm', ['install', '--no-audit', '--no-fund', '--save-exact', ...Object.keys(previous).map((pkg) => `${pkg}@${result.to[pkg]}`)], dir);
  result.upgrade = { install: up.ms, ok: up.ok, ...(up.ok ? await check(dir, name) : { error: up.out }) };
  console.log(`  upgraded: ${JSON.stringify({ install: up.ms, build: result.upgrade.build?.ok, contract: result.upgrade.contract?.pass })}`);
  result.firstInstall = install.ms;
  rmSync(temp, { recursive: true, force: true });
  return result;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DRILLS);
// Rerunning some builds keeps the others' earlier results.
let results = [];
try {
  results = JSON.parse(readFileSync(join(here, 'upgrade.json'), 'utf8')).results.filter((one) => !names.includes(one.name));
} catch {}
for (const name of names) results.push(await drill(name));
results.sort((a, b) => Object.keys(DRILLS).indexOf(a.name) - Object.keys(DRILLS).indexOf(b.name));
writeFileSync(join(here, 'upgrade.json'), `${JSON.stringify({ date: new Date().toISOString(), results }, null, 2)}\n`);
const cell = (side) => (side.error ? 'install failed' : !side.build?.ok ? 'build failed' : `${side.contract.pass} of ${side.contract.total}${side.contract.failed?.length ? ` (fails ${side.contract.failed.map((one) => one.split(' ')[0]).join(', ')})` : ''}`);
writeFileSync(
  join(here, 'UPGRADE.md'),
  `# Upgrade drill

Each build was copied, moved back to the previous minor release of its main packages, built and run
against the contract, then upgraded to the version the slice uses and checked again. No code was
changed by hand. Run ${new Date().toISOString().slice(0, 10)}; raw figures in \`upgrade.json\`.

| Build | From | To | Contract on the old version | Upgrade install (s) | Contract after upgrading |
| --- | --- | --- | --- | ---: | --- |
${results.map((r) => `| ${r.name} | ${Object.entries(r.from).map(([p, v]) => `${p} ${v}`).join(', ')} | ${Object.values(r.to).join(', ')} | ${cell(r.previous)} | ${(r.upgrade.install / 1000).toFixed(1)} | ${cell(r.upgrade)} |`).join('\n')}
`,
);
console.log(readFileSync(join(here, 'UPGRADE.md'), 'utf8'));
