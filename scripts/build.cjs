const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const babelSource = fs.readFileSync(path.join(root, 'assets/libs/babel.min.js'), 'utf8');
const babelModule = { exports: {} };

vm.runInNewContext(babelSource, {
  module: babelModule,
  exports: babelModule.exports,
  require,
  console,
  process,
  setTimeout,
  clearTimeout,
});

const Babel = babelModule.exports;
if (typeof Babel.transform !== 'function') {
  throw new Error('Unable to load bundled Babel compiler');
}

const orderedSources = [
  'components/EChart.jsx',
  'components/Sidebar.jsx',
  'components/Dashboard.jsx',
  'components/ReactionOverview.jsx',
  'components/DFTDatabase.jsx',
  'components/MicrodynamicsDB.jsx',
  'components/StructureDB.jsx',
  'components/MDDB.jsx',
  'components/C3H6Microdynamics.jsx',
  'components/ActionCenter.jsx',
  'app.jsx',
];

const banner = `/* QCC Database production bundle. Generated ${new Date().toISOString()} by scripts/build.cjs. */\n`;
const output = orderedSources.map(relativePath => {
  const absolutePath = path.join(root, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const transformed = Babel.transform(source, {
    presets: ['react'],
    sourceType: 'script',
    comments: false,
    compact: false,
  }).code;
  return `\n/* ${relativePath} */\n(function () {\n${transformed}\n})();\n`;
}).join('');

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'app.bundle.js'), banner + output, 'utf8');
console.log(`Built dist/app.bundle.js from ${orderedSources.length} source files.`);
