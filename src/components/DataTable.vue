<!-- src/components/DataTable.vue -->
<template>
  <el-card class="table-card">
    <template #header>
      <div class="table-toolbar">
        <el-input 
          v-model="searchText" 
          placeholder="搜索催化剂ID / 金属..." 
          clearable 
          style="width: 220px" 
          prefix-icon="Search"
        />
        <el-select v-model="filterType" placeholder="催化剂类型" clearable style="width: 140px">
          <el-option label="全部" value="" />
          <el-option label="单原子" value="单原子" />
          <el-option label="双原子" value="双原子" />
          <el-option label="氧空位" value="氧空位" />
          <el-option label="纯载体" value="纯载体" />
        </el-select>
        <el-select v-model="filterMetal" placeholder="掺杂金属" clearable filterable style="width: 140px">
          <el-option v-for="m in store.metals" :key="m" :label="m" :value="m" />
        </el-select>
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon> 导出 CSV
        </el-button>
        <el-button @click="showColumnSelector = true">
          <el-icon><Setting /></el-icon> 列管理
        </el-button>
        <span style="margin-left: auto; font-size: 13px; color: #909399;">
          共 {{ filteredData.length }} 条
        </span>
      </div>
    </template>

    <!-- 表格 -->
    <el-table 
      :data="paginatedData" 
      border 
      stripe 
      height="500" 
      style="width: 100%"
      v-loading="loading"
      @sort-change="handleSort"
    >
      <el-table-column type="index" label="#" width="55" fixed="left" />
      
      <el-table-column
        v-for="col in visibleCols"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :width="col.width || 150"
        :fixed="col.fixed ? 'left' : false"
        :sortable="col.key !== '催化剂_ID' && col.key !== '催化剂类型'"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span v-if="col.key === '催化剂_ID'" style="font-weight: 500; color: #409eff;">
            {{ row[col.key] }}
          </span>
          <span v-else-if="row[col.key] !== undefined && row[col.key] !== '' && row[col.key] !== null">
            {{ typeof row[col.key] === 'number' ? row[col.key].toFixed(4) : row[col.key] }}
          </span>
          <span v-else style="color: #c0c4cc;">-</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        layout="sizes, prev, pager, next"
        :total="filteredData.length"
        background
      />
    </div>

    <!-- 列选择器 -->
    <el-dialog v-model="showColumnSelector" title="选择显示的列" width="600px">
      <el-checkbox-group v-model="selectedColumns" class="column-checkbox-group">
        <el-checkbox 
          v-for="col in allColumns" 
          :key="col.key" 
          :label="col.key"
          :disabled="col.fixed"
        >
          {{ col.label }}
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="resetColumns">恢复默认</el-button>
        <el-button type="primary" @click="applyColumns">应用</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useDataStore } from '@/stores/dataStore';
import { getColumnLabel, FIXED_COLUMNS } from '@/utils/constants';
import { Download, Setting } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 接收 prop：是否应用元素筛选
const props = defineProps({
  applyElementFilter: {
    type: Boolean,
    default: true,
  }
});

const store = useDataStore();
const loading = ref(false);

// 搜索与筛选
const searchText = ref('');
const filterType = ref('');
const filterMetal = ref('');

// 分页
const currentPage = ref(1);
const pageSize = ref(50);

// 列管理
const showColumnSelector = ref(false);
const allColumns = ref([]);
const selectedColumns = ref([]);

// 初始化列
function initColumns() {
  const data = store.allData;
  if (data.length === 0) return;
  
  const keys = Object.keys(data[0]);
  allColumns.value = keys.map(key => ({
    key,
    label: getColumnLabel(key),
    fixed: FIXED_COLUMNS.includes(key),
    width: key === '催化剂_ID' ? 180 : (key.includes('键长') || key.includes('能') ? 160 : 140)
  }));
  
  selectedColumns.value = keys;
}

// 监听数据变化初始化列
watch(
  () => store.allData.length,
  (newLen) => {
    if (newLen > 0 && allColumns.value.length === 0) {
      initColumns();
    }
  },
  { immediate: true }
);

// 可见列
const visibleCols = computed(() => {
  return allColumns.value.filter(col => selectedColumns.value.includes(col.key));
});

// 根据 prop 决定基础数据源
const baseData = computed(() => {
  return props.applyElementFilter ? store.filteredByElement : store.allData;
});

// 再应用搜索、类型、金属筛选
const filteredData = computed(() => {
  let data = baseData.value;
  
  if (searchText.value) {
    const s = searchText.value.toLowerCase();
    data = data.filter(row => 
      (row['催化剂_ID'] && row['催化剂_ID'].toLowerCase().includes(s)) ||
      (row['掺杂金属'] && row['掺杂金属'].toLowerCase().includes(s))
    );
  }
  if (filterType.value) {
    data = data.filter(row => row['催化剂类型'] === filterType.value);
  }
  if (filterMetal.value) {
    data = data.filter(row => row['掺杂金属'] === filterMetal.value);
  }
  return data;
});

// 分页数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredData.value.slice(start, end);
});

// 排序
function handleSort({ prop, order }) {
  if (!prop) return;
  ElMessage.info('排序已应用（当前页）');
}

// 导出 CSV
function handleExport() {
  const data = filteredData.value;
  if (data.length === 0) return ElMessage.warning('没有数据可导出');
  const keys = Object.keys(data[0]);
  let csv = keys.join(',') + '\n';
  data.forEach(row => {
    csv += keys.map(k => `"${(row[k] ?? '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'catalyst_data.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('导出成功');
}

function resetColumns() {
  selectedColumns.value = allColumns.value.map(c => c.key);
}

function applyColumns() {
  showColumnSelector.value = false;
  ElMessage.success('列设置已更新');
}

onMounted(() => {
  if (store.allData.length > 0) {
    initColumns();
  }
});
</script>

<style scoped>
.table-card { margin-top: 10px; }
.table-toolbar { 
  display: flex; 
  flex-wrap: wrap; 
  align-items: center; 
  gap: 10px; 
}
@media (max-width: 768px) {
  .table-toolbar .el-input,
  .table-toolbar .el-select {
    width: 100% !important;
  }
  .table-toolbar .el-button {
    flex: 1;
    justify-content: center;
  }
  .table-toolbar span {
    width: 100%;
    text-align: center;
    margin-top: 4px;
  }
}
.pagination-wrapper { 
  display: flex; 
  justify-content: flex-end; 
  margin-top: 16px; 
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .pagination-wrapper {
    justify-content: center;
  }
  .el-pagination {
    flex-wrap: wrap;
    justify-content: center;
  }
}
.column-checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
.column-checkbox-group .el-checkbox { width: 160px; margin-right: 0; }
.el-table {
  overflow-x: auto;
}
</style>