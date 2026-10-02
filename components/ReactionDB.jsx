// Reaction Database page with search, filters, and pagination
const { useState, useMemo } = React;

function ReactionDB() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCatalyst, setFilterCatalyst] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    let data = [...REACTION_DATA];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.catalyst.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') {
      data = data.filter(r => r.name === filterType);
    }
    if (filterCatalyst !== 'all') {
      data = data.filter(r => r.catalyst === filterCatalyst);
    }
    // sort
    if (sortBy === 'id') {
      data.sort((a, b) => a.id.localeCompare(b.id));
    } else if (sortBy === 'temp') {
      data.sort((a, b) => b.temperature - a.temperature);
    } else if (sortBy === 'conv') {
      data.sort((a, b) => b.conversion - a.conversion);
    } else if (sortBy === 'sel') {
      data.sort((a, b) => b.selectivity - a.selectivity);
    }
    return data;
  }, [search, filterType, filterCatalyst, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetPage = () => setPage(1);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-dot"></span>
          碳基分子催化反应数据库
        </div>
        <div className="page-header-sub">
          收录烷烃脱氢、CO₂ 加氢/转化、甲烷活化、费托合成等碳基催化反应实验数据
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">反应类型:</span>
            <select
              className="filter-select"
              value={filterType}
              onChange={e => { setFilterType(e.target.value); resetPage(); }}
            >
              <option value="all">全部类型</option>
              {REACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">催化剂:</span>
            <select
              className="filter-select"
              value={filterCatalyst}
              onChange={e => { setFilterCatalyst(e.target.value); resetPage(); }}
            >
              <option value="all">全部体系</option>
              {CATALYST_SYSTEMS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">排序:</span>
            <select
              className="filter-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="id">按编号</option>
              <option value="temp">温度 (高→低)</option>
              <option value="conv">转化率 (高→低)</option>
              <option value="sel">选择性 (高→低)</option>
            </select>
          </div>
          <div className="filter-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="搜索反应、催化剂、文献..."
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>反应类型</th>
                <th>催化剂体系</th>
                <th className="num">温度 (°C)</th>
                <th className="num">压力 (MPa)</th>
                <th className="num">转化率 (%)</th>
                <th className="num">选择性 (%)</th>
                <th className="num">TOF (s⁻¹)</th>
                <th className="num">STY (g/g·h)</th>
                <th>文献来源</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ color: 'var(--carbon-400)' }}>{r.id}</td>
                  <td>
                    <span className={`tag ${
                      r.name.includes('脱氢') ? 'tag-bond' :
                      r.name.includes('CO₂') ? 'tag-catalyst' :
                      r.name.includes('甲烷') ? 'tag-energy' :
                      r.name.includes('费托') ? 'tag-reaction' : 'tag-success'
                    }`}>
                      {r.name}
                    </span>
                  </td>
                  <td>{r.catalyst}</td>
                  <td className="num mono">{r.temperature}</td>
                  <td className="num mono">{r.pressure}</td>
                  <td className="num mono highlight">{r.conversion}</td>
                  <td className="num mono">{r.selectivity}</td>
                  <td className="num mono">{r.tof}</td>
                  <td className="num mono">{r.sty}</td>
                  <td style={{ color: 'var(--carbon-400)', fontSize: '11px' }}>{r.reference}</td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--carbon-500)' }}>
                    没有找到匹配的反应数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div>
            共 <b style={{ color: 'var(--carbon-200)' }}>{filtered.length}</b> 条记录
            <span style={{ margin: '0 8px', color: 'var(--carbon-600)' }}>|</span>
            第 {currentPage} / {totalPages} 页
          </div>
          <div className="pagination">
            <button
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <Icon name="chevron-left" size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (currentPage <= 3) {
                p = i + 1;
              } else if (currentPage >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = currentPage - 2 + i;
              }
              return (
                <button
                  key={p}
                  className={`page-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <Icon name="chevron-right" size={14} />
            </button>
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

Object.assign(window, { ReactionDB });
