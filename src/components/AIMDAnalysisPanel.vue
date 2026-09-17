<template>
  <section class="aimd-analysis">
    <el-card shadow="never" class="analysis-card">
      <template #header>
        <div class="analysis-header">
          <div>
            <strong>AIMD 温度与结构统计</strong>
            <div class="analysis-subtitle">选择轨迹后，查看该轨迹的有效结构模型与结构预览</div>
          </div>
          <el-button size="small" plain @click="loadManifest" :loading="loadingManifest">刷新</el-button>
        </div>
      </template>

      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
        class="mb12"
      />

      <div v-if="loadingManifest && !manifest" class="analysis-loading">正在读取 AIMD 轨迹库…</div>

      <template v-else>
        <div v-if="trajectoryList.length" class="trajectory-section">
          <div class="section-title-row">
            <span>当前 AIMD 轨迹</span>
            <span class="muted">共 {{ trajectoryList.length }} 条</span>
          </div>

          <div class="trajectory-grid">
            <button
              v-for="item in trajectoryList"
              :key="item.id"
              type="button"
              class="trajectory-card"
              :class="{ active: item.id === selectedTrajectoryId }"
              @click="selectTrajectory(item)"
            >
              <div class="trajectory-name">{{ item.name || item.id }}</div>
              <div class="trajectory-file">{{ item.file }}</div>
              <div class="trajectory-meta">
                <span>{{ item.frames ?? '—' }} 帧</span>
                <strong>{{ item.effectiveStructureCount ?? '—' }} 个有效结构</strong>
              </div>
            </button>
          </div>
        </div>

        <div v-if="loadingAnalysis" class="analysis-loading compact">正在分析所选轨迹…</div>

        <template v-else-if="analysis">
          <div class="analysis-summary-grid">
            <div class="summary-card">
              <div class="label">当前轨迹</div>
              <div class="value text">{{ analysis.trajectory?.name || analysis.trajectory?.id }}</div>
            </div>
            <div class="summary-card">
              <div class="label">轨迹帧数</div>
              <div class="value">{{ counts.frameCount }}</div>
            </div>
            <div class="summary-card highlight">
              <div class="label">有效结构模型</div>
              <div class="value">{{ counts.effectiveStructureCount }}</div>
            </div>
            <div class="summary-card">
              <div class="label">成功解析能量</div>
              <div class="value">{{ counts.energyFrameCount }} 帧</div>
            </div>
          </div>

          <div class="model-content-grid">
            <el-card shadow="never" class="panel-card temperature-card">
              <template #header>
                <div class="card-header-row">
                  <span>温度—结构分布</span>
                  <span class="muted">0–400 ℃</span>
                </div>
              </template>

              <div class="temperature-list">
                <div v-for="item in temperatureBins" :key="item.label" class="temperature-row">
                  <div class="temperature-label">{{ item.label }}</div>
                  <div class="temperature-track">
                    <div class="temperature-bar" :style="{ width: `${item.percent}%` }"></div>
                  </div>
                  <div class="temperature-count">{{ item.count }}</div>
                </div>
              </div>
            </el-card>

            <el-card shadow="never" class="panel-card viewer-card">
              <template #header>
                <div class="card-header-row">
                  <span>结构模型预览</span>
                  <el-tag v-if="selectedModel" size="small" effect="plain">{{ selectedModel.id }}</el-tag>
                </div>
              </template>

              <div :key="selectedModel?.id || 'empty-model'" ref="modelViewerEl" class="model-viewer">
                <el-empty v-if="!selectedModel" description="请选择有效结构模型" :image-size="64" />
              </div>

              <div v-if="selectedModel" class="model-meta">
                <div><span>材料</span><strong>{{ selectedModel.material }}</strong></div>
                <div><span>Frame</span><strong>{{ selectedModel.frame }}</strong></div>
                <div><span>温度</span><strong>{{ selectedModel.temperatureC }} ℃</strong></div>
                <div><span>能量</span><strong>{{ formatEnergy(selectedModel.energy) }}</strong></div>
              </div>
            </el-card>

            <el-card shadow="never" class="panel-card model-list-card">
            <template #header>
              <div class="card-header-row">
                <span>有效结构模型</span>
                <div class="list-tools">
                  <el-input
                    v-model="searchText"
                    size="small"
                    clearable
                    placeholder="搜索模型 / Frame / 温度"
                    style="width: 220px"
                  />
                  <span class="muted">{{ filteredModels.length }} 个</span>
                </div>
              </div>
            </template>

            <el-table
              :data="pagedModels"
              size="small"
              row-key="id"
              highlight-current-row
              @row-click="selectModel"
            >
              <el-table-column prop="id" label="模型ID" width="150" />
              <el-table-column prop="frame" label="Frame" width="85" sortable />
              <el-table-column prop="temperatureC" label="温度 / ℃" width="105" sortable />
              <el-table-column label="能量 / eV" width="145">
                <template #default="scope">{{ formatEnergy(scope.row.energy) }}</template>
              </el-table-column>
              <el-table-column prop="mergedFrameCount" label="合并帧" width="85" />
              <el-table-column prop="atomCount" label="原子数" width="80" />
            </el-table>

            <div class="pagination-row">
              <el-pagination
                v-model:current-page="page"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50]"
                :total="filteredModels.length"
                layout="total, sizes, prev, pager, next"
                background
              />
            </div>
          </el-card>
          </div>
        </template>

        <el-empty v-else description="请选择一条 AIMD 轨迹查看有效结构模型" :image-size="84" />
      </template>
    </el-card>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as $3Dmol from '3dmol';

const BASE_URL = import.meta.env.BASE_URL || '/';
const INDEX_URL = new URL('aimd/analysis/index.json', new URL(BASE_URL, window.location.origin)).href;

const manifest = ref(null);
const analysis = ref(null);
const selectedTrajectoryId = ref('');
const selectedModel = ref(null);
const searchText = ref('');
const page = ref(1);
const pageSize = ref(20);
const loadingManifest = ref(false);
const loadingAnalysis = ref(false);
const errorMessage = ref('');
const modelViewerEl = ref(null);
const modelViewerLoading = ref(false);
let modelViewer = null;
let manifestToken = 0;
let analysisToken = 0;
let modelToken = 0;

const trajectoryList = computed(() => {
  const list = manifest.value?.trajectories || manifest.value?.models || [];
  return Array.isArray(list) ? list : [];
});

const counts = computed(() => analysis.value?.counts || {
  frameCount: 0,
  effectiveStructureCount: 0,
  energyFrameCount: 0,
});

const models = computed(() => Array.isArray(analysis.value?.models) ? analysis.value.models : []);

const filteredModels = computed(() => {
  const q = String(searchText.value || '').trim().toLowerCase();
  if (!q) return models.value;
  return models.value.filter(model =>
    [model.id, model.frame, model.temperatureC, model.energy]
      .some(value => String(value ?? '').toLowerCase().includes(q))
  );
});

const pagedModels = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredModels.value.slice(start, start + pageSize.value);
});

const temperatureBins = computed(() => {
  const ranges = [
    { min: 0, max: 79, label: '0–79 ℃' },
    { min: 80, max: 159, label: '80–159 ℃' },
    { min: 160, max: 239, label: '160–239 ℃' },
    { min: 240, max: 319, label: '240–319 ℃' },
    { min: 320, max: 400, label: '320–400 ℃' },
  ];
  const total = models.value.length || 1;
  return ranges.map(range => {
    const count = models.value.filter(model => {
      const t = Number(model.temperatureC);
      return Number.isFinite(t) && t >= range.min && t <= range.max;
    }).length;
    return {
      ...range,
      count,
      percent: count ? Math.max(8, Math.round(count / total * 100)) : 0,
    };
  });
});

watch(searchText, () => { page.value = 1; });
watch(pageSize, () => { page.value = 1; });

function formatEnergy(value) {
  return Number.isFinite(value) ? Number(value).toFixed(6) : '—';
}

async function loadManifest() {
  const token = ++manifestToken;
  loadingManifest.value = true;
  errorMessage.value = '';
  try {
    const res = await fetch(`${INDEX_URL}?v=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) throw new Error(`AIMD轨迹索引读取失败（HTTP ${res.status}）`);
    if (/^\s*<!doctype\s+html/i.test(text)) {
      throw new Error('未找到 AIMD 轨迹索引，请先运行 node scripts\\analyze-aimd-structures.cjs');
    }
    const json = JSON.parse(text);
    if (token !== manifestToken) return;
    manifest.value = json;
    const list = Array.isArray(json?.trajectories) ? json.trajectories : (json?.models || []);
    const first = list?.[0];
    if (first) await selectTrajectory(first);
  } catch (error) {
    if (token !== manifestToken) return;
    manifest.value = null;
    analysis.value = null;
    errorMessage.value = error?.message || 'AIMD轨迹库读取失败';
  } finally {
    if (token === manifestToken) loadingManifest.value = false;
  }
}

async function selectTrajectory(item) {
  if (!item?.id) return;
  const token = ++analysisToken;
  selectedTrajectoryId.value = item.id;
  analysis.value = null;
  selectedModel.value = null;
  ++modelToken;
  searchText.value = '';
  page.value = 1;
  destroyViewer();
  loadingAnalysis.value = true;
  errorMessage.value = '';

  try {
    const url = new URL(item.analysisUrl, INDEX_URL).href;
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) throw new Error(`轨迹 ${item.name || item.id} 分析结果读取失败（HTTP ${res.status}）`);
    if (/^\s*<!doctype\s+html/i.test(text)) throw new Error(`轨迹 ${item.name || item.id} 尚未生成结构分析结果`);
    const json = JSON.parse(text);
    if (token !== analysisToken) return;
    analysis.value = json;
    const firstModel = json.models?.[0] || null;
    if (firstModel) await selectModel(firstModel);
  } catch (error) {
    if (token !== analysisToken) return;
    analysis.value = null;
    errorMessage.value = error?.message || '所选 AIMD 轨迹分析失败';
  } finally {
    if (token === analysisToken) loadingAnalysis.value = false;
  }
}

async function selectModel(model) {
  if (!model) return;
  selectedModel.value = model;
  modelViewerLoading.value = true;
  const token = ++modelToken;
  try {
    const analysisBaseUrl = new URL(
      `aimd/analysis/trajectories/${analysis.value?.trajectory?.key || ''}.json`,
      new URL(BASE_URL, window.location.origin),
    ).href;
    const url = new URL(model.coordinatesUrl, analysisBaseUrl).href;
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) throw new Error(`结构模型读取失败（HTTP ${res.status}）`);
    if (/^\s*<!doctype\s+html/i.test(text)) throw new Error('结构模型坐标文件未找到，请重新运行 AIMD 分析脚本');
    const payload = JSON.parse(text);
    if (token !== modelToken) return;
    await nextTick();
    renderSelectedModel(payload);
  } catch (error) {
    if (token !== modelToken) return;
    errorMessage.value = error?.message || '有效结构模型加载失败';
    destroyViewer();
  } finally {
    if (token === modelToken) modelViewerLoading.value = false;
  }
}

function atomsToXyz(atoms) {
  const list = Array.isArray(atoms) ? atoms : [];
  return [
    String(list.length),
    'AIMD representative structure',
    ...list.map(atom => `${String(atom.element || 'X')} ${Number(atom.x).toFixed(6)} ${Number(atom.y).toFixed(6)} ${Number(atom.z).toFixed(6)}`),
  ].join('\n');
}

function destroyViewer() {
  if (modelViewer) {
    try { modelViewer.clear(); } catch {}
    modelViewer = null;
  }
}

function renderSelectedModel(payload) {
  const container = modelViewerEl.value;
  if (!container || !Array.isArray(payload?.atoms) || payload.atoms.length === 0) return;

  const token = modelToken;
  let tries = 0;

  const draw = () => {
    if (token !== modelToken) return;
    if (!modelViewerEl.value) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 80 || height < 80) {
      if (tries++ < 60) requestAnimationFrame(draw);
      return;
    }

    try {
      destroyViewer();
      container.innerHTML = '';
      modelViewer = $3Dmol.createViewer(container, {
        backgroundColor: '#ffffff',
        antialias: true,
      });

      modelViewer.addModel(atomsToXyz(payload.atoms), 'xyz');
      modelViewer.setStyle({}, {
        stick: { radius: 0.16, colorscheme: 'Jmol' },
        sphere: { scale: 0.32, colorscheme: 'Jmol' },
      });
      modelViewer.zoomTo();
      modelViewer.center();
      modelViewer.resize();
      modelViewer.render();
      requestAnimationFrame(() => {
        if (token !== modelToken || !modelViewer) return;
        modelViewer.resize();
        modelViewer.zoomTo();
        modelViewer.render();
      });
    } catch (error) {
      errorMessage.value = `结构模型预览失败：${error?.message || '3D 模型渲染错误'}`;
      destroyViewer();
    }
  };

  nextTick(() => requestAnimationFrame(draw));
}

onMounted(loadManifest);
onBeforeUnmount(destroyViewer);
</script>

<style scoped>
.aimd-analysis { margin: 0 0 16px; }
.analysis-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.analysis-header, .card-header-row, .section-title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.analysis-subtitle { margin-top:4px; color:#98a2b3; font-size:12px; }
.mb12 { margin-bottom:12px; }
.muted { color:#98a2b3; font-size:12px; }
.analysis-loading { padding:24px; text-align:center; color:#667085; }
.analysis-loading.compact { padding:16px; margin:12px 0; background:#fafafa; border-radius:8px; }
.trajectory-section { margin-bottom:12px; }
.section-title-row { margin:2px 0 8px; font-size:13px; font-weight:600; color:#344054; }
.trajectory-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.trajectory-card { text-align:left; border:1px solid #e4e7ed; border-radius:10px; background:#fff; padding:12px 13px; cursor:pointer; transition:.18s ease; }
.trajectory-card:hover { border-color:#b6c9ff; transform:translateY(-1px); }
.trajectory-card.active { border-color:#5b8def; background:#f7faff; box-shadow:0 0 0 1px rgba(91,141,239,.12); }
.trajectory-name { font-size:14px; font-weight:700; color:#1f2937; }
.trajectory-file { margin-top:3px; font-size:11px; color:#98a2b3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trajectory-meta { display:flex; justify-content:space-between; gap:8px; margin-top:10px; font-size:11px; color:#667085; }
.trajectory-meta strong { color:#3f6fc6; }
.analysis-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:12px 0; }
.summary-card { min-height:72px; padding:12px 14px; border:1px solid #eaecf0; border-radius:9px; background:#fff; }
.summary-card.highlight { border-color:#c7defe; background:#f7faff; }
.summary-card .label { font-size:12px; color:#98a2b3; margin-bottom:6px; }
.summary-card .value { font-size:22px; font-weight:700; color:#1d2939; }
.summary-card .value.text { font-size:15px; line-height:1.3; }
.temperature-card { margin-bottom:0; }
.model-content-grid { display:grid; grid-template-columns:minmax(0,0.78fr) minmax(0,1.02fr) minmax(0,1.40fr); gap:12px; align-items:stretch; }
.panel-card { border:1px solid #eaecf0; border-radius:9px; }
.temperature-card { min-height:180px; }
.temperature-list { padding:6px 2px; }
.temperature-row { display:grid; grid-template-columns:78px 1fr 34px; align-items:center; gap:10px; margin:17px 0; }
.temperature-label { font-size:12px; color:#475467; }
.temperature-track { height:8px; border-radius:999px; overflow:hidden; background:#f2f4f7; }
.temperature-bar { height:100%; border-radius:999px; background:linear-gradient(90deg,#7ba7ff,#4f7cf0); }
.temperature-count { font-size:12px; text-align:right; color:#344054; font-weight:600; }
.viewer-card { min-height:380px; }
.model-list-card { min-width:0; }
.model-viewer { position:relative; width:100%; height:300px; min-height:300px; border:1px solid #eef0f3; border-radius:8px; background:#fff; overflow:hidden; }
.model-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:8px; }
.model-meta div { padding:8px 9px; border-radius:7px; background:#f8fafc; }
.model-meta span { display:block; font-size:10px; color:#98a2b3; margin-bottom:2px; }
.model-meta strong { display:block; font-size:12px; color:#344054; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.model-list-card { margin-bottom:0; min-width:0; overflow:hidden; }
.list-tools { display:flex; align-items:center; gap:9px; }
.pagination-row { display:flex; justify-content:flex-end; margin-top:10px; }
:deep(.el-table th.el-table__cell) { background:#fafafa; color:#667085; font-weight:600; }
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell) { padding:7px 0; }
@media (max-width: 1000px) {
  .trajectory-grid { grid-template-columns:1fr; }
  .analysis-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .model-content-grid { grid-template-columns:1fr; }
}
@media (max-width: 650px) {
  .analysis-summary-grid { grid-template-columns:1fr 1fr; }
  .model-meta { grid-template-columns:repeat(2,1fr); }
  .list-tools { width:100%; }
  .list-tools :deep(.el-input) { flex:1; }
}
</style>
