#!/usr/bin/env node
// Release-only overlay: never edit the checkout or install dependencies.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, realpathSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync,
  readdirSync, lstatSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
function parseJson(text) {
  try { return JSON.parse(text); }
  catch (error) { fail(`Invalid JSON: ${error.message}`); }
}
const json = (file) => parseJson(readFileSync(file, 'utf8'));
const saveJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell: false,
    timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  assert(!result.error && result.status === 0,
    `${command} failed: ${result.error?.message ?? result.stderr ?? result.status}`);
  return result.stdout;
}
function walk(root, prefix = '') {
  return readdirSync(path.join(root, prefix)).sort().flatMap((name) => {
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(path.join(root, relative));
    assert(!stat.isSymbolicLink(), `Symlink forbidden: ${relative}`);
    if (stat.isDirectory()) return walk(root, relative);
    assert(stat.isFile(), `Non-file forbidden: ${relative}`);
    return [relative];
  });
}
function copy(root, target, relative) {
  const destination = path.join(target, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, relative), destination);
}
function matches(file, pattern) {
  assert(!pattern.includes('..') && !pattern.startsWith('/') && !pattern.includes('\\'),
    `Unsafe files pattern: ${pattern}`);
  if (pattern.endsWith('/')) return file.startsWith(pattern);
  if (!pattern.includes('*')) return file === pattern;
  const regex = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
  return new RegExp(`^${regex}$`).test(file);
}
function stagePackage(source, target) {
  const manifest = json(path.join(source, 'package.json'));
  assert(Array.isArray(manifest.files), 'Explicit package files list required');
  const positive = manifest.files.filter((entry) => !entry.startsWith('!'));
  const negative = manifest.files.filter((entry) => entry.startsWith('!')).map((entry) => entry.slice(1));
  for (const file of walk(source)) {
    if ((['package.json', 'README.md', 'LICENSE'].includes(file)
      || positive.some((pattern) => matches(file, pattern)))
      && !negative.some((pattern) => matches(file, pattern))) copy(source, target, file);
  }
  delete manifest.scripts;
  delete manifest.publishConfig;
  delete manifest.workspaces;
  delete manifest.overrides;
  saveJson(path.join(target, 'package.json'), manifest);
  return manifest;
}
function checkExports(root, manifest) {
  const check = (value) => {
    if (typeof value === 'string') {
      assert(value.startsWith('./') && !value.includes('..') && !value.includes('*'), 'Unsafe export target');
      assert(existsSync(path.join(root, value)) && lstatSync(path.join(root, value)).isFile(), `Missing export: ${value}`);
    } else if (value && typeof value === 'object') Object.values(value).forEach(check);
    else assert(value === null, 'Invalid export');
  };
  check(manifest.exports);
}
function npmCli() {
  // Invoke npm's JS entry with Node, not npm.cmd through shell interpolation.
  const directories = [path.dirname(process.execPath), ...(process.env.PATH ?? process.env.Path ?? '').split(path.delimiter)];
  for (const directory of directories) {
    if (!directory) continue;
    const candidate = path.join(directory.replace(/^"|"$/g, ''), 'node_modules/npm/bin/npm-cli.js');
    if (existsSync(candidate)) return realpathSync(candidate);
    const launcher = path.join(directory, 'npm');
    if (existsSync(launcher)) {
      const resolved = realpathSync(launcher);
      if (resolved.endsWith(`${path.sep}npm-cli.js`)) return resolved;
    }
  }
  fail('Cannot locate npm-cli.js beside Node or on PATH; install Node with npm first');
}

try {
  assert(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22+ required');
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    assert(['--source', '--version', '--out'].includes(args[i]) && args[i + 1]
      && !Object.hasOwn(options, args[i]), 'Usage: node scripts/pack-ask-user-question.mjs --source <commit/ref> --version <fork-semver> --out <external-dir>');
    options[args[i]] = args[i + 1];
  }
  assert(Object.keys(options).length === 3, 'All three explicit options are required');
  const version = options['--version'];
  assert(/^2\.12\.0-yuchenhui\.(0|[1-9]\d*)$/.test(version), 'Fork version must be 2.12.0-yuchenhui.<number>');
  const recipeDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repo = realpathSync(run('git', ['rev-parse', '--show-toplevel'], recipeDirectory).trim());
  const sourceSha = run('git', ['rev-parse', '--verify', '--end-of-options', `${options['--source']}^{commit}`], repo).trim();
  assert(/^[a-f0-9]{40}$/.test(sourceSha), 'Expected exact SHA-1 commit');
  const sourceBaseline = '5ee7845672f491b331e9b551a77a4a0fc9f79d89';
  const upstreamBase = '68d9a0014b70006d7b04b57933752338a2716db7';
  run('git', ['merge-base', '--is-ancestor', sourceBaseline, sourceSha], repo);
  // Resolve an existing ancestor before mkdir, so symlinks cannot bypass containment.
  const requestedOut = path.resolve(options['--out']);
  let ancestor = requestedOut;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const out = path.resolve(realpathSync(ancestor), path.relative(ancestor, requestedOut));
  const outsideRepo = path.relative(repo, out);
  assert(outsideRepo.startsWith(`..${path.sep}`) || path.isAbsolute(outsideRepo), 'Output must be outside checkout');
  mkdirSync(out, { recursive: true });
  const filename = `juicesharp-rpiv-ask-user-question-${version}.tgz`;
  for (const name of [filename, 'SHA256SUMS', 'fork-release.json']) {
    assert(!existsSync(path.join(out, name)), `Refusing to overwrite: ${name}`);
  }
  const tempRelative = path.relative(repo, realpathSync(tmpdir()));
  assert(tempRelative.startsWith(`..${path.sep}`) || path.isAbsolute(tempRelative), 'TEMP must be outside checkout');
  const stage = mkdtempSync(path.join(tmpdir(), 'rpiv-ask-release-'));
  console.log(`Retained staging: ${stage}`);
  const archive = path.join(stage, 'source.tar');
  run('git', ['archive', '--format=tar', `--output=${archive}`, sourceSha, '--',
    'packages/rpiv-ask-user-question', 'packages/rpiv-config', 'LICENSE'], repo);
  const exported = path.join(stage, 'exported');
  mkdirSync(exported);
  run('tar', ['-xf', 'source.tar', '-C', 'exported'], stage);
  const ask = path.join(stage, 'package');
  const askSource = path.join(exported, 'packages/rpiv-ask-user-question');
  const sourceManifest = json(path.join(askSource, 'package.json'));
  const manifest = stagePackage(askSource, ask);
  assert(manifest.name === '@juicesharp/rpiv-ask-user-question' && manifest.version === '2.12.0', 'Unexpected ask source identity/version');
  assert(manifest.license === 'MIT' && manifest.author === 'juicesharp', 'Unexpected attribution');
  manifest.version = version;
  manifest.private = true;
  manifest.repository = { ...manifest.repository, url: 'git+https://github.com/Yuchenhui/rpiv-mono.git' };
  manifest.homepage = `https://github.com/Yuchenhui/rpiv-mono/tree/${sourceSha}/packages/rpiv-ask-user-question#readme`;
  manifest.bugs = { url: 'https://github.com/Yuchenhui/rpiv-mono/issues' };
  manifest.dependencies = { '@juicesharp/rpiv-config': '2.12.0' };
  manifest.bundleDependencies = ['@juicesharp/rpiv-config'];
  delete manifest.bundledDependencies;
  assert(!manifest.optionalDependencies, 'Unexpected optional dependencies');
  for (const peer of ['@earendil-works/pi-coding-agent', '@earendil-works/pi-tui', 'typebox', '@juicesharp/rpiv-i18n']) {
    assert(manifest.peerDependencies?.[peer] === '*', `Unexpected peer: ${peer}`);
  }
  assert(manifest.peerDependenciesMeta?.['@juicesharp/rpiv-i18n']?.optional === true, 'i18n must remain optional');
  assert(JSON.stringify(manifest.pi.extensions) === '["./index.ts"]', 'Only index.ts may register as an extension');
  saveJson(path.join(ask, 'package.json'), manifest);
  const config = path.join(ask, 'node_modules/@juicesharp/rpiv-config');
  const configManifest = stagePackage(path.join(exported, 'packages/rpiv-config'), config);
  assert(configManifest.name === '@juicesharp/rpiv-config' && configManifest.version === '2.12.0'
    && configManifest.license === 'MIT' && !configManifest.dependencies && !configManifest.optionalDependencies, 'Unexpected config package');
  copy(exported, config, 'LICENSE');
  checkExports(ask, manifest);
  checkExports(config, configManifest);
  const expected = walk(ask);
  for (const file of expected) {
    assert(!/(^|\/)(\.git|\.env[^/]*|test-fixtures\.ts|[^/]*\.test\.[^/]+|package-lock\.json|npm-shrinkwrap\.json|\.npmrc|config\.json)$/.test(file), `Forbidden file: ${file}`);
    assert(!file.includes('node_modules/') || file.startsWith('node_modules/@juicesharp/rpiv-config/'), `Unexpected bundled module: ${file}`);
  }
  const npmrc = path.join(stage, 'empty.npmrc');
  const globalNpmrc = path.join(stage, 'empty-global.npmrc');
  writeFileSync(npmrc, '');
  writeFileSync(globalNpmrc, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|windir|comspec|temp|tmp|home|userprofile|appdata|localappdata)$/i.test(key)));
  Object.assign(env, { npm_config_userconfig: npmrc, npm_config_globalconfig: globalNpmrc,
    npm_config_cache: path.join(stage, 'npm-cache'), npm_config_audit: 'false', npm_config_fund: 'false' });
  const summary = parseJson(run(process.execPath, [npmCli(), 'pack', '--ignore-scripts', '--workspaces=false', '--offline', '--json', '--pack-destination', out], ask, env));
  assert(summary.length === 1 && summary[0].filename === filename && summary[0].version === version
    && summary[0].name === manifest.name, 'Unexpected npm pack summary');
  assert(JSON.stringify(summary[0].bundled) === '["@juicesharp/rpiv-config"]', 'npm did not bundle exactly rpiv-config');
  assert(summary[0].entryCount === expected.length && Array.isArray(summary[0].files)
    && JSON.stringify(summary[0].files.map((file) => file.path).sort()) === JSON.stringify(expected), 'npm pack file summary mismatch');
  const tarball = path.join(out, filename);
  const entries = run('tar', ['-tf', filename], out).trim().split(/\r?\n/);
  const expectedSet = new Set(expected.map((file) => `package/${file}`));
  for (const entry of entries) {
    assert(!entry.includes('..') && !entry.includes('\\') && entry.startsWith('package/'), `Unsafe tar entry: ${entry}`);
    assert(entry.endsWith('/') ? [...expectedSet].some((file) => file.startsWith(entry)) : expectedSet.has(entry), `Unexpected tar entry: ${entry}`);
  }
  const actualFiles = entries.filter((entry) => !entry.endsWith('/'));
  assert(actualFiles.length === expectedSet.size && new Set(actualFiles).size === expectedSet.size, 'Tar file count/duplicates mismatch');
  const unpacked = path.join(stage, 'verified');
  mkdirSync(unpacked);
  run('tar', ['-xf', filename, '-C', unpacked.replaceAll('\\', '/')], out);
  const verified = path.join(unpacked, 'package');
  assert(JSON.stringify(walk(verified)) === JSON.stringify(expected), 'Extracted file list mismatch');
  for (const file of expected) assert(sha256(path.join(ask, file)) === sha256(path.join(verified, file)), `Packed content mismatch: ${file}`);
  checkExports(verified, json(path.join(verified, 'package.json')));
  checkExports(path.join(verified, 'node_modules/@juicesharp/rpiv-config'), json(path.join(verified, 'node_modules/@juicesharp/rpiv-config/package.json')));
  const tarBytes = readFileSync(tarball);
  assert(summary[0].size === tarBytes.length
    && summary[0].shasum === createHash('sha1').update(tarBytes).digest('hex')
    && summary[0].integrity === `sha512-${createHash('sha512').update(tarBytes).digest('base64')}`, 'npm pack size/hash summary mismatch');
  const digest = sha256(tarball);
  writeFileSync(path.join(out, 'SHA256SUMS'), `${digest}  ${filename}\n`);
  saveJson(path.join(out, 'fork-release.json'), {
    repository: 'https://github.com/Yuchenhui/rpiv-mono', upstreamRepository: 'https://github.com/juicesharp/rpiv-mono',
    upstreamBase, sourceBaseline, originalVersion: '2.12.0', forkVersion: version, sourceSha,
    tag: `rpiv-ask-user-question-v${version}`, configSource: { sourceSha, directory: 'packages/rpiv-config', version: '2.12.0', license: 'MIT' },
    sourceManifest, artifactManifest: manifest,
    overlayPolicy: 'Source/workspace versions stay 2.12.0; fork version/private/URLs/exact bundled config are artifact-only. Scripts and publishConfig removed; SDK/typebox peers and optional i18n retained.',
    artifact: { filename, sha256: digest, fileCount: expected.length, files: expected, npmPack: summary[0] },
    validationBoundary: 'Committed Git archive only; npm pack offline/ignore-scripts; exact tar listing, extracted byte hashes, exports and bundle checked. No install, publish, build, regression, native CLI, model calls, extension execution, deployment or restart. English fallback without optional i18n. Windows pinned deployment is the target; Linux execution is not certified. Stable recipe/file output, not a promise of byte-identical tar timestamps.'
  });
  console.log(JSON.stringify({ sourceSha, tarball, sha256: digest, fileCount: expected.length,
    bundledConfigFiles: expected.filter((file) => file.startsWith('node_modules/')).length, stage }, null, 2));
} catch (error) {
  console.error(`Release packaging failed: ${error.message}`);
  process.exitCode = 1;
}
