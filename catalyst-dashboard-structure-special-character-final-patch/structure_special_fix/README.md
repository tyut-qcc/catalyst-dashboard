# 结构文件名特殊字符彻底修复补丁

本补丁针对 `public/structures` 下 XYZ 文件名包含 `+`、`→`、`-`、空格、中文、`#`、括号等特殊字符时，结构展示出现“XYZ 中没有解析到有效原子坐标”的问题。

## 本次修复原则

1. **原始模型名称完全保留**：`name`、`file`、`path` 继续使用 `structures` 下的实际名称，例如 `Co-Cu-CeO2-CO+H→1.xyz`，不改名、不替换 `+`、`→`、`-`。
2. **浏览器请求路径与显示名称彻底分离**：生成器会为每个 XYZ 在 `public/structures/__data__/` 生成一个由 SHA-1 哈希得到的纯 ASCII 文件名，并让 `index.json` 的 `url` 指向该安全文件。
3. `__data__` 会在生成结构索引前自动清空并重新生成；扫描原始 structures 时会跳过该目录，避免把生成文件再次扫描成模型。
4. `StructureViewer.vue` 优先使用 `index.json` 给出的安全 URL；只有旧版 index 没有安全 URL 时，才回退到对原始路径逐段编码。
5. 保留之前的 XYZ 稳健解析和坐标数据页逻辑。

## 替换文件

- `scripts/generate-structure-index.cjs`
- `src/components/StructureViewer.vue`

## 执行

在 Windows CMD 项目根目录执行：

```cmd
npm run generate:structures
npm run build
npm run preview
```

执行后会生成/更新：

```text
public/structures/index.json
public/structures/structure-data.json
public/structures/__data__/*.xyz
```

## 注意

以后新增或修改 `public/structures` 下的 XYZ 文件后，只需要重新执行 `npm run generate:structures`，不需要手动修改文件名。
