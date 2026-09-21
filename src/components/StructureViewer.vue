<template>
  <el-card class="structure-card">
    <template #header>
      <div class="card-header">
        <div>
          <span>🧬 结构模型库</span>
        </div>
        <div class="header-actions">
          <el-tag v-if="indexLoaded" size="small" type="info">
            {{ totalModelCount }} 个模型 · 催化剂 {{ catalystModelCount }} / 中间体与过渡态 {{ intermediateModelCount }}
          </el-tag>
          <el-button size="small" :loading="loadingIndex" @click="reloadModels">刷新模型库</el-button>
        </div>
      </div>
    </template>

    <el-alert
      title="结构模型说明"
      type="info"
      :closable="false"
      class="structure-guide"
    >
      <template #default>
        <div class="data-description">
          <div>1. 结构模型库按 <code>public/structures</code> 实际目录层级自动生成，分为催化剂结构及反应中间体/过渡态结构2类。</div>
        </div>
      </template>
    </el-alert>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="mb12"
    />

    <div v-loading="loadingIndex" element-loading-text="正在读取结构目录索引……">
      <StructureSection
        icon="🧬"
        title="催化剂结构展示"
        :nodes="catalystModelNodes"
        empty-text="暂无催化剂结构：请将催化剂 XYZ 文件放入 public/structures/catalyst/ 目录，然后运行 npm run generate:structures"
      />
      <StructureSection
        icon="⚗️"
        title="反应中间体/过渡态结构展示"
        :nodes="intermediateNodes"
        empty-text="暂无反应中间体/过渡态结构：请将 XYZ 文件放入 public/structures 下的反应目录（如 CO-oxidation、C3H6-oxidation、NH3-SCR），然后运行 npm run generate:structures"
      />
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import StructureSection from './StructureSection.vue';

const MODEL_INDEX_URL = new URL('structures/index.json', new URL(import.meta.env.BASE_URL || '/', window.location.origin)).href;
const CACHE_VERSION = 'v10-two-sections';

const treeData = ref([]);
const loadingIndex = ref(false);
const loadError = ref('');
const indexLoaded = ref(false);

// catalyst / catalysts 顶层目录（大小写不敏感）归入催化剂结构，其余全部归入反应中间体/过渡态。
function isCatalystNode(node) {
  if (node.type !== 'folder') return false;
  const top = String(node.path || node.name || '').split(/[\\/]/)[0].trim().toLowerCase();
  return top === 'catalyst' || top === 'catalysts' || top === '催化剂' || top === '催化剂结构';
}

// 催化剂区：直接呈现 catalyst 文件夹“下”的内容（模型与子文件夹），不再外包一层“催化剂”根节点。
const catalystFolder = computed(() => treeData.value.find(isCatalystNode) || null);
const catalystModelNodes = computed(() => catalystFolder.value?.children || []);

// 中间体/过渡态区：保留各反应目录作为顶层节点（CO-oxidation、C3H6-oxidation、NH3-SCR 等）。
const intermediateNodes = computed(() => treeData.value.filter(node => !isCatalystNode(node)));

function countModels(nodes) {
  return (nodes || []).reduce((sum, node) => {
    if (node.type === 'file') return sum + 1;
    return sum + countModels(node.children || []);
  }, 0);
}

const catalystModelCount = computed(() => countModels(catalystModelNodes.value));
const intermediateModelCount = computed(() => countModels(intermediateNodes.value));
const totalModelCount = computed(() => catalystModelCount.value + intermediateModelCount.value);

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
  } catch (error) {
    console.error('结构模型库加载失败:', error);
    treeData.value = [];
    indexLoaded.value = false;
    loadError.value = `结构模型库加载失败：${error.message}`;
    ElMessage.error(loadError.value);
  } finally {
    loadingIndex.value = false;
  }
}

async function reloadModels() {
  await loadModels();
  if (!loadError.value) ElMessage.success('结构模型库已刷新');
}

loadModels();
</script>

<style scoped>
.structure-card { margin-top: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.structure-guide { margin-bottom: 14px; }
.mb12 { margin-bottom: 12px; }
.data-description { line-height: 1.8; font-size: 14px; }
.data-description div { margin-bottom: 4px; }
@media (max-width: 900px) {
  .card-header { align-items: flex-start; flex-direction: column; }
  .header-actions { width: 100%; justify-content: flex-end; }
}
</style>
