<template>
  <el-card class="structure-card">
    <template #header>
      <div class="card-header">
        <div>
          <span>🧬 催化剂结构展示</span>
          <span class="subtitle">按 public/structures 实际目录层级自动生成</span>
        </div>
        <div class="header-actions">
          <el-tag v-if="indexLoaded" size="small" type="info">
            {{ totalModelCount }} 个模型
          </el-tag>
          <el-button size="small" :loading="loadingIndex" @click="reloadModels">刷新模型库</el-button>
        </div>
      </div>
    </template>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="mb12"
    />

    <div v-if="loadingIndex" class="index-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      正在读取结构目录索引……
    </div>

    <div v-else class="structure-layout">
      <aside class="model-sidebar">
        <div class="section-title">结构目录</div>

        <el-input
          v-model="treeFilter"
          clearable
          size="small"
          placeholder="搜索目录或 XYZ 文件"
          class="search-box"
        />

        <div class="tree-summary">
          共 {{ folderCount }} 个文件夹 · {{ totalModelCount }} 个 XYZ 模型
        </div>

        <div class="tree-wrapper">
          <el-tree
            ref="treeRef"
            :data="treeData"
            node-key="id"
            highlight-current
            default-expand-all
            :filter-node-method="filterTreeNode"
            :props="treeProps"
            @node-click="handleNodeClick"
          >
            <template #default="{ data }">
              <div class="tree-node" :class="{ 'is-file': data.type === 'file' }">
                <span class="tree-icon">{{ data.type === 'folder' ? '📁' : '🧬' }}</span>
                <span class="tree-name" :title="data.path || data.name">{{ data.name }}</span>
                <span v-if="data.type === 'folder'" class="tree-count">
                  {{ data.modelCount }}
                </span>
                <span v-else class="tree-file-meta">
                  {{ data.atomCount || '—' }} atoms
                </span>
              </div>
            </template>
          </el-tree>
        </div>
      </aside>

      <section class="viewer-panel">
        <div class="viewer-toolbar">
          <div class="model-title">
            <div class="title-main">
              <strong>{{ selectedModel?.name || '请选择 XYZ 模型' }}</strong>
              <el-tag v-if="selectedModel" size="small" type="info">
                {{ atomCount }} atoms
              </el-tag>
            </div>
            <div v-if="selectedModel" class="model-path">
              {{ selectedModel.path }}
            </div>
          </div>

          <el-button-group>
            <el-button size="small" :disabled="!selectedModel" @click="setStyle('stick')">球棍</el-button>
            <el-button size="small" :disabled="!selectedModel" @click="setStyle('sphere')">空间填充</el-button>
            <el-button size="small" :disabled="!selectedModel" @click="setStyle('line')">线框</el-button>
            <el-button size="small" :disabled="!selectedModel" @click="resetView">重置视角</el-button>
          </el-button-group>
        </div>

        <div ref="viewerRef" class="viewer-3d">
          <el-empty v-if="!selectedModel && !loading" description="请从左侧目录选择一个 XYZ 模型" />
          <div v-else-if="loading" class="viewer-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            正在加载结构……
          </div>
        </div>

        <div v-if="selectedModel" class="model-info">
          <div><span class="info-label">文件：</span>{{ selectedModel.file }}</div>
          <div><span class="info-label">路径：</span>{{ selectedModel.path }}</div>
          <div><span class="info-label">元素：</span>{{ selectedElements.join(' · ') || '—' }}</div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as $3Dmol from '3dmol';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';

const BASE_URL = import.meta.env.BASE_URL || '/';
const MODEL_INDEX_URL = new URL('structures/index.json', new URL(BASE_URL, window.location.origin)).href;
const CACHE_VERSION = 'v6-special-char-arrow-url';

const viewerRef = ref(null);
const treeRef = ref(null);
const treeFilter = ref('');
const treeData = ref([]);
const selectedModel = ref(null);
const structureData = ref('');
const atomCount = ref(0);
const loading = ref(false);
const loadingIndex = ref(false);
const loadError = ref('');
const indexLoaded = ref(false);

let viewer = null;
let selectedLoadToken = 0;
const modelTextCache = new Map();

const treeProps = {
  children: 'children',
  label: 'name',
};

const folderCount = computed(() => countFolders(treeData.value));
const totalModelCount = computed(() => countModels(treeData.value));
const selectedElements = computed(() => {
  if (!structureData.value) return [];
  return parseXYZ(structureData.value).elements;
});

watch(treeFilter, (value) => {
  treeRef.value?.filter(value);
});

function countFolders(nodes) {
  return (nodes || []).reduce((sum, node) => {
    if (node.type !== 'folder') return sum;
    return sum + 1 + countFolders(node.children || []);
  }, 0);
}

function countModels(nodes) {
  return (nodes || []).reduce((sum, node) => {
    if (node.type === 'file') return sum + 1;
    return sum + countModels(node.children || []);
  }, 0);
}

function filterTreeNode(value, data) {
  if (!value) return true;
  const query = String(value).trim().toLowerCase();
  if (!query) return true;

  const selfMatch = `${data.name || ''} ${data.file || ''} ${data.path || ''}`.toLowerCase().includes(query);
  if (selfMatch) return true;

  return data.type === 'folder' && hasDescendantMatch(data.children || [], query);
}

function hasDescendantMatch(nodes, query) {
  return (nodes || []).some((node) => {
    const selfMatch = `${node.name || ''} ${node.file || ''} ${node.path || ''}`.toLowerCase().includes(query);
    return selfMatch || (node.type === 'folder' && hasDescendantMatch(node.children || [], query));
  });
}

async function loadModels() {
  loadingIndex.value = true;
  loadError.value = '';
  try {
    const response = await fetch(`${MODEL_INDEX_URL}?v=${CACHE_VERSION}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`结构索引 HTTP ${response.status}`);
    const index = await response.json();

    if (Array.isArray(index) || !Array.isArray(index.tree)) {
      throw new Error('检测到旧版结构索引，请重新运行 npm run generate:structures');
    }

    treeData.value = index.tree;
    indexLoaded.value = true;
    selectedModel.value = null;
    structureData.value = '';
    atomCount.value = 0;

    await nextTick();
    if (treeData.value.length) {
      expandFirstLevels();
    }
  } catch (error) {
    console.error('结构模型库加载失败:', error);
    treeData.value = [];
    selectedModel.value = null;
    loadError.value = `结构模型库加载失败：${error.message}`;
    ElMessage.error(loadError.value);
  } finally {
    loadingIndex.value = false;
  }
}

function expandFirstLevels() {
  const tree = treeRef.value;
  if (!tree) return;
  const first = treeData.value[0];
  if (!first) return;
  const nodes = tree.store?._getAllNodes ? tree.store._getAllNodes() : [];
  nodes.forEach((node) => {
    if (node.level <= 2) node.expanded = true;
  });
  // 默认展开所有层级，保证用户第一次进入即可看到完整目录；搜索时 Element Plus 会自动联动。
  tree.store.nodesMap[first.id]?.expand?.();
}

async function reloadModels() {
  await loadModels();
  if (!loadError.value) ElMessage.success('结构模型库已刷新');
}

async function handleNodeClick(data, node) {
  if (!data || data.type !== 'file') {
    // 点击目录时不加载文件，保持纯目录浏览。
    return;
  }

  // Element Plus 节点高亮已经自动处理；这里仅切换模型。
  selectedModel.value = data;
  await loadSelectedModel();
}

function encodePathSegments(relativePath) {
  return String(relativePath || '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildModelFileUrl(model) {
  // 优先使用生成器提供的 ASCII 安全 URL。
  // model.path/model.file/model.name 仅用于展示，保留 structures 下的原始名称。
  if (model?.url) {
    return new URL(model.url, new URL(BASE_URL, window.location.origin)).href;
  }

  // 兼容旧版 index.json：若没有安全 URL，再对原始路径逐段编码。
  const encodedPath = encodePathSegments(model?.path || '');
  if (!encodedPath) return '';

  return new URL(
    `structures/${encodedPath}`,
    new URL(BASE_URL, window.location.origin)
  ).href;
}

async function loadSelectedModel() {
  const model = selectedModel.value;
  if (!model?.url) return;

  const token = ++selectedLoadToken;
  loading.value = true;
  loadError.value = '';
  destroyViewer();

  try {
    let text = modelTextCache.get(model.id);
    if (!text) {
      const modelUrl = buildModelFileUrl(model);
      let response = await fetch(modelUrl, { cache: 'force-cache' });

      if (!response.ok) throw new Error(`XYZ 文件 HTTP ${response.status}`);
      text = await response.text();
      if (text.trim()) modelTextCache.set(model.id, text);
    }

    if (token !== selectedLoadToken) return;
    if (!text.trim()) throw new Error('XYZ 文件为空');

    const parsed = parseXYZ(text);
    if (!parsed.atoms.length) throw new Error('XYZ 中没有解析到有效原子坐标');

    structureData.value = text;
    atomCount.value = parsed.atoms.length;

    await nextTick();
    if (token !== selectedLoadToken) return;
    renderStructure(parsed.atoms);
  } catch (error) {
    if (token !== selectedLoadToken) return;
    console.error('XYZ 模型加载/渲染失败:', error);
    loadError.value = `模型“${model.name}”加载失败：${error.message}`;
    ElMessage.error(loadError.value);
  } finally {
    if (token === selectedLoadToken) loading.value = false;
  }
}

function parseXYZ(content) {
  const rawText = String(content ?? '').replace(/^\uFEFF/, '');
  const rawLines = rawText.split(/\r?\n/);

  const firstLine = (rawLines[0] || '').replace(/^\s+|\s+$/g, '');
  const countMatch = firstLine.match(/^([+-]?\d+)\s*$/);
  const declaredCount = countMatch ? Number.parseInt(countMatch[1], 10) : null;
  const isStandardXYZ = Number.isInteger(declaredCount) && declaredCount > 0;

  // 标准 XYZ：第 1 行原子数，第 2 行注释，其后为原子坐标。
  // 非标准但常见情况：没有原子数/注释，则从全文中自动识别“元素 + 3 个数值”。
  const start = isStandardXYZ ? 2 : 0;
  const atoms = [];

  for (const rawLine of rawLines.slice(start)) {
    const atom = parseXYZAtomLine(rawLine);
    if (!atom) continue;

    atoms.push(atom);

    // 标准 XYZ 只读取声明的原子数，避免把后续注释/额外内容当成原子。
    if (isStandardXYZ && atoms.length >= declaredCount) break;
  }

  return {
    atoms,
    elements: [...new Set(atoms.map(atom => atom.element))].sort(),
    declaredCount: isStandardXYZ ? declaredCount : null,
  };
}

function parseXYZAtomLine(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return null;

  // 兼容：
  // 1) C  0.0  1.0  2.0
  // 2) 1 C 0.0 1.0 2.0
  // 3) C1 0.0 1.0 2.0
  // 4) C, 0.0, 1.0, 2.0
  const parts = line.split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 4) return null;

  // 在前几个字段中寻找元素符号；一旦找到，就尝试读取其后的三个数值。
  // 这样可兼容带原子序号/标签的 XYZ 行。
  const maxElementIndex = Math.min(parts.length - 4, 3);

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
  const normalized = String(value ?? '')
    .trim()
    .replace(/[dD]([+-]?\d+)$/, 'e$1');

  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function normalizeElement(value) {
  const token = String(value || '').trim();
  if (!token) return '';

  // 去掉原子标签中的数字/符号，例如 C1、Pt_1、O(3) 都归一为元素符号。
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

  // 优先精确匹配。
  const exact = symbols.find((symbol) => symbol.toLowerCase() === lower);
  if (exact) return exact;

  // 再兼容 C1 / Pt_2 / O(3) 等标签：取最长合法元素前缀。
  return [...symbols]
    .sort((a, b) => b.length - a.length)
    .find((symbol) => lower.startsWith(symbol.toLowerCase())) || '';
}

function atomToPdbLine(atom, serial) {
  const element = atom.element.toUpperCase().padEnd(2).slice(0, 2);
  const atomName = atom.element.padStart(4).slice(-4);
  return [
    'ATOM  ', String(serial).padStart(5), ' ', atomName, ' ', 'XYZ', ' A', '   1', '    ',
    atom.x.toFixed(3).padStart(8), atom.y.toFixed(3).padStart(8), atom.z.toFixed(3).padStart(8),
    '  1.00  0.00          ', element,
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

  const model = viewer.addModel(atomsToPdb(atoms), 'pdb');
  if (!model) throw new Error('3Dmol 无法创建分子模型');

  applyStyle(model, atoms, 'stick');
  viewer.zoomTo();
  viewer.render();
}

function applyStyle(model, atoms, style) {
  model.setStyle({}, {});
  atoms.forEach((atom, index) => {
    const color = elementColor(normalizeElement(atom.element));
    const serial = index + 1;
    if (style === 'stick') {
      model.setStyle({ serial }, { stick: { color, radius: 0.18 }, sphere: { color, scale: 0.28 } });
    } else if (style === 'sphere') {
      model.setStyle({ serial }, { sphere: { color, scale: 0.72 } });
    } else {
      model.setStyle({ serial }, { line: { color, linewidth: 2 } });
    }
  });
}

function setStyle(style) {
  if (!viewer || !structureData.value) return;
  const model = viewer.getModel();
  if (!model) return;
  const atoms = parseXYZ(structureData.value).atoms;
  applyStyle(model, atoms, style);
  viewer.render();
}

function resetView() {
  if (!viewer) return;
  viewer.zoomTo();
  viewer.render();
}

function destroyViewer() {
  if (!viewer) return;
  try {
    viewer.clear();
  } catch (error) {
    console.warn('清理 viewer 时出错:', error);
  }
  viewer = null;
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
onBeforeUnmount(() => {
  ++selectedLoadToken;
  modelTextCache.clear();
  destroyViewer();
});
</script>

<style scoped>
.structure-card { margin-top: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.subtitle { margin-left: 12px; color: #909399; font-size: 13px; }
.mb12 { margin-bottom: 12px; }
.index-loading { min-height: 180px; display: grid; place-items: center; color: #909399; gap: 8px; }
.structure-layout { display: grid; grid-template-columns: 350px minmax(0, 1fr); gap: 16px; }
.model-sidebar { border-right: 1px solid #ebeef5; padding-right: 14px; min-height: 620px; overflow: hidden; }
.section-title { font-weight: 600; margin-bottom: 12px; }
.search-box { margin-bottom: 8px; }
.tree-summary { padding: 8px 10px; margin-bottom: 10px; border-radius: 6px; background: #f5f7fa; color: #606266; font-size: 12px; }
.tree-wrapper { height: 540px; overflow: auto; padding-right: 4px; }
.tree-node { width: 100%; display: flex; align-items: center; gap: 6px; min-width: 0; padding-right: 4px; }
.tree-icon { flex: 0 0 auto; font-size: 15px; }
.tree-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-count { flex: 0 0 auto; color: #909399; font-size: 11px; }
.tree-file-meta { flex: 0 0 auto; color: #909399; font-size: 10px; }
.viewer-panel { min-width: 0; }
.viewer-toolbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.model-title { min-width: 0; }
.title-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.title-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-path { margin-top: 4px; color: #909399; font-size: 11px; word-break: break-all; }
.viewer-3d { position: relative; width: 100%; height: 520px; border: 1px solid #dcdfe6; border-radius: 6px; background: #fff; overflow: hidden; }
.viewer-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; color: #909399; background: rgba(255,255,255,.75); }
.model-info { margin-top: 10px; padding: 9px 10px; border-radius: 6px; background: #f5f7fa; color: #606266; font-size: 12px; line-height: 1.7; word-break: break-all; }
.info-label { color: #909399; }
.legend { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 13px; }
.legend-title { color: #606266; font-weight: 600; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #c0c4cc; display: inline-block; }
@media (max-width: 900px) {
  .structure-layout { grid-template-columns: 1fr; }
  .model-sidebar { border-right: 0; border-bottom: 1px solid #ebeef5; padding-right: 0; padding-bottom: 14px; min-height: auto; }
  .tree-wrapper { height: 320px; }
  .viewer-3d { height: 440px; }
  .card-header, .viewer-toolbar { align-items: flex-start; flex-direction: column; }
  .subtitle { margin-left: 0; margin-top: 4px; display: block; }
  .header-actions { width: 100%; justify-content: flex-end; }
}
</style>
