/* ====== Mock Data for Carbocat DB ======
   DEMO DATA - For demonstration purposes only.
   Not representative of real research findings. */

// === Dashboard Stats ===
const DASHBOARD_STATS = [
  { label: '催化剂体系', value: 384, unit: '种', trend: '+24', className: 'catalyst', desc: '覆盖单原子 / 团簇 / 氧化物' },
  { label: '反应数据条目', value: 2156, unit: '条', trend: '+128', className: 'reaction', desc: '实验级反应记录' },
  { label: 'DFT 计算条目', value: 892, unit: '组', trend: '+56', className: 'energy', desc: '电子结构与能垒计算' },
  { label: '碳基底物分子', value: 47, unit: '类', trend: '+6', className: 'bond', desc: '烷烃 / CO₂ / 合成气 等' },
];

// === Reaction Database ===
const REACTION_TYPES = [
  '乙烷脱氢', '丙烷脱氢', 'CO₂加氢制甲醇', 'CO₂甲烷化',
  '甲烷干重整', '甲烷氧化偶联', '费托合成', '水煤气变换',
  '甲醇制烯烃', '苯乙烯脱氢'
];

const CATALYST_SYSTEMS = [
  'Pt-Sn/Al₂O₃', 'Cr₂O₃/ZrO₂', 'Ga/ZSM-5', 'Zn/ZSM-5',
  'Co/分子筛', 'Ni-CeO₂', 'Cu/ZnO/Al₂O₃', 'Fe-K/Al₂O₃',
  'Ru/MgO', 'Pd-Au/SiO₂', '单原子 Pt/C₃N₄', '单原子 Co/NG',
  'Mo₂C', 'WC', 'TiO₂负载Au', 'In₂O₃/ZrO₂'
];

const REFERENCES = [
  'J. Catal. 2024, 428, 115123',
  'ACS Catal. 2023, 13, 12456−12468',
  'Angew. Chem. Int. Ed. 2024, 63, e202315421',
  'Nat. Catal. 2023, 6, 892−901',
  'Chem. Sci. 2024, 15, 3421−3430',
  'Appl. Catal. B 2023, 329, 122587',
  'J. Am. Chem. Soc. 2024, 146, 5120−5132',
  'Catal. Today 2023, 420, 114−123',
];

function generateReactions(n) {
  const reactions = [];
  for (let i = 0; i < n; i++) {
    const typeIdx = i % REACTION_TYPES.length;
    const catIdx = (i * 3 + 7) % CATALYST_SYSTEMS.length;
    const refIdx = (i * 5 + 2) % REFERENCES.length;
    const type = REACTION_TYPES[typeIdx];
    const cat = CATALYST_SYSTEMS[catIdx];

    // Base values varying by reaction type
    let tempBase, presBase, convBase, selBase, tofBase;
    switch(typeIdx) {
      case 0: case 1: // dehydrogenation
        tempBase = 550 + (i % 8) * 15;
        presBase = 0.1 + (i % 5) * 0.05;
        convBase = 25 + (i % 15) * 2.1;
        selBase = 85 + (i % 12) * 1.2;
        tofBase = 0.08 + (i % 10) * 0.03;
        break;
      case 2: case 3: // CO2 hydrogenation
        tempBase = 220 + (i % 10) * 20;
        presBase = 3 + (i % 6) * 0.8;
        convBase = 12 + (i % 20) * 1.4;
        selBase = 70 + (i % 25) * 1.1;
        tofBase = 0.02 + (i % 8) * 0.01;
        break;
      case 4: case 5: // methane activation
        tempBase = 700 + (i % 8) * 25;
        presBase = 1 + (i % 4) * 0.5;
        convBase = 18 + (i % 18) * 1.8;
        selBase = 75 + (i % 20) * 1.0;
        tofBase = 0.15 + (i % 12) * 0.05;
        break;
      case 6: // F-T
        tempBase = 220 + (i % 7) * 15;
        presBase = 2 + (i % 5) * 0.6;
        convBase = 40 + (i % 30) * 1.5;
        selBase = 60 + (i % 25) * 1.3;
        tofBase = 0.05 + (i % 10) * 0.02;
        break;
      default:
        tempBase = 300 + (i % 10) * 30;
        presBase = 1 + (i % 5) * 0.5;
        convBase = 30 + (i % 20) * 1.8;
        selBase = 78 + (i % 18) * 1.1;
        tofBase = 0.06 + (i % 10) * 0.02;
    }

    reactions.push({
      id: `R-${String(1001 + i).padStart(5, '0')}`,
      name: type,
      catalyst: cat,
      temperature: Math.round(tempBase),
      pressure: Number(presBase.toFixed(2)),
      conversion: Number(convBase.toFixed(1)),
      selectivity: Number(selBase.toFixed(1)),
      tof: Number(tofBase.toFixed(3)),
      sty: Number((tofBase * 120 + (i % 7) * 0.5).toFixed(2)),
      reference: REFERENCES[refIdx],
      year: 2018 + (i % 7),
    });
  }
  return reactions;
}

const REACTION_DATA = generateReactions(80);

// === Catalyst Database ===
const CATALYST_DATA = [
  { id: 'CAT-001', name: '单原子 Pt/g-C₃N₄', composition: 'Pt 单原子 / g-C₃N₄ 纳米片', loading: '0.25 wt%', site: 'Pt-N₄ 配位',
    characterization: 'HAADF-STEM, XANES, EXAFS, XPS', feature: 'Pt 原子级分散，配位不饱和', category: '单原子催化剂' },
  { id: 'CAT-002', name: '单原子 Co/N-掺杂石墨烯', composition: 'Co 单原子 / NG', loading: '1.2 wt%', site: 'Co-N₄ 位点',
    characterization: 'AC-HAADF, XAFS, CO-DRIFTS', feature: '高比表面积，Co 位点均一', category: '单原子催化剂' },
  { id: 'CAT-003', name: 'Pt-Sn/Al₂O₃', composition: 'PtSn 双金属 / γ-Al₂O₃', loading: 'Pt 0.35%, Sn 0.6%', site: 'Pt₃Sn 合金相',
    characterization: 'TEM, XRD, H₂-TPR, CO-chemisorption', feature: 'Sn 掺杂抑制积碳，提升稳定性', category: '负载型金属' },
  { id: 'CAT-004', name: 'Ga/ZSM-5 分子筛', composition: 'Ga 修饰 H-ZSM-5', loading: 'Ga 2.0 wt%', site: 'Ga⁺ 离子交换位 + Ga₂O₃ 团簇',
    characterization: 'NH₃-TPD, Py-IR, ²⁹Si NMR, TEM', feature: 'B 酸 + L 酸协同，脱氢活性高', category: '分子筛' },
  { id: 'CAT-005', name: 'Zn/ZSM-5', composition: 'Zn 改性 H-ZSM-5', loading: 'Zn 3.5 wt%', site: 'ZnO 团簇 / 骨架外 Zn',
    characterization: 'XPS, H₂-TPR, UV-vis', feature: 'Zn-Lewis 酸位促进烷烃活化', category: '分子筛' },
  { id: 'CAT-006', name: 'Cr₂O₃/ZrO₂', composition: 'CrOₓ / 单斜 ZrO₂', loading: 'Cr 8 wt%', site: 'Cr⁶⁺/Cr³⁺ 氧化还原对',
    characterization: 'Raman, XPS, H₂-TPR, TPO', feature: 'ZrO₂ 晶面效应，氧空位参与', category: '金属氧化物' },
  { id: 'CAT-007', name: 'Cu/ZnO/Al₂O₃', composition: 'Cu-ZnO-Al₂O₃ 三元复合', loading: 'Cu 42%, Zn 25%', site: 'Cu-ZnO 界面位点',
    characterization: 'XPS, TEM, N₂O 滴定, in-situ IR', feature: '强金属-载体相互作用 (SMSI)', category: '金属氧化物' },
  { id: 'CAT-008', name: 'Ni-CeO₂', composition: 'Ni 纳米颗粒 / CeO₂ 纳米棒', loading: 'Ni 5 wt%', site: 'Ni-CeO₂ 界面氧空位',
    characterization: 'HRTEM, EPR, Raman, TPR', feature: 'CeO₂ 氧储存能力，Ni 分散度高', category: '金属氧化物' },
  { id: 'CAT-009', name: 'Co/分子筛', composition: 'Co 纳米团簇 / 全硅分子筛', loading: 'Co 2.5 wt%', site: 'Co₄ 团簇限域于孔道',
    characterization: 'AC-TEM, XAFS, DFT 拟合', feature: '分子筛孔道限域效应，费托性能优', category: '分子筛' },
  { id: 'CAT-010', name: 'Fe-K/Al₂O₃', composition: 'Fe-K / γ-Al₂O₃', loading: 'Fe 15%, K 1.5%', site: 'Fe₅C₂ Hägg 碳化物相',
    characterization: 'XRD, Mössbauer, XPS, TPR', feature: 'K 助剂促进碳化物形成，调节产物分布', category: '负载型金属' },
  { id: 'CAT-011', name: 'Mo₂C 纳米晶', composition: 'β-Mo₂C 纳米颗粒', loading: '体相材料', site: 'Mo 末端位点 + C 空位',
    characterization: 'XRD, XPS, HRTEM, CO-TPD', feature: '类贵金属电子结构，C-H 活化活性高', category: '碳化物' },
  { id: 'CAT-012', name: 'In₂O₃/ZrO₂', composition: 'In₂O₃ / m-ZrO₂', loading: 'In 10 wt%', site: 'In-O 缺陷位 / Zr-In 界面',
    characterization: 'XPS, Raman, TPD, DFT 验证', feature: '氧空位驱动 CO₂ 加氢，甲醇选择性高', category: '金属氧化物' },
  { id: 'CAT-013', name: 'Ru/MgO', composition: 'Ru 簇 / MgO (100) 面', loading: 'Ru 2 wt%', site: 'Ru⁰ 纳米团簇 (~2 nm)',
    characterization: 'HRTEM, CO-chemisorption, FTIR', feature: 'MgO 强载体效应，甲烷化活性高', category: '负载型金属' },
  { id: 'CAT-014', name: 'Pd-Au/SiO₂', composition: 'PdAu 合金 / 无定形 SiO₂', loading: 'Pd 1%, Au 2%', site: 'Pd-Au 合金表面位点',
    characterization: 'TEM-EDX, XRD, XPS, DFT', feature: 'Au 稀释 Pd 位点，调节选择性', category: '负载型金属' },
  { id: 'CAT-015', name: 'WC 纳米粉体', composition: 'W₂C / WC 混合相', loading: '体相材料', site: 'W 表面 + C 边缘位',
    characterization: 'XRD, XPS, HRTEM, BET', feature: '类 Pt 电子性质，低成本替代贵金属', category: '碳化物' },
  { id: 'CAT-016', name: 'TiO₂ 负载 Au 团簇', composition: 'Au 团簇 / P25 TiO₂', loading: 'Au 1.0 wt%', site: 'Au-TiO₂ 界面 + 台阶位',
    characterization: 'AC-TEM, XPS, EPR, in-situ DRIFTS', feature: '尺寸效应明显，界面活性主导', category: '负载型金属' },
];

// === DFT Calculation Database ===
const DFT_METHODS = [
  { functional: 'PBE', basis: 'PAW', cutoff: '400 eV', kpoint: '3×3×1', software: 'VASP 5.4.4' },
  { functional: 'RPBE', basis: 'PAW', cutoff: '450 eV', kpoint: '4×4×1', software: 'VASP 5.4.4' },
  { functional: 'BEEF-vdW', basis: 'PAW', cutoff: '500 eV', kpoint: '3×3×1', software: 'VASP 6.3.0' },
  { functional: 'HSE06', basis: 'PAW', cutoff: '400 eV', kpoint: '2×2×1', software: 'VASP 6.3.0' },
];

const DFT_REACTIONS = [
  {
    id: 'DFT-101',
    name: '乙烷脱氢 - Pt(111) 表面',
    catalyst: 'Pt(111) slab',
    method: DFT_METHODS[2],
    intermediates: [
      { name: 'C₂H₆(g) + *', energy: 0.00 },
      { name: 'C₂H₅* + H*', energy: 0.85 },
      { name: 'TS1 (C-H 断裂)', energy: 1.32, isTS: true },
      { name: 'C₂H₄* + 2H*', energy: 0.42 },
      { name: 'TS2 (β-H 消除)', energy: 0.98, isTS: true },
      { name: 'C₂H₄(g) + H₂(g) + *', energy: 1.18 },
    ],
    activationEnergy: 1.32,
    reactionEnergy: 1.18,
  },
  {
    id: 'DFT-102',
    name: 'CO₂ 加氢 - Cu(111) 表面',
    catalyst: 'Cu(111) slab',
    method: DFT_METHODS[0],
    intermediates: [
      { name: 'CO₂(g) + H₂(g) + *', energy: 0.00 },
      { name: 'CO₂* + H₂(g)', energy: -0.15 },
      { name: 'TS1 (H 加成)', energy: 0.92, isTS: true },
      { name: 'HCOO* + H₂(g)', energy: 0.45 },
      { name: 'TS2 (H 加成)', energy: 1.18, isTS: true },
      { name: 'H₂COO* + H₂(g)', energy: 0.72 },
      { name: 'TS3 (H 加成)', energy: 1.55, isTS: true },
      { name: 'CH₃O* + H*', energy: 0.55 },
      { name: 'CH₃OH(g) + *', energy: 0.48 },
    ],
    activationEnergy: 1.55,
    reactionEnergy: 0.48,
  },
  {
    id: 'DFT-103',
    name: '甲烷活化 - Ni(111) 表面',
    catalyst: 'Ni(111) slab',
    method: DFT_METHODS[1],
    intermediates: [
      { name: 'CH₄(g) + *', energy: 0.00 },
      { name: 'CH₄* 物理吸附', energy: -0.18 },
      { name: 'TS (C-H 键断裂)', energy: 0.92, isTS: true },
      { name: 'CH₃* + H*', energy: -0.35 },
    ],
    activationEnergy: 0.92,
    reactionEnergy: -0.35,
  },
  {
    id: 'DFT-104',
    name: 'CO 解离 - Fe(110) 表面',
    catalyst: 'Fe(110) slab - 费托活性位',
    method: DFT_METHODS[2],
    intermediates: [
      { name: 'CO(g) + 2*', energy: 0.00 },
      { name: 'CO* + *', energy: -1.85 },
      { name: 'TS (C-O 键断裂)', energy: 0.42, isTS: true },
      { name: 'C* + O*', energy: -1.12 },
    ],
    activationEnergy: 2.27,
    reactionEnergy: -1.12,
  },
];

// DOS data for a representative catalyst
const generateDOSData = (center, width, numPoints = 200) => {
  const data = [];
  for (let i = 0; i < numPoints; i++) {
    const x = -10 + (i / numPoints) * 15; // energy from -10 to 5 eV
    // Multiple Gaussian peaks for realistic DOS shape
    const peak1 = Math.exp(-Math.pow(x - center + 2, 2) / (2 * width)) * 2.5;
    const peak2 = Math.exp(-Math.pow(x - center - 2, 2) / (2 * width * 0.7)) * 1.8;
    const peak3 = Math.exp(-Math.pow(x - (center - 5), 2) / (2 * width * 1.5)) * 1.2;
    const y = peak1 + peak2 + peak3;
    data.push([Number(x.toFixed(2)), Number(y.toFixed(3))]);
  }
  return data;
};

// === ML Model Database ===
const ML_MODELS = [
  {
    id: 'ML-001',
    name: 'DeepMD - Pt/C₃N₄ 势函数',
    description: '深度势能分子动力学，预测 Pt 单原子催化剂的乙烷脱氢反应能垒',
    category: 'Deep Potential',
    metrics: {
      '能量 RMSE': '0.021 eV',
      '力 RMSE': '0.18 eV/Å',
      'R² (能量)': '0.994',
      '训练集': '12,400 结构',
    },
    trainingCurve: Array.from({length: 50}, (_, i) => ({
      epoch: i + 1,
      trainLoss: Math.exp(-i/12) * 0.5 + 0.01,
      valLoss: Math.exp(-i/14) * 0.6 + 0.015,
    })),
  },
  {
    id: 'ML-002',
    name: 'GNN - 催化剂吸附能预测',
    description: '图神经网络模型，从催化剂结构预测中间体吸附能',
    category: 'GNN / CGCNN',
    metrics: {
      'MAE': '0.18 eV',
      'RMSE': '0.26 eV',
      'R²': '0.921',
      '测试集': '1,850 样本',
    },
    trainingCurve: Array.from({length: 50}, (_, i) => ({
      epoch: i + 1,
      trainLoss: Math.exp(-i/10) * 0.8 + 0.05,
      valLoss: Math.exp(-i/11) * 0.9 + 0.07,
    })),
  },
  {
    id: 'ML-003',
    name: '随机森林 - 催化活性预测',
    description: '基于描述符的随机森林模型，预测不同催化剂的 TOF',
    category: '传统 ML',
    metrics: {
      'RMSE': '0.087 s⁻¹',
      'R²': '0.856',
      '特征数': '24',
      '交叉验证': '10-fold CV',
    },
    featureImportance: [
      { name: 'd 带中心', importance: 28.5 },
      { name: '金属半径', importance: 15.2 },
      { name: '电负性', importance: 12.8 },
      { name: '结合能', importance: 10.4 },
      { name: '配位数', importance: 8.7 },
      { name: '费米能级', importance: 6.5 },
      { name: '晶格参数', importance: 5.3 },
      { name: '其他', importance: 12.6 },
    ],
    trainingCurve: Array.from({length: 50}, (_, i) => ({
      epoch: i + 1,
      trainLoss: 0.25 - i * 0.004 + Math.random() * 0.01,
      valLoss: 0.3 - i * 0.004 + Math.random() * 0.02,
    })).map(d => ({...d, trainLoss: Math.max(0.05, d.trainLoss), valLoss: Math.max(0.08, d.valLoss)})),
  },
];

// === Chart: Reaction type distribution ===
const REACTION_DISTRIBUTION = [
  { type: '烷烃脱氢', count: 486, color: '#00d4aa' },
  { type: 'CO₂ 加氢/转化', count: 524, color: '#3b82f6' },
  { type: '甲烷活化', count: 312, color: '#f5a623' },
  { type: '费托合成', count: 286, color: '#7c6cf5' },
  { type: '水煤气变换', count: 198, color: '#ec4899' },
  { type: '甲醇转化', count: 350, color: '#10b981' },
];

const CATALYST_DISTRIBUTION = [
  { type: '单原子催化剂', count: 96, color: '#00d4aa' },
  { type: '负载型金属', count: 128, color: '#3b82f6' },
  { type: '金属氧化物', count: 82, color: '#f5a623' },
  { type: '分子筛', count: 48, color: '#7c6cf5' },
  { type: '碳化物/碳材料', count: 30, color: '#ec4899' },
];

// === Mechanism data ===
const MECHANISM_DEHYDROGENATION = {
  title: '乙烷脱氢反应机理',
  substrate: 'C₂H₆',
  product: 'C₂H₄ + H₂',
  catalyst: 'Pt 基催化剂',
  steps: [
    { label: '反应物吸附', desc: '乙烷分子物理吸附于 Pt 表面', formula: 'C₂H₆(g) + * → C₂H₆*' },
    { label: '第一步 C-H 断裂', desc: 'C-H 键在 Pt 活性位断裂，生成乙基中间体', formula: 'C₂H₆* → C₂H₅* + H*' },
    { label: '第二步 β-H 消除', desc: '乙基 β 位 C-H 键断裂，生成乙烯', formula: 'C₂H₅* → C₂H₄* + H*' },
    { label: 'H₂ 脱附', desc: '表面 H 原子复合并脱附', formula: '2H* → H₂(g) + 2*' },
    { label: '产物脱附', desc: '乙烯从催化剂表面脱附', formula: 'C₂H₄* → C₂H₄(g) + *' },
  ],
};

const MECHANISM_CO2_HYDRO = {
  title: 'CO₂ 加氢制甲醇反应机理',
  substrate: 'CO₂ + 3H₂',
  product: 'CH₃OH + H₂O',
  catalyst: 'Cu/ZnO/Al₂O₃',
  steps: [
    { label: 'CO₂ 吸附', desc: 'CO₂ 在 Cu-ZnO 界面吸附活化', formula: 'CO₂(g) + * → CO₂*' },
    { label: '甲酸盐路径', desc: 'H 加成生成甲酸盐中间体', formula: 'CO₂* + H* → HCOO* + *' },
    { label: '二氧亚甲基', desc: '继续加氢生成 H₂COO*', formula: 'HCOO* + H* → H₂COO*' },
    { label: '甲氧基', desc: '进一步加氢生成甲氧基', formula: 'H₂COO* + 2H* → CH₃O* + O*' },
    { label: '甲醇生成', desc: '甲氧基加氢生成甲醇并脱附', formula: 'CH₃O* + H* → CH₃OH(g) + 2*' },
  ],
};

// Export to window
Object.assign(window, {
  DASHBOARD_STATS,
  REACTION_DATA,
  REACTION_TYPES,
  CATALYST_SYSTEMS,
  CATALYST_DATA,
  DFT_REACTIONS,
  DFT_METHODS,
  generateDOSData,
  ML_MODELS,
  REACTION_DISTRIBUTION,
  CATALYST_DISTRIBUTION,
  MECHANISM_DEHYDROGENATION,
  MECHANISM_CO2_HYDRO,
});
