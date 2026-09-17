<template>
  <div id="app">
    <el-container>
      <el-header class="app-header">
        <h2>🧪 尾气净化催化剂数据平台</h2>
        <span class="data-count">{{ store.stats.dataPoints || 0 }} 条基础数据</span>
        <span class="version">v1.0</span>
      </el-header>

      <el-main class="app-main">
        <div class="container">
          <StatsCards />

          <el-tabs v-model="activeTab" type="border-card">
            <!-- 1. 数据浏览 -->
            <el-tab-pane label="📊 数据浏览" name="browse">
              <el-tabs type="card" class="browse-subtabs">
                <el-tab-pane label="催化剂特征值" name="features">
                  <DataTable :apply-element-filter="false" />
                </el-tab-pane>
                <el-tab-pane label="模型原子坐标" name="coordinates">
                  <StructureCoordinateTable />
                </el-tab-pane>
              </el-tabs>
            </el-tab-pane>

            <!-- 2. 催化剂特征值搜索 -->
            <el-tab-pane label="🔍 催化剂特征值搜索" name="search">
              <div class="search-panel">
                <PeriodicTable />
                <div v-if="store.selectedElement" class="selected-element-row">
                  <span class="selected-label">当前筛选元素：</span>
                  <el-tag type="primary">{{ store.selectedElement }}</el-tag>
                  <el-button type="text" @click="store.setSelectedElement('')">清除筛选</el-button>
                  <span class="related-count">共 {{ elementFilteredCount }} 条相关数据</span>
                </div>
                <DataTable :apply-element-filter="true" />
              </div>
            </el-tab-pane>

            <!-- 3. 结构展示 -->
            <el-tab-pane label="🧬 结构展示" name="structure">
              <StructureViewer />
            </el-tab-pane>

            <!-- 4. 动力学模拟 -->
            <el-tab-pane label="⚛️ 动力学模拟" name="aimd">
              <AIMDViewer :is-active="activeTab === 'aimd'" />
            </el-tab-pane>

            <!-- 5. 上传数据（最后一项） -->
            <el-tab-pane label="📤 上传数据" name="upload">
              <UploadPanel />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import StatsCards from '@/components/StatsCards.vue';
import PeriodicTable from '@/components/PeriodicTable.vue';
import DataTable from '@/components/DataTable.vue';
import StructureCoordinateTable from '@/components/StructureCoordinateTable.vue';
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
  } catch (error) {
    console.error('加载数据失败:', error);
    alert('请先运行 npm run convert 生成数据文件');
  }
});
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
  padding: 0;
}

.app-header {
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.app-header h2 {
  margin: 0;
  font-size: 20px;
}

.data-count {
  margin-left: 20px;
  font-size: 14px;
  opacity: 0.9;
}

.version {
  margin-left: auto;
  font-size: 13px;
  opacity: 0.8;
}

.app-main {
  background: #f5f7fa;
}

.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 10px;
}

.search-panel {
  padding: 10px 0;
}

.selected-element-row {
  margin: 10px 0;
}

.selected-label {
  font-weight: 500;
}

.related-count {
  margin-left: 15px;
  color: #909399;
}

.el-tabs--border-card {
  background: white;
}

.el-tabs__item {
  font-size: 15px;
}

@media (min-width: 768px) {
  .container { padding: 0 20px; }
}

@media (min-width: 1200px) {
  .container {
    max-width: 98%;
    padding: 0 30px;
  }
}

@media (max-width: 768px) {
  .el-tabs__item {
    font-size: 13px;
    padding: 0 10px;
  }
  .app-header h2 { font-size: 16px; }
  .app-header span { font-size: 12px; }
}

@media (max-width: 480px) {
  .el-tabs__item {
    font-size: 12px;
    padding: 0 6px;
  }
  .app-header { padding: 0 10px; }
  .app-header h2 { font-size: 14px; }
  .app-header span { font-size: 11px; }
}
</style>
