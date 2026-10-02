# QCC Database

面向理论催化研究的数据展示与管理前端。网站以反应类型作为一级分类，每个反应工作区包含四类二级数据库：

线上地址：`https://tyut-qcc.github.io/catalyst-dashboard/`

- DFT Database
- Microkinetic Database
- Structure Database
- MD Database

当前已接入真实数据的反应体系为：

- CO Oxidation：187 个催化剂、28,264 个 DFT 特征值、21 个微观动力学数据区段、1,679 个 XYZ 结构
- NH3-SCR：28 个催化剂、6,946 个 DFT 特征值、6 个微观动力学数据区段、547 个 XYZ 结构
- C3H6 Combustion：26 个催化剂、3,739 个 DFT 特征值、23 个微观动力学数据区段、443 个 XYZ 结构

Alkane Dehydrogenation、CO2 Cycloaddition、F-T Synthesis 和 MD Database 暂未接入真实数据，页面统一显示“相关内容开发中……”。

## 本地预览

该项目使用静态 React bundle，无需安装运行时依赖，但必须通过 HTTP 服务访问，否则浏览器会阻止 JSON 数据加载。

```bash
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

修改 `.jsx` 源码后，重新生成部署 bundle：

```bash
npm run build
```

## 部署到 GitHub Pages

1. 将本目录内容推送到 GitHub 仓库默认分支。
2. 在仓库 Settings → Pages 中选择 “Deploy from a branch”。
3. 选择默认分支和根目录 `/`。
4. 等待 Pages 完成部署。

页面使用 Hash URL（例如 `#/reaction/co-oxidation/dft`），因此在 GitHub Pages 子路径部署时刷新页面不会产生 404。

## 当前可用交互

- 两级反应 / 数据库导航与反应工作区
- 按催化剂、特征组、条件与原始 Excel 位置浏览 DFT 数据
- 按总体速率、稳态速率、基元步骤速率、事件数和来源浏览微观动力学数据
- XYZ 球棍结构展示、旋转、缩放、筛选与下载
- 全局搜索催化剂、DFT 特征和微观动力学条件
- 当前页面 JSON / CSV 导出
- 新增、编辑、删除本地草稿
- JSON / CSV / 结构文件导入预检
- 本地登录会话
- 桌面、平板与手机响应式布局

草稿和本地会话仅写入浏览器 `localStorage`，不会修改仓库中的原始 JSON，也不会向外部服务器发送数据。正式部署用户登录、数据上传、下载、编辑和新增功能时，应接入后端 API 与持久化数据库。

## 后端接入

在 `services/api.js` 加载前配置 API 地址：

```html
<script>window.QCC_DB_API_BASE = 'https://api.example.com';</script>
```

前端已预留以下资源边界：

- `POST /auth/login`
- `GET /reactions`
- `GET /reactions/:reaction/:database`
- `POST /records`
- `PATCH /records/:id`
- `POST /uploads`
- `GET /exports/:jobId`

生产环境建议使用服务端会话或 HttpOnly Cookie，并为新增、编辑、上传、导出配置基于角色的权限和审计日志。
