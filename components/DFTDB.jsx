// DFT Calculation Database
const { useState, useMemo } = React;

function DFTDB() {
  const [selectedId, setSelectedId] = useState(DFT_REACTIONS[0].id);

  const selected = DFT_REACTIONS.find(r => r.id === selectedId) || DFT_REACTIONS[0];

  // Energy profile chart
  const energyProfileOption = useMemo(() => {
    const data = selected.intermediates.map((s, i) => ({
      name: s.name,
      value: s.energy,
      isTS: s.isTS,
      idx: i,
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 32, 0.95)',
        borderColor: '#2a3644',
        borderWidth: 1,
        textStyle: { color: '#e0e8f0', fontSize: 12 },
        formatter: (p) => {
          const d = data[p.dataIndex];
          return `${d.name}<br/>能量: <b>${d.value.toFixed(2)} eV</b>${d.isTS ? '<br/>过渡态' : ''}`;
        },
      },
      grid: { left: 60, right: 40, top: 20, bottom: 60, containLabel: false },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLine: { lineStyle: { color: '#2a3644' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#a0b0c2',
          fontSize: 10,
          interval: 0,
          rotate: data.length > 6 ? 30 : 0,
          fontWeight: (i) => data[i].isTS ? 600 : 400,
          color: (i) => data[i].isTS ? '#f5a623' : '#a0b0c2',
        },
      },
      yAxis: {
        type: 'value',
        name: '能量 (eV)',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          data: data.map(d => d.value),
          smooth: 0.3,
          lineStyle: { color: '#00d4aa', width: 2.5 },
          itemStyle: {
            color: (p) => data[p.dataIndex].isTS ? '#f5a623' : '#00d4aa',
            borderColor: '#111820',
            borderWidth: 2,
          },
          symbol: 'circle',
          symbolSize: (v, p) => data[p.dataIndex].isTS ? 10 : 7,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 212, 170, 0.15)' },
              { offset: 1, color: 'rgba(0, 212, 170, 0.01)' },
            ]),
          },
          label: {
            show: true,
            position: 'top',
            formatter: (p) => `${p.value.toFixed(2)}`,
            color: '#c4d0dd',
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
      ],
    };
  }, [selected]);

  // Activation energy comparison across all reactions
  const activationCompareOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 32, 0.95)',
      borderColor: '#2a3644',
      borderWidth: 1,
      textStyle: { color: '#e0e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 140, right: 30, top: 10, bottom: 20, containLabel: false },
    xAxis: {
      type: 'value',
      name: '能垒 (eV)',
      nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7a8ca0', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: DFT_REACTIONS.map(r => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#c4d0dd', fontSize: 11 },
    },
    series: [
      {
        name: '决速步能垒',
        type: 'bar',
        barWidth: 14,
        data: DFT_REACTIONS.map(r => r.activationEnergy),
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: (p) => {
            const val = p.value;
            if (val < 1.0) return '#10b981';
            if (val < 1.5) return '#00d4aa';
            if (val < 2.0) return '#f5a623';
            return '#ef4444';
          },
        },
        label: {
          show: true,
          position: 'right',
          color: '#c4d0dd',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (p) => `${p.value.toFixed(2)} eV`,
        },
      },
    ],
  }), []);

  // DOS plot
  const dosOption = useMemo(() => {
    const dosTotal = generateDOSData(-2, 2.5);
    const dosD = generateDOSData(-1.5, 1.8).map(p => [p[0], p[1] * 0.6]);
    const dosS = generateDOSData(-4, 3.0).map(p => [p[0], p[1] * 0.35]);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 32, 0.95)',
        borderColor: '#2a3644',
        borderWidth: 1,
        textStyle: { color: '#e0e8f0', fontSize: 12 },
        formatter: (params) => {
          let s = `E - E<sub>f</sub> = ${params[0].value[0].toFixed(2)} eV<br/>`;
          params.forEach(p => {
            s += `${p.seriesName}: <b>${p.value[1].toFixed(3)}</b><br/>`;
          });
          return s;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#a0b0c2', fontSize: 11 },
        itemWidth: 18,
        itemHeight: 2,
      },
      grid: { left: 50, right: 20, top: 15, bottom: 40, containLabel: false },
      xAxis: {
        type: 'value',
        name: 'E - E_f (eV)',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 22,
        axisLine: { lineStyle: { color: '#2a3644' } },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'DOS (states/eV)',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      series: [
        {
          name: 'Total DOS',
          type: 'line',
          data: dosTotal,
          smooth: true,
          lineStyle: { color: '#7c6cf5', width: 1.8 },
          itemStyle: { color: '#7c6cf5' },
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(124, 108, 245, 0.25)' },
              { offset: 1, color: 'rgba(124, 108, 245, 0.02)' },
            ]),
          },
        },
        {
          name: 'd-band PDOS',
          type: 'line',
          data: dosD,
          smooth: true,
          lineStyle: { color: '#00d4aa', width: 1.8 },
          itemStyle: { color: '#00d4aa' },
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 212, 170, 0.2)' },
              { offset: 1, color: 'rgba(0, 212, 170, 0.02)' },
            ]),
          },
        },
        {
          name: 's-band PDOS',
          type: 'line',
          data: dosS,
          smooth: true,
          lineStyle: { color: '#f5a623', width: 1.5 },
          itemStyle: { color: '#f5a623' },
          showSymbol: false,
        },
        // Fermi level line
        {
          name: 'E_F',
          type: 'line',
          data: [[0, 0], [0, 4]],
          lineStyle: { color: '#ef4444', width: 1, type: 'dashed' },
          itemStyle: { color: '#ef4444' },
          symbol: 'none',
        },
      ],
    };
  }, []);

  // Bader charge analysis data
  const baderData = [
    { atom: 'Pt₁ (活性位)', charge: -0.32, color: '#00d4aa' },
    { atom: 'Pt₂ (邻近)', charge: -0.18, color: '#3b82f6' },
    { atom: 'N₁ (配位)', charge: 0.21, color: '#f5a623' },
    { atom: 'N₂ (配位)', charge: 0.19, color: '#f5a623' },
    { atom: 'C (基底)', charge: 0.05, color: '#7c6cf5' },
    { atom: 'O (吸附)', charge: -0.45, color: '#ec4899' },
  ];

  const baderOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 32, 0.95)',
      borderColor: '#2a3644',
      borderWidth: 1,
      textStyle: { color: '#e0e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
      formatter: (p) => `${p[0].name}<br/>Bader 电荷: <b>${p[0].value.toFixed(2)} e</b>`,
    },
    grid: { left: 90, right: 30, top: 10, bottom: 20, containLabel: false },
    xAxis: {
      type: 'value',
      name: '电荷转移 (e)',
      nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7a8ca0', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: baderData.map(d => d.atom).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#c4d0dd', fontSize: 11 },
    },
    series: [{
      type: 'bar',
      barWidth: 14,
      data: baderData.map(d => d.charge).reverse(),
      itemStyle: {
        borderRadius: (params) => {
          const v = params.value;
          if (v >= 0) return [3, 0, 0, 3];
          return [0, 3, 3, 0];
        },
        color: (p) => {
          const dataRev = baderData.slice().reverse();
          return dataRev[p.dataIndex].color;
        },
      },
      label: {
        show: true,
        position: (p) => p.value >= 0 ? 'right' : 'left',
        color: '#c4d0dd',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        formatter: (p) => `${p.value.toFixed(2)} e`,
      },
    }],
  }), []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-dot"></span>
          DFT 计算数据库
        </div>
        <div className="page-header-sub">
          密度泛函理论计算结果 — 反应路径能垒、态密度、Bader 电荷、吸附能等电子结构数据
        </div>
      </div>

      {/* Reaction selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="orbit" size={16} />
            反应路径选择
          </div>
          <span className="demo-notice">
            <Icon name="info" size={12} />
            相关内容开发中……
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DFT_REACTIONS.map(r => (
              <button
                key={r.id}
                className="topbar-btn"
                style={{
                  borderColor: selectedId === r.id ? 'var(--catalyst-600)' : 'var(--carbon-700)',
                  background: selectedId === r.id ? 'var(--catalyst-glow)' : 'transparent',
                  color: selectedId === r.id ? 'var(--catalyst-400)' : 'var(--carbon-300)',
                }}
                onClick={() => setSelectedId(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Energy profile + parameters */}
      <div className="chart-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="path" size={16} />
              反应能量曲线
            </div>
            <span className="tag tag-catalyst">
              能垒: {selected.activationEnergy.toFixed(2)} eV
            </span>
          </div>
          <div className="card-body">
            <EChart option={energyProfileOption} style={{ height: 320 }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="settings" size={16} />
              计算参数
            </div>
          </div>
          <div className="card-body">
            <div className="param-list">
              <div className="param-item">
                <span className="param-label">催化体系</span>
                <span className="param-value">{selected.catalyst}</span>
              </div>
              <div className="param-item">
                <span className="param-label">交换关联泛函</span>
                <span className="param-value">{selected.method.functional}</span>
              </div>
              <div className="param-item">
                <span className="param-label">基组 / 赝势</span>
                <span className="param-value">{selected.method.basis}</span>
              </div>
              <div className="param-item">
                <span className="param-label">平面波截断能</span>
                <span className="param-value">{selected.method.cutoff}</span>
              </div>
              <div className="param-item">
                <span className="param-label">k 点网格</span>
                <span className="param-value">{selected.method.kpoint}</span>
              </div>
              <div className="param-item">
                <span className="param-label">计算软件</span>
                <span className="param-value">{selected.method.software}</span>
              </div>
              <div className="param-item">
                <span className="param-label">反应能 ΔE</span>
                <span className="param-value" style={{ color: selected.reactionEnergy > 0 ? '#f5a623' : '#00d4aa' }}>
                  {selected.reactionEnergy > 0 ? '+' : ''}{selected.reactionEnergy.toFixed(2)} eV
                </span>
              </div>
              <div className="param-item">
                <span className="param-label">活化能 Ea</span>
                <span className="param-value" style={{ color: 'var(--bond-400)' }}>
                  {selected.activationEnergy.toFixed(2)} eV
                </span>
              </div>
              <div className="param-item">
                <span className="param-label">中间态数量</span>
                <span className="param-value">{selected.intermediates.length} 个</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activation energy comparison */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="filter" size={16} />
              各反应决速步能垒对比
            </div>
          </div>
          <div className="card-body">
            <EChart option={activationCompareOption} style={{ height: 260 }} />
          </div>
        </div>

        {/* DOS plot */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="atom" size={16} />
              态密度 DOS / pDOS
            </div>
            <span className="tag tag-energy">Pt(111) 表面</span>
          </div>
          <div className="card-body">
            <EChart option={dosOption} style={{ height: 260 }} />
          </div>
        </div>
      </div>

      {/* Bader charge */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="molecule" size={16} />
            Bader 电荷分析
          </div>
          <span className="demo-notice">
            <Icon name="info" size={12} />
            Pt 单原子 / g-C₃N₄ 吸附 CO 体系
          </span>
        </div>
        <div className="card-body" style={{ maxWidth: 600 }}>
          <EChart option={baderOption} style={{ height: 240 }} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="demo-notice">
          <Icon name="info" size={12} />
          以上为演示性模拟数据，不代表真实科研结论
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { DFTDB });
