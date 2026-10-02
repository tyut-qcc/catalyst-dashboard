// C3H6 Combustion Microkinetic Database - enhanced kMC data page
const { useState, useMemo, useEffect } = React;

function C3H6Microdynamics() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatalysts, setSelectedCatalysts] = useState(['Pd-CeO2']);
  const [selectedTemps, setSelectedTemps] = useState([]);
  const [selectedSegId, setSelectedSegId] = useState(null);

  // Load data
  useEffect(() => {
    fetch('data/c3h6_kmc_new.json')
      .then(r => r.json())
      .then(d => {
        // Add an id field to each segment
        const withIds = d.map((s, i) => ({ ...s, id: i + 1 }));
        setSegments(withIds);
        setLoading(false);
        // default: select first segment (Pd-CeO2 423.15K)
        if (withIds.length > 0) {
          setSelectedSegId(withIds[0].id);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const catalysts = useMemo(() => {
    const s = new Set();
    segments.forEach(seg => s.add(seg.catalyst));
    return Array.from(s).sort();
  }, [segments]);

  const temperatures = useMemo(() => {
    const s = new Set();
    segments.forEach(seg => s.add(seg.temperature_K));
    return Array.from(s).sort((a, b) => a - b);
  }, [segments]);

  // Filtered segments by catalyst + temperature
  const filteredSegs = useMemo(() => {
    let arr = [...segments];
    if (selectedCatalysts.length > 0) {
      arr = arr.filter(s => selectedCatalysts.includes(s.catalyst));
    }
    if (selectedTemps.length > 0) {
      arr = arr.filter(s => selectedTemps.includes(s.temperature_K));
    }
    return arr.sort((a, b) => {
      if (a.catalyst !== b.catalyst) return a.catalyst.localeCompare(b.catalyst);
      return a.temperature_K - b.temperature_K;
    });
  }, [segments, selectedCatalysts, selectedTemps]);

  const selectedSeg = useMemo(() =>
    segments.find(s => s.id === selectedSegId), [segments, selectedSegId]
  );

  const toggleCatalyst = (cat) => {
    setSelectedCatalysts(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleTemp = (t) => {
    setSelectedTemps(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const clearTempFilter = () => setSelectedTemps([]);

  // ===== Arrhenius plot: steady state rate vs temperature =====
  const arrheniusOption = useMemo(() => {
    // Group by catalyst, plot ln(rate) vs 1/T
    const byCatalyst = {};
    segments.forEach(seg => {
      if (!byCatalyst[seg.catalyst]) byCatalyst[seg.catalyst] = [];
      const invT = 1000 / seg.temperature_K; // 1000/K for readability
      const lnRate = Math.log(seg.steady_state_rate);
      byCatalyst[seg.catalyst].push({ invT, lnRate, T: seg.temperature_K, rate: seg.steady_state_rate });
    });

    const palette = [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.purple];
    const series = Object.entries(byCatalyst).map(([cat, data], idx) => ({
      name: cat,
      type: 'line',
      data: data.sort((a, b) => a.invT - b.invT).map(d => [d.invT, d.lnRate]),
      smooth: false,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { color: palette[idx % palette.length], width: 2 },
      itemStyle: { color: palette[idx % palette.length], borderColor: '#fff', borderWidth: 2 },
    }));

    return {
      tooltip: {
        ...DEFAULT_TOOLTIP,
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          // Find original data point
          const invT = p.value[0];
          const cat = p.seriesName;
          const pt = byCatalyst[cat].find(d => Math.abs(d.invT - invT) < 0.001);
          if (!pt) return '';
          return `<b>${cat}</b><br/>温度: ${pt.T} K<br/>1000/T: ${invT.toFixed(2)} K⁻¹<br/>速率: ${pt.rate.toExponential(3)} s⁻¹<br/>ln(rate): ${p.value[1].toFixed(3)}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#64748b', fontSize: 11 },
        itemWidth: 14,
        itemHeight: 2,
      },
      grid: { left: 60, right: 20, top: 15, bottom: 50, containLabel: false },
      xAxis: {
        type: 'value',
        name: '1000 / T (K⁻¹)',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        nameLocation: 'middle',
        nameGap: 28,
        inverse: true,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10.5, formatter: (v) => v.toFixed(2) },
        splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'ln(rate)',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        nameLocation: 'middle',
        nameGap: 45,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10.5 },
        splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } },
      },
      series,
    };
  }, [segments]);

  // ===== Steady state rate bar by catalyst at 623K (common) =====
  const rateBarOption = useMemo(() => {
    // Pick 623.15 K as the common reference temperature
    const commonT = 623.15;
    const data = segments
      .filter(s => s.temperature_K === commonT)
      .map(s => ({ name: s.catalyst, value: s.steady_state_rate }))
      .sort((a, b) => b.value - a.value);

    return {
      tooltip: {
        ...DEFAULT_TOOLTIP,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p) => `${p[0].name}<br/>稳态速率: <b>${p[0].value.toExponential(3)} s⁻¹</b>`,
      },
      grid: { left: 110, right: 80, top: 10, bottom: 15, containLabel: false },
      xAxis: {
        type: 'log',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10.5, formatter: (v) => v.toExponential(0) },
        splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } },
        name: 'Steady-state Rate (s⁻¹)',
        nameTextStyle: { color: '#64748b', fontSize: 10 },
        nameLocation: 'middle',
        nameGap: 25,
      },
      yAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#334155', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      },
      series: [{
        type: 'bar',
        barWidth: 14,
        data: data.map(d => d.value),
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#1e6fff' },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (p) => p.value.toExponential(2),
        },
      }],
    };
  }, [segments]);

  // ===== Step rates bar chart (for selected segment) =====
  const stepRatesOption = useMemo(() => {
    if (!selectedSeg?.step_rates) return {};
    const entries = Object.entries(selectedSeg.step_rates)
      .map(([k, v]) => ({ name: k, value: v }))
      .filter(d => d.value > 0 && isFinite(d.value))
      .sort((a, b) => b.value - a.value);

    if (entries.length === 0) return {};

    const minVal = entries[entries.length - 1].value / 5;

    return {
      tooltip: {
        ...DEFAULT_TOOLTIP,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p) => `${p[0].name}<br/>速率: <b>${p[0].value.toExponential(3)} s⁻¹</b>`,
      },
      grid: { left: 200, right: 60, top: 10, bottom: 15, containLabel: false },
      xAxis: {
        type: 'log',
        min: minVal,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (v) => v.toExponential(0) },
        splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: entries.map(d => d.name).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#334155',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        },
      },
      series: [{
        type: 'bar',
        barWidth: 10,
        data: entries.map(d => d.value).reverse(),
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#5eead4' },
            { offset: 1, color: '#14b8a6' },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 9.5,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (p) => p.value.toExponential(1),
        },
      }],
    };
  }, [selectedSeg]);

  // ===== Step counts bar chart =====
  const stepCountsOption = useMemo(() => {
    if (!selectedSeg?.step_counts) return {};
    const entries = Object.entries(selectedSeg.step_counts)
      .map(([k, v]) => ({ name: k, value: v }))
      .filter(d => d.value > 0 && isFinite(d.value))
      .sort((a, b) => b.value - a.value);

    if (entries.length === 0) return {};

    const minVal = entries[entries.length - 1].value / 5;

    return {
      tooltip: {
        ...DEFAULT_TOOLTIP,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p) => `${p[0].name}<br/>事件数: <b>${p[0].value.toLocaleString()}</b>`,
      },
      grid: { left: 200, right: 60, top: 10, bottom: 15, containLabel: false },
      xAxis: {
        type: 'log',
        min: minVal,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: entries.map(d => d.name).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#334155',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        },
      },
      series: [{
        type: 'bar',
        barWidth: 10,
        data: entries.map(d => d.value).reverse(),
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#c4b5fd' },
            { offset: 1, color: '#8b5cf6' },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 9.5,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (p) => p.value >= 1000 ? (p.value/1000).toFixed(1) + 'k' : p.value,
        },
      }],
    };
  }, [selectedSeg]);

  if (loading) {
    return (
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-bar"></span>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <div className="page-header-title">
              <span className="accent-bar"></span>
              C₃H₆ Combustion · Microkinetic Database
            </div>
            <div className="page-header-sub" style={{ marginTop: 6 }}>
              丙烯燃烧反应 kMC 微观动力学模拟数据 — 覆盖 Pd-CeO₂、Pt-CeO₂、Cu-CeO₂、Zr-CeO₂ 四种催化剂，多温度梯度下的基元步骤速率分析
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span className="data-badge real">
              <Icon name="check" size={12} />
              真实 kMC 动力学数据
            </span>
            <span className="tag tag-gray" style={{ fontSize: 11 }}>
              {segments.length} 个动力学片段 · {catalysts.length} 种催化剂
            </span>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="filter" size={15} />
            数据筛选
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 6, fontWeight: 500 }}>
              催化剂 ({selectedCatalysts.length}/{catalysts.length})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {catalysts.map(cat => (
                <div
                  key={cat}
                  className={`chip ${selectedCatalysts.includes(cat) ? 'active' : ''}`}
                  onClick={() => toggleCatalyst(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 6, fontWeight: 500 }}>
              反应温度 ({selectedTemps.length === 0 ? '全部' : selectedTemps.length + '个'})
              {selectedTemps.length > 0 && (
                <span
                  style={{ color: 'var(--primary-500)', cursor: 'pointer', marginLeft: 8, fontWeight: 400 }}
                  onClick={clearTempFilter}
                >
                  清除
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {temperatures.map(t => (
                <div
                  key={t}
                  className={`chip ${selectedTemps.includes(t) ? 'active' : ''}`}
                  onClick={() => toggleTemp(t)}
                >
                  {t} K
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Arrhenius + rate bar row */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="zap" size={15} />
              Arrhenius 图: ln(rate) vs 1/T
            </div>
            <span className="tag tag-teal">温度依赖</span>
          </div>
          <div className="card-body">
            <EChart option={arrheniusOption} style={{ height: 320 }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="flask" size={15} />
              催化剂活性对比 @ 623.15K
            </div>
            <span className="tag tag-amber">稳态速率</span>
          </div>
          <div className="card-body">
            <EChart option={rateBarOption} style={{ height: 320 }} />
          </div>
        </div>
      </div>

      {/* Segment selector + details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="settings" size={15} />
            动力学片段详情
          </div>
          {selectedSeg && (
            <span className="tag tag-purple">
              {selectedSeg.catalyst} · {selectedSeg.temperature_K}K
            </span>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            {/* Segment list */}
            <div style={{
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--r-sm)',
              maxHeight: 500,
              overflowY: 'auto',
            }}>
              {filteredSegs.map(seg => (
                <div
                  key={seg.id}
                  onClick={() => setSelectedSegId(seg.id)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--gray-100)',
                    cursor: 'pointer',
                    background: selectedSegId === seg.id ? 'var(--primary-50)' : '#fff',
                    borderLeft: selectedSegId === seg.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--gray-800)',
                    fontFamily: 'var(--font-mono)', marginBottom: 3,
                  }}>
                    {seg.catalyst}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{seg.temperature_K} K</span>
                    <span className="font-mono" style={{ color: 'var(--teal-600)', fontWeight: 500 }}>
                      {seg.steady_state_rate.toExponential(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Segment detail */}
            <div>
              {selectedSeg ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div className="stat-card" style={{ padding: '12px 14px', boxShadow: 'none' }}>
                      <div className="stat-card-label" style={{ fontSize: 11 }}>催化剂</div>
                      <div className="stat-card-value" style={{ fontSize: 18 }}>
                        {selectedSeg.catalyst}
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px 14px', boxShadow: 'none' }}>
                      <div className="stat-card-label" style={{ fontSize: 11 }}>温度</div>
                      <div className="stat-card-value" style={{ fontSize: 18 }}>
                        {selectedSeg.temperature_K}
                        <span className="unit">K</span>
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '12px 14px', boxShadow: 'none' }}>
                      <div className="stat-card-label" style={{ fontSize: 11 }}>稳态速率</div>
                      <div className="stat-card-value" style={{ fontSize: 18 }}>
                        <span className="font-mono" style={{ color: 'var(--primary-600)' }}>
                          {selectedSeg.steady_state_rate.toExponential(3)}
                        </span>
                        <span className="unit">s⁻¹</span>
                      </div>
                    </div>
                  </div>

                  {/* Elementary steps list */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--gray-700)',
                      marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Icon name="layers" size={13} />
                      基元步骤（{selectedSeg.elementary_steps?.length || 0} 个）
                    </div>
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 5,
                      padding: 10, background: 'var(--gray-50)',
                      borderRadius: 'var(--r-sm)', border: '1px solid var(--gray-100)',
                    }}>
                      {(selectedSeg.elementary_steps || []).map((step, idx) => (
                        <span
                          key={idx}
                          className="tag"
                          style={{
                            background: step.includes('_fwd') ? 'var(--success-50)' :
                                       step.includes('_rev') ? 'var(--warning-50)' :
                                       'var(--primary-50)',
                            color: step.includes('_fwd') ? 'var(--success-600)' :
                                   step.includes('_rev') ? 'var(--warning-600)' :
                                   'var(--primary-700)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10.5,
                            padding: '3px 7px',
                          }}
                        >
                          {idx + 1}. {step}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Feed info */}
                  <div style={{
                    fontSize: 12, color: 'var(--gray-600)',
                    padding: '8px 12px', background: 'var(--teal-50)',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--teal-100)',
                  }}>
                    <b style={{ color: 'var(--teal-700)' }}>进料:</b> {selectedSeg.feed}
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    <b style={{ color: 'var(--teal-700)' }}>基元步骤:</b> {selectedSeg.elementary_steps?.length} 个
                    &nbsp;&nbsp;·&nbsp;&nbsp;
                    <b style={{ color: 'var(--teal-700)' }}>曲线采样点:</b> {selectedSeg.curve?.length}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--gray-500)', padding: 40, textAlign: 'center' }}>
                  请选择一个动力学片段查看详情
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step rates + step counts */}
      {selectedSeg && (
        <>
          <div className="chart-grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Icon name="zap" size={15} />
                  基元步骤稳态速率
                </div>
                <span className="tag tag-teal">对数坐标</span>
              </div>
              <div className="card-body">
                <EChart option={stepRatesOption} style={{ height: 360 }} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Icon name="layers" size={15} />
                  基元步骤事件计数
                </div>
                <span className="tag tag-purple">step counts</span>
              </div>
              <div className="card-body">
                <EChart option={stepCountsOption} style={{ height: 360 }} />
              </div>
            </div>
          </div>

          {/* Step rates table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Icon name="settings" size={15} />
                基元步骤速率详表
              </div>
              <span className="tag tag-gray">{selectedSeg.elementary_steps?.length} 个步骤</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>基元步骤</th>
                    <th className="num">稳态速率 (s⁻¹)</th>
                    <th className="num">事件计数</th>
                    <th>类型</th>
                    <th className="num">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSeg.elementary_steps || []).map((step, idx) => {
                    const rate = selectedSeg.step_rates?.[step] ?? 0;
                    const count = selectedSeg.step_counts?.[step] ?? 0;
                    const totalRate = Object.values(selectedSeg.step_rates || {}).reduce((a, b) => a + (b || 0), 0);
                    const pct = totalRate > 0 ? (rate / totalRate * 100) : 0;
                    const isFwd = step.includes('_fwd');
                    const isRev = step.includes('_rev');
                    return (
                      <tr key={idx}>
                        <td className="mono" style={{ color: 'var(--gray-400)' }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--gray-800)' }}>
                          {step}
                        </td>
                        <td className="num mono highlight">{rate.toExponential(4)}</td>
                        <td className="num mono">{count.toLocaleString()}</td>
                        <td>
                          {isFwd && <span className="tag tag-success">正向</span>}
                          {isRev && <span className="tag tag-amber">逆向</span>}
                          {!isFwd && !isRev && <span className="tag tag-gray">其他</span>}
                        </td>
                        <td className="num mono">
                          {pct.toFixed(2)}%
                          <div style={{
                            display: 'inline-block',
                            width: 60,
                            height: 4,
                            background: 'var(--gray-100)',
                            borderRadius: 2,
                            marginLeft: 6,
                            verticalAlign: 'middle',
                          }}>
                            <div style={{
                              width: `${Math.min(pct, 100)}%`,
                              height: '100%',
                              background: 'var(--primary-400)',
                              borderRadius: 2,
                            }}></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Full summary table */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="layers" size={15} />
            全部动力学片段汇总
          </div>
          <span className="tag tag-gray">共 {segments.length} 个片段</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>催化剂</th>
                <th>温度 (K)</th>
                <th>进料</th>
                <th className="num">基元步骤数</th>
                <th className="num">稳态速率 (s⁻¹)</th>
                <th className="num">曲线点数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, idx) => (
                <tr
                  key={seg.id}
                  style={{
                    background: selectedSegId === seg.id ? 'var(--primary-50)' : undefined,
                  }}
                >
                  <td className="mono" style={{ color: 'var(--gray-400)' }}>{idx + 1}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--gray-800)' }}>
                    {seg.catalyst}
                  </td>
                  <td>
                    <span className="tag tag-primary">{seg.temperature_K}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{seg.feed}</td>
                  <td className="num mono">{seg.elementary_steps?.length || 0}</td>
                  <td className="num mono highlight">{seg.steady_state_rate.toExponential(3)}</td>
                  <td className="num mono">{seg.curve?.length || 0}</td>
                  <td>
                    <span
                      style={{
                        color: 'var(--primary-600)', fontSize: 12, cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onClick={() => setSelectedSegId(seg.id)}
                    >
                      查看详情 →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { C3H6Microdynamics });
