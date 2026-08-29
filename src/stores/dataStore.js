// src/stores/dataStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDataStore = defineStore('data', () => {
  const rawData = ref([]);
  const metadata = ref({});
  const userUploadedData = ref([]);
  const selectedElement = ref('');

  // 所有数据（原始 + 用户上传）
  const allData = computed(() => {
    return [...rawData.value, ...userUploadedData.value];
  });

  // 统计数据
  const stats = computed(() => {
    const list = allData.value;
    
    // 1. 催化剂种类数：按催化剂_ID 去重
    const catalystIds = new Set(list.map(r => r['催化剂_ID']).filter(Boolean));
    
    // 2. 所有元素：从掺杂金属中提取，并强制包含 'Ce'
    const allMetals = new Set();
    list.forEach(r => {
      const metal = r['掺杂金属'];
      if (metal) {
        metal.split('-').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) allMetals.add(trimmed);
        });
      }
    });
    allMetals.add('Ce');
    
    // 3. 反应种类
    const reactions = ['CO氧化', 'HCs氧化', 'NH3-SCR'];
    
    // ============================================
    // 🎯 核心修改：计算所有非空数据单元格总数
    // ============================================
    let totalDataPoints = 0;
    if (list.length > 0) {
      // 获取所有列名（以第一行为准）
      const keys = Object.keys(list[0]);
      list.forEach(row => {
        keys.forEach(key => {
          const value = row[key];
          // 统计非空值（排除 undefined、null、空字符串）
          if (value !== undefined && value !== null && value !== '') {
            totalDataPoints++;
          }
        });
      });
    }
    
    return {
      catalystCount: catalystIds.size,        // 催化剂种类数
      dataPoints: totalDataPoints,            // 数据条目总数（非空单元格）
      elementCount: allMetals.size,           // 涵盖元素种类
      reactionTypes: reactions,
    };
  });

  // 所有金属种类（用于下拉列表和周期表高亮）
  const metals = computed(() => {
    const set = new Set();
    allData.value.forEach(r => {
      const metal = r['掺杂金属'];
      if (metal) {
        metal.split('-').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    set.add('Ce');
    return [...set].sort();
  });

  // 根据选中的元素过滤数据
  const filteredByElement = computed(() => {
    const data = allData.value;
    const element = selectedElement.value;
    if (!element) return data;
    if (element === 'Ce') return data;
    return data.filter(row => {
      const metal = row['掺杂金属'] || '';
      return metal.split('-').some(m => m.trim() === element);
    });
  });

  function loadBaseData(jsonData) {
    rawData.value = jsonData.data || [];
    metadata.value = jsonData.metadata || {};
  }

  function mergeUploadedData(newData) {
    const existingIds = new Set(userUploadedData.value.map(d => d['催化剂_ID']));
    const filteredNew = newData.filter(d => !existingIds.has(d['催化剂_ID']));
    userUploadedData.value = [...userUploadedData.value, ...filteredNew];
    localStorage.setItem('catalyst_uploaded', JSON.stringify(userUploadedData.value));
    return filteredNew.length;
  }

  function loadUploadedFromStorage() {
    const stored = localStorage.getItem('catalyst_uploaded');
    if (stored) {
      try {
        userUploadedData.value = JSON.parse(stored);
      } catch (e) {
        userUploadedData.value = [];
      }
    }
  }

  function setSelectedElement(element) {
    selectedElement.value = element;
  }

  return {
    rawData,
    metadata,
    userUploadedData,
    allData,
    stats,
    metals,
    selectedElement,
    filteredByElement,
    loadBaseData,
    mergeUploadedData,
    loadUploadedFromStorage,
    setSelectedElement,
  };
});