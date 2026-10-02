// Unified microkinetic database sourced from the uploaded KMC worksheets.
const { useEffect, useMemo, useState } = React;

function kmcNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return number === 0 ? '0' : number.toExponential(4);
}

function MicrodynamicsDB({ reactionData, reactionLabel }) {
  const segments = reactionData?.kmc_segments || [];
  const stats = reactionData?.stats || {};
  const [catalystFilter, setCatalystFilter] = useState('all');
  const [temperatureFilter, setTemperatureFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(segments[0]?.id || null);

  const catalysts = useMemo(() => Array.from(new Set(segments.map(item => item.catalyst))).sort(), [segments]);
  const temperatures = useMemo(() => Array.from(new Set(segments.map(item => item.temperature_K).filter(value => value !== null && value !== undefined))).sort((a, b) => a - b), [segments]);
  const filtered = useMemo(() => segments.filter(item => {
    if (catalystFilter !== 'all' && item.catalyst !== catalystFilter) return false;
    if (temperatureFilter === 'unreported' && item.temperature_K !== null && item.temperature_K !== undefined) return false;
    if (temperatureFilter !== 'all' && temperatureFilter !== 'unreported' && Number(item.temperature_K) !== Number(temperatureFilter)) return false;
    if (qualityFilter !== 'all' && item.quality !== qualityFilter) return false;
    return true;
  }), [segments, catalystFilter, temperatureFilter, qualityFilter]);

  useEffect(() => {
    if (!filtered.some(item => item.id === selectedId)) setSelectedId(filtered[0]?.id || null);
  }, [filtered, selectedId]);

  const selected = segments.find(item => item.id === selectedId) || null;
  const selectedSteps = useMemo(() => {
    if (!selected) return [];
    return (selected.elementary_steps || []).map(name => ({
      name,
      rate: selected.step_rates?.[name],
      count: selected.step_counts?.[name],
    })).sort((a, b) => (b.rate || 0) - (a.rate || 0));
  }, [selected]);

  const rateOption = useMemo(() => ({
    tooltip: { ...DEFAULT_TOOLTIP, trigger: 'axis', formatter: params => { const p = params[0]; return `<b>${p.seriesName}</b><br/>步数: ${Number(p.value[0]).toLocaleString()}<br/>速率: ${kmcNumber(p.value[1])} s⁻¹`; } },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: '#64748b', fontSize: 10 } },
    grid: { left: 72, right: 24, top: 18, bottom: 58 },
    xAxis: { type: 'value', name: 'KMC steps', nameLocation: 'middle', nameGap: 32, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#94a3b8', formatter: value => Number(value).toExponential(0) }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
    yAxis: { type: 'log', name: 'Overall rate (s⁻¹)', nameLocation: 'middle', nameGap: 52, axisLine: { show: false }, axisLabel: { color: '#94a3b8', formatter: value => Number(value).toExponential(0) }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
    series: filtered.slice(0, 10).map((segment, index) => ({
      name: `${segment.catalyst}${segment.temperature_K ? ` · ${segment.temperature_K} K` : ''} · #${segment.id}`,
      type: 'line',
      showSymbol: false,
      smooth: false,
      data: (segment.curve || []).filter(point => point.rate > 0).map(point => [point.steps, point.rate]),
      lineStyle: { width: segment.id === selectedId ? 2.6 : 1.4, opacity: segment.id === selectedId ? 1 : 0.55 },
      emphasis: { focus: 'series' },
    })),
  }), [filtered, selectedId]);

  const steadyOption = useMemo(() => {
    const rows = filtered.filter(item => item.steady_state_rate > 0).sort((a, b) => b.steady_state_rate - a.steady_state_rate).slice(0, 24);
    return {
      tooltip: { ...DEFAULT_TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => `${params[0].name}<br/>稳态速率: <b>${kmcNumber(params[0].value)} s⁻¹</b>` },
      grid: { left: 145, right: 50, top: 12, bottom: 24 },
      xAxis: { type: 'log', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', formatter: value => Number(value).toExponential(0) }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
      yAxis: { type: 'category', data: rows.map(item => `${item.catalyst}${item.temperature_K ? ` · ${item.temperature_K} K` : ''}`), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 10 } },
      series: [{ type: 'bar', data: rows.map(item => item.steady_state_rate), barMaxWidth: 12, itemStyle: { color: '#7c3aed', borderRadius: [0, 3, 3, 0] } }],
    };
  }, [filtered]);

  if (!segments.length) return <DevelopmentPanel title={`${reactionLabel} · Microkinetic Database`} />;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-top">
          <div><div className="page-header-title"><span className="accent-bar"></span>{reactionLabel} · Microkinetic Database</div><div className="page-header-sub" style={{ marginTop: 6 }}>按原始工作簿中的配置步、总体速率、基元步骤速率和累计事件数组织；未提供的温度与进料条件保持“原表未标注”。</div></div>
          <span className="data-badge real"><Icon name="check" size={12} />原始 KMC 工作表</span>
        </div>
      </div>

      <div className="stat-grid kmc-stat-grid">
        <div className="stat-card"><div className="stat-card-label">动力学区段</div><div className="stat-card-value">{segments.length}<span className="unit">段</span></div><div className="stat-card-foot"><span>{stats.kmc_complete || 0} 段记录完整</span></div></div>
        <div className="stat-card"><div className="stat-card-label">催化剂</div><div className="stat-card-value">{catalysts.length}<span className="unit">种</span></div><div className="stat-card-foot"><span>{catalysts.slice(0, 3).join(' / ')}{catalysts.length > 3 ? ' …' : ''}</span></div></div>
        <div className="stat-card"><div className="stat-card-label">明确温度</div><div className="stat-card-value">{temperatures.length}<span className="unit">档</span></div><div className="stat-card-foot"><span>{temperatures.length ? `${temperatures[0]}–${temperatures[temperatures.length - 1]} K` : '原表未标注温度'}</span></div></div>
        <div className="stat-card"><div className="stat-card-label">数据来源</div><div className="stat-card-value source-stat">{reactionData?.sources?.microkinetic_excel?.length || 0}<span className="unit">份</span></div><div className="stat-card-foot"><span>{reactionData?.sources?.microkinetic_excel?.join('、')}</span></div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title"><Icon name="filter" size={15} />区段筛选</div><span className="tag tag-gray">{filtered.length} / {segments.length}</span></div>
        <div className="kmc-filter-grid">
          <label><span>催化剂</span><select value={catalystFilter} onChange={event => setCatalystFilter(event.target.value)}><option value="all">全部催化剂</option>{catalysts.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>温度</span><select value={temperatureFilter} onChange={event => setTemperatureFilter(event.target.value)}><option value="all">全部温度</option><option value="unreported">原表未标注</option>{temperatures.map(item => <option key={item} value={item}>{item} K</option>)}</select></label>
          <label><span>记录完整性</span><select value={qualityFilter} onChange={event => setQualityFilter(event.target.value)}><option value="all">全部</option><option value="complete">完整记录</option><option value="partial">部分记录</option></select></label>
        </div>
      </div>

      <div className="chart-grid-2 kmc-chart-grid">
        <div className="card"><div className="card-header"><div className="card-title"><Icon name="path" size={15} />总体速率随 KMC 步数演化</div><span className="tag tag-purple">最多叠加 10 段</span></div><div className="card-body"><EChart option={rateOption} style={{ height: 390 }} /></div></div>
        <div className="card"><div className="card-header"><div className="card-title"><Icon name="zap" size={15} />末端稳态速率</div><span className="tag tag-teal">对数坐标</span></div><div className="card-body"><EChart option={steadyOption} style={{ height: 390 }} /></div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title"><Icon name="database" size={15} />动力学区段</div><span className="tag tag-gray">点击行查看基元步骤</span></div>
        <div className="data-table-wrap"><table className="data-table selectable-table"><thead><tr><th>ID</th><th>催化剂</th><th>进料</th><th>温度</th><th className="num">采样点</th><th className="num">稳态速率 (s⁻¹)</th><th>完整性</th><th>原始位置</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} className={item.id === selectedId ? 'selected-row' : ''} onClick={() => setSelectedId(item.id)}><td className="mono">#{item.id}</td><td><strong>{item.catalyst}</strong></td><td>{item.feed || '原表未标注'}</td><td>{item.temperature_K ? `${item.temperature_K} K` : '原表未标注'}</td><td className="num mono">{item.curve_point_count || item.curve?.length || 0}</td><td className="num mono highlight">{kmcNumber(item.steady_state_rate)}</td><td><span className={`quality-badge ${item.quality}`}>{item.quality === 'complete' ? '完整' : '部分记录'}</span></td><td className="source-cell">{item.source?.sheet}<small>R{item.source?.start_row}–R{item.source?.end_row}</small></td></tr>)}</tbody></table></div>
      </div>

      {selected && <div className="card">
        <div className="card-header"><div className="card-title"><Icon name="settings" size={15} />#{selected.id} · {selected.catalyst} 基元步骤</div><span className="tag tag-primary">{selectedSteps.length} 个步骤</span></div>
        <div className="selected-segment-summary"><div><span>进料</span><strong>{selected.feed || '原表未标注'}</strong></div><div><span>温度</span><strong>{selected.temperature_K ? `${selected.temperature_K} K` : '原表未标注'}</strong></div><div><span>工作表</span><strong>{selected.source?.sheet}</strong></div><div><span>最终 KMC 步数</span><strong>{selected.curve?.[selected.curve.length - 1]?.steps?.toLocaleString() || '—'}</strong></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>基元步骤</th><th className="num">末端速率 (s⁻¹)</th><th className="num">累计事件数</th></tr></thead><tbody>{selectedSteps.map(item => <tr key={item.name}><td className="mono">{item.name}</td><td className="num mono">{kmcNumber(item.rate)}</td><td className="num mono">{item.count === undefined ? '—' : Number(item.count).toLocaleString()}</td></tr>)}</tbody></table></div>
      </div>}
    </div>
  );
}

Object.assign(window, { MicrodynamicsDB });
