# AIMD UI 布局更新

本补丁仅调整 `src/components/AIMDAnalysisPanel.vue` 的页面布局，不改变 AIMD 轨迹识别、有效结构模型计算、温度分配、能量解析或数据点统计逻辑。

## 本次调整

- `结构模型预览` 与 `有效结构模型` 调整到同一行。
- 左侧为 3D 结构模型预览，右侧为有效结构模型列表。
- `温度—结构分布` 保持在上一行，作为单独的统计模块。
- 屏幕宽度较小时，两列自动堆叠，保证移动端可读性。

## 替换文件

`src/components/AIMDAnalysisPanel.vue`

## 构建

```cmd
npm run build
npm run preview
```
