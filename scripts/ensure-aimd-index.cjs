// Generate both trajectory and structure-analysis indices when local XYZ changed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'public', 'aimd');
if (!fs.existsSync(dir)) process.exit(0);
const files = fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.xyz'));
if (!files.length) process.exit(0);
const indices = [path.join(dir, 'index.json'), path.join(dir, 'analysis', 'index.json')];
const newest = Math.max(...files.map(n => fs.statSync(path.join(dir, n)).mtimeMs));
let currentAnalysis = false;
try {
  const index = JSON.parse(fs.readFileSync(indices[1], 'utf8'));
  currentAnalysis = String(index?.assumptions?.temperatureAssignment || '').includes('默认仅读取 XYZ 注释中的真实温度');
} catch {}
if (currentAnalysis && indices.every(p => fs.existsSync(p) && fs.statSync(p).mtimeMs >= newest)) process.exit(0);
const run = spawnSync(process.execPath, [path.join(__dirname, 'analyze-aimd-structures.cjs')], {stdio:'inherit'});
if (run.status !== 0) {
  console.error('AIMD 索引生成失败。请核对轨迹 XYZ，并检查上方具体错误。');
  process.exit(run.status || 1);
}
