// Reaction workspace backed by the real-data inventory.
function ReactionOverview({ reaction, reactionData, structuresData, onNavigate, draftCount = 0 }) {
  const stats = reactionData?.stats || {};
  const structureEntry = structuresData?.reactions?.[reaction.id] || null;
  const libraries = [
    { id: 'dft', title: 'DFT Database', description: '按催化剂、特征组和条件检索 SQLite 中的 DFT 特征值，并回溯至原始 Excel 行列。', icon: 'orbit', tone: 'primary', value: stats.feature_values || 0, unit: '个有效值', meta: `${stats.feature_definitions || 0} 项特征定义`, available: true },
    { id: 'microkinetic', title: 'Microkinetic Database', description: '浏览 KMC 配置步、总体速率、基元步骤速率、累计事件数和原始工作表位置。', icon: 'path', tone: 'purple', value: reactionData?.kmc_segments?.length || 0, unit: '个区段', meta: `${stats.kmc_complete || 0} 个完整记录`, available: Boolean(reactionData?.kmc_segments?.length) },
    { id: 'structure', title: 'Structure Database', description: '从 structures 目录按需读取 XYZ 坐标，并在网页中旋转、缩放和下载模型。', icon: 'box', tone: 'teal', value: structureEntry?.modelCount || 0, unit: '个 XYZ', meta: `${structureEntry?.catalysts?.length || 0} 个催化剂目录`, available: Boolean(structureEntry?.modelCount) },
    { id: 'md', title: 'MD Database', description: '分子动力学轨迹、系综、温度、帧数和结构演化。', icon: 'molecule', tone: 'amber', value: 0, unit: '条轨迹', meta: '相关内容开发中……', available: false },
  ];

  return <div>
    <section className="reaction-hero">
      <div className="reaction-hero-main"><div className="eyebrow">REACTION WORKSPACE</div><div className="reaction-hero-title-row"><h1>{reaction.label}</h1><span className="data-badge real"><Icon name="check" size={12} />真实数据已入库</span></div><p>DFT、Microkinetic 与 Structure 数据均来自本次提供的原始文件。页面保留来源信息和缺失状态，不对空值进行补齐。</p><div className="reaction-hero-actions"><button className="button button-primary" onClick={() => onNavigate(reaction.id, 'dft')}>浏览 DFT 数据 <Icon name="arrow-right" size={14} /></button><button className="button button-secondary" onClick={() => onNavigate(reaction.id, 'structure')}>查看三维结构</button></div></div>
      <div className="reaction-hero-stats"><div><strong>{stats.catalysts || 0}</strong><span>催化剂体系</span></div><div><strong>{(stats.feature_values || 0).toLocaleString()}</strong><span>DFT 有效值</span></div><div><strong>{reactionData?.kmc_segments?.length || 0}</strong><span>KMC 区段</span></div><div><strong>{structureEntry?.modelCount?.toLocaleString() || 0}</strong><span>XYZ 模型</span></div></div>
    </section>

    <div className="section-heading"><div><h2>选择数据库</h2><p>四类数据库共用当前反应上下文。</p></div><span className="section-count">{libraries.filter(item => item.available).length} available</span></div>
    <div className="database-card-grid">{libraries.map(library => <button key={library.id} className={`database-card ${library.available ? '' : 'development'}`} onClick={() => onNavigate(reaction.id, library.id)}><span className={`database-card-icon ${library.tone}`}><Icon name={library.icon} size={21} /></span><span className="database-card-copy"><span className="database-card-kicker">{library.title}</span><span className="database-card-description">{library.description}</span></span><span className="database-card-metric"><strong>{library.available ? library.value.toLocaleString() : '—'}</strong><span>{library.unit}</span></span><span className="database-card-footer"><span>{library.meta}</span><Icon name="arrow-right" size={15} /></span></button>)}</div>

    <div className="architecture-note"><div className="architecture-note-icon"><Icon name="layers" size={18} /></div><div><strong>后端接入边界已保留</strong><p>当前新增、导入和编辑先保存为本地草稿；后续可将现有接口层替换为用户鉴权、上传下载和 CRUD 服务。</p></div><span className={`backend-pill ${QCC_API.backendConnected ? 'connected' : ''}`}><span></span>{QCC_API.backendConnected ? 'API connected' : 'Static mode'}</span></div>
  </div>;
}

Object.assign(window, { ReactionOverview });
