// Machine Learning Modeling Module
const { useState, useMemo } = React;

function MLModel() {
  const [selectedId, setSelectedId] = useState(ML_MODELS[0].id);
  const selected = ML_MODELS.find(m => m.id === selectedId) || ML_MODELS[0];

  // Training curve
  const trainingOption = useMemo(() => {
    const data = selected.trainingCurve;
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 32, 0.95)',
        borderColor: '#2a3644',
        borderWidth: 1,
        textStyle: { color: '#e0e8f0', fontSize: 12 },
        formatter: (params) => {
          let s = `Epoch ${params[0].value[0]}<br/>`;
          params.forEach(p => {
            s += `${p.seriesName}: <b>${p.value[1].toFixed(4)}</b><br/>`;
          });
          return s;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#a0b0c2', fontSize: 11 },
        itemWidth: 16,
        itemHeight: 2,
      },
      grid: { left: 50, right: 20, top: 15, bottom: 35, containLabel: false },
      xAxis: {
        type: 'value',
        name: 'Epoch',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 20,
        axisLine: { lineStyle: { color: '#2a3644' } },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Loss',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 35,
        type: 'log',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      series: [
        {
          name: '训练集 Loss',
          type: 'line',
          data: data.map(d => [d.epoch, d.trainLoss]),
          smooth: true,
          lineStyle: { color: '#00d4aa', width: 2 },
          itemStyle: { color: '#00d4aa' },
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '验证集 Loss',
          type: 'line',
          data: data.map(d => [d.epoch, d.valLoss]),
          smooth: true,
          lineStyle: { color: '#f5a623', width: 2, type: 'dashed' },
          itemStyle: { color: '#f5a623' },
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    };
  }, [selected]);

  // Model comparison radar
  const modelCompareOption = useMemo(() => ({
    tooltip: {
      backgroundColor: 'rgba(17, 24, 32, 0.95)',
      borderColor: '#2a3644',
      borderWidth: 1,
      textStyle: { color: '#e0e8f0', fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#a0b0c2', fontSize: 11 },
      itemWidth: 14,
      itemHeight: 2,
      type: 'scroll',
    },
    radar: {
      indicator: [
        { name: '预测精度', max: 100 },
        { name: '数据效率', max: 100 },
        { name: '迁移能力', max: 100 },
        { name: '推理速度', max: 100 },
        { name: '可解释性', max: 100 },
        { name: '可扩展性', max: 100 },
      ],
      center: ['50%', '48%'],
      radius: '65%',
      splitNumber: 4,
      axisName: { color: '#a0b0c2', fontSize: 10 },
      splitLine: { lineStyle: { color: '#2a3644' } },
      splitArea: { areaStyle: { color: ['rgba(29,39,51,0.3)', 'rgba(29,39,51,0.1)'] } },
      axisLine: { lineStyle: { color: '#2a3644' } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          name: 'DeepMD 势函数',
          value: [95, 45, 70, 80, 55, 85],
          lineStyle: { color: '#00d4aa', width: 2 },
          itemStyle: { color: '#00d4aa' },
          areaStyle: { color: 'rgba(0, 212, 170, 0.15)' },
        },
        {
          name: 'GNN / CGCNN',
          value: [88, 65, 80, 70, 60, 75],
          lineStyle: { color: '#7c6cf5', width: 2 },
          itemStyle: { color: '#7c6cf5' },
          areaStyle: { color: 'rgba(124, 108, 245, 0.12)' },
        },
        {
          name: '随机森林 (描述符)',
          value: [75, 80, 60, 95, 85, 55],
          lineStyle: { color: '#f5a623', width: 2 },
          itemStyle: { color: '#f5a623' },
          areaStyle: { color: 'rgba(245, 166, 35, 0.12)' },
        },
      ],
    }],
  }), []);

  // Feature importance
  const featureOption = useMemo(() => {
    const data = ML_MODELS[2].featureImportance;
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 32, 0.95)',
        borderColor: '#2a3644',
        borderWidth: 1,
        textStyle: { color: '#e0e8f0', fontSize: 12 },
        formatter: (p) => `${p.name}<br/>重要性: <b>${p.value.toFixed(1)}%</b>`,
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderColor: '#111820', borderWidth: 2 },
        label: {
          show: true,
          position: 'outside',
          color: '#c4d0dd',
          fontSize: 11,
          formatter: (p) => `${p.name}\n${p.value.toFixed(1)}%`,
        },
        labelLine: {
          lineStyle: { color: '#3d4d61' },
          length: 10,
          length2: 10,
        },
        data: data.map((d, i) => ({
          name: d.name,
          value: d.importance,
          itemStyle: { color: ['#00d4aa', '#3b82f6', '#f5a623', '#7c6cf5', '#ec4899', '#10b981', '#f97316', '#56687d'][i % 8] },
        })),
      }],
    };
  }, []);

  // Parity plot (scatter showing predicted vs actual)
  const parityOption = useMemo(() => {
    // Generate simulated parity data
    const points = [];
    for (let i = 0; i < 120; i++) {
      const actual = -3 + Math.random() * 6;
      const noise = (Math.random() - 0.5) * 0.4;
      const predicted = actual + noise;
      points.push([actual, predicted]);
    }
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 32, 0.95)',
        borderColor: '#2a3644',
        borderWidth: 1,
        textStyle: { color: '#e0e8f0', fontSize: 12 },
        formatter: (p) => `实际值: <b>${p.value[0].toFixed(3)} eV</b><br/>预测值: <b>${p.value[1].toFixed(3)} eV</b>`,
      },
      grid: { left: 50, right: 20, top: 20, bottom: 40, containLabel: false },
      xAxis: {
        type: 'value',
        name: 'DFT 计算值 (eV)',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 22,
        min: -3, max: 3,
        axisLine: { lineStyle: { color: '#2a3644' } },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'ML 预测值 (eV)',
        nameTextStyle: { color: '#7a8ca0', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 35,
        min: -3, max: 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#7a8ca0', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1d2733', type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          data: [[-3, -3], [3, 3]],
          lineStyle: { color: '#2a3644', width: 1, type: 'dashed' },
          symbol: 'none',
          tooltip: { show: false },
        },
        {
          type: 'scatter',
          data: points,
          symbolSize: 7,
          itemStyle: { color: '#00d4aa', opacity: 0.7 },
        },
      ],
    };
  }, []);

  const metricEntries = Object.entries(selected.metrics);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-dot"></span>
          机器学习建模模块
        </div>
        <div className="page-header-sub">
          用于催化预测的机器学习与机器学习势 (ML Potential) 建模结果与性能评估
        </div>
      </div>

      {/* Model selector tabs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="brain" size={16} />
            模型选择
          </div>
          <span className="demo-notice">
            <Icon name="info" size={12} />
            相关内容开发中……
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ML_MODELS.map(m => (
              <button
                key={m.id}
                className="topbar-btn"
                style={{
                  borderColor: selectedId === m.id ? 'var(--catalyst-600)' : 'var(--carbon-700)',
                  background: selectedId === m.id ? 'var(--catalyst-glow)' : 'transparent',
                  color: selectedId === m.id ? 'var(--catalyst-400)' : 'var(--carbon-300)',
                  padding: '8px 14px',
                }}
                onClick={() => setSelectedId(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected model detail */}
      <div className="chart-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="brain" size={16} />
              {selected.name}
            </div>
            <span className="tag tag-energy">{selected.category}</span>
          </div>
          <div className="card-body">
            <p style={{ color: 'var(--carbon-300)', fontSize: '12.5px', marginBottom: 16, lineHeight: 1.6 }}>
              {selected.description}
            </p>
            <div className="ml-metrics-grid">
              {metricEntries.map(([key, val]) => {
                const isGood = key.includes('R²') || key === 'R²';
                return (
                  <div key={key} className="ml-metric">
                    <div className="ml-metric-label">{key}</div>
                    <div className={`ml-metric-value ${isGood ? 'good' : ''}`}>{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="chevron-right" size={16} />
              训练 / 验证曲线
            </div>
            <span className="tag tag-catalyst">对数坐标</span>
          </div>
          <div className="card-body">
            <EChart option={trainingOption} style={{ height: 280 }} />
          </div>
        </div>
      </div>

      {/* Model comparison + parity plot */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="filter" size={16} />
              模型综合性能对比
            </div>
          </div>
          <div className="card-body">
            <EChart option={modelCompareOption} style={{ height: 320 }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="orbit" size={16} />
              Parity Plot — 预测 vs DFT
            </div>
            <span className="tag tag-success">R² = 0.994</span>
          </div>
          <div className="card-body">
            <EChart option={parityOption} style={{ height: 320 }} />
          </div>
        </div>
      </div>

      {/* Feature importance */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="settings" size={16} />
            特征重要性分析 (随机森林模型)
          </div>
          <span className="demo-notice">
            <Icon name="info" size={12} />
            基于 24 维描述符，Top 8 特征展示
          </span>
        </div>
        <div className="card-body">
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <EChart option={featureOption} style={{ height: 320 }} />
          </div>
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

Object.assign(window, { MLModel });
