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

  // AIMD 有效结构模型统计：来自 public/aimd/analysis/index.json
  const aimdEffectiveStructureCount = ref(0);
  const aimdStatsLoaded = ref(false);
  const aimdStatsLoading = ref(false);
  const aimdTrajectoryCount = ref(0);

  // 每个有效结构模型统一按 15 条数据折算
  // 同时适用于静态 XYZ 结构库和 AIMD 有效结构模型。
  const STRUCTURE_DATA_FACTOR = 15;

  const BASE_URL = import.meta.env.BASE_URL || '/';
  const STRUCTURE_INDEX_URL = `${BASE_URL}structures/index.json`;
  const AIMD_ANALYSIS_INDEX_URL = `${BASE_URL}aimd/analysis/index.json`;

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


  // 只读取 AIMD 分析索引，不加载全部轨迹文件。
  // 有效模型数量由分析脚本基于结构差异判定后写入 counts.effectiveStructureCount。
  async function loadAimdStats() {
    if (aimdStatsLoaded.value || aimdStatsLoading.value) {
      return;
    }

    aimdStatsLoading.value = true;

    try {
      const response = await fetch(
        `${AIMD_ANALYSIS_INDEX_URL}?v=${Date.now()}`,
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const index = await response.json();

      const trajectories = Array.isArray(index?.trajectories)
        ? index.trajectories
        : (Array.isArray(index?.models) ? index.models : []);

      aimdTrajectoryCount.value = trajectories.length;

      // 新版：逐条 AIMD 轨迹的有效结构模型数量求和。
      const trajectoryTotal = trajectories.reduce((sum, item) => {
        const count = Number(item?.effectiveStructureCount);
        return sum + (Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0);
      }, 0);

      // 兼容旧版合并索引：如果没有逐轨迹统计，则读取总数。
      const counted = Number(
        index?.counts?.totalEffectiveStructureCount ??
        index?.counts?.effectiveStructureCount
      );
      const fallback = Array.isArray(index?.models)
        ? index.models.length
        : 0;

      const modelCount = trajectories.length > 0
        ? trajectoryTotal
        : (Number.isFinite(counted) && counted >= 0 ? counted : fallback);

      aimdEffectiveStructureCount.value = Math.max(0, Math.floor(modelCount));
    } catch (error) {
      console.warn(
        '读取 AIMD 有效结构模型统计失败，将按 0 个 AIMD 有效模型计算：',
        error
      );
      aimdEffectiveStructureCount.value = 0;
    } finally {
      aimdStatsLoaded.value = true;
      aimdStatsLoading.value = false;
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

    // 4. XYZ 结构模型折算数据
    const structureDataPoints =
      structureModelCount.value *
      STRUCTURE_DATA_FACTOR;

    // 5. AIMD 结构差异判定后的有效模型折算数据
    //    仅对实际识别出的有效结构模型计数，不按原始轨迹帧数直接折算。
    const aimdDataPoints =
      aimdEffectiveStructureCount.value *
      STRUCTURE_DATA_FACTOR;

    // 6. 首页“已收录数据点”总数
    const totalDataPoints =
      tableDataPoints +
      structureDataPoints +
      aimdDataPoints;

    // 7. 全数据库涵盖元素：
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

      // AIMD 有效结构模型折算
      aimdEffectiveStructureCount: aimdEffectiveStructureCount.value,
      aimdTrajectoryCount: aimdTrajectoryCount.value,
      aimdDataPoints,

      // 当前两类结构模型统一按每个模型 15 条数据计入
      structureDataFactor: STRUCTURE_DATA_FACTOR,
      aimdDataFactor: STRUCTURE_DATA_FACTOR,

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

  // 应用启动后仅请求两个轻量统计索引，不加载具体 XYZ/轨迹数据。
  loadStructureStats();
  loadAimdStats();

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

    aimdEffectiveStructureCount,
    aimdTrajectoryCount,
    aimdStatsLoaded,
    aimdStatsLoading,
    loadAimdStats,

    loadBaseData,
    mergeUploadedData,
    loadUploadedFromStorage,
    setSelectedElement,
  };
});
