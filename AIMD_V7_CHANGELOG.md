# AIMD v7 修复说明

本版本针对“切换 AIMD 轨迹后，能量曲线和元素组成正常更新，但 3D 动力学轨迹画面空白”的问题进行专门修复。

## 核心原因

v6 在切换轨迹时复用了旧的 3Dmol viewer，仅执行 `removeAllModels()`。对于已经经历过 Tab 切换和多次轨迹切换的 viewer，这可能留下旧的 canvas / WebGL / model 状态，使新轨迹虽然完成解析，但新模型无法正常显示。

## v7 修复

1. 切换轨迹时彻底 `destroyViewer()`，调用 `viewer.clear()` 并将 viewer 置空。
2. 销毁 viewer 的同时递增 `renderToken`，让旧的 `requestAnimationFrame` 渲染任务全部失效。
3. 新轨迹解析成功后重新在当前可见容器中 `createViewer()`。
4. 本地上传轨迹与服务器轨迹两条切换路径均执行 viewer 销毁。
5. 3D 帧播放过程中继续复用当前 viewer，避免每一帧重新创建 WebGL 上下文造成性能下降。
6. 保留 v6 的 Tab 激活检测、ResizeObserver、轨迹加载 token、空间网格成键、元素自动识别等功能。

## 验证

AIMDViewer.vue 的 `<script setup>` 已通过 Node.js `node --check` 语法检查。
