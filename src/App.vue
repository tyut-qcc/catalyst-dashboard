<!-- src/App.vue -->
<template>
  <div id="app">
    <el-container>
      <el-header style="background: #409eff; color: white; display: flex; align-items: center; padding: 0 20px;">
        <h2 style="margin:0; font-size: 20px;">🧪 尾气净化催化剂数据平台</h2>
        <span style="margin-left: 20px; font-size: 14px; opacity: 0.9;">
          {{ store.stats.dataPoints || 0 }} 条基础数据
        </span>
        <span style="margin-left: auto; font-size: 13px; opacity: 0.8;">
          v1.0
        </span>
      </el-header>
      <el-main style="background: #f5f7fa;">
        <div class="container">
          <StatsCards />

          <el-tabs v-model="activeTab" type="border-card">
            <el-tab-pane label="📊 数据浏览" name="browse">
              <DataTable :apply-element-filter="false" />
            </el-tab-pane>

            <el-tab-pane label="🔍 数据搜索" name="search">
              <div style="padding: 10px 0;">
                <PeriodicTable />
                <div v-if="store.selectedElement" style="margin: 10px 0;">
                  <span style="font-weight:500;">当前筛选元素：</span>
                  <el-tag type="primary">{{ store.selectedElement }}</el-tag>
                  <el-button type="text" @click="store.setSelectedElement('')">清除筛选</el-button>
                  <span style="margin-left: 15px; color: #909399;">
                    共 {{ elementFilteredCount }} 条相关数据
                  </span>
                </div>
                <DataTable :apply-element-filter="true" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="📤 上传数据" name="upload">
              <UploadPanel />
            </el-tab-pane>

            <el-tab-pane label="🧬 结构展示" name="structure">
              <StructureViewer />
            </el-tab-pane>

            <el-tab-pane label="⚛️ 动力学模拟" name="aimd">
              <AIMDViewer :is-active="activeTab === 'aimd'" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import StatsCards from '@/components/StatsCards.vue';
import PeriodicTable from '@/components/PeriodicTable.vue';
import DataTable from '@/components/DataTable.vue';
import UploadPanel from '@/components/UploadPanel.vue';
import StructureViewer from '@/components/StructureViewer.vue';
import AIMDViewer from '@/components/AIMDViewer.vue';

const store = useDataStore();
const activeTab = ref('browse');

const elementFilteredCount = computed(() => store.filteredByElement.length);

onMounted(async () => {
  try {
    const data = await import('@/data/catalysts.json');
    store.loadBaseData(data.default);
    store.loadUploadedFromStorage();
  } catch (e) {
    console.error('加载数据失败:', e);
    alert('请先运行 npm run convert 生成数据文件');
  }
});
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f7fa; padding: 0; }
.container { max-width: 100%; margin: 0 auto; padding: 0 10px; }
@media (min-width: 768px) { .container { padding: 0 20px; } }
@media (min-width: 1200px) { .container { max-width: 98%; padding: 0 30px; } }
.el-tabs--border-card { background: white; }
.el-tabs__item { font-size: 15px; }
@media (max-width: 768px) {
  .el-tabs__item { font-size: 13px; padding: 0 10px; }
  .el-header h2 { font-size: 16px !important; }
  .el-header span { font-size: 12px !important; }
}
@media (max-width: 480px) {
  .el-tabs__item { font-size: 12px; padding: 0 6px; }
  .el-header { padding: 0 10px !important; }
  .el-header h2 { font-size: 14px !important; }
  .el-header span { font-size: 11px !important; }
}
</style>