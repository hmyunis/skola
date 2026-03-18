const { spawnSync } = require('child_process');
const path = require('path');

const action = process.argv[2];
const rest = process.argv.slice(3);

if (!action) {
  console.error('Usage: node scripts/typeorm.js <action> [name]');
  process.exit(1);
}

const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['typeorm-ts-node-commonjs', '-d', 'src/database/data-source.ts', action];

if (action === 'migration:generate' || action === 'migration:create') {
  const name = rest[0];
  if (!name) {
    console.error(`Missing migration name. Example: npm run ${action} -- AddQuizMaxAttempts`);
    process.exit(1);
  }
  args.push(`src/database/migrations/${name}`);
  args.push(...rest.slice(1));
} else {
  args.push(...rest);
}

const result = spawnSync(npxBin, args, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
