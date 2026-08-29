<!-- src/components/PeriodicTable.vue -->
<template>
  <div class="periodic-table">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>🧪 元素周期表</span>
          <span style="font-size:13px; color:#909399;">
            点击元素可筛选数据，再次点击取消选择
          </span>
        </div>
      </template>
      <div class="table-grid">
        <div 
          v-for="el in elements" 
          :key="el.symbol"
          class="element-item"
          :class="{ 
            active: selectedElement === el.symbol,
            present: presentElements.includes(el.symbol)
          }"
          @click="toggleElement(el.symbol)"
        >
          <div class="symbol">{{ el.symbol }}</div>
          <div class="name">{{ el.name }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useDataStore } from '@/stores/dataStore';

const store = useDataStore();
const selectedElement = computed(() => store.selectedElement);

// 标准元素周期表（完整版）
const allElements = [
  { symbol: 'H', name: '氢' }, { symbol: 'He', name: '氦' },
  { symbol: 'Li', name: '锂' }, { symbol: 'Be', name: '铍' }, { symbol: 'B', name: '硼' }, { symbol: 'C', name: '碳' }, { symbol: 'N', name: '氮' }, { symbol: 'O', name: '氧' }, { symbol: 'F', name: '氟' }, { symbol: 'Ne', name: '氖' },
  { symbol: 'Na', name: '钠' }, { symbol: 'Mg', name: '镁' }, { symbol: 'Al', name: '铝' }, { symbol: 'Si', name: '硅' }, { symbol: 'P', name: '磷' }, { symbol: 'S', name: '硫' }, { symbol: 'Cl', name: '氯' }, { symbol: 'Ar', name: '氩' },
  { symbol: 'K', name: '钾' }, { symbol: 'Ca', name: '钙' }, { symbol: 'Sc', name: '钪' }, { symbol: 'Ti', name: '钛' }, { symbol: 'V', name: '钒' }, { symbol: 'Cr', name: '铬' }, { symbol: 'Mn', name: '锰' }, { symbol: 'Fe', name: '铁' }, { symbol: 'Co', name: '钴' }, { symbol: 'Ni', name: '镍' }, { symbol: 'Cu', name: '铜' }, { symbol: 'Zn', name: '锌' }, { symbol: 'Ga', name: '镓' }, { symbol: 'Ge', name: '锗' }, { symbol: 'As', name: '砷' }, { symbol: 'Se', name: '硒' }, { symbol: 'Br', name: '溴' }, { symbol: 'Kr', name: '氪' },
  { symbol: 'Rb', name: '铷' }, { symbol: 'Sr', name: '锶' }, { symbol: 'Y', name: '钇' }, { symbol: 'Zr', name: '锆' }, { symbol: 'Nb', name: '铌' }, { symbol: 'Mo', name: '钼' }, { symbol: 'Tc', name: '锝' }, { symbol: 'Ru', name: '钌' }, { symbol: 'Rh', name: '铑' }, { symbol: 'Pd', name: '钯' }, { symbol: 'Ag', name: '银' }, { symbol: 'Cd', name: '镉' }, { symbol: 'In', name: '铟' }, { symbol: 'Sn', name: '锡' }, { symbol: 'Sb', name: '锑' }, { symbol: 'Te', name: '碲' }, { symbol: 'I', name: '碘' }, { symbol: 'Xe', name: '氙' },
  { symbol: 'Cs', name: '铯' }, { symbol: 'Ba', name: '钡' }, { symbol: 'La', name: '镧' }, { symbol: 'Ce', name: '铈' }, { symbol: 'Pr', name: '镨' }, { symbol: 'Nd', name: '钕' }, { symbol: 'Pm', name: '钷' }, { symbol: 'Sm', name: '钐' }, { symbol: 'Eu', name: '铕' }, { symbol: 'Gd', name: '钆' }, { symbol: 'Tb', name: '铽' }, { symbol: 'Dy', name: '镝' }, { symbol: 'Ho', name: '钬' }, { symbol: 'Er', name: '铒' }, { symbol: 'Tm', name: '铥' }, { symbol: 'Yb', name: '镱' }, { symbol: 'Lu', name: '镥' },
  { symbol: 'Hf', name: '铪' }, { symbol: 'Ta', name: '钽' }, { symbol: 'W', name: '钨' }, { symbol: 'Re', name: '铼' }, { symbol: 'Os', name: '锇' }, { symbol: 'Ir', name: '铱' }, { symbol: 'Pt', name: '铂' }, { symbol: 'Au', name: '金' }, { symbol: 'Hg', name: '汞' }, { symbol: 'Tl', name: '铊' }, { symbol: 'Pb', name: '铅' }, { symbol: 'Bi', name: '铋' }, { symbol: 'Po', name: '钋' }, { symbol: 'At', name: '砹' }, { symbol: 'Rn', name: '氡' },
];

const presentElements = computed(() => store.metals);
const elements = allElements;

function toggleElement(symbol) {
  if (store.selectedElement === symbol) {
    store.setSelectedElement('');
  } else {
    store.setSelectedElement(symbol);
  }
}
</script>

<style scoped>
.periodic-table { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }

/* 🎯 自适应网格：手机6列，平板9列，桌面18列 */
.table-grid {
  display: grid;
  gap: 4px;
  margin-top: 10px;
}

/* 手机端 (宽度 < 768px) */
@media (max-width: 767px) {
  .table-grid {
    grid-template-columns: repeat(6, 1fr);
  }
  .element-item { padding: 6px 2px; }
  .symbol { font-size: 14px; }
  .name { font-size: 9px; }
}

/* 平板端 (768px ~ 1200px) */
@media (min-width: 768px) and (max-width: 1199px) {
  .table-grid {
    grid-template-columns: repeat(9, 1fr);
  }
  .symbol { font-size: 15px; }
  .name { font-size: 10px; }
}

/* 桌面端 (≥ 1200px) */
@media (min-width: 1200px) {
  .table-grid {
    grid-template-columns: repeat(18, 1fr);
  }
}

.element-item {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 4px 2px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}
.element-item:hover {
  background: #e6e9f0;
  transform: scale(1.05);
}
.element-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}
.element-item.present {
  background: #d1e7ff;
  font-weight: bold;
}
.element-item.present.active {
  background: #b3d8ff;
}
.symbol { font-weight: 600; line-height: 1.2; }
.name { color: #606266; }
</style>