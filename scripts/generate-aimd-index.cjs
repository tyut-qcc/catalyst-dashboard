const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'public', 'aimd');
const chunkRoot = path.join(dir, 'chunks');
const out = path.join(dir, 'index.json');
const CHUNK_FRAMES = 25;

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(chunkRoot)) fs.mkdirSync(chunkRoot, { recursive: true });

function parseMeta(comment) {
  const text = String(comment || '');
  const frame = text.match(/\bi\s*=\s*(-?\d+)/i);
  const time = text.match(/\btime\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  const energy = text.match(/\bE\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  return {
    index: frame ? Number(frame[1]) : null,
    time: time ? Number(time[1]) : null,
    energy: energy ? Number(energy[1]) : null,
  };
}

function parseTrajectory(text, fileName) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const frames = [];
  let cursor = 0;
  let atomCount = null;

  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor >= lines.length) break;

    const countLine = lines[cursor].trim();
    if (!/^\d+$/.test(countLine)) {
      throw new Error(`${fileName}: 无法解析第 ${cursor + 1} 行原子数：${lines[cursor]}`);
    }
    const count = Number(countLine);
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error(`${fileName}: 第 ${cursor + 1} 行原子数无效：${countLine}`);
    }
    if (atomCount == null) atomCount = count;
    if (count !== atomCount) {
      throw new Error(`${fileName}: 原子数不一致，发现 ${count}，期望 ${atomCount}`);
    }

    const comment = lines[cursor + 1] ?? '';
    const meta = parseMeta(comment);
    const start = cursor;
    cursor += 2 + count;
    if (cursor > lines.length) {
      throw new Error(`${fileName}: 第 ${frames.length + 1} 帧文件提前结束`);
    }

    frames.push({
      text: lines.slice(start, cursor).join('\n'),
      index: meta.index ?? frames.length,
      time: meta.time,
      energy: meta.energy,
    });
  }

  return { atomCount, frames };
}

const files = fs.readdirSync(dir)
  .filter((name) => name.toLowerCase().endsWith('.xyz'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

// Remove stale generated chunks so renamed/deleted tracks don't linger in deployments.
if (fs.existsSync(chunkRoot)) {
  for (const entry of fs.readdirSync(chunkRoot, { withFileTypes: true })) {
    const full = path.join(chunkRoot, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

const entries = [];

for (const file of files) {
  const id = path.basename(file, path.extname(file));
  const fullPath = path.join(dir, file);
  const text = fs.readFileSync(fullPath, 'utf8');
  const parsed = parseTrajectory(text, file);

  const trackDir = path.join(chunkRoot, id);
  fs.mkdirSync(trackDir, { recursive: true });

  const chunkEntries = [];
  const energies = parsed.frames.map((f) => f.energy);
  const times = parsed.frames.map((f) => f.time);

  for (let start = 0, chunkIndex = 0; start < parsed.frames.length; start += CHUNK_FRAMES, chunkIndex++) {
    const chunkFrames = parsed.frames.slice(start, start + CHUNK_FRAMES);
    const chunkName = `chunk_${String(chunkIndex).padStart(4, '0')}.xyz`;
    const chunkPath = path.join(trackDir, chunkName);
    fs.writeFileSync(
      chunkPath,
      chunkFrames.map((f) => f.text).join('\n') + '\n',
      'utf8'
    );
    chunkEntries.push({
      index: chunkIndex,
      startFrame: start,
      endFrame: start + chunkFrames.length - 1,
      file: `chunks/${id}/${chunkName}`,
    });
  }

  const numericEnergies = energies.filter(Number.isFinite);
  const numericTimes = times.filter(Number.isFinite);

  entries.push({
    id,
    name: id,
    file,
    atomCount: parsed.atomCount,
    frames: parsed.frames.length,
    chunkSize: CHUNK_FRAMES,
    chunks: chunkEntries,
    times,
    energies,
    timeStart: numericTimes.length ? Math.min(...numericTimes) : null,
    timeEnd: numericTimes.length ? Math.max(...numericTimes) : null,
    energyMin: numericEnergies.length ? Math.min(...numericEnergies) : null,
    energyMax: numericEnergies.length ? Math.max(...numericEnergies) : null,
  });
}

fs.writeFileSync(out, JSON.stringify(entries, null, 2), 'utf8');
console.log(`Generated ${entries.length} AIMD trajectories with ${CHUNK_FRAMES}-frame chunks: ${out}`);
