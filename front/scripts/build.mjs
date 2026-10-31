import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runtimeScript } from './write-vercel-runtime.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export function buildOptions(args, env) {
  const vercel = env.VERCEL === '1' || args.includes('--vercel');
  return {
    vercel,
    args: ['build', ...args.filter((argument) => argument !== '--vercel'), ...(vercel ? ['--configuration', 'production-static'] : [])],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = buildOptions(process.argv.slice(2), process.env);
    if (options.vercel) {
      writeFileSync(resolve(root, 'public/runtime-config.js'), runtimeScript(process.env));
      console.log('Public Vercel runtime configuration written; values are not logged.');
    }
    const build = spawnSync(process.execPath, [resolve(root, 'node_modules/@angular/cli/bin/ng.js'), ...options.args], { cwd: root, stdio: 'inherit' });
    if (build.error || build.status !== 0) process.exit(build.status || 1);
    if (options.vercel) {
      const version = spawnSync(process.execPath, [resolve(root, 'scripts/inject-version-into-index.js')], { cwd: root, stdio: 'inherit' });
      if (version.error || version.status !== 0) process.exit(version.status || 1);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
