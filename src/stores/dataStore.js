// src/stores/dataStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDataStore = defineStore('data', () => {
  const rawData = ref([]);
  const metadata = ref({});
  const userUploadedData = ref([]);
  const selectedElement = ref('');

  // 结构库统计
  // modelCount：所有 public/structures/**/*.xyz 文件数量
  // elements：所有 XYZ 模型中实际出现的元素类型并集
  const structureModelCount = ref(0);
  const structureElements = ref([]);
  const structureStatsLoaded = ref(false);
  const structureStatsLoading = ref(false);

  // 每个 XYZ 结构按 10 个有效数据（活性中心周围）折算
  const STRUCTURE_DATA_FACTOR = 10;

  const BASE_URL = import.meta.env.BASE_URL || '/';
  const STRUCTURE_INDEX_URL = `${BASE_URL}structures/index.json`;

  // 所有数据（原始 + 用户上传）
  const allData = computed(() => {
    return [...rawData.value, ...userUploadedData.value];
  });

  // 只读取 structures/index.json，不读取具体 XYZ 文件
  async function loadStructureStats() {
    if (
      structureStatsLoaded.value ||
      structureStatsLoading.value
    ) {
      return;
    }

    structureStatsLoading.value = true;

    try {
      const response = await fetch(
        `${STRUCTURE_INDEX_URL}?v=${Date.now()}`,
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const index = await response.json();

      const modelCount = Number(index?.modelCount);

      structureModelCount.value =
        Number.isFinite(modelCount) && modelCount >= 0
          ? modelCount
          : 0;

      const elements = Array.isArray(index?.elements)
        ? index.elements.filter(Boolean)
        : [];

      structureElements.value = [
        ...new Set(elements.map(String)),
      ].sort();
    } catch (error) {
      console.warn(
        '读取结构库统计失败，将按 0 个结构、0 种结构元素计算：',
        error
      );

      structureModelCount.value = 0;
      structureElements.value = [];
    } finally {
      structureStatsLoaded.value = true;
      structureStatsLoading.value = false;
    }
  }

  const stats = computed(() => {
    const list = allData.value;

    // 1. 催化剂种类数：按催化剂_ID 去重
    const catalystIds = new Set(
      list
        .map(row => row['催化剂_ID'])
        .filter(Boolean)
    );

    // 2. 数据表中的元素集合
    const tableElements = new Set();

    list.forEach(row => {
      const metal = row['掺杂金属'];

      if (metal) {
        metal.split('-').forEach(item => {
          const trimmed = item.trim();

          if (trimmed) {
            tableElements.add(trimmed);
          }
        });
      }
    });

    // 与原有逻辑保持一致：Ce 始终计入数据表元素集合
    tableElements.add('Ce');

    // 3. 数据表有效数据条目
    let tableDataPoints = 0;

    if (list.length > 0) {
      // 使用所有记录字段的并集，避免不同记录字段数量不一致时漏计。
      const keys = new Set();

      list.forEach(row => {
        Object.keys(row || {}).forEach(key => {
          keys.add(key);
        });
      });

      list.forEach(row => {
        keys.forEach(key => {
          const value = row?.[key];

          if (
            value !== undefined &&
            value !== null &&
            value !== ''
          ) {
            tableDataPoints++;
          }
        });
      });
    }

    // 4. 结构折算数据
    const structureDataPoints =
      structureModelCount.value *
      STRUCTURE_DATA_FACTOR;

    // 5. 首页总条目数
    const totalDataPoints =
      tableDataPoints +
      structureDataPoints;

    // 6. 全数据库涵盖元素：
    //    数据表元素 ∪ 所有 XYZ 模型元素
    const allElements = new Set(tableElements);

    structureElements.value.forEach(element => {
      allElements.add(element);
    });

    const mergedElements = [...allElements].sort();

    return {
      catalystCount: catalystIds.size,

      // 首页总条目
      dataPoints: totalDataPoints,

      // 明细
      tableDataPoints,
      structureModelCount: structureModelCount.value,
      structureDataPoints,
      structureDataFactor: STRUCTURE_DATA_FACTOR,

      // 全数据库元素统计
      elementCount: mergedElements.length,
      elements: mergedElements,
      tableElements: [...tableElements].sort(),
      structureElements: [...structureElements.value].sort(),

      reactionTypes: [
        'CO氧化',
        'HCs氧化',
        'NH3-SCR',
      ],
    };
  });

  // 元素下拉列表/周期表高亮：
  // 数据表元素 + 结构 XYZ 元素
  const metals = computed(() => {
    return stats.value.elements;
  });

  const filteredByElement = computed(() => {
    const data = allData.value;
    const element = selectedElement.value;

    if (!element) return data;

    if (element === 'Ce') return data;

    return data.filter(row => {
      const metal = row['掺杂金属'] || '';

      return metal
        .split('-')
        .some(item => item.trim() === element);
    });
  });

  function loadBaseData(jsonData) {
    rawData.value = jsonData.data || [];
    metadata.value = jsonData.metadata || {};
  }

  function mergeUploadedData(newData) {
    const existingIds = new Set(
      userUploadedData.value.map(
        item => item['催化剂_ID']
      )
    );

    const filteredNew = newData.filter(
      item =>
        !existingIds.has(
          item['催化剂_ID']
        )
    );

    userUploadedData.value = [
      ...userUploadedData.value,
      ...filteredNew,
    ];

    localStorage.setItem(
      'catalyst_uploaded',
      JSON.stringify(
        userUploadedData.value
      )
    );

    return filteredNew.length;
  }

  function loadUploadedFromStorage() {
    const stored =
      localStorage.getItem(
        'catalyst_uploaded'
      );

    if (!stored) return;

    try {
      userUploadedData.value =
        JSON.parse(stored);
    } catch (error) {
      console.warn(
        '读取本地上传数据失败：',
        error
      );

      userUploadedData.value = [];
    }
  }

  function setSelectedElement(element) {
    selectedElement.value = element;
  }

  // 应用启动后只请求 index.json，
  // 不加载任何 XYZ 文件。
  loadStructureStats();

  return {
    rawData,
    metadata,
    userUploadedData,
    allData,

    stats,
    metals,
    selectedElement,
    filteredByElement,

    structureModelCount,
    structureElements,
    structureStatsLoaded,
    structureStatsLoading,
    loadStructureStats,

    loadBaseData,
    mergeUploadedData,
    loadUploadedFromStorage,
    setSelectedElement,
  };
});
