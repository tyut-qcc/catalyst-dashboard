# AIMD v5 修复说明

本版本基于当前 CRUD 版项目制作，保留：
- 数据浏览 / 搜索
- 数据新增 / 修改 / 删除
- Excel 上传
- XYZ 结构展示
- AIMD 动力学模拟

AIMD v5 重点修复：
1. 切换不同网页 Tab 后，3Dmol viewer 可能因为容器尺寸尚未恢复而出现空白。
2. 快速切换不同 AIMD 轨迹时，旧轨迹异步请求可能覆盖新轨迹。
3. AIMD 每帧动态成键原先使用全原子 O(N²) 计算，大体系播放容易卡顿。
4. 3D 模拟窗口固定在独立容器内，不向外溢出。
5. 每帧仍严格从 XYZ 第一行读取原子数、从原子坐标行第一列读取元素，不假设固定元素组成。
6. 第二行按 `i = ..., time = ..., E = ...` 解析帧号、时间与能量。

建议验证步骤：
- `npm install`
- `npm run generate:structures`
- `npm run generate:aimd`
- `npm run build`
- `npm run dev`

重点测试：
- 进入动力学模拟
- 轨迹 A -> 轨迹 B -> 轨迹 C 连续切换
- 切换到其他 Tab 后再返回动力学模拟
- 拖动 Frame 滑块
- 播放 / 暂停
- 不同元素组成的 AIMD 轨迹
