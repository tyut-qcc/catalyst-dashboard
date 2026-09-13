// src/stores/dataStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const STORAGE_KEY = 'catalyst_dataset_changes_v1';

function safeLoadChanges() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { added: [], updated: {}, deleted: [] };
    const parsed = JSON.parse(raw);
    return {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      updated: parsed.updated && typeof parsed.updated === 'object' ? parsed.updated : {},
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
    };
  } catch (e) {
    console.warn('读取本地数据修改记录失败:', e);
    return { added: [], updated: {}, deleted: [] };
  }
}

export const useDataStore = defineStore('data', () => {
  const rawData = ref([]);
  const metadata = ref({});
  const selectedElement = ref('');

  const addedData = ref([]);
  const updatedData = ref({});
  const deletedIds = ref(new Set());

  function persistChanges() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      added: addedData.value,
      updated: updatedData.value,
      deleted: [...deletedIds.value],
    }));
  }

  function applyChanges(baseRows) {
    const deleted = deletedIds.value;
    const updated = updatedData.value;
    const base = baseRows
      .filter(row => !deleted.has(row['催化剂_ID']))
      .map(row => updated[row['催化剂_ID']] ? { ...row, ...updated[row['催化剂_ID']] } : { ...row });

    const baseIds = new Set(base.map(row => row['催化剂_ID']));
    const added = addedData.value.filter(row => row['催化剂_ID'] && !baseIds.has(row['催化剂_ID']) && !deleted.has(row['催化剂_ID']));
    return [...base, ...added];
  }

  // 所有数据（基础数据 + 本地新增/修改，扣除本地删除）
  const allData = computed(() => applyChanges(rawData.value));

  const stats = computed(() => {
    const list = allData.value;
    const catalystIds = new Set(list.map(r => r['催化剂_ID']).filter(Boolean));
    const allMetals = new Set();
    list.forEach(r => {
      const metal = r['掺杂金属'];
      if (metal) {
        String(metal).split('-').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) allMetals.add(trimmed);
        });
      }
    });
    allMetals.add('Ce');
    const reactions = ['CO氧化', 'HCs氧化', 'NH3-SCR'];

    let totalDataPoints = 0;
    if (list.length > 0) {
      const keySet = new Set();
      list.forEach(row => Object.keys(row).forEach(k => keySet.add(k)));
      const keys = [...keySet];
      list.forEach(row => keys.forEach(key => {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') totalDataPoints++;
      }));
    }

    return {
      catalystCount: catalystIds.size,
      dataPoints: totalDataPoints,
      elementCount: allMetals.size,
      reactionTypes: reactions,
    };
  });

  const metals = computed(() => {
    const set = new Set();
    allData.value.forEach(r => {
      const metal = r['掺杂金属'];
      if (metal) {
        String(metal).split('-').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    set.add('Ce');
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  const filteredByElement = computed(() => {
    const data = allData.value;
    const element = selectedElement.value;
    if (!element || element === 'Ce') return data;
    return data.filter(row => {
      const metal = row['掺杂金属'] || '';
      return String(metal).split('-').some(m => m.trim() === element);
    });
  });

  function loadBaseData(jsonData) {
    rawData.value = jsonData.data || [];
    metadata.value = jsonData.metadata || {};
    const changes = safeLoadChanges();
    addedData.value = changes.added;
    updatedData.value = changes.updated;
    deletedIds.value = new Set(changes.deleted);
  }

  function mergeUploadedData(newData) {
    const existing = new Set(allData.value.map(row => row['催化剂_ID']));
    let count = 0;
    const incoming = Array.isArray(newData) ? newData : [];
    incoming.forEach(row => {
      const id = String(row?.['催化剂_ID'] ?? '').trim();
      if (!id || existing.has(id)) return;
      addedData.value.push({ ...row, 催化剂_ID: id });
      existing.add(id);
      count += 1;
    });
    if (count) persistChanges();
    return count;
  }

  function loadUploadedFromStorage() {
    // 兼容旧版 catalyst_uploaded：迁移到新增数据集合
    try {
      const stored = localStorage.getItem('catalyst_uploaded');
      if (!stored) return;
      const oldRows = JSON.parse(stored);
      if (!Array.isArray(oldRows) || oldRows.length === 0) return;
      const currentIds = new Set(allData.value.map(r => r['催化剂_ID']));
      let changed = false;
      oldRows.forEach(row => {
        const id = row['催化剂_ID'];
        if (id && !currentIds.has(id)) {
          addedData.value.push(row);
          currentIds.add(id);
          changed = true;
        }
      });
      if (changed) persistChanges();
    } catch (e) {
      console.warn('迁移旧上传数据失败:', e);
    }
  }

  function isDuplicateId(id, exceptId = null) {
    return allData.value.some(row => row['催化剂_ID'] === id && row['催化剂_ID'] !== exceptId);
  }

  function addRecord(record) {
    const id = String(record['催化剂_ID'] ?? '').trim();
    if (!id) throw new Error('催化剂_ID 不能为空');
    if (isDuplicateId(id)) throw new Error(`催化剂_ID「${id}」已存在`);
    if (deletedIds.value.has(id)) {
      deletedIds.value.delete(id);
      deletedIds.value = new Set(deletedIds.value);
    }
    addedData.value.push({ ...record, 催化剂_ID: id });
    persistChanges();
    return record;
  }

  function updateRecord(originalId, record) {
    const oldId = String(originalId ?? '').trim();
    if (!oldId) throw new Error('原催化剂_ID 无效');
    if (!allData.value.some(row => row['催化剂_ID'] === oldId)) throw new Error('找不到要修改的记录');
    const next = { ...record, 催化剂_ID: oldId };

    const addedIndex = addedData.value.findIndex(row => row['催化剂_ID'] === oldId);
    if (addedIndex >= 0) {
      addedData.value[addedIndex] = next;
    } else {
      updatedData.value[oldId] = next;
    }
    persistChanges();
    return next;
  }

  function deleteRecord(id) {
    const targetId = String(id ?? '').trim();
    const addedIndex = addedData.value.findIndex(row => row['催化剂_ID'] === targetId);
    if (addedIndex >= 0) {
      addedData.value.splice(addedIndex, 1);
    } else {
      deletedIds.value.add(targetId);
      delete updatedData.value[targetId];
      // 触发 Vue 对 Set 的依赖更新：重新赋值
      deletedIds.value = new Set(deletedIds.value);
    }
    persistChanges();
  }

  function resetLocalChanges() {
    addedData.value = [];
    updatedData.value = {};
    deletedIds.value = new Set();
    localStorage.removeItem(STORAGE_KEY);
  }

  function setSelectedElement(element) {
    selectedElement.value = element;
  }

  return {
    rawData,
    metadata,
    addedData,
    updatedData,
    deletedIds,
    allData,
    stats,
    metals,
    selectedElement,
    filteredByElement,
    loadBaseData,
    loadUploadedFromStorage,
    mergeUploadedData,
    addRecord,
    updateRecord,
    deleteRecord,
    resetLocalChanges,
    isDuplicateId,
    setSelectedElement,
  };
});
