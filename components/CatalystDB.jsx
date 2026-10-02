// Catalyst Structure Database
const { useState, useMemo } = React;

function CatalystDB() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = ['全部类别', '单原子催化剂', '负载型金属', '金属氧化物', '分子筛', '碳化物'];

  const filtered = useMemo(() => {
    let data = [...CATALYST_DATA];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.composition.toLowerCase().includes(q) ||
        c.site.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.feature.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'all') {
      data = data.filter(c => c.category === filterCategory);
    }
    return data;
  }, [search, filterCategory]);

  const getCategoryTagClass = (cat) => {
    switch(cat) {
      case '单原子催化剂': return 'tag-catalyst';
      case '负载型金属': return 'tag-reaction';
      case '金属氧化物': return 'tag-bond';
      case '分子筛': return 'tag-energy';
      case '碳化物': return 'tag-warning';
      default: return 'tag-success';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <span className="accent-dot"></span>
          催化剂结构数据库
        </div>
        <div className="page-header-sub">
          分子筛负载单原子/团簇催化剂、金属氧化物催化剂等结构信息与表征数据
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">类别:</span>
            <select
              className="filter-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">全部类别</option>
              {categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="搜索催化剂名称、组成、活性位点..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>催化剂名称</th>
                <th>类别</th>
                <th>组成</th>
                <th>负载量</th>
                <th>活性位点</th>
                <th>表征手段</th>
                <th>结构特征</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="mono" style={{ color: 'var(--carbon-400)' }}>{c.id}</td>
                  <td style={{ color: 'var(--carbon-100)', fontWeight: 500 }}>{c.name}</td>
                  <td>
                    <span className={`tag ${getCategoryTagClass(c.category)}`}>
                      {c.category}
                    </span>
                  </td>
                  <td>{c.composition}</td>
                  <td className="mono">{c.loading}</td>
                  <td style={{ color: 'var(--catalyst-400)' }}>{c.site}</td>
                  <td style={{ fontSize: '11px', color: 'var(--carbon-300)' }}>{c.characterization}</td>
                  <td style={{ fontSize: '11.5px', color: 'var(--carbon-400)' }}>{c.feature}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--carbon-500)' }}>
                    没有找到匹配的催化剂
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div>共 <b style={{ color: 'var(--carbon-200)' }}>{filtered.length}</b> 条催化剂记录</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="topbar-btn">
              <Icon name="download" size={13} />
              导出 CSV
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

Object.assign(window, { CatalystDB });
