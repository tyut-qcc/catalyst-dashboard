const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'public', 'aimd');
const out = path.join(dir, 'index.json');

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const files = fs.readdirSync(dir)
  .filter((name) => name.toLowerCase().endsWith('.xyz'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

const entries = files.map((file) => ({
  id: path.basename(file, path.extname(file)),
  name: path.basename(file, path.extname(file)),
  file,
}));

fs.writeFileSync(out, JSON.stringify(entries, null, 2), 'utf8');
console.log(`Generated ${entries.length} AIMD trajectory entries: ${out}`);
