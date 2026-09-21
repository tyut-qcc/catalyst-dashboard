<template>
  <el-card class="upload-card">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>📤 数据上传</span>
        <el-button type="primary" size="small" @click="downloadTemplate">
          <el-icon><Download /></el-icon> 下载模板
        </el-button>
      </div>
    </template>

    <el-upload
      ref="uploadRef"
      drag
      accept=".xlsx,.xls"
      :auto-upload="false"
      :on-change="handleFileChange"
      :file-list="fileList"
      :limit="1"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖拽或点击上传 <em>.xlsx</em> 文件</div>
    </el-upload>

    <!-- 预览区 -->
    <div v-if="previewData.length > 0" class="preview-area">
      <el-divider>数据预览与验证</el-divider>
      <div style="margin-bottom: 10px;">
        <el-tag type="info">解析到 {{ previewData.length }} 条</el-tag>
        <el-tag v-if="errors.length === 0" type="success">✅ 全部验证通过</el-tag>
        <el-tag v-else type="danger">❌ 发现 {{ errors.length }} 条错误</el-tag>
      </div>
      
      <el-table :data="previewData.slice(0, 5)" border max-height="200" size="small">
        <el-table-column prop="催化剂_ID" label="催化剂ID" width="120" />
        <el-table-column prop="催化剂类型" label="类型" width="100" />
        <el-table-column prop="掺杂金属" label="金属" width="100" />
        <el-table-column v-for="k in extraPreviewCols" :key="k" :prop="k" :label="k" width="100" show-overflow-tooltip />
      </el-table>
      <p v-if="previewData.length > 5" style="color:#909399;font-size:12px;">仅显示前5条</p>

      <div v-if="errors.length > 0" style="margin: 10px 0;">
        <el-alert v-for="(e, i) in errors.slice(0,3)" :key="i" :title="e.message" type="error" :closable="false" />
        <p v-if="errors.length > 3" style="color:#f56c6c;font-size:12px;">... 还有 {{ errors.length - 3 }} 条错误</p>
      </div>

      <el-button 
        type="primary" 
        :disabled="errors.length > 0 || previewData.length === 0"
        @click="submitData"
        :loading="submitting"
      >
        提交数据
      </el-button>
      <el-button @click="clearPreview">清空</el-button>
    </div>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';
import * as XLSX from 'xlsx';
import { useDataStore } from '@/stores/dataStore';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, UploadFilled } from '@element-plus/icons-vue';

const store = useDataStore();
const fileList = ref([]);
const previewData = ref([]);
const errors = ref([]);
const submitting = ref(false);
const uploadRef = ref();

const extraPreviewCols = ['氧空位形成能(eV)', 'CO氧化能垒TS1'];

function handleFileChange(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      
      // 过滤空行
      const filtered = json.filter(row => row['催化剂_ID'] && row['催化剂_ID'].trim() !== '');
      previewData.value = filtered;
      
      // 简单验证
      errors.value = [];
      filtered.forEach((row, idx) => {
        if (!row['催化剂_ID']) errors.value.push({ message: `第 ${idx+1} 行: 缺少催化剂_ID` });
        if (!row['催化剂类型']) errors.value.push({ message: `第 ${idx+1} 行: 缺少催化剂类型` });
        if (!row['掺杂金属']) errors.value.push({ message: `第 ${idx+1} 行: 缺少掺杂金属` });
      });
      
      if (errors.value.length === 0) {
        ElMessage.success(`解析成功，共 ${filtered.length} 条数据`);
      } else {
        ElMessage.warning(`解析完成，但有 ${errors.value.length} 条错误`);
      }
    } catch (err) {
      ElMessage.error('文件解析失败，请检查格式');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file.raw);
}

function clearPreview() {
  previewData.value = [];
  errors.value = [];
  fileList.value = [];
}

async function submitData() {
  if (previewData.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认提交 ${previewData.value.length} 条数据？`, '确认', { type: 'info' });
    submitting.value = true;
    const count = store.mergeUploadedData(previewData.value);
    ElMessage.success(`成功上传 ${count} 条新数据（重复已跳过）`);
    clearPreview();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('提交失败');
  } finally {
    submitting.value = false;
  }
}

function downloadTemplate() {
  // 获取现有数据的第一行作为表头模板
  const allData = store.allData;
  if (allData.length === 0) {
    return ElMessage.warning('请先加载基础数据');
  }
  const headers = Object.keys(allData[0]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, headers.map(() => '')]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, '模板');
  XLSX.writeFile(wb, 'catalyst_template.xlsx');
  ElMessage.success('模板已下载');
}
</script>

<style scoped>
.upload-card { margin-top: 20px; }
.preview-area { margin-top: 20px; }
.el-upload { width: 100%; }
.el-upload-dragger { width: 100%; }
</style>