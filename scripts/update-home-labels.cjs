const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const replacements = [
  {
    file: path.join(root, 'src', 'App.vue'),
    items: [
      ['label="XYZ 原子坐标"', 'label="模型原子坐标"'],
      ['label="🔍 数据搜索"', 'label="🔍 催化剂特征值搜索"'],
      ['<!-- 2. 数据搜索 -->', '<!-- 2. 催化剂特征值搜索 -->'],
    ],
  },
  {
    file: path.join(root, 'src', 'components', 'StructureCoordinateTable.vue'),
    items: [
      ['<span>XYZ 原子坐标</span>', '<span>模型原子坐标</span>'],
    ],
  },
];

let changed = 0;

for (const target of replacements) {
  if (!fs.existsSync(target.file)) {
    console.warn(`未找到文件，跳过：${target.file}`);
    continue;
  }

  let text = fs.readFileSync(target.file, 'utf8');
  const original = text;

  for (const [from, to] of target.items) {
    if (text.includes(from)) {
      text = text.split(from).join(to);
    }
  }

  if (text !== original) {
    fs.writeFileSync(target.file, text, 'utf8');
    changed += 1;
    console.log(`已更新：${target.file}`);
  } else {
    console.log(`无需修改：${target.file}`);
  }
}

console.log(`\n主页文字更新完成，修改文件数：${changed}`);
