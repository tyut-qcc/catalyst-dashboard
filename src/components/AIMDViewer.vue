<template>
  <div class="aimd-page">
    <div class="toolbar-card">
      <div class="toolbar-row">
        <el-button type="primary" @click="fileInput?.click()">上传 XYZ 轨迹</el-button>
        <input ref="fileInput" type="file" accept=".xyz,.txt" hidden @change="onFileUpload" />

        <el-button @click="refreshLibrary" :loading="loadingLibrary">刷新轨迹库</el-button>

        <el-select
          v-model="selectedId"
          placeholder="选择 AIMD 轨迹"
          class="model-select"
          :disabled="loading"
        >
          <el-option
            v-for="item in allTrajectories"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          >
            <div class="option-row">
              <span>{{ item.name }}</span>
              <span class="option-meta">{{ item.frames ?? '—' }} 帧</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <div class="hint">
        AIMD 采用分块懒加载：首次只读取模型索引和首个轨迹块，播放过程中提前缓存后续帧，以减少 GitHub Pages 首次等待时间。
      </div>
    </div>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
      class="mb12"
    />

    <div v-if="loading" class="loading-card">
      <el-icon class="is-loading"><Loading /></el-icon>
      {{ loadingMessage }}
    </div>

    <template v-else-if="totalFrames > 0">
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">当前轨迹</div>
          <div class="value text">{{ currentTrajectoryName }}</div>
        </div>

        <div class="summary-card">
          <div class="label">总帧数</div>
          <div class="value">{{ totalFrames }}</div>
        </div>

        <div class="summary-card">
          <div class="label">原子数</div>
          <div class="value">{{ currentFrameData?.atomCount || selectedTrajectoryMeta?.atomCount || 0 }}</div>
        </div>

        <div class="summary-card">
          <div class="label">当前时间</div>
          <div class="value">{{ currentTimeLabel }}</div>
        </div>

        <div class="summary-card">
          <div class="label">当前能量</div>
          <div class="value" style="font-size: 16px">{{ currentEnergyLabel }}</div>
        </div>

        <div class="summary-card">
          <div class="label">元素组成</div>
          <div class="value text">{{ currentCompositionLabel }}</div>
        </div>
      </div>

      <div class="main-grid">
        <el-card shadow="never" class="viewer-card">
          <template #header>
            <div class="card-header">
              <span>AIMD 动力学轨迹</span>
              <div class="header-tags">
                <el-tag type="info">Frame {{ currentFrame + 1 }} / {{ totalFrames }}</el-tag>
                <el-tag v-if="cacheLabel" type="success">{{ cacheLabel }}</el-tag>
              </div>
            </div>
          </template>

          <div class="viewer-shell">
            <div ref="viewerEl" class="viewer"></div>
          </div>

          <div class="controls">
            <el-button-group>
              <el-button @click="previousFrame">⏮</el-button>
              <el-button type="primary" @click="togglePlaying">
                {{ playing ? '⏸ 暂停' : '▶ 播放' }}
              </el-button>
              <el-button @click="nextFrame">⏭</el-button>
            </el-button-group>

            <el-slider
              v-model="currentFrame"
              :min="0"
              :max="Math.max(totalFrames - 1, 0)"
              :step="1"
              class="frame-slider"
              @change="onSliderChange"
            />

            <el-input-number
              v-model="fps"
              :min="1"
              :max="60"
              :step="1"
              size="small"
              controls-position="right"
            />

            <span class="fps-label">FPS</span>
          </div>

          <div class="element-legend">
            <span v-for="el in currentElements" :key="el" class="legend-item">
              <i :style="{ background: elementColor(el) }"></i>
              {{ el }}
            </span>
          </div>
        </el-card>

        <el-card shadow="never" class="energy-card">
          <template #header>
            <div class="card-header">
              <span>能量变化</span>
              <el-tag v-if="energyValues.length" type="success">单位：eV</el-tag>
            </div>
          </template>

          <div v-if="energyValues.length" class="energy-panel">
            <svg
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              class="energy-chart"
              preserveAspectRatio="none"
            >
              <line
                :x1="chartPad.left"
                :y1="chartPad.top"
                :x2="chartPad.left"
                :y2="chartHeight - chartPad.bottom"
                class="axis"
              />

              <line
                :x1="chartPad.left"
                :y1="chartHeight - chartPad.bottom"
                :x2="chartWidth - chartPad.right"
                :y2="chartHeight - chartPad.bottom"
                class="axis"
              />

              <polyline :points="chartPoints" fill="none" class="energy-line" />

              <circle
                v-if="currentEnergyPoint"
                :cx="currentEnergyPoint.x"
                :cy="currentEnergyPoint.y"
                r="4"
                class="energy-point"
              />
            </svg>

            <div class="chart-footer">
              <span>Time {{ chartStartTimeLabel }}</span>
              <span>当前：t={{ currentTimeLabel }}，E={{ currentEnergyLabel }}</span>
              <span>Frame {{ totalFrames }}</span>
            </div>
          </div>

          <el-empty v-else description="未检测到能量数据" :image-size="80" />
        </el-card>
      </div>
    </template>

    <el-empty
      v-else
      description="请选择轨迹文件，或点击“上传 XYZ 轨迹”加载多帧 AIMD 轨迹"
    />
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue';
import { Loading } from '@element-plus/icons-vue';
import * as $3Dmol from '3dmol';

const props = defineProps({
  isActive: {
    type: Boolean,
    default: false
  }
});

const BASE_URL = import.meta.env.BASE_URL || '/';
const INDEX_URL = `${BASE_URL}aimd/index.json`;
const AIMD_DIR_URL = `${BASE_URL}aimd/`;
const FALLBACK_CHUNK_SIZE = 25;
const PRELOAD_AHEAD = 2;
const PRELOAD_TRIGGER = 8;

const fileInput = ref(null);
const viewerEl = ref(null);
const viewer = ref(null);

const trajectories = ref([]);
const uploadedTrajectories = ref([]);
const selectedId = ref('');
const selectedTrajectoryMeta = ref(null);
const currentFrame = ref(0);
const visibleFrames = ref([]);
const playing = ref(false);
const fps = ref(8);
const loading = ref(false);
const loadingMessage = ref('正在读取 AIMD 轨迹…');
const loadingLibrary = ref(false);
const errorMessage = ref('');

const chunkCache = new Map();
const chunkPromises = new Map();
const pdbCache = new Map();
let activeTrajectoryToken = 0;
let renderToken = 0;
let timer = null;
let advanceBusy = false;
let resizeObserver = null;
let needsZoom = true;

const palette = {
  H: '#FFFFFF', C: '#555555', N: '#3050F8', O: '#FF0D0D', F: '#90E050', Cl: '#1FF01F',
  Br: '#A62929', I: '#940094', P: '#FF8000', S: '#FFFF30', Si: '#F0C8A0', B: '#FFB5B5',
  Na: '#AB5CF2', Mg: '#8AFF00', Al: '#BFA6A6', K: '#8F40D4', Ca: '#3DFF00', Sc: '#E6E6E6',
  Ti: '#BFC2C7', V: '#A6A6AB', Cr: '#8A99C7', Mn: '#9C7AC7', Fe: '#E06633', Co: '#F090A0',
  Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0', Y: '#94FFFF', Zr: '#94E0E0', Nb: '#73C2C9',
  Mo: '#54B5B5', Tc: '#3B9E9E', Ru: '#248F8F', Rh: '#0A7D8C', Pd: '#006985', Ag: '#C0C0C0',
  Cd: '#FFD98F', In: '#A67573', Sn: '#668080', Sb: '#9E63B5', Te: '#D47A00', Cs: '#57178F',
  Ba: '#00C900', La: '#70D4FF', Ce: '#FFFF00', Pr: '#D9FFC8', Nd: '#C7FFC7', Sm: '#8FFFC7',
  Eu: '#61FFC7', Gd: '#45FFC7', Tb: '#30FFC7', Dy: '#1FFFC7', Ho: '#00FF9C', Er: '#00E675',
  Tm: '#00D452', Yb: '#00BF38', Lu: '#00AB24', Hf: '#4DC2FF', Ta: '#4DA6FF', W: '#2194D6',
  Re: '#267DA9', Os: '#266696', Ir: '#175487', Pt: '#D0D0E0', Au: '#FFD123', Hg: '#B8B8D0'
};

const normalizeElement = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const letters = s.match(/[A-Za-z]{1,2}/)?.[0] || s;
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
};

const elementColor = (el) => palette[normalizeElement(el)] || '#FF69B4';

const allTrajectories = computed(() => [...trajectories.value, ...uploadedTrajectories.value]);
const currentFrameData = computed(() => visibleFrames.value.find((f) => f.globalIndex === currentFrame.value) || null);
const totalFrames = computed(() => selectedTrajectoryMeta.value?.frames ?? visibleFrames.value.length);
const currentTrajectoryName = computed(() => selectedTrajectoryMeta.value?.name || selectedId.value || '');

const energySeries = computed(() => {
  const meta = selectedTrajectoryMeta.value;
  if (!meta) return [];
  const times = Array.isArray(meta.times) ? meta.times : [];
  const energies = Array.isArray(meta.energies) ? meta.energies : [];
  const count = Math.max(times.length, energies.length, meta.frames || 0);
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    time: Number.isFinite(times[i]) ? times[i] : i,
    energy: Number.isFinite(energies[i]) ? energies[i] : null
  }));
});

const energyValues = computed(() => energySeries.value.filter((p) => p.energy !== null));
const currentEnergy = computed(() => {
  const frame = currentFrameData.value;
  if (Number.isFinite(frame?.energy)) return frame.energy;
  return energySeries.value[currentFrame.value]?.energy ?? null;
});
const currentTime = computed(() => {
  const frame = currentFrameData.value;
  if (Number.isFinite(frame?.time)) return frame.time;
  return energySeries.value[currentFrame.value]?.time ?? null;
});
const currentEnergyLabel = computed(() => Number.isFinite(currentEnergy.value) ? `${currentEnergy.value.toFixed(6)} eV` : '—');
const currentTimeLabel = computed(() => Number.isFinite(currentTime.value) ? currentTime.value.toFixed(3) : '—');
const chartStartTimeLabel = computed(() => Number.isFinite(energySeries.value[0]?.time) ? Number(energySeries.value[0].time).toFixed(3) : '0');

const currentElements = computed(() => [...new Set((currentFrameData.value?.atoms || []).map((a) => normalizeElement(a.element)).filter(Boolean))]);
const currentCompositionLabel = computed(() => {
  const counts = new Map();
  for (const atom of currentFrameData.value?.atoms || []) {
    const el = normalizeElement(atom.element);
    if (!el) continue;
    counts.set(el, (counts.get(el) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en')).map(([el, n]) => `${el}${n}`).join(' · ') || '—';
});

const cacheLabel = computed(() => {
  if (!selectedTrajectoryMeta.value?.chunks?.length) return '';
  return `缓存 ${chunkCache.size}/${selectedTrajectoryMeta.value.chunks.length} 块`;
});

const chartWidth = 640;
const chartHeight = 260;
const chartPad = { left: 42, right: 12, top: 12, bottom: 28 };

const chartPoints = computed(() => {
  const pts = energyValues.value;
  if (!pts.length) return '';
  const min = Math.min(...pts.map((p) => p.energy));
  const max = Math.max(...pts.map((p) => p.energy));
  const span = max - min || 1;
  const w = chartWidth - chartPad.left - chartPad.right;
  const h = chartHeight - chartPad.top - chartPad.bottom;
  const maxIndex = Math.max(totalFrames.value - 1, 1);
  return pts.map((p) => {
    const x = chartPad.left + (p.index / maxIndex) * w;
    const y = chartPad.top + ((max - p.energy) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});

const currentEnergyPoint = computed(() => {
  const pts = energyValues.value;
  const current = energySeries.value[currentFrame.value];
  if (!pts.length || !current || current.energy === null) return null;
  const min = Math.min(...pts.map((p) => p.energy));
  const max = Math.max(...pts.map((p) => p.energy));
  const span = max - min || 1;
  const w = chartWidth - chartPad.left - chartPad.right;
  const h = chartHeight - chartPad.top - chartPad.bottom;
  const maxIndex = Math.max(totalFrames.value - 1, 1);
  return {
    x: chartPad.left + (current.index / maxIndex) * w,
    y: chartPad.top + ((max - current.energy) / span) * h
  };
});

const parseFrameMeta = (comment) => {
  const text = String(comment || '').trim();
  const frameMatch = text.match(/\bi\s*=\s*(-?\d+)/i);
  const timeMatch = text.match(/\btime\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  const energyMatch = text.match(/\bE\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  return {
    index: frameMatch ? Number(frameMatch[1]) : null,
    time: timeMatch ? Number(timeMatch[1]) : null,
    energy: energyMatch ? Number(energyMatch[1]) : null
  };
};

const parseXYZTrajectory = (text) => {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const result = [];
  let cursor = 0;
  let expectedAtomCount = null;

  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor >= lines.length) break;
    const countText = lines[cursor].trim();
    if (!/^\d+$/.test(countText)) throw new Error(`第 ${cursor + 1} 行不是有效的原子数：${lines[cursor]}`);
    const count = Number(countText);
    if (!Number.isSafeInteger(count) || count <= 0) throw new Error(`第 ${cursor + 1} 行原子数无效：${countText}`);
    if (expectedAtomCount === null) expectedAtomCount = count;
    if (count !== expectedAtomCount) throw new Error(`第 ${result.length + 1} 帧原子数为 ${count}，但前面的帧均为 ${expectedAtomCount}。`);

    const comment = lines[cursor + 1] ?? '';
    const meta = parseFrameMeta(comment);
    cursor += 2;
    const atoms = new Array(count);

    for (let n = 0; n < count; n++, cursor++) {
      if (cursor >= lines.length) throw new Error(`第 ${result.length + 1} 帧文件提前结束。`);
      const raw = lines[cursor].trim();
      const parts = raw.split(/\s+/);
      if (parts.length < 4) throw new Error(`第 ${cursor + 1} 行原子坐标格式异常：${lines[cursor]}`);
      const element = normalizeElement(parts[0]);
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!element || [x, y, z].some((v) => !Number.isFinite(v))) throw new Error(`第 ${cursor + 1} 行存在无效元素或坐标。`);
      atoms[n] = { element, x, y, z };
    }

    result.push({
      globalIndex: result.length,
      comment,
      index: meta.index ?? result.length,
      time: meta.time,
      energy: meta.energy,
      atomCount: count,
      atoms,
      pdb: null
    });
  }
  return result;
};

const covalentRadius = {
  H: 0.31, B: 0.85, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Si: 1.11, P: 1.07, S: 1.05,
  Cl: 1.02, Br: 1.20, I: 1.39, Na: 1.66, Mg: 1.41, Al: 1.21, K: 2.03, Ca: 1.76, Sc: 1.70,
  Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22,
  Y: 1.90, Zr: 1.75, Nb: 1.64, Mo: 1.54, Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44,
  Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41, Pt: 1.36, Au: 1.36, Hg: 1.32,
  Ce: 1.81, La: 1.87, Pr: 1.82, Nd: 1.81, Sm: 1.80, Eu: 1.98, Gd: 1.80, Tb: 1.76, Dy: 1.75,
  Ho: 1.74, Er: 1.73, Tm: 1.72, Yb: 1.94, Lu: 1.72
};
const nonmetalElements = new Set(['H','B','C','N','O','F','Si','P','S','Cl','Br','I']);
const metalElements = new Set(Object.keys(covalentRadius).filter((e) => !nonmetalElements.has(e)));
const bondScale = 1.18;
const bondMin = 0.70;
const pairCutoff = {
  'Ce-O': 2.72, 'Pt-O': 2.35, 'Pt-Pt': 3.25, 'Pd-O': 2.35, 'Pd-Pd': 3.10, 'Rh-O': 2.35, 'Rh-Rh': 3.10,
  'Co-O': 2.25, 'Ni-O': 2.20, 'Cu-O': 2.25, 'Fe-O': 2.25, 'Ti-O': 2.30, 'Cr-O': 2.30
};
const pairKey = (a, b) => [normalizeElement(a), normalizeElement(b)].sort().join('-');

const canBond = (a, b, distance) => {
  const ea = normalizeElement(a.element);
  const eb = normalizeElement(b.element);
  const key = pairKey(ea, eb);
  if (Object.prototype.hasOwnProperty.call(pairCutoff, key)) return distance <= pairCutoff[key] && distance >= bondMin;
  if (ea === 'O' && eb === 'O') return distance <= 1.75 && distance >= bondMin;
  if (ea === 'H' && eb === 'H') return distance <= 0.90 && distance >= bondMin;
  const bothMetal = metalElements.has(ea) && metalElements.has(eb);
  if (bothMetal && ea !== eb) return false;
  if (bothMetal && ea === 'Ce') return false;
  const ra = covalentRadius[ea] ?? 1.0;
  const rb = covalentRadius[eb] ?? 1.0;
  const cutoff = (ra + rb) * bondScale;
  return distance <= cutoff && distance >= bondMin;
};

const buildBonds = (frame) => {
  const atoms = frame.atoms || [];
  const bonds = [];
  if (atoms.length < 2) return bonds;

  const maxRadius = Math.max(0.9, ...atoms.map((a) => covalentRadius[normalizeElement(a.element)] ?? 1.0));
  const cellSize = Math.max(2.8, (maxRadius * 2 + 0.45) * bondScale);
  const grid = new Map();
  const cellCoord = (x) => Math.floor(x / cellSize);
  const cellKey = (ix, iy, iz) => `${ix}|${iy}|${iz}`;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const key = cellKey(cellCoord(a.x), cellCoord(a.y), cellCoord(a.z));
    const list = grid.get(key);
    if (list) list.push(i); else grid.set(key, [i]);
  }

  for (let i = 0; i < atoms.length; i++) {
    const ai = atoms[i];
    const cx = cellCoord(ai.x);
    const cy = cellCoord(ai.y);
    const cz = cellCoord(ai.z);

    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      for (let dyCell = -1; dyCell <= 1; dyCell++) {
        for (let dzCell = -1; dzCell <= 1; dzCell++) {
          const candidates = grid.get(cellKey(cx + dxCell, cy + dyCell, cz + dzCell));
          if (!candidates) continue;

          for (const j of candidates) {
            if (j <= i) continue;
            const aj = atoms[j];
            const dx = ai.x - aj.x;
            const dy = ai.y - aj.y;
            const dz = ai.z - aj.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bondMin * bondMin) continue;

            const maxCutoff = pairCutoff[pairKey(ai.element, aj.element)] ??
              ((covalentRadius[normalizeElement(ai.element)] ?? 1.0) +
               (covalentRadius[normalizeElement(aj.element)] ?? 1.0)) * bondScale;
            if (d2 > maxCutoff * maxCutoff) continue;

            const distance = Math.sqrt(d2);
            if (canBond(ai, aj, distance)) bonds.push([i + 1, j + 1]);
          }
        }
      }
    }
  }
  return bonds;
};

const atomToPdbLine = (atom, serial) => {
  const element = normalizeElement(atom.element).toUpperCase().padEnd(2).slice(0, 2);
  const atomName = normalizeElement(atom.element).padStart(4).slice(-4);
  return [
    'ATOM  ', String(serial).padStart(5), ' ', atomName, ' ', 'AIM', ' A', '   1', '    ',
    atom.x.toFixed(3).padStart(8), atom.y.toFixed(3).padStart(8), atom.z.toFixed(3).padStart(8),
    '  1.00  0.00          ', element
  ].join('');
};

const frameToPdb = (frame) => {
  if (frame.pdb) return frame.pdb;
  const atomLines = frame.atoms.map((atom, idx) => atomToPdbLine(atom, idx + 1));
  const bondLines = buildBonds(frame).map(([a, b]) => `CONECT${String(a).padStart(5, ' ')}${String(b).padStart(5, ' ')}`);
  frame.pdb = [...atomLines, ...bondLines, 'END'].join('\n');
  return frame.pdb;
};

const parseChunkText = (text, startFrame = 0) => {
  const parsed = parseXYZTrajectory(text);
  return parsed.map((frame, i) => ({ ...frame, globalIndex: startFrame + i }));
};

const buildLocalMeta = (id, name, parsed, file = '') => ({
  id,
  name,
  file,
  local: true,
  atomCount: parsed[0]?.atomCount || 0,
  frames: parsed.length,
  chunkSize: parsed.length,
  chunks: [{ index: 0, startFrame: 0, endFrame: Math.max(parsed.length - 1, 0), file: '' }],
  times: parsed.map((f) => f.time),
  energies: parsed.map((f) => f.energy),
  localFrames: parsed
});

const clearChunkCache = () => {
  chunkCache.clear();
  chunkPromises.clear();
  pdbCache.clear();
};

const loadLibrary = async () => {
  loadingLibrary.value = true;
  try {
    const res = await fetch(`${INDEX_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`轨迹索引读取失败（HTTP ${res.status}）`);
    const json = await res.json();
    trajectories.value = Array.isArray(json) ? json : (Array.isArray(json.models) ? json.models : []);
    if (!selectedId.value && trajectories.value.length) selectedId.value = trajectories.value[0].id;
  } catch (e) {
    trajectories.value = [];
    errorMessage.value = e?.message || '模型库加载失败';
  } finally {
    loadingLibrary.value = false;
  }
};

const refreshLibrary = async () => {
  await loadLibrary();
  if (selectedId.value) await loadSelectedTrajectory();
};

const resolveTrajectoryUrl = (relativePath) => {
  return new URL(relativePath, new URL(AIMD_DIR_URL, window.location.href)).href;
};

const getChunkDescriptor = (meta, chunkIndex) => {
  const chunks = Array.isArray(meta?.chunks) ? meta.chunks : [];
  return chunks[chunkIndex] || null;
};

const getChunkIndex = (frameIndex, meta = selectedTrajectoryMeta.value) => {
  const size = Number(meta?.chunkSize) || FALLBACK_CHUNK_SIZE;
  const chunks = Array.isArray(meta?.chunks) ? meta.chunks : [];
  if (chunks.length) {
    const found = chunks.findIndex((c) => frameIndex >= c.startFrame && frameIndex <= c.endFrame);
    if (found >= 0) return found;
  }
  return Math.floor(frameIndex / size);
};

const loadChunk = async (chunkIndex, token = activeTrajectoryToken) => {
  if (!selectedTrajectoryMeta.value) return null;
  if (chunkCache.has(chunkIndex)) return chunkCache.get(chunkIndex);
  if (chunkPromises.has(chunkIndex)) return chunkPromises.get(chunkIndex);

  const meta = selectedTrajectoryMeta.value;
  const descriptor = getChunkDescriptor(meta, chunkIndex);

  if (meta.local) {
    const localFrames = meta.localFrames || [];
    const chunk = localFrames.map((frame, i) => ({ ...frame, globalIndex: i }));
    chunkCache.set(0, chunk);
    return chunk;
  }

  // Backward-compatible fallback for an old index.json without generated chunks.
  if (!descriptor) {
    if (!meta.file || chunkIndex !== 0) return null;
    const promise = (async () => {
      const url = resolveTrajectoryUrl(meta.file);
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`轨迹文件读取失败（HTTP ${res.status}）：${meta.file}`);
      const parsed = parseXYZTrajectory(await res.text());
      const chunk = parsed.map((frame, i) => ({ ...frame, globalIndex: i }));
      chunkCache.set(0, chunk);
      return chunk;
    })();
    chunkPromises.set(0, promise);
    try { return await promise; } finally { chunkPromises.delete(0); }
  }

  const promise = (async () => {
    const url = resolveTrajectoryUrl(descriptor.file);
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`轨迹分块读取失败（HTTP ${res.status}）：${descriptor.file}`);
    if (token !== activeTrajectoryToken) return null;
    const chunk = parseChunkText(await res.text(), descriptor.startFrame);
    chunkCache.set(chunkIndex, chunk);
    return chunk;
  })();

  chunkPromises.set(chunkIndex, promise);
  try {
    return await promise;
  } finally {
    chunkPromises.delete(chunkIndex);
  }
};

const preloadNearbyChunks = (frameIndex) => {
  const meta = selectedTrajectoryMeta.value;
  if (!meta?.chunks?.length) return;
  const currentChunk = getChunkIndex(frameIndex, meta);
  const descriptor = getChunkDescriptor(meta, currentChunk);
  if (!descriptor) return;
  if (frameIndex === 0 || frameIndex - descriptor.startFrame >= PRELOAD_TRIGGER) {
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = currentChunk + i;
      if (next < meta.chunks.length) loadChunk(next).catch(() => {});
    }
  }
};

const setVisibleFrame = (frameIndex) => {
  const chunkIndex = getChunkIndex(frameIndex);
  const chunk = chunkCache.get(chunkIndex);
  if (!chunk) return false;
  visibleFrames.value = chunk;
  return true;
};

const ensureFrameLoaded = async (frameIndex) => {
  const meta = selectedTrajectoryMeta.value;
  if (!meta || frameIndex < 0 || frameIndex >= (meta.frames || 0)) return null;
  const chunkIndex = getChunkIndex(frameIndex, meta);
  let chunk = chunkCache.get(chunkIndex);
  if (!chunk) chunk = await loadChunk(chunkIndex);
  if (!chunk) return null;
  setVisibleFrame(frameIndex);
  preloadNearbyChunks(frameIndex);
  return chunk.find((frame) => frame.globalIndex === frameIndex) || null;
};

const loadSelectedTrajectory = async () => {
  const token = ++activeTrajectoryToken;
  const item = allTrajectories.value.find((x) => x.id === selectedId.value);
  if (!item) return;

  loading.value = true;
  loadingMessage.value = '正在读取模型索引与首个轨迹块…';
  errorMessage.value = '';
  stopPlayback();
  clearChunkCache();
  selectedTrajectoryMeta.value = null;
  visibleFrames.value = [];
  currentFrame.value = 0;
  needsZoom = true;
  destroyViewer();

  try {
    let meta = item;
    if (item.local) {
      meta = item;
    }
    selectedTrajectoryMeta.value = meta;

    if (!meta.local && !meta.chunks?.length) {
      loadingMessage.value = '当前索引为旧格式，正在兼容读取整条轨迹…';
    } else {
      loadingMessage.value = '正在加载首个轨迹块…';
    }

    const frame = await ensureFrameLoaded(0);
    if (token !== activeTrajectoryToken) return;
    if (!frame) throw new Error('没有解析到首帧 AIMD 数据');

    await nextTick();
    await renderCurrentFrame(token);
  } catch (e) {
    if (token !== activeTrajectoryToken) return;
    errorMessage.value = e?.message || '轨迹加载失败';
    selectedTrajectoryMeta.value = null;
    visibleFrames.value = [];
  } finally {
    if (token === activeTrajectoryToken) loading.value = false;
  }
};

const onFileUpload = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    loading.value = true;
    loadingMessage.value = '正在解析本地 XYZ 轨迹…';
    const parsed = parseXYZTrajectory(await file.text());
    if (!parsed.length) throw new Error('没有解析到任何 AIMD 帧');
    const id = `upload-${Date.now()}`;
    const meta = buildLocalMeta(id, file.name, parsed);
    uploadedTrajectories.value.push(meta);
    selectedId.value = id;
  } catch (e) {
    errorMessage.value = e?.message || 'XYZ 轨迹解析失败';
  } finally {
    loading.value = false;
  }
};

const createViewer = () => {
  if (!viewerEl.value) return null;
  viewer.value = $3Dmol.createViewer(viewerEl.value, { backgroundColor: 'white' });
  return viewer.value;
};

const refreshViewerLayout = () => {
  const v = viewer.value;
  const el = viewerEl.value;
  if (!v || !el || el.clientWidth < 20 || el.clientHeight < 20) return false;
  try {
    if (typeof v.resize === 'function') v.resize();
    v.render();
    return true;
  } catch (e) {
    console.warn('AIMD viewer resize/render failed:', e);
    return false;
  }
};

const destroyViewer = () => {
  ++renderToken;
  if (viewer.value) {
    try { viewer.value.clear(); } catch (e) { console.warn('AIMD viewer 清理失败:', e); }
    viewer.value = null;
  }
};

const scheduleRender = () => {
  const token = ++renderToken;
  let attempts = 0;
  const run = () => {
    if (token !== renderToken) return;
    attempts += 1;
    const el = viewerEl.value;
    if (!el || el.clientWidth < 20 || el.clientHeight < 20) {
      if (attempts < 30) requestAnimationFrame(run);
      return;
    }
    renderCurrentFrame().catch((e) => console.error(e));
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
};

const renderCurrentFrame = async (expectedToken = activeTrajectoryToken) => {
  if (expectedToken !== activeTrajectoryToken) return;
  const frame = await ensureFrameLoaded(currentFrame.value);
  if (!frame || expectedToken !== activeTrajectoryToken) return;
  await nextTick();
  const el = viewerEl.value;
  if (!el || el.clientWidth < 20 || el.clientHeight < 20) {
    scheduleRender();
    return;
  }

  if (!viewer.value) createViewer();
  const v = viewer.value;
  if (!v) return;

  try {
    v.removeAllModels();
    const model = v.addModel(frameToPdb(frame), 'pdb');
    if (!model) throw new Error('3Dmol 未能创建当前帧模型');

    model.setStyle({}, {
      stick: { radius: 0.16, colorscheme: 'Jmol' },
      sphere: { scale: 0.28, colorscheme: 'Jmol' }
    });

    frame.atoms.forEach((atom, idx) => {
      const color = elementColor(atom.element);
      model.setStyle({ serial: idx + 1 }, {
        stick: { radius: 0.16, color },
        sphere: { scale: 0.28, color }
      });
    });

    refreshViewerLayout();
    if (needsZoom) {
      v.zoomTo();
      needsZoom = false;
    }
    v.render();
  } catch (e) {
    console.error('AIMD 3D rendering error:', e);
    errorMessage.value = `AIMD 三维结构渲染失败：${e?.message || e}`;
  }
};

const onSliderChange = async (value) => {
  stopPlayback();
  currentFrame.value = Number(value);
  await renderCurrentFrame();
};

const nextFrame = async () => {
  if (!totalFrames.value || advanceBusy) return;
  advanceBusy = true;
  try {
    const next = Math.min(currentFrame.value + 1, totalFrames.value - 1);
    if (next === currentFrame.value && playing.value) {
      stopPlayback();
      return;
    }
    currentFrame.value = next;
    await renderCurrentFrame();
  } finally {
    advanceBusy = false;
  }
};

const previousFrame = async () => {
  if (!totalFrames.value) return;
  stopPlayback();
  currentFrame.value = Math.max(currentFrame.value - 1, 0);
  await renderCurrentFrame();
};

const startPlayback = () => {
  stopPlayback();
  playing.value = true;
  timer = window.setInterval(() => {
    nextFrame().catch(() => {});
  }, Math.max(20, 1000 / fps.value));
};

const stopPlayback = () => {
  playing.value = false;
  if (timer) window.clearInterval(timer);
  timer = null;
};

const togglePlaying = () => {
  if (playing.value) stopPlayback();
  else startPlayback();
};

watch(selectedId, async (id) => {
  if (!id || !props.isActive) return;
  await loadSelectedTrajectory();
});

watch(fps, () => {
  if (playing.value) startPlayback();
});

watch(() => props.isActive, async (active) => {
  if (!active) return;
  if (!selectedTrajectoryMeta.value && selectedId.value) {
    await loadSelectedTrajectory();
    return;
  }
  if (selectedTrajectoryMeta.value) {
    needsZoom = true;
    await nextTick();
    destroyViewer();
    scheduleRender();
  }
});

const onWindowResize = () => {
  if (props.isActive) refreshViewerLayout();
};

onMounted(async () => {
  if (viewerEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (props.isActive) refreshViewerLayout();
    });
    resizeObserver.observe(viewerEl.value);
  }
  window.addEventListener('resize', onWindowResize);
  await loadLibrary();
  if (selectedId.value && props.isActive) await loadSelectedTrajectory();
});

onBeforeUnmount(() => {
  stopPlayback();
  ++activeTrajectoryToken;
  ++renderToken;
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('resize', onWindowResize);
  destroyViewer();
  clearChunkCache();
});
</script>

<style scoped>
.aimd-page { padding: 4px 0 20px; min-width: 0; overflow: hidden; }
.toolbar-card, .loading-card { background:white; border:1px solid #ebeef5; border-radius:8px; padding:14px 16px; margin-bottom:12px; }
.toolbar-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.model-select { min-width:280px; flex:1; max-width:520px; }
.option-row { display:flex; justify-content:space-between; gap:18px; width:100%; }
.option-meta { color:#909399; font-size:12px; }
.hint { color:#909399; font-size:12px; margin-top:10px; line-height:1.6; }
.mb12 { margin-bottom:12px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
.summary-card { background:white; border:1px solid #ebeef5; border-radius:8px; padding:12px 14px; min-width:0; }
.summary-card .label { color:#909399; font-size:12px; margin-bottom:6px; }
.summary-card .value { font-weight:600; font-size:20px; color:#303133; }
.summary-card .value.text { font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.main-grid { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(320px,.9fr); gap:12px; align-items:start; }
.viewer-card, .energy-card { border-radius:8px; min-width:0; }
.card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.header-tags { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
.viewer-shell { width:100%; height:520px; max-height:520px; min-height:360px; overflow:hidden; border:1px solid #ebeef5; border-radius:6px; background:#fff; position:relative; contain:strict; }
.viewer { width:100%; height:100%; overflow:hidden; }
.viewer :deep(canvas) { display:block!important; width:100%!important; height:100%!important; max-width:100%!important; }
.controls { display:flex; align-items:center; gap:10px; margin-top:12px; flex-wrap:wrap; }
.frame-slider { flex:1; min-width:220px; }
.fps-label { color:#909399; font-size:12px; margin-left:-8px; }
.element-legend { display:flex; flex-wrap:wrap; gap:10px 14px; margin-top:12px; color:#606266; font-size:12px; }
.legend-item { display:inline-flex; align-items:center; gap:5px; }
.legend-item i { width:12px; height:12px; border-radius:50%; display:inline-block; border:1px solid rgba(0,0,0,.12); }
.energy-panel { width:100%; overflow:hidden; }
.energy-chart { width:100%; height:300px; display:block; }
.axis { stroke:#c0c4cc; stroke-width:1; }
.energy-line { stroke:#409eff; stroke-width:2.5; }
.energy-point { fill:#f56c6c; stroke:white; stroke-width:2; }
.chart-footer { display:flex; justify-content:space-between; gap:12px; color:#909399; font-size:12px; flex-wrap:wrap; }
.loading-card { display:flex; align-items:center; justify-content:center; gap:8px; color:#606266; min-height:120px; }
@media (max-width:1000px) { .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .main-grid { grid-template-columns:1fr; } }
@media (max-width:600px) { .summary-grid { grid-template-columns:1fr 1fr; } .viewer-shell { height:420px; max-height:420px; } .model-select { min-width:180px; } }
</style>
