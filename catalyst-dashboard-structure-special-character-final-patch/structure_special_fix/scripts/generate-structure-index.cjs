/*
 * 自动递归扫描 public/structures，按实际目录树生成 index.json。
 * 支持任意层级目录，并统计：
 * 1. XYZ 模型总数 modelCount
 * 2. 所有 XYZ 模型涉及的全局元素集合 elements
 * 3. 目录树中的每个模型自身的元素集合
 *
 * 用法：
 *   npm run generate:structures
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const structuresDir = path.resolve(__dirname, '..', 'public', 'structures');
const output = path.join(structuresDir, 'index.json');
const coordinateOutput = path.join(structuresDir, 'structure-data.json');
const safeDataDir = path.join(structuresDir, '__data__');
const coordinateRows = [];

const TOP_LEVEL_LABELS = {
  'CO-oxidation': 'CO 氧化',
  'C3H6-oxidation': 'C₃H₆ 氧化',
  'NH3-SCR': 'NH₃-SCR',
};

const ELEMENTS = [
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
  'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
  'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
  'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
  'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm',
  'Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'
];

const ELEMENTS_BY_LOWER = new Map(
  ELEMENTS.map(symbol => [symbol.toLowerCase(), symbol])
);

function normalizeElement(value) {
  const token = String(value || '').trim();
  if (!token) return '';

  const cleaned = token.replace(/[^A-Za-z]/g, '');
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();

  if (ELEMENTS_BY_LOWER.has(lower)) {
    return ELEMENTS_BY_LOWER.get(lower);
  }

  const matched = [...ELEMENTS]
    .sort((a, b) => b.length - a.length)
    .find(symbol => lower.startsWith(symbol.toLowerCase()));

  if (matched) return matched;

  return cleaned.slice(0, 1).toUpperCase() + cleaned.slice(1, 2).toLowerCase();
}

function parseXYZ(content) {
  const rawText = String(content ?? '').replace(/^\uFEFF/, '');
  const rawLines = rawText.split(/\r?\n/);
  const firstLine = (rawLines[0] || '').trim();
  const countMatch = firstLine.match(/^([+-]?\d+)\s*(?:#.*)?$/);
  const declaredCount = countMatch ? Number.parseInt(countMatch[1], 10) : null;
  const isStandardXYZ = Number.isInteger(declaredCount) && declaredCount > 0;
  const start = isStandardXYZ ? 2 : 0;
  const atoms = [];

  for (const rawLine of rawLines.slice(start)) {
    const atom = parseXYZAtomLine(rawLine);
    if (!atom) continue;
    atoms.push(atom);
    if (isStandardXYZ && atoms.length >= declaredCount) break;
  }

  return {
    atoms,
    atomCount: atoms.length,
    elements: [...new Set(atoms.map(atom => atom.element))].sort(),
  };
}

function parseXYZAtomLine(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return null;

  const parts = line.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean);
  if (parts.length < 4) return null;

  const maxElementIndex = Math.min(parts.length - 4, 4);
  for (let i = 0; i <= maxElementIndex; i += 1) {
    const element = normalizeElement(parts[i]);
    if (!element) continue;

    const x = parseXYZNumber(parts[i + 1]);
    const y = parseXYZNumber(parts[i + 2]);
    const z = parseXYZNumber(parts[i + 3]);

    if ([x, y, z].every(Number.isFinite)) {
      return { element, x, y, z };
    }
  }

  return null;
}

function parseXYZNumber(value) {
  const normalized = String(value ?? '').trim().replace(/[dD]([+-]?\d+)$/, 'e$1');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function encodePath(relativePath) {
  // 按路径段分别编码：+、#、空格、中文、括号等特殊字符必须编码，
  // 不能对整条路径直接 encodeURIComponent，否则 / 也会被编码。
  return String(relativePath || '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join('/');
}

function humanizeName(name, depth = 0) {
  if (depth === 0 && TOP_LEVEL_LABELS[name]) {
    return TOP_LEVEL_LABELS[name];
  }

  return String(name || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeId(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function makeSafeFileKey(relativePath) {
  return crypto
    .createHash('sha1')
    .update(relativePath.replace(/\\/g, '/'), 'utf8')
    .digest('hex')
    .slice(0, 24);
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    return a.name.localeCompare(
      b.name,
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      }
    );
  });
}

function buildNode(absPath, relativePath = '', depth = 0) {
  const entries = sortEntries(
    fs.readdirSync(absPath, { withFileTypes: true })
  );

  const children = [];
  let modelCount = 0;
  const elementSet = new Set();

  for (const entry of entries) {
    if (entry.name === 'index.json' || entry.name === 'structure-data.json' || entry.name === '__data__') continue;

    const childAbs = path.join(absPath, entry.name);
    const childRel = relativePath
      ? path.join(relativePath, entry.name)
      : entry.name;

    const childRelPosix = childRel.replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const childNode = buildNode(
        childAbs,
        childRelPosix,
        depth + 1
      );

      if (
        childNode.modelCount > 0 ||
        childNode.children.length > 0
      ) {
        children.push(childNode);
        modelCount += childNode.modelCount;

        (childNode.elements || []).forEach(element => {
          elementSet.add(element);
        });
      }

      continue;
    }

    if (
      !entry.isFile() ||
      !entry.name.toLowerCase().endsWith('.xyz')
    ) {
      continue;
    }

    const stats = fs.statSync(childAbs);
    const parsed = parseXYZ(
      fs.readFileSync(childAbs, 'utf8')
    );

    const pathParts = childRelPosix.split('/');
    pathParts.pop();
    const modelName = entry.name.replace(/\.xyz$/i, '');
    const modelId = makeId(childRelPosix);
    parsed.atoms.forEach((atom, index) => {
      coordinateRows.push({
        modelId,
        path: pathParts.join('/'),
        pathParts,
        pathPartsCount: pathParts.length,
        file: entry.name,
        model: modelName,
        atomIndex: index + 1,
        element: atom.element,
        x: atom.x,
        y: atom.y,
        z: atom.z,
      });
    });

    parsed.elements.forEach(element => {
      elementSet.add(element);
    });

    const baseName = entry.name.replace(/\.xyz$/i, '');
    const safeFileKey = makeSafeFileKey(childRelPosix);
    const safeFileRelative = `__data__/${safeFileKey}.xyz`;
    const safeFileAbs = path.join(safeDataDir, `${safeFileKey}.xyz`);

    fs.writeFileSync(
      safeFileAbs,
      fs.readFileSync(childAbs),
    );

    const modelNode = {
      id: modelId,
      type: 'file',
      name: baseName,
      file: entry.name,
      path: childRelPosix,
      // 请求路径只使用内部 ASCII 安全文件名；展示名称/原始路径保持完全不变。
      url: `./structures/${safeFileRelative}`,
      size: stats.size,
      atomCount: parsed.atomCount,
      elements: parsed.elements,
    };

    children.push(modelNode);
    modelCount += 1;
  }

  return {
    id: relativePath || '__root__',
    type: 'folder',
    name: relativePath
      ? humanizeName(path.basename(relativePath), depth)
      : '结构库',
    path: relativePath,
    depth,
    modelCount,
    elements: [...elementSet].sort(),
    children,
  };
}

function countFolders(node) {
  return (node.children || []).reduce(
    (sum, child) => {
      return sum + (
        child.type === 'folder'
          ? 1 + countFolders(child)
          : 0
      );
    },
    0
  );
}

function buildIndex() {
  if (!fs.existsSync(structuresDir)) {
    fs.mkdirSync(structuresDir, { recursive: true });
  }

  if (fs.existsSync(safeDataDir)) {
    fs.rmSync(safeDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(safeDataDir, { recursive: true });

  const tree = buildNode(structuresDir, '', 0);

  const topLevelFolders = tree.children.filter(
    node => node.type === 'folder'
  );

  const totalModels = topLevelFolders.reduce(
    (sum, node) => sum + Number(node.modelCount || 0),
    0
  );

  const structureElements = [
    ...new Set(
      topLevelFolders.flatMap(node => node.elements || [])
    ),
  ].sort();

  return {
    version: 7,
    generatedAt: new Date().toISOString(),
    root: 'structures',
    folderCount: countFolders(tree),
    modelCount: totalModels,

    // 所有 public/structures/**/*.xyz 的元素类型并集
    elementCount: structureElements.length,
    elements: structureElements,

    tree: topLevelFolders,
  };
}

const index = buildIndex();

fs.writeFileSync(
  output,
  JSON.stringify(index, null, 2),
  'utf8'
);

fs.writeFileSync(
  coordinateOutput,
  JSON.stringify({
    version: 1,
    generatedAt: index.generatedAt,
    root: 'structures',
    atomCount: coordinateRows.length,
    modelCount: index.modelCount,
    elements: index.elements,
    tree: index.tree,
    rows: coordinateRows,
  }, null, 2),
  'utf8'
);

console.log(`Generated structure index: ${output}`);
console.log(`Folders: ${index.folderCount}`);
console.log(`XYZ models: ${index.modelCount}`);
console.log(`XYZ atoms: ${coordinateRows.length}`);
console.log(`Coordinate data: ${coordinateOutput}`);
console.log(
  `Structure elements (${index.elementCount}): ${index.elements.join(', ')}`
);
