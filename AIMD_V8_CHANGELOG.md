# AIMD v8 性能优化说明

本版本基于 AIMD v7 的稳定显示逻辑优化，保留 3Dmol viewer 生命周期修复，并针对 GitHub Pages 加速 AIMD：

1. AIMD 轨迹按 25 帧分块生成，首次仅下载首块，不再一次性下载整条 XYZ。
2. index.json 预先保存 frames / atomCount / times / energies，能量曲线无需等待全部轨迹解析。
3. 播放过程中提前预加载后续 2 个轨迹块，减少跨块播放卡顿。
4. 轨迹块使用稳定 URL + browser force-cache，不再使用 Date.now() 查询参数绕过浏览器缓存。
5. 当前帧 PDB 字符串缓存在帧对象中，重复显示同一帧无需再次计算动态成键。
6. 只有切换轨迹/重新进入 Tab 的首帧执行 zoomTo()；后续帧复用当前相机视角，降低 3Dmol 开销。
7. AIMD Tab 未激活时不下载轨迹首帧，避免进入首页就触发大文件解析。
8. 保留旧版 index.json / 单文件 XYZ 的兼容回退。
9. vite.config.js 使用 GitHub Pages 子路径：/catalyst-dashboard/。

使用方法：
- 覆盖 src/components/AIMDViewer.vue
- 覆盖 scripts/generate-aimd-index.cjs
- 确保 vite.config.js 的 base 为 /catalyst-dashboard/
- 保留原有 public/aimd/*.xyz
- 执行 npm run generate:aimd，然后 npm run build
