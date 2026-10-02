// Catalytic Mechanism Diagram Component
const { useState } = React;

function Mechanism() {
  const [activeTab, setActiveTab] = useState('dehydrogenation');

  const data = activeTab === 'dehydrogenation' ? MECHANISM_DEHYDROGENATION : MECHANISM_CO2_HYDRO;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-dot"></span>
          催化机理示意
        </div>
        <div className="page-header-sub">
          碳基分子催化关键反应机理的可视化示意 — 帮助理解反应路径与活性位点作用机制
        </div>
      </div>

      {/* Tab selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="path" size={16} />
            反应类型
          </div>
          <span className="demo-notice">
            <Icon name="info" size={12} />
            概念示意图
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="topbar-btn"
              style={{
                borderColor: activeTab === 'dehydrogenation' ? 'var(--catalyst-600)' : 'var(--carbon-700)',
                background: activeTab === 'dehydrogenation' ? 'var(--catalyst-glow)' : 'transparent',
                color: activeTab === 'dehydrogenation' ? 'var(--catalyst-400)' : 'var(--carbon-300)',
                padding: '8px 16px',
              }}
              onClick={() => setActiveTab('dehydrogenation')}
            >
              乙烷脱氢
            </button>
            <button
              className="topbar-btn"
              style={{
                borderColor: activeTab === 'co2' ? 'var(--catalyst-600)' : 'var(--carbon-700)',
                background: activeTab === 'co2' ? 'var(--catalyst-glow)' : 'transparent',
                color: activeTab === 'co2' ? 'var(--catalyst-400)' : 'var(--carbon-300)',
                padding: '8px 16px',
              }}
              onClick={() => setActiveTab('co2')}
            >
              CO₂ 加氢制甲醇
            </button>
          </div>
        </div>
      </div>

      {/* Mechanism diagram */}
      <div className="mech-section">
        <div className="mech-section-title">{data.title}</div>
        <div className="mech-diagram">
          {/* Overall reaction header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 30,
            padding: '16px 24px',
            background: 'var(--carbon-900)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--carbon-700)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--carbon-100)' }}>
                {data.substrate}
              </div>
              <div style={{ fontSize: 11, color: 'var(--carbon-400)', marginTop: 4 }}>反应物</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 40, height: 2, background: 'var(--catalyst-500)' }}></div>
              <div style={{ color: 'var(--catalyst-400)', fontSize: 12, fontWeight: 500 }}>{data.catalyst}</div>
              <div style={{ width: 40, height: 2, background: 'var(--catalyst-500)' }}></div>
              <Icon name="arrow-right" size={18} color="#00d4aa" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--catalyst-400)' }}>
                {data.product}
              </div>
              <div style={{ fontSize: 11, color: 'var(--carbon-400)', marginTop: 4 }}>产物</div>
            </div>
          </div>

          {/* Reaction steps */}
          <div style={{ position: 'relative' }}>
            {/* Step cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${data.steps.length}, 1fr)`,
              gap: 8,
              position: 'relative',
            }}>
              {data.steps.map((step, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  {/* Step number badge */}
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: idx < data.steps.length - 1 ? 'var(--catalyst-600)' : 'var(--bond-500)',
                    color: 'var(--carbon-950)',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {idx + 1}
                  </div>

                  {/* Step card */}
                  <div style={{
                    background: 'var(--carbon-900)',
                    border: '1px solid var(--carbon-700)',
                    borderRadius: 'var(--radius-md)',
                    padding: '28px 14px 16px',
                    height: '100%',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--catalyst-600)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--carbon-700)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  >
                    {/* Molecule / step icon placeholder */}
                    <MoleculeIcon stepIdx={idx} totalSteps={data.steps.length} type={activeTab} />

                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--carbon-100)',
                      marginBottom: 6,
                      marginTop: 12,
                    }}>
                      {step.label}
                    </div>

                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      color: 'var(--catalyst-400)',
                      marginBottom: 8,
                      wordBreak: 'break-word',
                      lineHeight: 1.5,
                    }}>
                      {step.formula}
                    </div>

                    <div style={{
                      fontSize: 11,
                      color: 'var(--carbon-400)',
                      lineHeight: 1.5,
                    }}>
                      {step.desc}
                    </div>
                  </div>

                  {/* Arrow between steps */}
                  {idx < data.steps.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(50% - 20px)',
                      right: -12,
                      zIndex: 3,
                      color: 'var(--carbon-600)',
                    }}>
                      <Icon name="arrow-right" size={18} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Energy profile mini */}
          <div style={{ marginTop: 30 }}>
            <div style={{
              fontSize: 12,
              color: 'var(--carbon-300)',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon name="orbit" size={13} />
              反应能量变化示意
            </div>
            <EnergyProfileMini type={activeTab} />
          </div>
        </div>
      </div>

      {/* C-H activation concept */}
      <div className="mech-section">
        <div className="mech-section-title">C-H 键活化机制</div>
        <div className="chart-grid-3">
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: 13 }}>氧化加成 (Oxidative Addition)</div>
            </div>
            <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{
                width: '100%',
                height: 120,
                background: 'var(--carbon-850)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <OxidativeAdditionSVG />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--carbon-400)', lineHeight: 1.6, textAlign: 'left' }}>
                金属中心直接插入 C-H 键间，金属氧化态升高 2，C 和 H 分别与金属成键。常见于 Pt、Pd 等贵金属。
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: 13 }}>σ-键复分解 (σ-Bond Metathesis)</div>
            </div>
            <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{
                width: '100%',
                height: 120,
                background: 'var(--carbon-850)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <SigmaMetathesisSVG />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--carbon-400)', lineHeight: 1.6, textAlign: 'left' }}>
                四元环过渡态，C-H 键断裂与 M-H 键形成同时发生。金属氧化态不变。常见于 d⁰ 金属如 Zr、Sc。
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: 13 }}>协同金属化-脱质子 (CMD)</div>
            </div>
            <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{
                width: '100%',
                height: 120,
                background: 'var(--carbon-850)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CMDSVG />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--carbon-400)', lineHeight: 1.6, textAlign: 'left' }}>
                配体碱同时夺取质子，金属与碳成键。羧酸根等配体协助，广泛存在于 Pd、Cu 催化的 C-H 活化中。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="demo-notice">
          <Icon name="info" size={12} />
          本页为催化机理概念示意图，仅作科普展示用途
        </span>
      </div>
    </div>
  );
}

// Mini energy profile
function EnergyProfileMini({ type }) {
  const profile = type === 'dehydrogenation'
    ? [0, 0.85, 1.32, 0.42, 0.98, 1.18]
    : [0, -0.15, 0.92, 0.45, 1.18, 0.72, 1.55, 0.55, 0.48];

  const labels = type === 'dehydrogenation'
    ? ['C₂H₆', 'C₂H₅*', 'TS1', 'C₂H₄*', 'TS2', 'C₂H₄+H₂']
    : ['CO₂', 'CO₂*', 'TS1', 'HCOO*', 'TS2', 'H₂COO*', 'TS3', 'CH₃O*', 'CH₃OH'];

  const option = {
    grid: { left: 50, right: 20, top: 10, bottom: 20, containLabel: false },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#2a3644' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#7a8ca0',
        fontSize: 9,
        interval: 0,
        rotate: labels.length > 6 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      name: 'E (eV)',
      nameTextStyle: { color: '#7a8ca0', fontSize: 9 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7a8ca0', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
    },
    series: [{
      type: 'line',
      data: profile,
      smooth: 0.3,
      lineStyle: { color: '#00d4aa', width: 2 },
      itemStyle: {
        color: (p) => labels[p.dataIndex].startsWith('TS') ? '#f5a623' : '#00d4aa',
      },
      symbol: 'circle',
      symbolSize: 5,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0, 212, 170, 0.12)' },
          { offset: 1, color: 'rgba(0, 212, 170, 0.01)' },
        ]),
      },
    }],
  };

  return <EChart option={option} style={{ height: 180 }} />;
}

// Molecule illustration icons (simplified)
function MoleculeIcon({ stepIdx, totalSteps, type }) {
  // Different icon per step
  const color = '#00d4aa';
  const carbonColor = '#f5a623';
  const hydrogenColor = '#a0b0c2';

  return (
    <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="70" height="50" viewBox="0 0 70 50">
        {type === 'dehydrogenation' ? (
          <EthaneStepSVG step={stepIdx} />
        ) : (
          <CO2StepSVG step={stepIdx} />
        )}
      </svg>
    </div>
  );
}

function EthaneStepSVG({ step }) {
  // step 0: ethane C2H6 - two carbons with bonds
  // step 1: ethyl radical + H*
  // step 2: TS1
  // step 3: ethylene + 2H
  // step 4: TS2
  const c1x = 22, c2x = 48, cy = 28;
  if (step === 0) {
    // C2H6
    return (
      <g>
        <line x1={c1x+3} y1={cy} x2={c2x-3} y2={cy} stroke="#7c6cf5" strokeWidth="3" />
        <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
        <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
        <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        {/* H atoms */}
        <circle cx={c1x-10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c1x-6} cy={cy+11} r="4" fill="#a0b0c2" />
        <circle cx={c2x+10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c2x+6} cy={cy+11} r="4" fill="#a0b0c2" />
      </g>
    );
  }
  if (step === 1) {
    // C2H5* + H*
    return (
      <g>
        <line x1={c1x+3} y1={cy} x2={c2x-3} y2={cy} stroke="#7c6cf5" strokeWidth="3" />
        <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
        <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
        <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c1x-10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c2x+10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c2x+6} cy={cy+11} r="4" fill="#a0b0c2" />
        {/* separated H */}
        <circle cx={62} cy={18} r="4" fill="#ef4444" />
        <text x={62} y={21} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">H</text>
      </g>
    );
  }
  if (step === 2) {
    // TS1 - dashed breaking bond
    return (
      <g>
        <line x1={c1x+3} y1={cy} x2={c2x-3} y2={cy} stroke="#7c6cf5" strokeWidth="3" />
        <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
        <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
        <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c1x-10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c2x+10} cy={cy-10} r="4" fill="#a0b0c2" />
        <circle cx={c2x+6} cy={cy+11} r="4" fill="#a0b0c2" />
        {/* Breaking C-H bond */}
        <line x1={c1x-5} y1={cy+6} x2={c1x-10} y2={cy+14} stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" />
        <circle cx={c1x-5} cy={cy+6} r="2" fill="#ef4444" />
        <circle cx={c1x-12} cy={cy+16} r="3" fill="#ef4444" opacity="0.5" />
        <text x={35} y={8} textAnchor="middle" fontSize="9" fill="#f5a623" fontWeight="bold">TS</text>
      </g>
    );
  }
  if (step === 3) {
    // Ethylene - double bond
    return (
      <g>
        <line x1={c1x+3} y1={cy-2} x2={c2x-3} y2={cy-2} stroke="#00d4aa" strokeWidth="2.5" />
        <line x1={c1x+3} y1={cy+2} x2={c2x-3} y2={cy+2} stroke="#00d4aa" strokeWidth="2.5" />
        <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
        <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
        <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c1x-10} cy={cy-11} r="4" fill="#a0b0c2" />
        <circle cx={c2x+10} cy={cy-11} r="4" fill="#a0b0c2" />
        {/* Two H on surface */}
        <circle cx={10} cy={42} r="3.5" fill="#ef4444" />
        <circle cx={22} cy={42} r="3.5" fill="#ef4444" />
        {/* Surface line */}
        <line x1={4} y1={46} x2={30} y2={46} stroke="#56687d" strokeWidth="1.5" />
      </g>
    );
  }
  if (step === 4) {
    // TS2
    return (
      <g>
        <line x1={c1x+3} y1={cy-2} x2={c2x-3} y2={cy-2} stroke="#00d4aa" strokeWidth="2.5" />
        <line x1={c1x+3} y1={cy+2} x2={c2x-3} y2={cy+2} stroke="#00d4aa" strokeWidth="2.5" />
        <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
        <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
        <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={c1x-10} cy={cy-11} r="4" fill="#a0b0c2" />
        <text x={35} y={8} textAnchor="middle" fontSize="9" fill="#f5a623" fontWeight="bold">TS</text>
        {/* H2 forming */}
        <line x1={55} y1={40} x2={62} y2={40} stroke="#ef4444" strokeWidth="2" strokeDasharray="2,2" />
        <circle cx={55} cy={40} r="3.5" fill="#ef4444" />
        <circle cx={62} cy={40} r="3.5" fill="#ef4444" />
      </g>
    );
  }
  // step 5: products
  return (
    <g>
      <line x1={c1x+3} y1={cy-2} x2={c2x-3} y2={cy-2} stroke="#00d4aa" strokeWidth="2.5" />
      <line x1={c1x+3} y1={cy+2} x2={c2x-3} y2={cy+2} stroke="#00d4aa" strokeWidth="2.5" />
      <circle cx={c1x} cy={cy} r="9" fill="#f5a623" />
      <text x={c1x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
      <circle cx={c2x} cy={cy} r="9" fill="#f5a623" />
      <text x={c2x} y={cy+3} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
      <circle cx={c1x-10} cy={cy-11} r="4" fill="#a0b0c2" />
      <circle cx={c2x+10} cy={cy-11} r="4" fill="#a0b0c2" />
      {/* H2 gas */}
      <line x1={57} y1={14} x2={64} y2={14} stroke="#a0b0c2" strokeWidth="2" />
      <circle cx={57} cy={14} r="4" fill="#a0b0c2" />
      <text x={57} y={17} textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
      <circle cx={64} cy={14} r="4" fill="#a0b0c2" />
      <text x={64} y={17} textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
    </g>
  );
}

function CO2StepSVG({ step }) {
  // Simplified CO2 hydrogenation steps
  if (step === 0) {
    // CO2 gas
    return (
      <g>
        <circle cx={18} cy={25} r="8" fill="#ef4444" />
        <text x={18} y={28} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">O</text>
        <circle cx={35} cy={25} r="10" fill="#f5a623" />
        <text x={35} y={29} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={52} cy={25} r="8" fill="#ef4444" />
        <text x={52} y={28} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">O</text>
        <line x1={26} y1={24} x2={25} y2={24} stroke="#7c6cf5" strokeWidth="2.5" />
        <line x1={26} y1={26} x2={25} y2={26} stroke="#7c6cf5" strokeWidth="2.5" />
        <line x1={43} y1={24} x2={45} y2={24} stroke="#7c6cf5" strokeWidth="2.5" />
        <line x1={43} y1={26} x2={45} y2={26} stroke="#7c6cf5" strokeWidth="2.5" />
      </g>
    );
  }
  if (step === 1) {
    // CO2 adsorbed
    return (
      <g>
        <circle cx={20} cy={22} r="7" fill="#ef4444" />
        <text x={20} y={25} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
        <circle cx={35} cy={22} r="9" fill="#f5a623" />
        <text x={35} y={26} textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
        <circle cx={50} cy={22} r="7" fill="#ef4444" />
        <text x={50} y={25} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
        <line x1={27} y1={21} x2={26} y2={21} stroke="#7c6cf5" strokeWidth="2" />
        <line x1={43} y1={21} x2={44} y2={21} stroke="#7c6cf5" strokeWidth="2" />
        {/* surface */}
        <line x1={10} y1={44} x2={60} y2={44} stroke="#56687d" strokeWidth="1.5" />
        <line x1={25} y1={30} x2={25} y2={44} stroke="#00d4aa" strokeWidth="1.5" strokeDasharray="2,2" />
        <line x1={45} y1={30} x2={45} y2={44} stroke="#00d4aa" strokeWidth="1.5" strokeDasharray="2,2" />
      </g>
    );
  }
  if (step === 3) {
    // HCOO intermediate
    return (
      <g>
        <circle cx={30} cy={20} r="9" fill="#f5a623" />
        <text x={30} y={24} textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
        <circle cx={16} cy={22} r="7" fill="#ef4444" />
        <text x={16} y={25} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
        <circle cx={46} cy={22} r="7" fill="#ef4444" />
        <text x={46} y={25} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
        {/* H attached */}
        <circle cx={30} cy={8} r="4" fill="#a0b0c2" />
        <text x={30} y={10} textAnchor="middle" fontSize="6" fill="#111820" fontWeight="bold">H</text>
        <line x1={22} y1={25} x2={24} y2={26} stroke="#7c6cf5" strokeWidth="2" />
        <line x1={36} y1={25} x2={38} y2={26} stroke="#7c6cf5" strokeWidth="2" />
        <line x1={10} y1={44} x2={60} y2={44} stroke="#56687d" strokeWidth="1.5" />
      </g>
    );
  }
  if (step === 6) {
    // CH3O intermediate
    return (
      <g>
        <circle cx={35} cy={25} r="10" fill="#f5a623" />
        <text x={35} y={29} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={55} cy={20} r="7" fill="#ef4444" />
        <text x={55} y={23} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
        <circle cx={20} cy={14} r="4" fill="#a0b0c2" />
        <circle cx={20} cy={32} r="4" fill="#a0b0c2" />
        <circle cx={35} cy={10} r="4" fill="#a0b0c2" />
        <line x1={10} y1={44} x2={60} y2={44} stroke="#56687d" strokeWidth="1.5" />
        <line x1={55} y1={28} x2={55} y2={44} stroke="#00d4aa" strokeWidth="1.5" />
      </g>
    );
  }
  if (step === 8) {
    // Methanol product
    return (
      <g>
        <circle cx={22} cy={25} r="10" fill="#f5a623" />
        <text x={22} y={29} textAnchor="middle" fontSize="9" fill="#111820" fontWeight="bold">C</text>
        <circle cx={42} cy={20} r="8" fill="#ef4444" />
        <text x={42} y={23} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">O</text>
        <circle cx={57} cy={20} r="4.5" fill="#a0b0c2" />
        <text x={57} y={22} textAnchor="middle" fontSize="6" fill="#111820" fontWeight="bold">H</text>
        <circle cx={10} cy={15} r="4" fill="#a0b0c2" />
        <circle cx={10} cy={32} r="4" fill="#a0b0c2" />
        <circle cx={22} cy={10} r="4" fill="#a0b0c2" />
        <line x1={32} y1={23} x2={34} y2={21} stroke="#7c6cf5" strokeWidth="2" />
      </g>
    );
  }
  // Generic intermediate
  return (
    <g>
      <circle cx={25} cy={22} r="8" fill="#f5a623" />
      <text x={25} y={25} textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
      <circle cx={45} cy={22} r="7" fill="#ef4444" />
      <text x={45} y={25} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
      <circle cx={12} cy={18} r="3.5" fill="#a0b0c2" />
      <circle cx={35} cy={10} r="3.5" fill="#a0b0c2" />
      <line x1={10} y1={44} x2={60} y2={44} stroke="#56687d" strokeWidth="1.5" />
    </g>
  );
}

// Mechanism SVG illustrations
function OxidativeAdditionSVG() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      {/* Metal center */}
      <circle cx="60" cy="55" r="12" fill="#00d4aa" />
      <text x="60" y="59" textAnchor="middle" fontSize="10" fill="#111820" fontWeight="bold">M</text>
      {/* C-H bond above */}
      <circle cx="40" cy="25" r="8" fill="#f5a623" />
      <text x="40" y="28" textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
      <circle cx="75" cy="22" r="5" fill="#a0b0c2" />
      <text x="75" y="25" textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
      <line x1="48" y1="25" x2="70" y2="22" stroke="#7c6cf5" strokeWidth="2.5" />
      {/* Arrows showing approach */}
      <line x1="45" y1="35" x2="52" y2="46" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arrow)" />
      <line x1="72" y1="32" x2="66" y2="45" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}

function SigmaMetathesisSVG() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      {/* Four-center transition state */}
      <circle cx="60" cy="45" r="12" fill="#00d4aa" />
      <text x="60" y="49" textAnchor="middle" fontSize="10" fill="#111820" fontWeight="bold">M</text>
      <circle cx="85" cy="40" r="5" fill="#a0b0c2" />
      <text x="85" y="43" textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
      <circle cx="35" cy="25" r="8" fill="#f5a623" />
      <text x="35" y="28" textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
      <circle cx="55" cy="20" r="5" fill="#a0b0c2" />
      <text x="55" y="23" textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
      {/* Breaking and forming bonds (dashed) */}
      <line x1="43" y1="28" x2="50" y2="38" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" />
      <line x1="72" y1="28" x2="77" y2="37" stroke="#00d4aa" strokeWidth="2" strokeDasharray="3,2" />
      <line x1="48" y1="38" x2="48" y2="39" stroke="#7c6cf5" strokeWidth="2" />
      {/* M-R bond */}
      <line x1="49" y1="38" x2="49" y2="45" stroke="#7c6cf5" strokeWidth="2" />
    </svg>
  );
}

function CMDSVG() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <circle cx="50" cy="50" r="12" fill="#00d4aa" />
      <text x="50" y="54" textAnchor="middle" fontSize="10" fill="#111820" fontWeight="bold">M</text>
      {/* Carboxylate ligand */}
      <circle cx="75" cy="48" r="8" fill="#7c6cf5" />
      <text x="75" y="52" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">O</text>
      {/* C-H being activated */}
      <circle cx="30" cy="25" r="8" fill="#f5a623" />
      <text x="30" y="28" textAnchor="middle" fontSize="8" fill="#111820" fontWeight="bold">C</text>
      <circle cx="48" cy="22" r="5" fill="#a0b0c2" />
      <text x="48" y="25" textAnchor="middle" fontSize="7" fill="#111820" fontWeight="bold">H</text>
      {/* M-C bond forming */}
      <line x1="42" y1="42" x2="37" y2="33" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* H being pulled by O */}
      <line x1="55" y1="28" x2="67" y2="40" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* M-O bond */}
      <line x1="58" y1="50" x2="67" y2="50" stroke="#7c6cf5" strokeWidth="2" />
    </svg>
  );
}

Object.assign(window, { Mechanism });
