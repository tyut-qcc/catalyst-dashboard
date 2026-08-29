import fs from 'fs';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 读取根目录下的 Excel
const filePath = path.join(rootDir, 'Catalyst_Master_Table_Base_with_Reactions.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ 错误：请将 Excel 文件放在根目录，并命名为 Catalyst_Master_Table_Base_with_Reactions.xlsx');
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// 过滤无效行
const cleanedData = rawData.filter(row => 
  row['催化剂_ID'] && 
  row['催化剂_ID'].trim() !== '' && 
  !row['催化剂_ID'].includes('单位')
);

// 统计
const metadata = {
  totalCount: cleanedData.length,
  columns: Object.keys(cleanedData[0] || {}),
  categories: {
    singleAtom: cleanedData.filter(r => r['催化剂类型'] === '单原子').length,
    doubleAtom: cleanedData.filter(r => r['催化剂类型'] === '双原子').length,
    oxygenVacancy: cleanedData.filter(r => r['催化剂类型'] === '氧空位').length,
    pure: cleanedData.filter(r => r['催化剂类型'] === '纯载体').length,
  },
  metals: [...new Set(cleanedData.map(r => r['掺杂金属']).filter(Boolean))]
};

// 写入 src/data/
const outputDir = path.join(rootDir, 'src', 'data');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, 'catalysts.json'),
  JSON.stringify({ metadata, data: cleanedData }, null, 2)
);

console.log(`✅ 转换成功！共 ${cleanedData.length} 条数据`);
console.log(`📊 列数: ${metadata.columns.length}`);
console.log(`📁 文件已保存至: src/data/catalysts.json`);