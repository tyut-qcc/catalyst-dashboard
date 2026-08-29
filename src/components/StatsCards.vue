<!-- src/components/StatsCards.vue -->
<template>
  <el-row :gutter="16" class="stats-cards">
    <el-col :xs="12" :sm="6" v-for="item in cardData" :key="item.label">
      <el-card shadow="hover" :body-style="{ padding: '16px', height: '100%', display: 'flex', alignItems: 'center' }">
        <div class="stat-item">
          <div class="stat-icon" :style="{ background: item.bg, color: item.color }">
            <el-icon><component :is="item.icon" /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-number">{{ item.value }}</div>
            <div v-if="item.label === '涵盖反应种类'" class="stat-detail">
              <el-tag size="small" v-for="r in item.reactions" :key="r" style="margin-right:4px;">
                {{ r }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup>
import { computed } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import { DataBoard, Document, Grid, Tickets } from '@element-plus/icons-vue';

const store = useDataStore();

const cardData = computed(() => {
  const s = store.stats;
  return [
    {
      label: '已收录催化剂数',
      value: s.catalystCount,
      icon: DataBoard,
      bg: '#ecf5ff',
      color: '#409eff',
    },
    {
      label: '已收录数据点',
      value: s.dataPoints,
      icon: Document,
      bg: '#f0f9eb',
      color: '#67c23a',
    },
    {
      label: '涵盖元素种类',
      value: s.elementCount,
      icon: Grid,
      bg: '#fdf6ec',
      color: '#e6a23c',
    },
    {
      label: '涵盖反应种类',
      value: s.reactionTypes.length,
      icon: Tickets,
      bg: '#fef0f0',
      color: '#f56c6c',
      reactions: s.reactionTypes,
    },
  ];
});
</script>

<style scoped>
.stats-cards {
  margin-bottom: 20px;
}
/* 确保每个卡片高度一致 */
.el-col {
  display: flex;
}
.el-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.stat-content {
  flex: 1;
  min-width: 0; /* 防止溢出 */
}
.stat-label {
  font-size: 14px;
  color: #909399;
}
.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}
.stat-detail {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>