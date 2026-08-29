<template>
  <el-card>
    <template #header>
      <span>🔍 按元素筛选催化剂</span>
      <span style="margin-left: 16px; font-size: 14px; color: #909399;">
        点击周期表中高亮的元素，查看对应催化剂的特性数据
      </span>
    </template>
    <div class="search-container">
      <div class="periodic-wrapper">
        <PeriodicTable 
          :highlighted="store.elements" 
          :clickable="true"
          :selected="selectedElement"
          @select="handleElementSelect"
        />
      </div>
      <div v-if="selectedElement" class="result-section">
        <el-divider content-position="left">
          筛选结果：掺杂金属含 {{ selectedElement }} 的催化剂
          <el-tag size="small" style="margin-left: 10px;">{{ filteredData.length }} 条</el-tag>
        </el-divider>
        <el-table 
          :data="filteredData" 
          border 
          stripe 
          height="400"
          style="width: 100%"
        >
          <el-table-column type="index" label="#" width="55" />
          <el-table-column prop="催化剂_ID" label="催化剂ID" width="180" fixed />
          <el-table-column prop="催化剂类型" label="类型" width="100" />
          <el-table-column prop="掺杂金属" label="掺杂金属" width="120" />
          <el-table-column prop="O2解离能垒TS2" label="O₂解离能垒" width="140" :formatter="formatNumber" />
          <el-table-column prop="CO氧化能垒TS1" label="CO氧化能垒" width="140" :formatter="formatNumber" />
          <el-table-column prop="氧空位形成能(eV)" label="氧空位形成能" width="140" :formatter="formatNumber" />
          <el-table-column prop="M1的鲍林电负性(无单位)" label="电负性" width="100" :formatter="formatNumber" />
          <el-table-column prop="M1的第一电离能(eV)" label="第一电离能" width="120" :formatter="formatNumber" />
        </el-table>
      </div>
      <div v-else class="hint">
        <el-empty description="请点击周期表中高亮的元素进行筛选" />
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import PeriodicTable from './PeriodicTable.vue';

const store = useDataStore();
const selectedElement = ref('');

// 当点击元素时，设置选中，并过滤数据
function handleElementSelect(symbol) {
  if (selectedElement.value === symbol) {
    // 如果点击的是同一个，取消选中
    selectedElement.value = '';
  } else {
    selectedElement.value = symbol;
  }
}

// 过滤数据：掺杂金属字段包含该元素（可能作为单独元素或复合中的一部分）
const filteredData = computed(() => {
  if (!selectedElement.value) return [];
  const elem = selectedElement.value;
  return store.allData.filter(row => {
    const metal = row['掺杂金属'] || '';
    // 检查 metal 是否包含该元素（作为独立符号或复合的一部分）
    // 可能的情况： "Pt" 或 "Pt-Ce" 或 "Cu-Ni"
    const parts = metal.split('-').map(s => s.trim());
    return parts.some(p => p === elem || p.startsWith(elem + '?') ); // 简单匹配
    // 更精确：使用正则匹配单词边界
    // return new RegExp('\\b' + elem + '\\b').test(metal);
  });
});

function formatNumber(val) {
  if (val === undefined || val === null || val === '') return '-';
  const num = Number(val);
  return isNaN(num) ? val : num.toFixed(3);
}
</script>

<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.periodic-wrapper {
  width: 100%;
  overflow-x: auto;
}
.result-section {
  margin-top: 10px;
}
.hint {
  padding: 40px 0;
}
</style>