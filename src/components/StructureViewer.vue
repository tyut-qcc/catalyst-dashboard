<!-- src/components/StructureViewer.vue -->
<template>
  <el-card class="structure-card">
    <template #header>
      <div class="card-header">
        <span>🧬 催化剂/中间体结构展示</span>
        <el-button type="primary" size="small" @click="downloadExample">下载示例 XYZ</el-button>
      </div>
    </template>

    <el-upload
      ref="uploadRef"
      drag
      accept=".xyz"
      :auto-upload="false"
      :on-change="handleFileChange"
      :file-list="fileList"
      :limit="1"
      style="margin-bottom: 20px;"
    >
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖拽或点击上传 <em>.xyz</em> 结构文件</div>
      <template #tip>
        <div class="el-upload__tip">仅支持 XYZ 格式坐标文件</div>
      </template>
    </el-upload>

    <div v-if="structureData" class="viewer-container">
      <div ref="viewerRef" class="viewer-3d"></div>
      <div class="control-bar">
        <el-button-group>
          <el-button size="small" @click="setStyle('stick')">球棍</el-button>
          <el-button size="small" @click="setStyle('sphere')">空间填充</el-button>
          <el-button size="small" @click="setStyle('line')">线框</el-button>
          <el-button size="small" @click="resetView">重置视角</el-button>
        </el-button-group>
      </div>
    </div>

    <el-empty v-else description="请上传 XYZ 文件查看结构" />
  </el-card>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as $3Dmol from '3dmol';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';

const uploadRef = ref(null);
const fileList = ref([]);
const viewerRef = ref(null);
let viewer = null;
const structureData = ref(null);

// 处理文件上传
function handleFileChange(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      structureData.value = content;
      renderStructure(content);
      ElMessage.success('结构文件加载成功');
    } catch (err) {
      ElMessage.error('文件解析失败，请检查格式');
      console.error(err);
    }
  };
  reader.readAsText(file.raw);
}

// 渲染 3D 结构
function renderStructure(xyzContent) {
  if (!viewerRef.value) return;
  
  // 如果已有 viewer 则清除
  if (viewer) {
    viewer.removeAllModels();
    viewer.clear();
  }

  // 创建新 viewer
  viewer = $3Dmol.createViewer(viewerRef.value, {
    backgroundColor: 'white',
    controlOptions: {
      trackball: true,
    },
  });

  // 添加 XYZ 模型
  const model = viewer.addModel(xyzContent, 'xyz');
  model.setStyle({}, { stick: { color: 'spectrum' }, sphere: { scale: 0.3 } });
  
  viewer.zoomTo();
  viewer.render();
}

// 切换显示风格
function setStyle(style) {
  if (!viewer) return;
  const model = viewer.getModel();
  if (!model) return;
  
  model.setStyle({}, {});
  if (style === 'stick') {
    model.setStyle({}, { stick: { color: 'spectrum' }, sphere: { scale: 0.3 } });
  } else if (style === 'sphere') {
    model.setStyle({}, { sphere: { color: 'spectrum', scale: 0.8 } });
  } else if (style === 'line') {
    model.setStyle({}, { line: { color: 'spectrum' } });
  }
  viewer.render();
}

// 重置视角
function resetView() {
  if (viewer) {
    viewer.zoomTo();
    viewer.render();
  }
}

// 下载示例 XYZ 文件（简单的甲烷分子）
function downloadExample() {
  const example = `5
甲烷分子
C        0.000000    0.000000    0.000000
H        0.000000    0.000000    1.089000
H        1.026719    0.000000   -0.363000
H       -0.513360   -0.889165   -0.363000
H       -0.513360    0.889165   -0.363000`;
  const blob = new Blob([example], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'methane.xyz';
  link.click();
  URL.revokeObjectURL(link.href);
}

// 组件卸载时清理
onBeforeUnmount(() => {
  if (viewer) {
    viewer.removeAllModels();
    viewer.clear();
    viewer = null;
  }
});
</script>

<style scoped>
.structure-card { margin-top: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.viewer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.viewer-3d {
  width: 100%;
  height: 500px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: white;
}
.control-bar {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>