<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'edit' ? '编辑催化剂数据' : '新增催化剂数据'"
    width="92%"
    top="4vh"
    destroy-on-close
  >
    <div class="editor-tip">
      <el-tag v-if="mode === 'edit'" type="info">编辑模式</el-tag>
      <el-tag v-else type="success">新增模式</el-tag>
      <span>带 * 的字段为必填字段。参数字段留空时不会填入数值。</span>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="editor-form"
    >
      <el-row :gutter="14">
        <el-col
          v-for="col in columns"
          :key="col.key"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-form-item :prop="col.key" :label="`${col.label}${requiredKeys.has(col.key) ? ' *' : ''}`">
            <el-input
              v-model="formData[col.key]"
              :placeholder="col.key === '催化剂_ID' ? '例如 Pt-CeO2' : '请输入或留空'"
              :disabled="mode === 'edit' && col.key === '催化剂_ID'"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">
        {{ mode === 'edit' ? '保存修改' : '新增记录' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useDataStore } from '@/stores/dataStore';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'add' },
  row: { type: Object, default: () => ({}) },
  columns: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'saved']);
const store = useDataStore();
const formRef = ref();
const formData = ref({});
const saving = ref(false);

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

const requiredKeys = new Set(['催化剂_ID', '催化剂类型', '掺杂金属']);
const rules = {
  催化剂_ID: [{ required: true, message: '请输入催化剂_ID', trigger: 'blur' }],
  催化剂类型: [{ required: true, message: '请选择催化剂类型', trigger: 'blur' }],
  掺杂金属: [{ required: true, message: '请输入掺杂金属', trigger: 'blur' }],
};

function rebuildForm() {
  const next = {};
  props.columns.forEach(col => {
    const value = props.row?.[col.key];
    next[col.key] = value === undefined || value === null ? '' : value;
  });
  formData.value = next;
}

watch(() => [props.modelValue, props.mode, props.row, props.columns], () => {
  if (props.modelValue) {
    rebuildForm();
    nextTick(() => formRef.value?.clearValidate());
  }
}, { deep: true, immediate: true });

function normalizeRow() {
  const normalized = {};
  Object.entries(formData.value).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '') return;
    // 保留 Excel 数值字段的数字类型；无法安全转换的字符串继续按字符串保存。
    if (typeof text === 'string' && /^[-+]?\d*\.\d+(?:[eE][-+]?\d+)?$|^[-+]?\d+(?:[eE][-+]?\d+)?$/.test(text)) {
      const n = Number(text);
      normalized[key] = Number.isFinite(n) ? n : text;
    } else {
      normalized[key] = text;
    }
  });
  ['催化剂_ID', '催化剂类型', '掺杂金属'].forEach(key => {
    if (!(key in normalized)) normalized[key] = '';
  });
  return normalized;
}

async function handleSubmit() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
    const data = normalizeRow();
    saving.value = true;

    if (props.mode === 'edit') {
      store.updateRecord(props.row['催化剂_ID'], data);
      ElMessage.success(`已修改：${props.row['催化剂_ID']}`);
    } else {
      store.addRecord(data);
      ElMessage.success(`已新增：${data['催化剂_ID']}`);
    }

    visible.value = false;
    emit('saved');
  } catch (e) {
    if (e instanceof Error && e.message) ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.editor-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  color: #606266;
  font-size: 13px;
}
.editor-form {
  max-height: 68vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 10px 12px 2px;
}
.editor-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
</style>
