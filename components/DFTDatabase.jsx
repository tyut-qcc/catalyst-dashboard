// DFT Database: catalyst-centred exploration of the SQLite feature store.
const { useEffect, useMemo, useState } = React;

function formatScientificValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'number') return String(value);
  const abs = Math.abs(value);
  if ((abs > 0 && abs < 0.001) || abs >= 10000) return value.toExponential(4);
  return Number(value.toFixed(5)).toString();
}

function DFTDatabase({ reactionData, reactionLabel }) {
  const features = reactionData?.dft_features || [];
  const catalysts = reactionData?.catalysts || [];
  const stats = reactionData?.stats || {};
  const groups = reactionData?.feature_groups || [];
  const conditions = reactionData?.conditions || [];
  const [featureSearch, setFeatureSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedCatalyst, setSelectedCatalyst] = useState(catalysts[0]?.name || '');
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [page, setPage] = useState(1);

  const catalystTypes = useMemo(() => Array.from(new Set(catalysts.map(item => item.type || '未分类'))), [catalysts]);
  const visibleCatalysts = useMemo(() => typeFilter === 'all' ? catalysts : catalysts.filter(item => (item.type || '未分类') === typeFilter), [catalysts, typeFilter]);

  useEffect(() => {
    if (!visibleCatalysts.some(item => item.name === selectedCatalyst)) setSelectedCatalyst(visibleCatalysts[0]?.name || '');
  }, [visibleCatalysts, selectedCatalyst]);

  const filteredFeatures = useMemo(() => {
    const query = featureSearch.trim().toLowerCase();
    return features.filter(item => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      if (conditionFilter !== 'all' && (item.condition || '未标注条件') !== conditionFilter) return false;
      return !query || `${item.feature} ${item.raw_header || ''} ${item.unit || ''}`.toLowerCase().includes(query);
    });
  }, [features, featureSearch, groupFilter, conditionFilter]);

  useEffect(() => {
    if (!filteredFeatures.some(item => item.id === selectedFeatureId)) {
      const preferred = filteredFeatures.find(item => item.group === '反应能量') || filteredFeatures[0];
      setSelectedFeatureId(preferred?.id || '');
    }
    setPage(1);
  }, [filteredFeatures, selectedFeatureId]);

  const selectedFeature = filteredFeatures.find(item => item.id === selectedFeatureId) || null;
  const catalystRows = useMemo(() => {
    if (!selectedCatalyst) return [];
    return filteredFeatures.filter(item => Object.prototype.hasOwnProperty.call(item.values || {}, selectedCatalyst)).map(item => ({
      id: item.id,
      feature: item.feature,
      group: item.group,
      condition: item.condition,
      temperature_K: item.temperature_K,
      value: item.values[selectedCatalyst],
      unit: item.unit,
      source: item.source,
      sourceRow: item.source_rows?.[selectedCatalyst],
    }));
  }, [filteredFeatures, selectedCatalyst]);

  const pageSize = 40;
  const totalPages = Math.max(1, Math.ceil(catalystRows.length / pageSize));
  const pagedRows = catalystRows.slice((page - 1) * pageSize, page * pageSize);

  const comparisonOption = useMemo(() => {
    if (!selectedFeature) return {};
    const allowed = new Set(visibleCatalysts.map(item => item.name));
    const values = Object.entries(selectedFeature.values || {}).filter(([name, value]) => allowed.has(name) && typeof value === 'number' && Number.isFinite(value)).map(([name, value]) => ({ name, value })).sort((a, b) => a.value - b.value).slice(0, 36);
    return {
      tooltip: { ...DEFAULT_TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => { const item = params[0]; return `<b>${item.name}</b><br/>${selectedFeature.feature}: ${formatScientificValue(item.value)} ${selectedFeature.unit || ''}`; } },
      grid: { left: 125, right: 30, top: 12, bottom: 30 },
      xAxis: { type: 'value', name: selectedFeature.unit || '数值', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: CHART_COLORS.gridLine, type: 'dashed' } } },
      yAxis: { type: 'category', data: values.map(item => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' } },
      series: [{ type: 'bar', data: values.map(item => item.value), barMaxWidth: 11, itemStyle: { color: '#2563eb', borderRadius: [0, 3, 3, 0] } }],
    };
  }, [selectedFeature, visibleCatalysts]);

  const selectedCatalystMeta = catalysts.find(item => item.name === selectedCatalyst);
  const sourceFiles = reactionData?.sources?.dft_excel || [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-top">
          <div><div className="page-header-title"><span className="accent-bar"></span>{reactionLabel} · DFT Database</div><div className="page-header-sub" style={{ marginTop: 6 }}>以催化剂为主索引浏览结构、电子、元素属性、反应能量与过渡态虚频；每个数值均保留原始表头和 Excel 行列来源。</div></div>
          <span className="data-badge real"><Icon name="check" size={12} />SQLite + 原始 Excel</span>
        </div>
      </div>

      <div className="stat-grid dft-stat-grid">
        <div className="stat-card"><div className="stat-card-label">催化剂体系</div><div className="stat-card-value">{stats.catalysts || catalysts.length}<span className="unit">种</span></div><div className="stat-card-foot"><span>{catalystTypes.join(' / ')}</span></div></div>
        <div className="stat-card"><div className="stat-card-label">特征定义</div><div className="stat-card-value">{(stats.feature_definitions || features.length).toLocaleString()}<span className="unit">项</span></div><div className="stat-card-foot"><span>{stats.feature_groups || groups.length} 个特征组</span></div></div>
        <div className="stat-card"><div className="stat-card-label">有效特征值</div><div className="stat-card-value">{(stats.feature_values || 0).toLocaleString()}<span className="unit">条</span></div><div className="stat-card-foot"><span>缺失值不做补齐或推断</span></div></div>
        <div className="stat-card"><div className="stat-card-label">条件标签</div><div className="stat-card-value">{stats.conditions || conditions.length}<span className="unit">组</span></div><div className="stat-card-foot"><span>{stats.temperatures || 0} 个明确温度</span></div></div>
      </div>

      <div className="group-summary-grid">{groups.map(item => <button key={item.group} className={`group-summary-card ${groupFilter === item.group ? 'active' : ''}`} onClick={() => setGroupFilter(groupFilter === item.group ? 'all' : item.group)}><span>{item.group}</span><strong>{item.features.toLocaleString()}</strong><small>{item.values.toLocaleString()} 个有效值</small></button>)}</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title"><Icon name="filter" size={15} />数据筛选</div><span className="tag tag-gray">{filteredFeatures.length} 项特征</span></div>
        <div className="dft-filter-grid">
          <label><span>催化剂类型</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">全部类型</option>{catalystTypes.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>催化剂</span><select value={selectedCatalyst} onChange={event => { setSelectedCatalyst(event.target.value); setPage(1); }}>{visibleCatalysts.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          <label><span>特征组</span><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="all">全部分组</option>{groups.map(item => <option key={item.group} value={item.group}>{item.group}</option>)}</select></label>
          <label><span>条件</span><select value={conditionFilter} onChange={event => setConditionFilter(event.target.value)}><option value="all">全部条件</option><option value="未标注条件">未标注条件</option>{conditions.map(item => <option key={item} value={item}>{item.replace(/\n/g, ' ')}</option>)}</select></label>
          <label className="wide"><span>搜索特征</span><div className="filter-search"><Icon name="search" size={14} /><input value={featureSearch} onChange={event => setFeatureSearch(event.target.value)} placeholder="输入吸附能、键长、Bader、电离能等关键词" /></div></label>
        </div>
      </div>

      <div className="chart-grid-2 dft-explorer-grid">
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="orbit" size={15} />跨催化剂特征对比</div><span className="tag tag-primary">最多显示 36 个数值</span></div>
          <div className="feature-picker"><select value={selectedFeatureId} onChange={event => setSelectedFeatureId(event.target.value)}>{filteredFeatures.map(item => <option key={item.id} value={item.id}>{item.feature}{item.condition ? ` · ${item.condition.replace(/\n/g, ' ')}` : ''}</option>)}</select>{selectedFeature && <div className="feature-provenance"><span>{selectedFeature.group}</span><span>{selectedFeature.unit || '单位未标注'}</span><span>{Object.keys(selectedFeature.values || {}).length} 个催化剂有值</span></div>}</div>
          <div className="card-body"><EChart option={comparisonOption} style={{ height: 420 }} /></div>
        </div>
        <div className="card catalyst-detail-card">
          <div className="card-header"><div className="card-title"><Icon name="atom" size={15} />当前催化剂</div><span className="tag tag-teal">{catalystRows.length} 个匹配值</span></div>
          <div className="selected-catalyst-profile"><div className="atom-badge">{selectedCatalystMeta?.dopant || 'Ce'}</div><div><strong>{selectedCatalyst || '未选择'}</strong><span>{selectedCatalystMeta?.type || '未分类'} · 数据库 ID {selectedCatalystMeta?.db_id || '—'}</span></div></div>
          <dl className="catalyst-meta-list"><div><dt>总特征值</dt><dd>{selectedCatalystMeta?.feature_count?.toLocaleString() || 0}</dd></div><div><dt>基态能量</dt><dd title={selectedCatalystMeta?.metadata_status === 'name_mismatch' ? 'SQLite 中该记录的名称元数据不一致，暂不展示能量' : ''}>{selectedCatalystMeta?.metadata_status === 'name_mismatch' ? '待核对' : formatScientificValue(selectedCatalystMeta?.energy)}</dd></div><div><dt>掺杂元素</dt><dd>{selectedCatalystMeta?.dopant || '—'}</dd></div></dl>
          <div className="source-note"><Icon name="database" size={15} /><span>DFT 来源：{sourceFiles.join('、')}；数值索引来自 catalyst_features.sqlite。</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title"><Icon name="layers" size={15} />{selectedCatalyst} · 特征明细</div><button className="topbar-btn" onClick={() => QCC_API.downloadCSV(catalystRows, `${reactionLabel}-${selectedCatalyst}-dft`)}><Icon name="download" size={13} />导出当前结果</button></div>
        <div className="data-table-wrap"><table className="data-table dft-detail-table"><thead><tr><th>特征名称</th><th>分组</th><th>条件</th><th className="num">数值</th><th>单位</th><th>原始位置</th></tr></thead><tbody>{pagedRows.map(row => <tr key={row.id}><td className="feature-name-cell"><strong>{row.feature}</strong>{row.temperature_K !== null && row.temperature_K !== undefined && <small>{row.temperature_K} K</small>}</td><td><span className="tag tag-primary">{row.group}</span></td><td>{row.condition?.replace(/\n/g, ' ') || '—'}</td><td className="num mono highlight">{formatScientificValue(row.value)}</td><td>{row.unit || '—'}</td><td className="source-cell">{row.source?.file || '—'}<small>{row.source?.sheet ? `${row.source.sheet} · R${row.sourceRow || '?'}C${row.source?.column || '?'}` : ''}</small></td></tr>)}</tbody></table></div>
        <div className="table-footer"><span>第 {page} / {totalPages} 页 · 共 {catalystRows.length} 条</span><div className="pagination"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
      </div>
    </div>
  );
}

Object.assign(window, { DFTDatabase });
