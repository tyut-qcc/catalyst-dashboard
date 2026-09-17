# AIMD v8 优化补丁

请把本目录文件覆盖到现有项目对应位置，不要删除现有 public/aimd/*.xyz。

然后执行：

npm run generate:aimd
npm run build

git add src/components/AIMDViewer.vue scripts/generate-aimd-index.cjs vite.config.js public/aimd
git commit -m "Optimize AIMD lazy loading and caching"
git push origin main

首次部署后可在浏览器检查：
https://tyut-qcc.github.io/catalyst-dashboard/aimd/index.json

新的 index.json 中应能看到 chunkSize 和 chunks 字段，并且 public/aimd/chunks/ 下会生成分块 XYZ 文件。
