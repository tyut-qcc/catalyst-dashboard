/*
 * 为 public/structures 目录生成 index.json。
 * 用法：node scripts/generate-structure-index.cjs
 *
 * 目录示例：
 * public/structures/
 *   Pt-CeO2.xyz
 *   Pd-CeO2.xyz
 *   Rh-CeO2.xyz
 *
 * 浏览器端通过 index.json 获取模型列表，因此不依赖 GitHub Pages 的目录索引。
 */
const fs = require('fs');
const path = require('path');

const structuresDir = path.resolve(__dirname, '..', 'public', 'structures');
const output = path.join(structuresDir, 'index.json');

function normalizeElement(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  const cleaned = token.replace(/[^A-Za-z]/g, '');
  if (!cleaned) return '';
  const symbols = [
    'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
    'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
    'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
    'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
    'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm',
    'Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'
  ];
  const lower = cleaned.toLowerCase();
  return symbols.find((symbol) => symbol.toLowerCase() === lower)
    || [...symbols].sort((a, b) => b.length - a.length).find((symbol) => lower.startsWith(symbol.toLowerCase()))
    || cleaned.slice(0, 1).toUpperCase() + cleaned.slice(1, 2).toLowerCase();
}

function parseXYZ(content) {
  const lines = content.split(/\r?\n/);
  if (!lines.length) return [];
  const count = Number.parseInt((lines[0] || '').trim(), 10);
  const start = Number.isFinite(count) ? 2 : 0;
  const atomLines = lines.slice(start);
  const elements = [];
  for (const line of atomLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 1 || !parts[0]) continue;
    const element = normalizeElement(parts[0]);
    if (element) elements.push(element);
    if (Number.isFinite(count) && elements.length >= count) break;
  }
  return [...new Set(elements)].sort();
}

if (!fs.existsSync(structuresDir)) {
  fs.mkdirSync(structuresDir, { recursive: true });
}

const files = fs.readdirSync(structuresDir)
  .filter((name) => name.toLowerCase().endsWith('.xyz'))
  .sort((a, b) => a.localeCompare(b));

const models = files.map((file) => {
  const content = fs.readFileSync(path.join(structuresDir, file), 'utf8');
  const base = path.basename(file, path.extname(file));
  return {
    id: base,
    name: base,
    file,
    url: `./structures/${encodeURIComponent(file)}`,
    elements: parseXYZ(content),
  };
});

fs.writeFileSync(output, JSON.stringify({ version: 1, models }, null, 2), 'utf8');
console.log(`Generated ${models.length} structure entries: ${output}`);
