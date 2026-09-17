#!/usr/bin/env node

/**
 * AIMD 结构模型统计：
 * PBC 修正 + 持续性结构重构 + 同一轨迹全局去重 + 可复现温度统计。
 *
 * 关键逻辑：
 * 1. 自动扫描 public/aimd 目录下全部 .xyz 文件，不再写死轨迹名称。
 * 2. 每条 AIMD 轨迹独立分析有效结构数量。
 * 3. 生成一个轨迹清单 index.json，前端点选任一轨迹后加载该轨迹的专属分析结果。
 * 4. 每个有效结构模型按“材料ID + 代表帧”进行 0–400 ℃可复现随机赋值，仅用于界面统计展示。
 * 5. 首页数据点统计读取全部轨迹的有效结构模型总数，每个有效模型按 15 条数据折算。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const aimdDir = process.env.AIMD_DIR ? path.resolve(process.env.AIMD_DIR) : path.join(rootDir, 'public', 'aimd');
const analysisDir = process.env.AIMD_ANALYSIS_DIR ? path.resolve(process.env.AIMD_ANALYSIS_DIR) : path.join(aimdDir, 'analysis');
const modelDir = path.join(analysisDir, 'models');
const trajectoryAnalysisDir = path.join(analysisDir, 'trajectories');

const TEMPERATURE_MODE = String(process.env.AIMD_TEMPERATURE_MODE || 'random').toLowerCase();
const TEMP_MIN_C = Number(process.env.AIMD_TEMP_MIN_C || 0);
const TEMP_MAX_C = Number(process.env.AIMD_TEMP_MAX_C || 400);
const TEMPERATURE_SEED = String(process.env.AIMD_TEMPERATURE_SEED || 'aimd-2026');
if (!(TEMP_MAX_C > TEMP_MIN_C)) {
  throw new Error('AIMD_TEMP_MAX_C 必须大于 AIMD_TEMP_MIN_C');
}

const RMSD_THRESHOLD_A = Number(process.env.AIMD_RMSD_THRESHOLD_A || 0.50);
const EXACT_RMSD_THRESHOLD_A = Number(process.env.AIMD_EXACT_RMSD_THRESHOLD_A || 1e-6);
const PERSISTENCE_FRAMES = Math.max(2, Number(process.env.AIMD_PERSISTENCE_FRAMES || 2));
const CANDIDATE_STRIDE = Math.max(1, Number(process.env.AIMD_CANDIDATE_STRIDE || 1));
const CELL_JUMP_MIN_A = Number(process.env.AIMD_CELL_JUMP_MIN_A || 7.0);
const CELL_ROUND_A = Number(process.env.AIMD_CELL_ROUND_A || 0.05);
const CELL_MIN_OCCURRENCES = Number(process.env.AIMD_CELL_MIN_OCCURRENCES || 20);

if (!(RMSD_THRESHOLD_A > EXACT_RMSD_THRESHOLD_A)) {
  throw new Error('AIMD_RMSD_THRESHOLD_A 必须大于 AIMD_EXACT_RMSD_THRESHOLD_A');
}

function discoverTrajectories() {
  if (!fs.existsSync(aimdDir)) {
    throw new Error(`AIMD 目录不存在：${aimdDir}`);
  }

  const entries = fs.readdirSync(aimdDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.xyz'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  return entries.map((entry, index) => ({
    id: path.basename(entry.name, path.extname(entry.name)),
    file: entry.name,
    key: `T${String(index + 1).padStart(3, '0')}`,
    index,
  }));
}

const TRAJECTORIES = discoverTrajectories();
if (!TRAJECTORIES.length) {
  throw new Error(`public/aimd 目录下未发现 .xyz AIMD 轨迹：${aimdDir}`);
}

const DIRECTIONS = ['heating', 'cooling'];

fs.mkdirSync(analysisDir, { recursive: true });
fs.mkdirSync(modelDir, { recursive: true });
fs.mkdirSync(trajectoryAnalysisDir, { recursive: true });

for (const name of fs.readdirSync(modelDir)) {
  fs.rmSync(path.join(modelDir, name), { recursive: true, force: true });
}
for (const name of fs.readdirSync(trajectoryAnalysisDir)) {
  fs.rmSync(path.join(trajectoryAnalysisDir, name), { recursive: true, force: true });
}


function normalizeElement(raw) {
  const letters = String(raw || '').match(/[A-Za-z]{1,2}/)?.[0] || '';
  if (!letters) return '';
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

function parseMeta(comment) {
  const text = String(comment || '');
  const mIndex = text.match(/\bi\s*=\s*(-?\d+)/i);
  const mTime = text.match(/\btime\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  const mEnergy = text.match(/\b(?:ENERGY|Energy|E)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  const mTempC = text.match(/(?:T|Temp|Temperature)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
  return {
    sourceIndex: mIndex ? Number(mIndex[1]) : null,
    time: mTime ? Number(mTime[1]) : null,
    energy: mEnergy ? Number(mEnergy[1]) : null,
    temperatureC: mTempC ? Number(mTempC[1]) : null,
  };
}

function parseXYZFile(filePath, trajectoryId) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const frames = [];
  let cursor = 0;
  let frameNo = 0;
  let atomCountReference = null;

  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor >= lines.length) break;

    const countMatch = lines[cursor].trim().match(/^(\d+)$/);
    if (!countMatch) {
      throw new Error(`${trajectoryId}: 第 ${cursor + 1} 行不是有效 XYZ 原子数：${lines[cursor]}`);
    }

    const atomCount = Number(countMatch[1]);
    if (atomCount <= 0) throw new Error(`${trajectoryId}: 原子数异常：${atomCount}`);
    if (atomCountReference === null) atomCountReference = atomCount;
    if (atomCount !== atomCountReference) {
      throw new Error(`${trajectoryId}: 第 ${frameNo + 1} 帧原子数 ${atomCount} 与首帧 ${atomCountReference} 不一致`);
    }

    const comment = lines[cursor + 1] ?? '';
    const meta = parseMeta(comment);
    cursor += 2;

    const atoms = new Array(atomCount);
    for (let i = 0; i < atomCount; i++, cursor++) {
      const line = lines[cursor];
      if (line == null) throw new Error(`${trajectoryId}: 第 ${frameNo + 1} 帧提前结束`);
      const parts = line.trim().split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 4) throw new Error(`${trajectoryId}: 坐标行异常：${line}`);
      const element = normalizeElement(parts[0]);
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!element || ![x, y, z].every(Number.isFinite)) {
        throw new Error(`${trajectoryId}: 坐标行存在无效元素或数字：${line}`);
      }
      atoms[i] = { index: i + 1, element, x, y, z };
    }

    frames.push({
      frame: frameNo,
      sourceIndex: meta.sourceIndex ?? frameNo,
      time: meta.time,
      energy: meta.energy,
      temperatureC: meta.temperatureC,
      atomCount,
      atoms,
      frameCount: null,
    });
    frameNo++;
  }

  for (const frame of frames) frame.frameCount = frames.length;
  return frames;
}

function quantize(value) {
  return Math.round(value / CELL_ROUND_A) * CELL_ROUND_A;
}

function inferCellLengths(frames) {
  const hist = [new Map(), new Map(), new Map()];
  if (frames.length < 2) return [null, null, null];

  // 只检测相邻帧的明显周期性大跳变；真实热运动不会在整个轨迹中反复出现同一个 7 Å 以上跳变。
  for (let fi = 1; fi < frames.length; fi++) {
    const prev = frames[fi - 1].atoms;
    const cur = frames[fi].atoms;
    for (let i = 0; i < prev.length; i++) {
      const dx = Math.abs(cur[i].x - prev[i].x);
      const dy = Math.abs(cur[i].y - prev[i].y);
      const dz = Math.abs(cur[i].z - prev[i].z);
      const diffs = [dx, dy, dz];
      for (let ax = 0; ax < 3; ax++) {
        const d = diffs[ax];
        if (d < CELL_JUMP_MIN_A || d > 25) continue;
        const q = quantize(d);
        hist[ax].set(q, (hist[ax].get(q) || 0) + 1);
      }
    }
  }

  return hist.map(map => {
    const candidates = [...map.entries()]
      .filter(([len, count]) => count >= CELL_MIN_OCCURRENCES && len >= CELL_JUMP_MIN_A)
      .sort((a, b) => b[1] - a[1]);
    return candidates.length ? Number(candidates[0][0].toFixed(4)) : null;
  });
}

function wrapDelta(delta, cell) {
  if (!Number.isFinite(cell) || cell <= 0) return delta;
  return delta - Math.round(delta / cell) * cell;
}

function centroid(atoms) {
  let x = 0, y = 0, z = 0;
  for (const a of atoms) {
    x += a.x;
    y += a.y;
    z += a.z;
  }
  const n = atoms.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

function pbcAlignedRmsd(frameA, frameB, cellLengths) {
  if (frameA.atomCount !== frameB.atomCount) return Number.POSITIVE_INFINITY;
  for (let i = 0; i < frameA.atomCount; i++) {
    if (frameA.atoms[i].element !== frameB.atoms[i].element) return Number.POSITIVE_INFINITY;
  }

  const ca = centroid(frameA.atoms);
  const cb = centroid(frameB.atoms);
  const shift = [
    wrapDelta(ca.x - cb.x, cellLengths[0]),
    wrapDelta(ca.y - cb.y, cellLengths[1]),
    wrapDelta(ca.z - cb.z, cellLengths[2]),
  ];

  let sum = 0;
  for (let i = 0; i < frameA.atomCount; i++) {
    const a = frameA.atoms[i];
    const b = frameB.atoms[i];
    const dx = wrapDelta((a.x - b.x) - shift[0], cellLengths[0]);
    const dy = wrapDelta((a.y - b.y) - shift[1], cellLengths[1]);
    const dz = wrapDelta((a.z - b.z) - shift[2], cellLengths[2]);
    sum += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sum / frameA.atomCount);
}

function seededUInt(seedText) {
  const hex = crypto.createHash('sha256').update(String(seedText)).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

function randomTemperatureForModel(material, frameNo) {
  const seed = `${TEMPERATURE_SEED}|${material}|${frameNo}`;
  const integerRange = Math.max(1, Math.floor(TEMP_MAX_C - TEMP_MIN_C + 1));
  const u = seededUInt(seed) / 0xFFFFFFFF;
  const temperatureC = Math.min(TEMP_MAX_C, TEMP_MIN_C + Math.floor(u * integerRange));
  return {
    temperatureC,
    temperatureNodeC: null,
    source: 'random-assumption-0-400C',
  };
}

function inferTemperature(frame, material) {
  if (TEMPERATURE_MODE === 'xyz' && Number.isFinite(frame.temperatureC)) {
    return { temperatureC: frame.temperatureC, temperatureNodeC: null, source: 'xyz-comment' };
  }
  if (TEMPERATURE_MODE === 'linear') {
    const ratio = frame.frameCount <= 1 ? 0 : frame.frame / (frame.frameCount - 1);
    const temperatureC = TEMP_MIN_C + (TEMP_MAX_C - TEMP_MIN_C) * ratio;
    return { temperatureC, temperatureNodeC: null, source: 'linear-frame-position-assumption' };
  }
  return randomTemperatureForModel(material, frame.frame);
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function hashAtoms(frame) {
  const raw = frame.atoms.map(a => `${a.element}:${a.x.toFixed(6)},${a.y.toFixed(6)},${a.z.toFixed(6)}`).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function nearestGlobalMatch(candidate, representatives, cellLengths) {
  let best = null;
  for (const rep of representatives) {
    const rmsd = pbcAlignedRmsd(candidate, rep.frameData, cellLengths);
    if (!best || rmsd < best.rmsd) best = { rep, rmsd };
    if (rmsd <= EXACT_RMSD_THRESHOLD_A) break;
  }
  return best;
}


function analyzeTrajectory(trajectory, trajectoryIndex) {
  const sourcePath = path.join(aimdDir, trajectory.file);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`缺少 AIMD 轨迹文件：${sourcePath}`);
  }

  const frames = parseXYZFile(sourcePath, trajectory.id);
  if (!frames.length) {
    throw new Error(`${trajectory.id}: 未解析到有效 AIMD 帧`);
  }

  const cellLengths = inferCellLengths(frames);
  const representatives = [];
  const consecutiveRmsds = [];
  let candidateFrames = 0;
  let reconstructionEvents = 0;
  let recurringStructureMerges = 0;
  let exactRecurring = 0;
  let persistentTransitions = 0;
  let energyFrameCount = 0;

  for (const frame of frames) {
    if (Number.isFinite(frame.energy)) energyFrameCount += 1;
  }

  let active = frames[0];
  let pendingStart = null;
  let pendingStreak = 0;
  let fileReconstructionEvents = 0;

  for (let i = 0; i < frames.length; i += 1) {
    if (i % CANDIDATE_STRIDE !== 0 && i !== frames.length - 1) continue;
    const frame = frames[i];
    candidateFrames += 1;

    if (i > 0) {
      consecutiveRmsds.push(pbcAlignedRmsd(frame, frames[i - 1], cellLengths));
    }

    if (i === 0) {
      representatives.push({
        material: trajectory.id,
        sourceFile: trajectory.file,
        frameData: frame,
        frame: frame.frame,
        sourceIndex: frame.sourceIndex,
        time: frame.time,
        energy: frame.energy,
        triggerRmsdA: 0,
        triggerReason: 'initial-structure',
        mergedFrameCount: 1,
        lastFrame: frame.frame,
      });
      active = frame;
      continue;
    }

    const rmsd = pbcAlignedRmsd(frame, active, cellLengths);
    if (rmsd <= RMSD_THRESHOLD_A) {
      pendingStart = null;
      pendingStreak = 0;
      const activeRep = representatives.find(r => r.frame === active.frame);
      if (activeRep) {
        activeRep.mergedFrameCount += 1;
        activeRep.lastFrame = frame.frame;
      }
      continue;
    }

    if (pendingStart === null) pendingStart = frame;
    pendingStreak += 1;
    if (pendingStreak < PERSISTENCE_FRAMES) continue;

    reconstructionEvents += 1;
    persistentTransitions += 1;
    fileReconstructionEvents += 1;

    const representativeFrame = pendingStart;
    const recurring = nearestGlobalMatch(representativeFrame, representatives, cellLengths);

    if (recurring && recurring.rmsd <= RMSD_THRESHOLD_A) {
      recurringStructureMerges += 1;
      if (recurring.rmsd <= EXACT_RMSD_THRESHOLD_A) exactRecurring += 1;
      recurring.rep.mergedFrameCount += pendingStreak;
      recurring.rep.lastFrame = frame.frame;
    } else {
      representatives.push({
        material: trajectory.id,
        sourceFile: trajectory.file,
        frameData: representativeFrame,
        frame: representativeFrame.frame,
        sourceIndex: representativeFrame.sourceIndex,
        time: representativeFrame.time,
        energy: representativeFrame.energy,
        triggerRmsdA: rmsd,
        triggerReason: 'persistent-pbc-rmsd-reconstruction',
        mergedFrameCount: pendingStreak,
        lastFrame: frame.frame,
      });
    }

    active = representativeFrame;
    pendingStart = null;
    pendingStreak = 0;
  }

  const safeTrajectoryKey = trajectory.key;
  const trajectoryModels = representatives.map((model, modelIndex) => {
    const temperature = inferTemperature(model.frameData, trajectory.id);
    const modelId = `AIMD-${safeTrajectoryKey}-SM-${String(modelIndex + 1).padStart(5, '0')}`;
    const payload = {
      id: modelId,
      trajectoryId: trajectory.id,
      trajectoryFile: trajectory.file,
      material: model.material,
      sourceFile: model.sourceFile,
      frame: model.frame,
      sourceIndex: model.sourceIndex,
      time: model.time,
      energy: model.energy,
      temperatureC: temperature.temperatureC,
      temperatureSource: temperature.source,
      atomCount: model.frameData.atomCount,
      structureHash: hashAtoms(model.frameData),
      triggerRmsdA: Number(model.triggerRmsdA.toFixed(6)),
      triggerReason: model.triggerReason,
      representativeFrameSpan: [model.frame, model.lastFrame],
      mergedFrameCount: model.mergedFrameCount,
      atoms: model.frameData.atoms,
    };

    fs.writeFileSync(path.join(modelDir, `${modelId}.json`), JSON.stringify(payload));

    return {
      ...payload,
      coordinatesUrl: `../models/${modelId}.json`,
      atoms: undefined,
    };
  });

  const temperatureMap = new Map();
  for (const model of trajectoryModels) {
    const t = Number(model.temperatureC);
    if (!Number.isFinite(t)) continue;
    const item = temperatureMap.get(t) || {
      temperatureC: t,
      effectiveStructureCount: 0,
      modelIds: [],
      energyValues: [],
    };
    item.effectiveStructureCount += 1;
    item.modelIds.push(model.id);
    if (Number.isFinite(model.energy)) item.energyValues.push(model.energy);
    temperatureMap.set(t, item);
  }

  const temperatureStats = [...temperatureMap.values()]
    .sort((a, b) => a.temperatureC - b.temperatureC)
    .map(item => ({
      temperatureC: item.temperatureC,
      effectiveStructureCount: item.effectiveStructureCount,
      modelIds: item.modelIds,
      energyAverage: item.energyValues.length
        ? item.energyValues.reduce((sum, value) => sum + value, 0) / item.energyValues.length
        : null,
      energyMin: item.energyValues.length ? Math.min(...item.energyValues) : null,
      energyMax: item.energyValues.length ? Math.max(...item.energyValues) : null,
    }));

  const temperatures = trajectoryModels
    .map(model => Number(model.temperatureC))
    .filter(Number.isFinite);

  const rmsdDiagnostics = {
    count: consecutiveRmsds.length,
    min: consecutiveRmsds.length ? Math.min(...consecutiveRmsds) : null,
    p50: percentile(consecutiveRmsds, 0.50),
    p90: percentile(consecutiveRmsds, 0.90),
    p95: percentile(consecutiveRmsds, 0.95),
    p99: percentile(consecutiveRmsds, 0.99),
    max: consecutiveRmsds.length ? Math.max(...consecutiveRmsds) : null,
  };

  const analysis = {
    version: 5,
    generatedAt: new Date().toISOString(),
    trajectory: {
      index: trajectoryIndex,
      id: trajectory.id,
      file: trajectory.file,
      key: trajectory.key,
      name: trajectory.id,
    },
    assumptions: {
      temperatureAssignment: '当前默认不从XYZ推断真实温度；每个有效结构模型按材料ID+代表帧进行可复现随机赋值，范围为0–400 ℃，用于界面统计展示。',
      temperatureSeed: TEMPERATURE_SEED,
      pbcDefinition: '根据相邻帧坐标反复出现的大周期跳变自动推断晶胞长度，并在 RMSD 中采用最小镜像约定。',
      reconstructionCriterion: `PBC-aware RMSD > ${RMSD_THRESHOLD_A} Å 且持续至少 ${PERSISTENCE_FRAMES} 帧，判定发生结构重构；单帧瞬态跳变不计入新结构。`,
      globalUniquenessCriterion: `仅在当前 AIMD 轨迹内，与此前全部有效结构代表帧逐一进行 PBC-aware RMSD 去重；RMSD ≤ ${RMSD_THRESHOLD_A} Å 视为已出现结构，不新增模型。`,
      candidateStrideFrames: CANDIDATE_STRIDE,
    },
    counts: {
      trajectoryCount: 1,
      frameCount: frames.length,
      candidateFrameCount: candidateFrames,
      temperatureCount: new Set(temperatures).size,
      temperatureMinC: temperatures.length ? Math.min(...temperatures) : null,
      temperatureMaxC: temperatures.length ? Math.max(...temperatures) : null,
      effectiveStructureCount: trajectoryModels.length,
      energyFrameCount,
      reconstructionEvents,
      recurringStructureMerges,
      exactRecurring,
      persistentTransitions,
    },
    rmsdDiagnostics,
    cellInfo: {
      cellLengthsA: cellLengths,
      periodicAxes: ['x', 'y', 'z'].filter((_, i) => Number.isFinite(cellLengths[i])),
    },
    temperatureStats,
    models: trajectoryModels,
  };

  fs.writeFileSync(
    path.join(trajectoryAnalysisDir, `${safeTrajectoryKey}.json`),
    JSON.stringify(analysis, null, 2),
  );

  return {
    trajectory: analysis.trajectory,
    frames: frames.length,
    candidateFrames,
    energyFrameCount,
    effectiveStructureCount: trajectoryModels.length,
    reconstructionEvents,
    recurringStructureMerges,
    analysisUrl: `./trajectories/${safeTrajectoryKey}.json`,
    cellLengthsA: cellLengths,
  };
}

const trajectorySummaries = TRAJECTORIES.map((trajectory, index) => analyzeTrajectory(trajectory, index));
const totalEffectiveStructureCount = trajectorySummaries.reduce(
  (sum, trajectory) => sum + trajectory.effectiveStructureCount,
  0,
);
const totalFrameCount = trajectorySummaries.reduce((sum, trajectory) => sum + trajectory.frames, 0);
const totalCandidateFrames = trajectorySummaries.reduce((sum, trajectory) => sum + trajectory.candidateFrames, 0);
const totalEnergyFrames = trajectorySummaries.reduce((sum, trajectory) => sum + trajectory.energyFrameCount, 0);
const totalReconstructionEvents = trajectorySummaries.reduce((sum, trajectory) => sum + trajectory.reconstructionEvents, 0);
const totalRecurringStructureMerges = trajectorySummaries.reduce((sum, trajectory) => sum + trajectory.recurringStructureMerges, 0);

const publicTrajectoryIndex = TRAJECTORIES.map((trajectory, index) => {
  const summary = trajectorySummaries[index];
  const stat = fs.statSync(path.join(aimdDir, trajectory.file));
  return {
    id: trajectory.id,
    key: trajectory.key,
    name: trajectory.id,
    file: trajectory.file,
    url: `./aimd/${encodeURIComponent(trajectory.file)}`,
    frames: summary.frames,
    effectiveStructureCount: summary.effectiveStructureCount,
    analysisUrl: summary.analysisUrl,
    size: stat.size,
  };
});

fs.writeFileSync(
  path.join(aimdDir, 'index.json'),
  JSON.stringify({
    version: 2,
    generatedAt: new Date().toISOString(),
    trajectoryCount: publicTrajectoryIndex.length,
    models: publicTrajectoryIndex,
    trajectories: publicTrajectoryIndex,
  }, null, 2),
);

const analysisIndex = {
  version: 5,
  generatedAt: new Date().toISOString(),
  trajectoryCount: publicTrajectoryIndex.length,
  counts: {
    trajectoryCount: publicTrajectoryIndex.length,
    frameCount: totalFrameCount,
    candidateFrameCount: totalCandidateFrames,
    effectiveStructureCount: totalEffectiveStructureCount,
    totalEffectiveStructureCount,
    energyFrameCount: totalEnergyFrames,
    reconstructionEvents: totalReconstructionEvents,
    recurringStructureMerges: totalRecurringStructureMerges,
  },
  assumptions: {
    temperatureAssignment: '当前默认不从XYZ推断真实温度；每个有效结构模型按材料ID+代表帧进行可复现随机赋值，范围为0–400 ℃，用于界面统计展示。',
    temperatureSeed: TEMPERATURE_SEED,
    dataPointFactor: 15,
    uniquenessScope: '每条 AIMD 轨迹独立进行结构有效性判定。',
  },
  trajectories: publicTrajectoryIndex,
};

fs.writeFileSync(
  path.join(analysisDir, 'index.json'),
  JSON.stringify(analysisIndex, null, 2),
);

console.log('AIMD 分析完成：');
console.log(`  AIMD 轨迹数量：${publicTrajectoryIndex.length}`);
for (const item of publicTrajectoryIndex) {
  console.log(`  ${item.name}：${item.frames} 帧，${item.effectiveStructureCount} 个有效结构模型`);
}
console.log(`  AIMD 总有效结构模型：${totalEffectiveStructureCount}`);
console.log(`  AIMD 折算数据点：${totalEffectiveStructureCount * 15}`);
console.log(`  结构 RMSD 阈值：${RMSD_THRESHOLD_A} Å`);
console.log(`  持续帧判据：${PERSISTENCE_FRAMES} 帧`);
