<!-- src/App.vue -->
<template>
  <div id="app">
    <el-container>
      <el-header style="background: #409eff; color: white; display: flex; align-items: center; padding: 0 20px;">
        <h2 style="margin:0; font-size: 20px;">🧪 尾气净化催化剂数据平台</h2>
        <span style="margin-left: 20px; font-size: 14px; opacity: 0.9;">
          {{ store.metadata.totalCount || 0 }} 条基础数据
        </span>
        <span style="margin-left: auto; font-size: 13px; opacity: 0.8;">
          v1.0
        </span>
      </el-header>
      <el-main style="background: #f5f7fa;">
        <div class="container">
          <!-- 统计卡片 -->
          <StatsCards />

          <!-- 标签页切换 -->
          <el-tabs v-model="activeTab" type="border-card">
            <!-- 数据浏览：显示全部数据，不使用元素筛选 -->
            <el-tab-pane label="📊 数据浏览" name="browse">
              <DataTable :apply-element-filter="false" />
            </el-tab-pane>

            <!-- 数据搜索：包含元素周期表和筛选结果 -->
            <el-tab-pane label="🔍 数据搜索" name="search">
              <div style="padding: 10px 0;">
                <!-- 元素周期表 -->
                <PeriodicTable />
                <!-- 当前选中元素提示 -->
                <div v-if="store.selectedElement" style="margin: 10px 0;">
                  <span style="font-weight:500;">当前筛选元素：</span>
                  <el-tag type="primary">{{ store.selectedElement }}</el-tag>
                  <el-button type="text" @click="store.setSelectedElement('')">清除筛选</el-button>
                  <span style="margin-left: 15px; color: #909399;">
                    共 {{ elementFilteredCount }} 条相关数据
                  </span>
                </div>
                <!-- 数据表格：应用元素筛选 -->
                <DataTable :apply-element-filter="true" />
              </div>
            </el-tab-pane>

            <el-tab-pane label="📤 上传数据" name="upload">
              <UploadPanel />
            </el-tab-pane>

            <!-- 结构展示（已下线，保留注释以备后续启用） -->
            <!--
            <el-tab-pane label="🧬 结构展示" name="structure">
              <StructureViewer />
            </el-tab-pane>
            -->
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
// 结构展示组件已下线，暂不导入
// import StructureViewer from '@/components/StructureViewer.vue';

const store = useDataStore();
const activeTab = ref('browse');

// 计算筛选后的数据条数，用于显示
const elementFilteredCount = computed(() => {
  return store.filteredByElement.length;
});

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
/* ===== 全局重置 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
  padding: 0;
}

/* ===== 容器：自适应宽度和留白 ===== */
.container {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 10px; /* 手机端默认小留白 */
}

/* 平板及桌面增加留白 */
@media (min-width: 768px) {
  .container {
    padding: 0 20px;
  }
}
@media (min-width: 1200px) {
  .container {
    max-width: 98%;
    padding: 0 30px;
  }
}

/* ===== Element Plus 标签页样式覆盖 ===== */
.el-tabs--border-card {
  background: white;
}
.el-tabs__item {
  font-size: 15px;
}

/* 手机端标签文字缩小，防止溢出 */
@media (max-width: 768px) {
  .el-tabs__item {
    font-size: 13px;
    padding: 0 10px;
  }
  .el-header h2 {
    font-size: 16px !important;
  }
  .el-header span {
    font-size: 12px !important;
  }
}

/* 更小屏设备（< 480px）进一步压缩 */
@media (max-width: 480px) {
  .el-tabs__item {
    font-size: 12px;
    padding: 0 6px;
  }
  .el-header {
    padding: 0 10px !important;
  }
  .el-header h2 {
    font-size: 14px !important;
  }
  .el-header span {
    font-size: 11px !important;
  }
}
</style>