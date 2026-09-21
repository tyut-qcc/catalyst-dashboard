<template>
  <el-container class="app">
    <el-header class="header"><h2>尾气净化催化剂数据平台</h2><span>结构化数据 · 结构模型 · AIMD</span></el-header>
    <el-main>
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="数据展示与检索" name="data"><ReactionExplorer /></el-tab-pane>
        <el-tab-pane label="结构模型" name="structure"><StructureViewer v-if="activeTab === 'structure'" /></el-tab-pane>
        <el-tab-pane label="AIMD 轨迹" name="aimd"><AIMDViewer v-if="activeTab === 'aimd'" :is-active="true" /></el-tab-pane>
      </el-tabs>
    </el-main>
  </el-container>
</template>
<script setup>
import { ref } from 'vue';
import ReactionExplorer from './components/ReactionExplorer.vue';
import StructureViewer from './components/StructureViewer.vue';
import AIMDViewer from './components/AIMDViewer.vue';
const activeTab = ref('data');
</script>
<style>
* { box-sizing: border-box; } body { margin: 0; background: #f5f7fa; font-family: Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.header { display:flex; align-items:center; gap:24px; background:#2876c7; color:white; }.header h2 { font-size:19px; }.header span { font-size:13px; opacity:.85; }
.app .el-main { padding:18px; } @media(max-width:650px) { .header span { display:none; }.app .el-main { padding:8px; } }
</style>
