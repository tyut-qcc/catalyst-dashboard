<template>
  <el-card class="structure-card">
    <template #header>
      <div class="card-header">
        <div>
          <span>🧬 催化剂结构展示</span>
          <span class="subtitle">读取站点已保存的 XYZ 模型，按元素筛选并以球棍模型显示</span>
        </div>
        <el-button size="small" @click="reloadModels">刷新模型库</el-button>
      </div>
    </template>

    <div v-if="loadError" class="error-box">
      {{ loadError }}
    </div>

    <div class="structure-layout">
      <aside class="model-sidebar">
        <div class="section-title">模型分类</div>
        <el-input v-model="searchText" clearable placeholder="搜索模型名称" size="small" />

        <div class="filter-title">按元素</div>
        <div class="element-filters">
          <el-button
            size="small"
            :type="selectedElement === '' ? 'primary' : 'default'"
            plain
            @click="selectedElement = ''"
          >全部</el-button>
          <el-button
            v-for="element in presentElements"
            :key="element"
            size="small"
            :type="selectedElement === element ? 'primary' : 'default'"
            plain
            @click="selectedElement = element"
          >{{ element }}</el-button>
        </div>

        <div class="filter-title composition-heading">模型列表</div>
        <div v-if="filteredModels.length" class="model-list">
          <button
            v-for="model in filteredModels"
            :key="model.id"
            class="model-item"
            :class="{ active: selectedModel?.id === model.id }"
            @click="selectModel(model)"
          >
            <span class="model-name">{{ model.name }}</span>
            <span class="model-meta">{{ model.elements?.join(' · ') || '未解析元素' }}</span>
          </button>
        </div>
        <el-empty v-else description="没有匹配的模型" :image-size="60" />
      </aside>

      <section class="viewer-panel">
        <div class="viewer-toolbar">
          <div class="model-title">
            <strong>{{ selectedModel?.name || '请选择模型' }}</strong>
            <el-tag v-if="selectedModel" size="small" type="info">{{ atomCount }} atoms</el-tag>
          </div>
          <el-button-group>
            <el-button size="small" @click="setStyle('stick')">球棍</el-button>
            <el-button size="small" @click="setStyle('sphere')">空间填充</el-button>
            <el-button size="small" @click="setStyle('line')">线框</el-button>
            <el-button size="small" @click="resetView">重置视角</el-button>
          </el-button-group>
        </div>

        <div ref="viewerRef" class="viewer-3d">
          <el-empty v-if="!selectedModel" description="请从左侧选择一个 XYZ 模型" />
          <div v-else-if="loading" class="viewer-loading">正在加载结构……</div>
        </div>

        <div v-if="selectedModel" class="legend">
          <span class="legend-title">元素：</span>
          <span v-for="element in selectedElements" :key="element" class="legend-item">
            <span class="legend-dot" :style="{ backgroundColor: elementColor(element) }"></span>
            {{ element }}
          </span>
        </div>
      </section>
    </div>
  </el-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import * as $3Dmol from '3dmol';
import { ElMessage } from 'element-plus';

const BASE_URL = import.meta.env.BASE_URL || '/';
const MODEL_INDEX_URL = new URL('structures/index.json', new URL(BASE_URL, window.location.origin)).href;
const STRUCTURE_DIR_URL = new URL('structures/', new URL(BASE_URL, window.location.origin)).href;

const viewerRef = ref(null);
const models = ref([]);
const selectedModel = ref(null);
const selectedElement = ref('');
const searchText = ref('');
const structureData = ref('');
const atomCount = ref(0);
const loading = ref(false);
const loadError = ref('');
let viewer = null;

const presentElements = computed(() => {
  const set = new Set();
  for (const model of models.value) {
    for (const element of model.elements || []) set.add(element);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});

const filteredModels = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  return models.value.filter((model) => {
    const nameMatch = !query || String(model.name || '').toLowerCase().includes(query);
    const elementMatch = !selectedElement.value || (model.elements || []).includes(selectedElement.value);
    return nameMatch && elementMatch;
  });
});

const selectedElements = computed(() => {
  if (!structureData.value) return [];
  return parseXYZ(structureData.value).elements;
});

async function loadModels() {
  loadError.value = '';
  try {
    const response = await fetch(`${MODEL_INDEX_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`模型索引 HTTP ${response.status}`);
    const index = await response.json();
    const list = Array.isArray(index) ? index : (index.models || []);
    models.value = list.map(normalizeModel).filter(Boolean);

    const current = selectedModel.value && models.value.find((item) => item.id === selectedModel.value.id);
    if (current) {
      selectedModel.value = current;
      await loadSelectedModel();
      return;
    }
    if (filteredModels.value.length > 0) await selectModel(filteredModels.value[0]);
  } catch (error) {
    console.error('模型库加载失败:', error);
    models.value = [];
    loadError.value = `模型库加载失败：${error.message}`;
    ElMessage.error(loadError.value);
  }
}

function normalizeModel(item) {
  if (!item || !item.id) return null;
  const file = item.file || `${item.id}.xyz`;
  const url = item.url
    ? new URL(String(item.url).replace(/^\.\//, ''), new URL(BASE_URL, window.location.origin)).href
    : new URL(file, STRUCTURE_DIR_URL).href;
  return {
    ...item,
    id: String(item.id),
    name: item.name || item.id,
    file,
    url,
    elements: Array.isArray(item.elements) ? item.elements : [],
  };
}

async function reloadModels() {
  await loadModels();
  if (!loadError.value) ElMessage.success('模型库已刷新');
}

async function selectModel(model) {
  selectedModel.value = model;
  await loadSelectedModel();
}

async function loadSelectedModel() {
  if (!selectedModel.value) return;
  loading.value = true;
  loadError.value = '';
  destroyViewer();
  try {
    const model = selectedModel.value;
    const response = await fetch(`${model.url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`XYZ 文件 HTTP ${response.status}：${model.url}`);

    const text = await response.text();
    if (!text.trim()) throw new Error('XYZ 文件为空');

    const parsed = parseXYZ(text);
    if (!parsed.atoms.length) throw new Error('XYZ 中没有解析到有效原子坐标');

    structureData.value = text;
    atomCount.value = parsed.atoms.length;

    await nextTick();
    renderStructure(parsed.atoms);
  } catch (error) {
    console.error('XYZ 模型加载/渲染失败:', error);
    loadError.value = `模型“${selectedModel.value.name}”加载失败：${error.message}`;
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

function parseXYZ(content) {
  const rawLines = String(content).replace(/^\uFEFF/, '').split(/\r?\n/);
  let count = Number.parseInt((rawLines[0] || '').trim(), 10);
  const isStandardXYZ = Number.isFinite(count) && count > 0;

  let start = 0;
  if (isStandardXYZ) {
    // 标准 XYZ：第 1 行原子数，第 2 行注释（允许为空）。
    start = 2;
  }

  const source = rawLines.slice(start);
  const atoms = [];
  for (const rawLine of source) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const element = normalizeElement(parts[0]);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const z = Number(parts[3]);
    if (!element || [x, y, z].some((v) => !Number.isFinite(v))) continue;
    atoms.push({ element, x, y, z });
    if (isStandardXYZ && atoms.length >= count) break;
  }

  return {
    atoms,
    elements: [...new Set(atoms.map((atom) => atom.element))].sort(),
  };
}

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

function atomToPdbLine(atom, serial) {
  const element = atom.element.toUpperCase().padEnd(2).slice(0, 2);
  const atomName = atom.element.padStart(4).slice(-4);
  return [
    'ATOM  ',
    String(serial).padStart(5),
    ' ',
    atomName,
    ' ',
    'XYZ',
    ' A',
    '   1',
    '    ',
    atom.x.toFixed(3).padStart(8),
    atom.y.toFixed(3).padStart(8),
    atom.z.toFixed(3).padStart(8),
    '  1.00  0.00          ',
    element,
  ].join('');
}

function atomsToPdb(atoms) {
  return `${atoms.map((atom, index) => atomToPdbLine(atom, index + 1)).join('\n')}\nEND\n`;
}

function renderStructure(atoms) {
  if (!viewerRef.value) throw new Error('3D viewer 容器尚未就绪');

  destroyViewer();
  viewer = $3Dmol.createViewer(viewerRef.value, {
    backgroundColor: 'white',
    antialias: true,
    controlOptions: { trackball: true },
  });

  if (!viewer) throw new Error('3Dmol viewer 创建失败');

  const pdb = atomsToPdb(atoms);
  const model = viewer.addModel(pdb, 'pdb');
  if (!model) throw new Error('3Dmol 无法创建分子模型');

  // 不再依赖 3Dmol 对 PDB 的 elem 字段进行匹配。
  // 直接按原子序号设置样式，避免 Ce/Pt/Pd/Rh 等双字母元素被误识别为 O。
  atoms.forEach((atom, index) => {
    const color = elementColor(normalizeElement(atom.element));
    model.setStyle({ serial: index + 1 }, {
      stick: { color, radius: 0.18 },
      sphere: { color, scale: 0.28 },
    });
  });

  viewer.zoomTo();
  viewer.render();
}

function setStyle(style) {
  if (!viewer) return;
  const model = viewer.getModel();
  if (!model) return;
  model.setStyle({}, {});
  const atoms = parseXYZ(structureData.value).atoms;
  atoms.forEach((atom, index) => {
    const color = elementColor(normalizeElement(atom.element));
    const serial = index + 1;
    if (style === 'stick') {
      model.setStyle({ serial }, { stick: { color, radius: 0.18 }, sphere: { color, scale: 0.28 } });
    } else if (style === 'sphere') {
      model.setStyle({ serial }, { sphere: { color, scale: 0.72 } });
    } else if (style === 'line') {
      model.setStyle({ serial }, { line: { color, linewidth: 2 } });
    }
  });
  viewer.render();
}

function resetView() {
  if (!viewer) return;
  viewer.zoomTo();
  viewer.render();
}

function destroyViewer() {
  if (viewer) {
    try { viewer.clear(); } catch (error) { console.warn('清理 viewer 时出错:', error); }
    viewer = null;
  }
}

function elementColor(element) {
  const colors = {
    H: '#FFFFFF', C: '#444444', N: '#3050F8', O: '#FF0D0D',
    F: '#90E050', P: '#FF8000', S: '#FFFF30', Cl: '#1FF01F',
    Br: '#A62929', I: '#940094', Ce: '#FFFFC7', Pt: '#D0D0E0',
    Pd: '#D0D0D0', Rh: '#D8D8D8', Cu: '#C88033', Ni: '#50D050',
    Co: '#F090A0', Fe: '#E06633', Mn: '#9C7AC7', Ti: '#BFC2C7',
    Cr: '#8A99C7', Ru: '#248F8F', Au: '#FFD123', Ag: '#C0C0C0',
    Mo: '#54B5B5', W: '#2194D6', V: '#A6A6AB', Y: '#94FFFF',
    Nb: '#73C2C9', Zr: '#94C7C7', Ta: '#4DA6FF', Re: '#267DAB',
    Sc: '#E6E6E6', Ga: '#C3B7B7', Ge: '#668F8F', Sn: '#668F8F',
    Ir: '#175487', Os: '#266696', Si: '#F0C8A0',
  };
  return colors[element] || '#B0B0B0';
}

onMounted(loadModels);
onBeforeUnmount(destroyViewer);
</script>

<style scoped>
.structure-card { margin-top: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.subtitle { margin-left: 12px; color: #909399; font-size: 13px; }
.error-box { margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; background: #fef0f0; color: #f56c6c; font-size: 13px; line-height: 1.5; word-break: break-all; }
.structure-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 16px; }
.model-sidebar { border-right: 1px solid #ebeef5; padding-right: 14px; min-height: 560px; }
.section-title { font-weight: 600; margin-bottom: 10px; }
.filter-title { margin: 14px 0 8px; font-size: 13px; color: #606266; font-weight: 600; }
.element-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.element-filters .el-button { margin-left: 0; margin-right: 0; }
.model-list { max-height: 430px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.model-item { border: 1px solid #ebeef5; border-radius: 6px; background: #fff; text-align: left; padding: 9px 10px; cursor: pointer; transition: .2s; }
.model-item:hover { border-color: #409eff; background: #f5f9ff; }
.model-item.active { border-color: #409eff; background: #ecf5ff; }
.model-name { display: block; color: #303133; font-weight: 500; }
.model-meta { display: block; margin-top: 3px; color: #909399; font-size: 11px; }
.viewer-panel { min-width: 0; }
.viewer-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.model-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.model-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viewer-3d { position: relative; width: 100%; height: 520px; border: 1px solid #dcdfe6; border-radius: 6px; background: #fff; overflow: hidden; }
.viewer-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #909399; background: rgba(255,255,255,.75); }
.legend { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 13px; }
.legend-title { color: #606266; font-weight: 600; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #c0c4cc; display: inline-block; }
@media (max-width: 900px) {
  .structure-layout { grid-template-columns: 1fr; }
  .model-sidebar { border-right: 0; border-bottom: 1px solid #ebeef5; padding-right: 0; padding-bottom: 14px; min-height: auto; }
  .model-list { max-height: 220px; }
  .viewer-3d { height: 440px; }
  .card-header { align-items: flex-start; flex-direction: column; }
  .subtitle { margin-left: 0; margin-top: 4px; display: block; }
}
</style>
