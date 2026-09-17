<template>
  <div class="structure-data-page" v-loading="loading">
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-row">
        <el-input v-model="searchText" clearable placeholder="搜索模型、元素或目录" class="search-input" />
        <el-select v-model="selectedElement" clearable filterable placeholder="元素" class="element-select">
          <el-option v-for="el in elements" :key="el" :label="el" :value="el" />
        </el-select>
        <el-select v-model="pageSize" class="page-size-select">
          <el-option v-for="size in [20, 50, 100, 200]" :key="size" :label="`${size} 行/页`" :value="size" />
        </el-select>
        <el-button @click="loadData" :loading="loading">刷新</el-button>
        <el-button type="primary" @click="exportCsv" :disabled="!filteredRows.length">
          导出 CSV
        </el-button>
        <span class="summary">共 {{ filteredRows.length }} 个原子坐标</span>
      </div>
    </el-card>

    <div class="content-grid">
      <el-card shadow="never" class="tree-card">
        <template #header>
          <div class="section-header">
            <span>结构目录</span>
            <el-tag size="small">{{ modelCount }} 个模型</el-tag>
          </div>
        </template>
        <el-input v-model="treeFilter" clearable placeholder="筛选目录/模型" class="tree-filter" />
        <el-tree
          ref="treeRef"
          :data="treeData"
          node-key="id"
          :props="treeProps"
          :filter-node-method="filterTreeNode"
          highlight-current
          default-expand-all
          @node-click="handleTreeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <span class="tree-node-name">{{ data.name }}</span>
              <span v-if="data.type === 'folder'" class="tree-node-meta">{{ data.modelCount || 0 }}</span>
              <span v-else class="tree-node-meta">{{ data.atomCount || 0 }} atoms</span>
            </span>
          </template>
        </el-tree>
      </el-card>

      <el-card shadow="never" class="table-card">
        <template #header>
          <div class="section-header">
            <span>XYZ 原子坐标</span>
            <el-tag v-if="selectedPathLabel" type="info" size="small">{{ selectedPathLabel }}</el-tag>
          </div>
        </template>

        <el-table v-if="selectedModelId" :data="paginatedRows" border stripe height="620">
          <el-table-column type="index" label="#" width="60" fixed="left" />
          <el-table-column
            v-for="key in pathColumns"
            :key="key"
            :prop="key"
            :label="key"
            min-width="130"
            show-overflow-tooltip
          />
          <el-table-column prop="model" label="模型" min-width="180" show-overflow-tooltip />
          <el-table-column prop="atomIndex" label="原子序号" width="100" />
          <el-table-column prop="element" label="元素" width="90" fixed="right" />
          <el-table-column prop="x" label="X (Å)" width="130" />
          <el-table-column prop="y" label="Y (Å)" width="130" />
          <el-table-column prop="z" label="Z (Å)" width="130" />
        </el-table>
        <el-empty
          v-else
          description="请从左侧 structures 目录选择一个具体 XYZ 模型"
          :image-size="100"
        />

        <div v-if="selectedModelId" class="pagination-wrapper">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            background
            layout="total, prev, pager, next"
            :total="filteredRows.length"
          />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

const BASE_URL = import.meta.env.BASE_URL || '/';
const DATA_URL = new URL('structures/structure-data.json', new URL(BASE_URL, window.location.origin)).href;
const CACHE_VERSION = 'v1-coordinate-table';

const loading = ref(false);
const allRows = ref([]);
const treeData = ref([]);
const treeRef = ref(null);
const treeFilter = ref('');
const searchText = ref('');
const selectedElement = ref('');
const selectedPath = ref('');
const selectedModelId = ref('');
const selectedModelName = ref('');
const currentPage = ref(1);
const pageSize = ref(50);

const treeProps = { children: 'children', label: 'name' };

const elements = computed(() => [...new Set(allRows.value.map(row => row.element).filter(Boolean))].sort());
const modelCount = computed(() => new Set(allRows.value.map(row => `${row.path || ''}|${row.model || ''}`)).size);
const maxDepth = computed(() => allRows.value.reduce((max, row) => Math.max(max, Number(row.pathPartsCount || 0)), 0));
const pathColumns = computed(() => Array.from({ length: maxDepth.value }, (_, index) => `目录${index + 1}`));

const filteredRows = computed(() => {
  if (!selectedModelId.value) return [];
  const query = searchText.value.trim().toLowerCase();
  return allRows.value.filter(row => {
    if (row.modelId !== selectedModelId.value) return false;
    if (selectedElement.value && row.element !== selectedElement.value) return false;
    if (!query) return true;
    const haystack = [row.model, row.file, row.path, row.element, ...(row.pathParts || [])].join(' ').toLowerCase();
    return haystack.includes(query);
  });
});

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value).map(row => ({
    ...row,
    ...Object.fromEntries((row.pathParts || []).map((part, index) => [`目录${index + 1}`, part])),
    model: selectedModelName.value || row.model || (row.file ? String(row.file).replace(/\.xyz$/i, '') : ''),
    x: formatNumber(row.x),
    y: formatNumber(row.y),
    z: formatNumber(row.z),
  }));
});

const selectedPathLabel = computed(() => {
  if (!selectedModelId.value) return '未选择模型';
  const row = allRows.value.find(item => item.modelId === selectedModelId.value);
  if (!row) return selectedModelName.value || '已选择模型';
  const modelName = selectedModelName.value || row.model || (row.file ? String(row.file).replace(/\.xyz$/i, '') : '');
  return `${row.path ? row.path.replace(/\//g, ' / ') + ' / ' : ''}${modelName}`;
});

watch(treeFilter, value => treeRef.value?.filter(value));
watch([searchText, selectedElement, selectedPath, pageSize], () => { currentPage.value = 1; });

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : '';
}

function filterTreeNode(value, data) {
  if (!value) return true;
  const query = String(value).trim().toLowerCase();
  return `${data.name || ''} ${data.path || ''} ${data.file || ''}`.toLowerCase().includes(query)
    || (data.type === 'folder' && hasDescendantMatch(data.children || [], query));
}

function hasDescendantMatch(nodes, query) {
  return nodes.some(node => {
    const hit = `${node.name || ''} ${node.path || ''} ${node.file || ''}`.toLowerCase().includes(query);
    return hit || (node.type === 'folder' && hasDescendantMatch(node.children || [], query));
  });
}

function handleTreeClick(data) {
  if (!data) return;
  currentPage.value = 1;
  if (data.type !== 'file') {
    selectedModelId.value = '';
    selectedModelName.value = '';
    selectedPath.value = data.path || '';
    return;
  }
  selectedModelId.value = data.id || '';
  selectedModelName.value = data.name || (data.file ? String(data.file).replace(/\.xyz$/i, '') : '');
  selectedPath.value = String(data.path || '').replace(/\/[^/]+$/, '');
}

async function loadData() {
  loading.value = true;
  try {
    const response = await fetch(`${DATA_URL}?v=${CACHE_VERSION}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`结构坐标数据 HTTP ${response.status}`);
    const payload = await response.json();
    treeData.value = payload.tree || [];
    allRows.value = payload.rows || [];
    selectedPath.value = '';
    selectedModelId.value = '';
    selectedModelName.value = '';
    selectedElement.value = '';
    currentPage.value = 1;
    await nextTick();
  } catch (error) {
    console.error('结构坐标数据加载失败:', error);
    ElMessage.error(`结构坐标数据加载失败：${error.message}`);
  } finally {
    loading.value = false;
  }
}

function exportCsv() {
  const keys = [...pathColumns.value, '模型', '原子序号', '元素', 'X (Å)', 'Y (Å)', 'Z (Å)'];
  const csvRows = [keys.join(',')];
  filteredRows.value.forEach(row => {
    const values = [
      ...(row.pathParts || []),
      row.model,
      row.atomIndex,
      row.element,
      formatNumber(row.x),
      formatNumber(row.y),
      formatNumber(row.z),
    ];
    csvRows.push(values.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'structure_xyz_coordinates.csv';
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('结构坐标已导出');
}

loadData();
</script>

<style scoped>
.structure-data-page { padding: 0; }
.toolbar-card { margin-bottom: 12px; }
.toolbar-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.search-input { width: 280px; }
.element-select { width: 130px; }
.page-size-select { width: 120px; }
.summary { margin-left: auto; color: #909399; font-size: 13px; }
.content-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 12px; }
.tree-card, .table-card { min-width: 0; }
.tree-filter { margin-bottom: 10px; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tree-node { display: flex; align-items: center; width: 100%; min-width: 0; }
.tree-node-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-node-meta { margin-left: auto; color: #909399; font-size: 12px; }
.pagination-wrapper { display: flex; justify-content: flex-end; margin-top: 12px; }
@media (max-width: 900px) {
  .content-grid { grid-template-columns: 1fr; }
  .summary { width: 100%; margin-left: 0; }
}
</style>
