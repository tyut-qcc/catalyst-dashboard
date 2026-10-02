// Data overview based only on uploaded Excel, SQLite and XYZ sources.
const { useEffect, useMemo, useState } = React;

function Dashboard({ reactions, onNavigate }) {
  const [allData, setAllData] = useState({});
  const [structures, setStructures] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      ...reactions.map(item => fetch(item.dataFile, { cache: 'no-store' }).then(response => response.json()).catch(() => null)),
      fetch('data/structures.json', { cache: 'no-store' }).then(response => response.json()).catch(() => null),
    ]).then(results => {
      if (!alive) return;
      const structureData = results.pop();
      setAllData(Object.fromEntries(reactions.map((item, index) => [item.id, results[index]])));
      setStructures(structureData);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [reactions]);

  const available = reactions.filter(item => item.isReal);
  const stats = useMemo(() => {
    const names = new Set();
    let featureDefinitions = 0; let featureValues = 0; let kmcSegments = 0;
    available.forEach(reaction => {
      const data = allData[reaction.id];
      (data?.catalysts || []).forEach(item => names.add(item.name));
      featureDefinitions += data?.stats?.feature_definitions || data?.dft_features?.length || 0;
      featureValues += data?.stats?.feature_values || 0;
      kmcSegments += data?.kmc_segments?.length || 0;
    });
    return { catalysts: names.size, featureDefinitions, featureValues, kmcSegments, structures: structures?.modelCount || 0 };
  }, [allData, structures, available]);

  const catalystOption = useMemo(() => {
    const rows = available.map(item => ({ name: item.label, value: allData[item.id]?.stats?.catalysts || 0 }));
    return {
      tooltip: { ...DEFAULT_TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 135, right: 42, top: 18, bottom: 28 },
      xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
      yAxis: { type: 'category', data: rows.map(item => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569' } },
      series: [{ type: 'bar', data: rows.map(item => item.value), barWidth: 18, itemStyle: { color: '#2563eb', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#475569', formatter: '{c} 种' } }],
    };
  }, [allData, available]);

  const groupOption = useMemo(() => {
    const groupNames = ['反应能量', '元素/基础属性', '结构特征', '电子结构', '过渡态虚频'];
    return {
      tooltip: { ...DEFAULT_TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 10 } },
      grid: { left: 62, right: 20, top: 16, bottom: 50 },
      xAxis: { type: 'category', data: groupNames, axisLabel: { color: '#64748b', fontSize: 10 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#cbd5e1' } } },
      yAxis: { type: 'value', name: '有效值', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
      series: available.map((reaction, index) => {
        const groups = allData[reaction.id]?.feature_groups || [];
        return { name: reaction.label, type: 'bar', stack: 'values', data: groupNames.map(name => groups.find(item => item.group === name)?.values || 0), itemStyle: { color: [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.purple][index] } };
      }),
    };
  }, [allData, available]);

  const structureOption = useMemo(() => {
    const rows = available.map(item => ({ name: item.label, value: structures?.reactions?.[item.id]?.modelCount || 0 }));
    return {
      tooltip: { ...DEFAULT_TOOLTIP, trigger: 'item', formatter: params => `${params.name}<br/>XYZ 模型: <b>${params.value}</b>` },
      legend: { bottom: 0, textStyle: { color: '#64748b', fontSize: 10 } },
      series: [{ type: 'pie', radius: ['43%', '70%'], center: ['50%', '44%'], data: rows, label: { formatter: '{b}\n{c}', fontSize: 10 }, itemStyle: { borderColor: '#fff', borderWidth: 2 }, color: [CHART_COLORS.primary, CHART_COLORS.teal, CHART_COLORS.amber] }],
    };
  }, [structures, available]);

  if (loading) return <div className="loading-page"><div className="skeleton skeleton-title"></div><div className="loading-grid">{[0, 1, 2, 3].map(item => <div className="skeleton skeleton-card" key={item}></div>)}</div></div>;

  return <div>
    <div className="page-header"><div className="page-header-top"><div><div className="page-header-title"><span className="accent-bar"></span>数据总览</div><div className="page-header-sub" style={{ marginTop: 6 }}>当前入库 CO Oxidation、NH₃-SCR、C₃H₆ Combustion 三类反应；统计均来自上传的 Excel、catalyst_features.sqlite 与 structures 目录。</div></div><span className="data-badge real"><Icon name="check" size={12} />3 类反应已入库</span></div></div>

    <div className="stat-grid">
      <div className="stat-card"><div className="stat-card-icon primary"><Icon name="atom" size={18} /></div><div className="stat-card-label">唯一催化剂体系</div><div className="stat-card-value">{stats.catalysts}<span className="unit">种</span></div><div className="stat-card-foot"><span>跨反应去重统计</span></div></div>
      <div className="stat-card"><div className="stat-card-icon teal"><Icon name="orbit" size={18} /></div><div className="stat-card-label">DFT 有效特征值</div><div className="stat-card-value">{stats.featureValues.toLocaleString()}<span className="unit">条</span></div><div className="stat-card-foot"><span>{stats.featureDefinitions.toLocaleString()} 项反应内特征定义</span></div></div>
      <div className="stat-card"><div className="stat-card-icon purple"><Icon name="path" size={18} /></div><div className="stat-card-label">KMC 动力学区段</div><div className="stat-card-value">{stats.kmcSegments}<span className="unit">段</span></div><div className="stat-card-foot"><span>保留完整与部分记录标记</span></div></div>
      <div className="stat-card"><div className="stat-card-icon amber"><Icon name="box" size={18} /></div><div className="stat-card-label">XYZ 结构模型</div><div className="stat-card-value">{stats.structures.toLocaleString()}<span className="unit">个</span></div><div className="stat-card-foot"><span>{structures?.folderCount || 0} 个实际目录</span></div></div>
    </div>

    <div className="chart-grid-2">
      <div className="card"><div className="card-header"><div className="card-title"><Icon name="atom" size={15} />各反应催化剂覆盖</div></div><div className="card-body"><EChart option={catalystOption} style={{ height: 300 }} /></div></div>
      <div className="card"><div className="card-header"><div className="card-title"><Icon name="layers" size={15} />DFT 特征值分组</div></div><div className="card-body"><EChart option={groupOption} style={{ height: 300 }} /></div></div>
    </div>

    <div className="dashboard-lower-grid">
      <div className="card"><div className="card-header"><div className="card-title"><Icon name="box" size={15} />XYZ 模型分布</div></div><div className="card-body"><EChart option={structureOption} style={{ height: 300 }} /></div></div>
      <div className="card source-register"><div className="card-header"><div className="card-title"><Icon name="database" size={15} />当前数据源</div></div><div className="source-register-list"><div><span>SQLite</span><strong>catalyst_features.sqlite</strong><small>201 个唯一催化剂 · 38,949 个特征值</small></div><div><span>DFT / KMC</span><strong>5 份 Excel 工作簿</strong><small>CO、NH₃-SCR、C₃H₆ 原始表格</small></div><div><span>Structure</span><strong>{stats.structures.toLocaleString()} 个 XYZ</strong><small>仅统计三个已入库反应目录</small></div></div></div>
    </div>

    <div className="section-heading"><div><h2>反应工作区</h2><p>已入库反应显示真实统计；其余反应仅保留开发状态入口。</p></div><span className="section-count">{available.length} available · {reactions.length - available.length} developing</span></div>
    <div className="reaction-workspace-grid">{reactions.map(reaction => {
      const data = allData[reaction.id]; const structureCount = structures?.reactions?.[reaction.id]?.modelCount || 0;
      return <button key={reaction.id} className={`reaction-workspace-card ${reaction.isReal ? '' : 'development'}`} onClick={() => onNavigate(reaction.id, null)}><div className="reaction-card-head"><span className={`nav-status-dot ${reaction.isReal ? 'real' : 'development'}`}></span><strong>{reaction.label}</strong><span>{reaction.isReal ? '已入库' : '开发中'}</span></div>{reaction.isReal ? <div className="reaction-card-stats"><span><b>{data?.stats?.catalysts || 0}</b> 催化剂</span><span><b>{(data?.stats?.feature_values || 0).toLocaleString()}</b> DFT 值</span><span><b>{data?.kmc_segments?.length || 0}</b> KMC 区段</span><span><b>{structureCount.toLocaleString()}</b> XYZ</span></div> : <p>相关内容开发中……</p>}<div className="reaction-card-link">进入工作区 <Icon name="arrow-right" size={13} /></div></button>;
    })}</div>
  </div>;
}

Object.assign(window, { Dashboard });
