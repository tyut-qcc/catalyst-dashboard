<template>
  <div class="aimd-page">
    <div class="toolbar-card">
      <div class="toolbar-row">
        <el-button type="primary" @click="fileInput?.click()">上传 XYZ 轨迹</el-button>
        <input ref="fileInput" type="file" accept=".xyz,.txt" hidden @change="onFileUpload" />
        <el-button @click="refreshLibrary" :loading="loadingLibrary">刷新轨迹库</el-button>
        <el-select v-model="selectedId" placeholder="选择 AIMD 轨迹" class="model-select" :disabled="loading">
          <el-option v-for="item in allTrajectories" :key="item.id" :label="item.name" :value="item.id">
            <div class="option-row">
              <span>{{ item.name }}</span>
              <span class="option-meta">{{ item.frames ?? '—' }} 帧</span>
            </div>
          </el-option>
        </el-select>
      </div>
      <div class="hint">支持标准多帧 XYZ。建议每帧第二行为注释，并在其中写入能量，例如 <code>Energy=-123.456 eV</code>、<code>E=-123.456</code>。</div>
    </div>

    <AIMDAnalysisPanel />

    <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="mb12" />

    <div v-if="loading" class="loading-card">
      <el-icon class="is-loading"><Loading /></el-icon>
      正在读取 AIMD 轨迹…
    </div>

    <template v-else-if="frames.length">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">当前轨迹</div><div class="value text">{{ currentTrajectoryName }}</div></div>
        <div class="summary-card"><div class="label">总帧数</div><div class="value">{{ frames.length }}</div></div>
        <div class="summary-card"><div class="label">原子数</div><div class="value">{{ frames[currentFrame]?.atomCount || frames[currentFrame]?.atoms.length || 0 }}</div></div>
        <div class="summary-card"><div class="label">当前时间</div><div class="value">{{ currentTimeLabel }}</div></div>
        <div class="summary-card"><div class="label">当前能量</div><div class="value" style="font-size:16px">{{ currentEnergyLabel }}</div></div>
        <div class="summary-card"><div class="label">元素组成</div><div class="value text">{{ currentCompositionLabel }}</div></div>
      </div>

      <div class="main-grid">
        <el-card shadow="never" class="viewer-card">
          <template #header>
            <div class="card-header">
              <span>AIMD 动力学轨迹</span>
              <el-tag type="info">Frame {{ currentFrame + 1 }} / {{ frames.length }}</el-tag>
            </div>
          </template>
          <div class="viewer-shell"><div ref="viewerEl" class="viewer"></div></div>
          <div class="controls">
            <el-button-group>
              <el-button @click="previousFrame">⏮</el-button>
              <el-button type="primary" @click="togglePlaying">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</el-button>
              <el-button @click="nextFrame">⏭</el-button>
            </el-button-group>
            <el-slider v-model="currentFrame" :min="0" :max="Math.max(frames.length - 1, 0)" :step="1" class="frame-slider" @change="renderCurrentFrame" />
            <el-input-number v-model="fps" :min="1" :max="60" :step="1" size="small" controls-position="right" />
            <span class="fps-label">FPS</span>
          </div>
          <div class="element-legend">
            <span v-for="el in currentElements" :key="el" class="legend-item">
              <i :style="{ background: elementColor(el) }"></i>{{ el }}
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
            <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="energy-chart" preserveAspectRatio="none">
              <line :x1="chartPad.left" :y1="chartPad.top" :x2="chartPad.left" :y2="chartHeight-chartPad.bottom" class="axis" />
              <line :x1="chartPad.left" :y1="chartHeight-chartPad.bottom" :x2="chartWidth-chartPad.right" :y2="chartHeight-chartPad.bottom" class="axis" />
              <polyline :points="chartPoints" fill="none" class="energy-line" />
              <circle v-if="currentEnergyPoint" :cx="currentEnergyPoint.x" :cy="currentEnergyPoint.y" r="4" class="energy-point" />
            </svg>
            <div class="chart-footer">
              <span>Time 0 / Frame 1</span>
              <span>当前：t={{ currentTimeLabel }}，E={{ currentEnergyLabel }}</span>
              <span>Frame {{ frames.length }}</span>
            </div>
          </div>
          <el-empty v-else description="未检测到能量数据" :image-size="80" />
        </el-card>
      </div>
    </template>

    <el-empty v-else description="请选择轨迹文件，或点击“上传 XYZ 轨迹”加载多帧 AIMD 轨迹" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import AIMDAnalysisPanel from './AIMDAnalysisPanel.vue';
import * as $3Dmol from '3dmol';

const props = defineProps({
  isActive: { type: Boolean, default: false },
});

const BASE_URL = import.meta.env.BASE_URL || '/';
const INDEX_URL = `${BASE_URL}aimd/index.json`;
const AIMD_DIR_URL = `${BASE_URL}aimd/`;

const fileInput = ref(null);
const viewerEl = ref(null);
const viewer = ref(null);
const trajectories = ref([]);
const uploadedTrajectories = ref([]);
const selectedId = ref('');
const frames = ref([]);
const currentFrame = ref(0);
const playing = ref(false);
const fps = ref(8);
const loading = ref(false);
const loadingLibrary = ref(false);
const errorMessage = ref('');
let timer = null;
let resizeObserver = null;
const onWindowResize = () => {
  if (props.isActive) refreshViewerLayout();
};
let loadToken = 0;
let renderToken = 0;

const palette = {
  H: '#FFFFFF', C: '#555555', N: '#3050F8', O: '#FF0D0D',
  F: '#90E050', Cl: '#1FF01F', Br: '#A62929', I: '#940094',
  P: '#FF8000', S: '#FFFF30', Si: '#F0C8A0',
  B: '#FFB5B5', Na: '#AB5CF2', Mg: '#8AFF00', Al: '#BFA6A6',
  K: '#8F40D4', Ca: '#3DFF00', Sc: '#E6E6E6', Ti: '#BFC2C7',
  V: '#A6A6AB', Cr: '#8A99C7', Mn: '#9C7AC7', Fe: '#E06633',
  Co: '#F090A0', Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0',
  Y: '#94FFFF', Zr: '#94E0E0', Nb: '#73C2C9', Mo: '#54B5B5',
  Tc: '#3B9E9E', Ru: '#248F8F', Rh: '#0A7D8C', Pd: '#006985',
  Ag: '#C0C0C0', Cd: '#FFD98F', In: '#A67573', Sn: '#668080',
  Sb: '#9E63B5', Te: '#D47A00', Cs: '#57178F', Ba: '#00C900',
  La: '#70D4FF', Ce: '#FFFF00', Pr: '#D9FFC8', Nd: '#C7FFC7',
  Sm: '#8FFFC7', Eu: '#61FFC7', Gd: '#45FFC7', Tb: '#30FFC7',
  Dy: '#1FFFC7', Ho: '#00FF9C', Er: '#00E675', Tm: '#00D452',
  Yb: '#00BF38', Lu: '#00AB24', Hf: '#4DC2FF', Ta: '#4DA6FF',
  W: '#2194D6', Re: '#267DA9', Os: '#266696', Ir: '#175487',
  Pt: '#D0D0E0', Au: '#FFD123', Hg: '#B8B8D0'
};

const normalizeElement = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const letters = s.match(/[A-Za-z]{1,2}/)?.[0] || s;
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
};

const elementColor = (el) => palette[normalizeElement(el)] || '#FF69B4';
const currentElements = computed(() => [...new Set((frames.value[currentFrame.value]?.atoms || []).map(a => normalizeElement(a.element)).filter(Boolean))]);
const allTrajectories = computed(() => [...trajectories.value, ...uploadedTrajectories.value]);
const currentTrajectoryName = computed(() => allTrajectories.value.find(x => x.id === selectedId.value)?.name || selectedId.value || '');
const energySeries = computed(() => frames.value.map((f, i) => ({ index: i, time: Number.isFinite(f.time) ? f.time : i, energy: Number.isFinite(f.energy) ? f.energy : null })));
const energyValues = computed(() => energySeries.value.filter(p => p.energy !== null));
const currentEnergy = computed(() => frames.value[currentFrame.value]?.energy);
const currentTime = computed(() => frames.value[currentFrame.value]?.time);
const currentEnergyLabel = computed(() => Number.isFinite(currentEnergy.value) ? currentEnergy.value.toFixed(6) + ' eV' : '—');
const currentTimeLabel = computed(() => Number.isFinite(currentTime.value) ? currentTime.value.toFixed(3) : '—');

const currentComposition = computed(() => {
  const counts = new Map();
  for (const atom of (frames.value[currentFrame.value]?.atoms || [])) {
    const el = normalizeElement(atom.element);
    if (!el) continue;
    counts.set(el, (counts.get(el) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => a[0].localeCompare(b[0], 'en'))
    .map(([el, n]) => `${el}${n}`).join(' · ');
});
const currentCompositionLabel = computed(() => currentComposition.value || '—');

const chartWidth = 640;
const chartHeight = 260;
const chartPad = { left: 42, right: 12, top: 12, bottom: 28 };
const chartPoints = computed(() => {
  const pts = energySeries.value.filter(p => p.energy !== null);
  if (!pts.length) return '';
  const min = Math.min(...pts.map(p => p.energy));
  const max = Math.max(...pts.map(p => p.energy));
  const span = max - min || 1;
  const w = chartWidth - chartPad.left - chartPad.right;
  const h = chartHeight - chartPad.top - chartPad.bottom;
  const maxIndex = Math.max(frames.value.length - 1, 1);
  return pts.map(p => {
    const x = chartPad.left + (p.index / maxIndex) * w;
    const y = chartPad.top + (max - p.energy) / span * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});
const currentEnergyPoint = computed(() => {
  const pts = energySeries.value.filter(p => p.energy !== null);
  const current = energySeries.value[currentFrame.value];
  if (!pts.length || !current || current.energy === null) return null;
  const min = Math.min(...pts.map(p => p.energy));
  const max = Math.max(...pts.map(p => p.energy));
  const span = max - min || 1;
  const w = chartWidth - chartPad.left - chartPad.right;
  const h = chartHeight - chartPad.top - chartPad.bottom;
  const maxIndex = Math.max(frames.value.length - 1, 1);
  return {
    x: chartPad.left + (current.index / maxIndex) * w,
    y: chartPad.top + (max - current.energy) / span * h
  };
});

const parseFrameMeta = (comment) => {
  const text = String(comment || '').trim();
  const frameMatch = text.match(/\bi\s*=\s*(-?\d+)/i);
  const timeMatch = text.match(/\btime\s*=\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  const energyMatch = text.match(/\b(?:ENERGY|Energy|E)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/i);
  return {
    index: frameMatch ? Number(frameMatch[1]) : null,
    time: timeMatch ? Number(timeMatch[1]) : null,
    energy: energyMatch ? Number(energyMatch[1]) : null,
  };
};

const parseEnergy = (comment) => parseFrameMeta(comment).energy;

const parseXYZTrajectory = (text) => {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const result = [];
  let cursor = 0;
  let expectedAtomCount = null;
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor >= lines.length) break;

    // XYZ 每一帧的第一行必须是“原子总数”，例如 160。
    const countText = lines[cursor].trim();
    const countMatch = countText.match(/^\d+$/);
    if (!countMatch) {
      throw new Error(`第 ${cursor + 1} 行不是有效的原子数：${lines[cursor]}`);
    }
    const count = Number(countText);
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error(`第 ${cursor + 1} 行原子数无效：${countText}`);
    }

    if (expectedAtomCount === null) expectedAtomCount = count;
    if (count !== expectedAtomCount) {
      throw new Error(`第 ${result.length + 1} 帧原子数为 ${count}，但前面的帧均为 ${expectedAtomCount}。请检查轨迹文件是否损坏或混入了不同体系。`);
    }

    const comment = lines[cursor + 1] ?? '';
    const meta = parseFrameMeta(comment);
    cursor += 2;

    const atoms = new Array(count);
    for (let n = 0; n < count; n++, cursor++) {
      if (cursor >= lines.length) {
        throw new Error(`第 ${result.length + 1} 帧声明有 ${count} 个原子，但文件提前结束，仅读取到 ${n} 个原子。`);
      }
      const raw = lines[cursor].trim();
      const parts = raw.split(/\s+/);
      if (parts.length < 4) {
        throw new Error(`第 ${cursor + 1} 行原子坐标格式异常：${lines[cursor]}`);
      }

      // 元素永远取坐标行的第一个字段，不根据当前体系假设 Pt/Ce/O。
      const element = normalizeElement(parts[0]);
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!element || [x, y, z].some(v => !Number.isFinite(v))) {
        throw new Error(`第 ${cursor + 1} 行存在无效元素或坐标：${lines[cursor]}`);
      }
      atoms[n] = { element, x, y, z };
    }

    result.push({
      comment,
      index: meta.index ?? result.length,
      time: meta.time,
      energy: meta.energy,
      atomCount: count,
      atoms,
    });
  }
  return result;
};

const covalentRadius = {
  H: 0.31, B: 0.85, C: 0.76, N: 0.71, O: 0.66, F: 0.57,
  Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02, Br: 1.20, I: 1.39,
  Na: 1.66, Mg: 1.41, Al: 1.21, K: 2.03, Ca: 1.76, Sc: 1.70,
  Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26,
  Ni: 1.24, Cu: 1.32, Zn: 1.22, Y: 1.90, Zr: 1.75, Nb: 1.64,
  Mo: 1.54, Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44,
  Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41,
  Pt: 1.36, Au: 1.36, Hg: 1.32, Ce: 1.81, La: 1.87, Pr: 1.82,
  Nd: 1.81, Sm: 1.80, Eu: 1.98, Gd: 1.80, Tb: 1.76, Dy: 1.75,
  Ho: 1.74, Er: 1.73, Tm: 1.72, Yb: 1.94, Lu: 1.72
};

const nonmetalElements = new Set(['H','B','C','N','O','F','Si','P','S','Cl','Br','I']);
const metalElements = new Set(Object.keys(covalentRadius).filter(e => !nonmetalElements.has(e)));
const bondScale = 1.18;
const bondMin = 0.70;
const pairKey = (a, b) => [normalizeElement(a), normalizeElement(b)].sort().join('-');
const pairCutoff = {
  'Ce-O': 2.72,
  'Pt-O': 2.35,
  'Pt-Pt': 3.25,
  'Pd-O': 2.35,
  'Pd-Pd': 3.10,
  'Rh-O': 2.35,
  'Rh-Rh': 3.10,
  'Co-O': 2.25,
  'Ni-O': 2.20,
  'Cu-O': 2.25,
  'Fe-O': 2.25,
  'Ti-O': 2.30,
  'Cr-O': 2.30,
};

const canBond = (a, b, distance) => {
  const ea = normalizeElement(a.element);
  const eb = normalizeElement(b.element);
  const key = pairKey(ea, eb);

  // 已知催化剂/氧化物常见键优先使用明确阈值。
  if (Object.prototype.hasOwnProperty.call(pairCutoff, key)) {
    return distance <= pairCutoff[key] && distance >= bondMin;
  }

  // O-O、H-H 等非化学成键距离过大的情况直接排除；允许常规共价键。
  if (ea === 'O' && eb === 'O') return distance <= 1.75 && distance >= bondMin;
  if (ea === 'H' && eb === 'H') return distance <= 0.90 && distance >= bondMin;

  const bothMetal = metalElements.has(ea) && metalElements.has(eb);
  // 金属-金属仅保留明确接近的同种/过渡金属团簇键，避免 Ce-Ce、Ce-Pt 这类晶格近邻被大量连线。
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

  // 空间网格：只检查相邻网格，避免 AIMD 每帧 O(N²) 全原子对计算。
  const maxRadius = Math.max(0.9, ...atoms.map(a => covalentRadius[normalizeElement(a.element)] ?? 1.0));
  const cellSize = Math.max(2.8, (maxRadius * 2 + 0.45) * bondScale);
  const grid = new Map();

  const cellCoord = (x) => Math.floor(x / cellSize);
  const cellKey = (ix, iy, iz) => `${ix}|${iy}|${iz}`;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const key = cellKey(cellCoord(a.x), cellCoord(a.y), cellCoord(a.z));
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
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

            const maxCutoff = pairCutoff[pairKey(ai.element, aj.element)]
              ?? ((covalentRadius[normalizeElement(ai.element)] ?? 1.0) +
                  (covalentRadius[normalizeElement(aj.element)] ?? 1.0)) * bondScale;
            if (d2 > maxCutoff * maxCutoff) continue;

            const distance = Math.sqrt(d2);
            if (canBond(ai, aj, distance)) {
              bonds.push([i + 1, j + 1, 1]);
            }
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
    'ATOM  ',
    String(serial).padStart(5),
    ' ',
    atomName,
    ' ',
    'AIM',
    ' A',
    '   1',
    '    ',
    atom.x.toFixed(3).padStart(8),
    atom.y.toFixed(3).padStart(8),
    atom.z.toFixed(3).padStart(8),
    '  1.00  0.00          ',
    element,
  ].join('');
};

const frameToPdb = (frame) => {
  const atomLines = frame.atoms.map((atom, idx) => atomToPdbLine(atom, idx + 1));
  const bondLines = buildBonds(frame).map(([a, b]) => {
    const aSerial = String(a).padStart(5, ' ');
    const bSerial = String(b).padStart(5, ' ');
    return `CONECT${aSerial}${bSerial}`;
  });
  return [...atomLines, ...bondLines, 'END'].join('\n');
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
  } finally {
    loadingLibrary.value = false;
  }
};

const refreshLibrary = async () => {
  await loadLibrary();
  if (selectedId.value) await loadSelectedTrajectory();
};

const loadSelectedTrajectory = async () => {
  const token = ++loadToken;
  const item = allTrajectories.value.find(x => x.id === selectedId.value);
  if (!item) return;

  loading.value = true;
  errorMessage.value = '';
  stopPlayback();

  // 切换轨迹时不要复用旧的 3Dmol viewer。旧 viewer 可能仍持有上一条轨迹的
  // WebGL/canvas/model 状态，导致新轨迹数据已成功解析但画布保持空白。
  destroyViewer();

  try {
    const file = item.file || `${item.id}.xyz`;
    const url = new URL(file, new URL(AIMD_DIR_URL, window.location.href)).href;
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`轨迹文件读取失败（HTTP ${res.status}）：${file}`);

    const text = await res.text();
    const parsed = parseXYZTrajectory(text);
    if (!parsed.length) throw new Error('没有解析到任何 AIMD 帧');

    // 防止用户快速切换轨迹后，旧请求覆盖新轨迹。
    if (token !== loadToken) return;

    frames.value = parsed;
    currentFrame.value = 0;
    await nextTick();
    scheduleRender();
  } catch (e) {
    if (token !== loadToken) return;
    frames.value = [];
    errorMessage.value = e?.message || '轨迹加载失败';
  } finally {
    if (token === loadToken) loading.value = false;
  }
};

const onFileUpload = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseXYZTrajectory(text);
    if (!parsed.length) throw new Error('没有解析到任何 AIMD 帧');
    const id = `upload-${Date.now()}`;
    uploadedTrajectories.value.push({ id, name: file.name, file: '', frames: parsed.length, local: true, parsed });
    selectedId.value = id;
    frames.value = parsed;
    currentFrame.value = 0;
    errorMessage.value = '';
    await nextTick();
    scheduleRender();
  } catch (e) {
    errorMessage.value = e?.message || 'XYZ 轨迹解析失败';
  }
};

const ensureViewer = () => {
  if (!viewerEl.value) return null;
  if (!viewer.value) {
    viewer.value = $3Dmol.createViewer(viewerEl.value, {
      backgroundColor: 'white'
    });
  }
  return viewer.value;
};

const refreshViewerLayout = () => {
  const v = viewer.value;
  const el = viewerEl.value;
  if (!v || !el) return false;

  const width = el.clientWidth;
  const height = el.clientHeight;
  if (width < 20 || height < 20) return false;

  try {
    if (typeof v.resize === 'function') v.resize();
    v.render();
    return true;
  } catch (e) {
    console.warn('AIMD viewer resize/render failed:', e);
    return false;
  }
};

const scheduleRender = () => {
  const token = ++renderToken;
  let attempts = 0;

  const run = () => {
    if (token !== renderToken) return;
    attempts += 1;

    const el = viewerEl.value;
    const width = el?.clientWidth || 0;
    const height = el?.clientHeight || 0;

    if (width < 20 || height < 20) {
      if (attempts < 30) requestAnimationFrame(run);
      return;
    }

    renderCurrentFrame(token);
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
};

const destroyViewer = () => {
  // 让所有尚未执行的旧 requestAnimationFrame 渲染任务立即失效。
  ++renderToken;
  if (viewer.value) {
    try { viewer.value.clear(); } catch (e) { console.warn('AIMD viewer 清理失败:', e); }
    viewer.value = null;
  }
};

const rebuildViewer = () => {
  destroyViewer();
  return ensureViewer();
};

const renderCurrentFrame = async (expectedRenderToken = renderToken) => {
  if (expectedRenderToken !== renderToken) return;

  await nextTick();
  if (expectedRenderToken !== renderToken) return;

  const frame = frames.value[currentFrame.value];
  const el = viewerEl.value;
  if (!el || !frame) return;

  if (el.clientWidth < 20 || el.clientHeight < 20) {
    scheduleRender();
    return;
  }

  // Tab 切换后首次进入时，之前可能在隐藏容器中创建过 3Dmol。
  // 在确认容器已经有真实尺寸后强制重建一次，避免空白画布。
  const v = ensureViewer();
  if (!v) return;

  try {
    v.removeAllModels();

    const model = v.addModel(frameToPdb(frame), 'pdb');
    if (!model) throw new Error('3Dmol 未能创建当前帧模型');

    // 先设置统一球棍样式，再按原子序号覆盖元素颜色。
    model.setStyle({}, {
      stick: { radius: 0.16, colorscheme: 'Jmol' },
      sphere: { scale: 0.28, colorscheme: 'Jmol' }
    });

    frame.atoms.forEach((atom, idx) => {
      const color = elementColor(atom.element);
      model.setStyle(
        { serial: idx + 1 },
        {
          stick: { radius: 0.16, color },
          sphere: { scale: 0.28, color }
        }
      );
    });

    refreshViewerLayout();
    v.zoomTo();
    v.render();
  } catch (e) {
    console.error('AIMD 3D rendering error:', e);
    errorMessage.value = `AIMD 三维结构渲染失败：${e?.message || e}`;
  }
};

const nextFrame = () => {
  if (!frames.value.length) return;
  currentFrame.value = (currentFrame.value + 1) % frames.value.length;
  renderCurrentFrame();
};
const previousFrame = () => {
  if (!frames.value.length) return;
  currentFrame.value = (currentFrame.value - 1 + frames.value.length) % frames.value.length;
  renderCurrentFrame();
};
const startPlayback = () => {
  stopPlayback();
  playing.value = true;
  timer = window.setInterval(nextFrame, Math.max(20, 1000 / fps.value));
};
const stopPlayback = () => {
  playing.value = false;
  if (timer) window.clearInterval(timer);
  timer = null;
};
const togglePlaying = () => playing.value ? stopPlayback() : startPlayback();

watch(selectedId, async (id) => {
  ++loadToken;
  const local = uploadedTrajectories.value.find(x => x.id === id);
  if (local?.parsed) {
    stopPlayback();
    destroyViewer();
    frames.value = local.parsed;
    currentFrame.value = 0;
    errorMessage.value = '';
    await nextTick();
    scheduleRender();
  } else if (id) {
    await loadSelectedTrajectory();
  }
});
watch(currentFrame, () => {
  if (frames.value.length && props.isActive) scheduleRender();
});
watch(fps, () => { if (playing.value) startPlayback(); });

const activateAndRender = async () => {
  if (!props.isActive) return;
  await nextTick();

  let tries = 0;
  const attempt = () => {
    if (!props.isActive || !frames.value.length) return;
    tries += 1;
    const el = viewerEl.value;
    if (!el || el.clientWidth < 20 || el.clientHeight < 20) {
      if (tries < 40) window.setTimeout(attempt, 50);
      return;
    }

    // 激活 Tab 时强制从可见尺寸重新创建 viewer。
    rebuildViewer();
    scheduleRender();
  };

  window.setTimeout(attempt, 30);
};

watch(() => props.isActive, (active) => {
  if (active) activateAndRender();
});

onMounted(async () => {
  await nextTick();

  if (viewerEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!props.isActive || !frames.value.length) return;
      const el = viewerEl.value;
      if (el?.clientWidth >= 20 && el?.clientHeight >= 20) {
        refreshViewerLayout();
      } else {
        scheduleRender();
      }
    });
    resizeObserver.observe(viewerEl.value);
  }

  window.addEventListener('resize', onWindowResize);

  await loadLibrary();
  if (selectedId.value) await loadSelectedTrajectory();
  if (props.isActive) activateAndRender();
});

onBeforeUnmount(() => {
  stopPlayback();
  ++loadToken;
  ++renderToken;
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('resize', onWindowResize);
  destroyViewer();
});
</script>

<style scoped>
.aimd-page { padding: 4px 0 20px; }
.toolbar-card, .loading-card { background: white; border: 1px solid #ebeef5; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
.toolbar-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.model-select { min-width: 280px; flex: 1; max-width: 520px; }
.option-row { display: flex; justify-content: space-between; gap: 18px; width: 100%; }
.option-meta { color: #909399; font-size: 12px; }
.hint { color: #909399; font-size: 12px; margin-top: 10px; line-height: 1.6; }
.mb12 { margin-bottom: 12px; }
.summary-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 12px; }
.summary-card { background:white; border:1px solid #ebeef5; border-radius:8px; padding:12px 14px; }
.summary-card .label { color:#909399; font-size:12px; margin-bottom:6px; }
.summary-card .value { font-weight:600; font-size:20px; color:#303133; }
.summary-card .value.text { font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.main-grid { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(320px,0.9fr); gap:12px; align-items:start; }
.viewer-card, .energy-card { border-radius:8px; }
.card-header { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.viewer-shell { width:100%; height:520px; max-height:520px; min-height:360px; overflow:hidden; border:1px solid #ebeef5; border-radius:6px; background:#fff; position:relative; contain:strict; }
.viewer { width:100%; height:100%; overflow:hidden; }
.viewer :deep(canvas) { display:block !important; width:100% !important; height:100% !important; max-width:100% !important; }
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
.aimd-page { min-width:0; overflow:hidden; }
.toolbar-card, .summary-card, .viewer-card, .energy-card { min-width:0; }
.loading-card { display:flex; align-items:center; justify-content:center; gap:8px; color:#606266; min-height:120px; }
@media (max-width: 1000px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .main-grid { grid-template-columns:1fr; }
}
@media (max-width: 600px) {
  .summary-grid { grid-template-columns:1fr 1fr; }
  .viewer-shell { height:420px; max-height:420px; }
  .model-select { min-width:180px; }
}
</style>
