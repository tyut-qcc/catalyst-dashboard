// QCC DB application shell - GitHub Pages friendly, backend ready.
const { useEffect, useMemo, useRef, useState } = React;

const REACTIONS_V2 = [
  { id: 'CO Oxidation', slug: 'co-oxidation', label: 'CO Oxidation', isReal: true, status: 'available', dataFile: 'data/co_oxidation.json' },
  { id: 'NH3-SCR', slug: 'nh3-scr', label: 'NH₃-SCR', isReal: true, status: 'available', dataFile: 'data/nh3_scr.json' },
  { id: 'C3H6 Combustion', slug: 'c3h6-combustion', label: 'C₃H₆ Combustion', isReal: true, status: 'available', dataFile: 'data/c3h6_combustion.json' },
  { id: 'Alkane Dehydrogenation', slug: 'alkane-dehydrogenation', label: 'Alkane Dehydrogenation', isReal: false, status: 'development', dataFile: 'data/alkane_dehydrogenation.json' },
  { id: 'CO2 Cycloaddition', slug: 'co2-cycloaddition', label: 'CO₂ Cycloaddition', isReal: false, status: 'development', dataFile: 'data/co2_cycloaddition.json' },
  { id: 'F-T Synthesis', slug: 'ft-synthesis', label: 'F-T Synthesis', isReal: false, status: 'development', dataFile: 'data/ft_synthesis.json' },
];

const DATABASE_LABELS = {
  dft: 'DFT Database',
  microkinetic: 'Microkinetic Database',
  structure: 'Structure Database',
  md: 'MD Database',
};

function readHashRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw || raw === 'dashboard') return { reaction: 'dashboard', database: null };
  const [prefix, reactionSlug, database] = raw.split('/');
  if (prefix !== 'reaction') return { reaction: 'dashboard', database: null };
  const reaction = REACTIONS_V2.find(item => item.slug === reactionSlug);
  const normalizedDatabase = database === 'microdynamics' ? 'microkinetic' : database;
  return {
    reaction: reaction?.id || 'dashboard',
    database: DATABASE_LABELS[normalizedDatabase] ? normalizedDatabase : null,
  };
}

function writeHashRoute(reactionId, database) {
  const reaction = REACTIONS_V2.find(item => item.id === reactionId);
  const next = reactionId === 'dashboard'
    ? '#/dashboard'
    : `#/reaction/${reaction?.slug}${database ? `/${database}` : ''}`;
  if (window.location.hash !== next) history.pushState(null, '', next);
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span className="toast-icon"><Icon name="check" size={15} /></span>
      <div><strong>{toast.title}</strong><span>{toast.message}</span></div>
      <button onClick={onClose} aria-label="关闭提示"><Icon name="close" size={14} /></button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-page">
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-copy"></div>
      <div className="loading-grid">
        {[0, 1, 2, 3].map(item => <div className="skeleton skeleton-card" key={item}></div>)}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon error"><Icon name="warning" size={24} /></span>
      <strong>数据加载失败</strong>
      <span>请确认通过本地服务器或 GitHub Pages 访问，直接打开 HTML 文件会阻止 JSON 请求。</span>
      <button className="button button-primary" onClick={onRetry}>重新加载</button>
    </div>
  );
}

function App() {
  const initialRoute = useMemo(readHashRoute, []);
  const [activeReaction, setActiveReaction] = useState(initialRoute.reaction);
  const [activeSub, setActiveSub] = useState(initialRoute.database);
  const [reactionData, setReactionData] = useState(null);
  const [allReactionData, setAllReactionData] = useState({});
  const [structuresData, setStructuresData] = useState(null);
  const [mdData, setMdData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionMode, setActionMode] = useState(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [session, setSession] = useState(() => QCC_API.auth.getSession());
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);

  const currentReaction = REACTIONS_V2.find(item => item.id === activeReaction);
  const drafts = useMemo(() => QCC_API.drafts.list(), [draftVersion]);
  const currentDraftCount = drafts.filter(item => item.reaction === activeReaction).length;

  const showToast = (title, message) => setToast({ title, message, id: Date.now() });

  useEffect(() => {
    const handleHash = () => {
      const route = readHashRoute();
      setActiveReaction(route.reaction);
      setActiveSub(route.database);
    };
    window.addEventListener('hashchange', handleHash);
    if (!window.location.hash) writeHashRoute('dashboard', null);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      QCC_API.loadJSON('data/structures.json'),
      QCC_API.loadJSON('data/md.json'),
      ...REACTIONS_V2.map(reaction => QCC_API.loadJSON(reaction.dataFile)),
    ]).then(([structures, md, ...reactionResults]) => {
      if (!alive) return;
      setStructuresData(structures);
      setMdData(md);
      setAllReactionData(Object.fromEntries(REACTIONS_V2.map((reaction, index) => [reaction.id, reactionResults[index]])));
    }).catch(error => console.warn('Some global datasets could not be loaded', error));
    return () => { alive = false; };
  }, [loadNonce]);

  useEffect(() => {
    if (activeReaction === 'dashboard') {
      setReactionData(null);
      setLoadError(false);
      return undefined;
    }
    const reaction = REACTIONS_V2.find(item => item.id === activeReaction);
    if (!reaction) return undefined;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    QCC_API.loadJSON(reaction.dataFile)
      .then(data => {
        if (!alive) return;
        setReactionData(data);
        setAllReactionData(current => ({ ...current, [reaction.id]: data }));
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [activeReaction, loadNonce]);

  const navigate = (reactionId, subId = null) => {
    setActiveReaction(reactionId);
    setActiveSub(subId);
    writeHashRoute(reactionId, subId);
    setSidebarOpen(false);
    setSearch('');
    setSearchOpen(false);
    document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    const results = [];
    REACTIONS_V2.forEach(reaction => {
      const data = allReactionData[reaction.id];
      if (!data) return;
      if (reaction.label.toLowerCase().includes(query) || reaction.id.toLowerCase().includes(query)) {
        results.push({ reaction, sub: null, title: reaction.label, meta: '反应工作区', type: 'reaction' });
      }
      (data.catalysts || []).forEach(catalyst => {
        if (catalyst.name?.toLowerCase().includes(query) || catalyst.dopant?.toLowerCase().includes(query)) {
          results.push({ reaction, sub: 'structure', title: catalyst.name, meta: `${catalyst.type || '催化剂'} · ${reaction.label}`, type: 'catalyst' });
        }
      });
      (data.dft_features || []).forEach(feature => {
        if (feature.feature?.toLowerCase().includes(query) || feature.group?.toLowerCase().includes(query)) {
          results.push({ reaction, sub: 'dft', title: feature.feature, meta: `${feature.group} · ${reaction.label}`, type: 'feature' });
        }
      });
      (data.kmc_segments || []).forEach(segment => {
        const haystack = `${segment.catalyst || ''} ${segment.feed || ''} ${segment.temperature_K || ''}`.toLowerCase();
        if (haystack.includes(query)) {
          results.push({ reaction, sub: 'microkinetic', title: segment.catalyst || 'KMC segment', meta: `${segment.temperature_K || '—'} K · ${segment.feed || 'KMC'} · ${reaction.label}`, type: 'kmc' });
        }
      });
    });
    return results.slice(0, 14);
  }, [search, allReactionData]);

  const exportContext = useMemo(() => {
    if (activeReaction === 'dashboard') {
      return {
        name: 'qcc-db-catalog',
        label: 'QCC DB 全站数据目录',
        description: `${Object.keys(allReactionData).length} 类反应及全局结构 / MD 元数据`,
        data: { reactions: allReactionData, structures: structuresData, md: mdData },
        rows: REACTIONS_V2.map(reaction => ({
          reaction: reaction.id,
          dataType: reaction.status,
          catalysts: allReactionData[reaction.id]?.catalysts?.length || 0,
          dftFeatures: allReactionData[reaction.id]?.dft_features?.length || 0,
          kmcSegments: allReactionData[reaction.id]?.kmc_segments?.length || 0,
        })),
      };
    }
    const baseName = `${currentReaction?.slug}-${activeSub || 'workspace'}`;
    if (activeSub === 'dft') {
      return { name: baseName, label: `${currentReaction.label} · DFT Database`, description: `${reactionData?.dft_features?.length || 0} 个特征`, data: reactionData?.dft_features || [], rows: reactionData?.dft_features || [] };
    }
    if (activeSub === 'microkinetic') {
      return { name: baseName, label: `${currentReaction.label} · Microkinetic Database`, description: `${reactionData?.kmc_segments?.length || 0} 个动力学片段`, data: reactionData?.kmc_segments || [], rows: reactionData?.kmc_segments || [] };
    }
    if (activeSub === 'structure') {
      return { name: baseName, label: `${currentReaction.label} · Structure Database`, description: `${reactionData?.catalysts?.length || 0} 个催化剂条目`, data: { catalysts: reactionData?.catalysts || [], structures: structuresData?.reactions?.[activeReaction] || null }, rows: reactionData?.catalysts || [] };
    }
    if (activeSub === 'md') {
      return { name: baseName, label: `${currentReaction.label} · MD Database`, description: `${mdData?.trajectories?.length || 0} 条共享轨迹`, data: mdData, rows: mdData?.trajectories || [] };
    }
    return { name: baseName, label: `${currentReaction?.label} · 反应工作区`, description: '反应数据概览', data: reactionData, rows: reactionData?.catalysts || [] };
  }, [activeReaction, activeSub, currentReaction, reactionData, allReactionData, structuresData, mdData]);

  const renderContent = () => {
    if (activeReaction === 'dashboard') return <Dashboard reactions={REACTIONS_V2} onNavigate={navigate} />;
    if (!currentReaction?.isReal) return <DevelopmentPanel title={`${currentReaction?.label}${activeSub ? ` · ${DATABASE_LABELS[activeSub]}` : ''}`} />;
    if (loading) return <LoadingState />;
    if (loadError || !reactionData) return <ErrorState onRetry={() => setLoadNonce(value => value + 1)} />;
    if (!activeSub) {
      return <ReactionOverview reaction={currentReaction} reactionData={reactionData} structuresData={structuresData} mdData={mdData} draftCount={currentDraftCount} onNavigate={navigate} />;
    }
    switch (activeSub) {
      case 'dft':
        return <DFTDatabase key={activeReaction} reactionData={reactionData} reactionLabel={currentReaction.label} />;
      case 'microkinetic':
        return <MicrodynamicsDB key={activeReaction} reactionData={reactionData} reactionLabel={currentReaction.label} />;
      case 'structure':
        return <StructureDB key={activeReaction} reactionData={reactionData} reactionLabel={currentReaction.label} reactionKey={activeReaction} structuresData={structuresData} />;
      case 'md':
        return <MDDB reactionLabel={currentReaction.label} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      <div className={`mobile-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <Sidebar
        reactions={REACTIONS_V2}
        activeReaction={activeReaction}
        activeSub={activeSub}
        onNavigate={navigate}
        onDashboard={() => navigate('dashboard', null)}
        mobileOpen={sidebarOpen}
        draftCount={drafts.length}
        onOpenDrafts={() => setActionMode('drafts')}
        onOpenApi={() => setActionMode('api')}
      />

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Icon name="menu" size={19} /></button>
          <div className="topbar-breadcrumb">
            <button onClick={() => navigate('dashboard', null)}>数据总览</button>
            {activeReaction !== 'dashboard' && (
              <>
                <Icon name="chevron-right" size={12} />
                <button className={!activeSub ? 'crumb-current' : ''} onClick={() => navigate(activeReaction, null)}>{currentReaction?.label}</button>
                {activeSub && <><Icon name="chevron-right" size={12} /><span className="crumb-current">{DATABASE_LABELS[activeSub]}</span></>}
              </>
            )}
          </div>

          <div className="topbar-search-wrap">
            <div className={`topbar-search ${searchOpen ? 'focused' : ''}`}>
              <Icon name="search" size={15} />
              <input ref={searchRef} type="search" value={search} onChange={event => { setSearch(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="搜索反应、催化剂、特征或 KMC 条件…" />
              <kbd>Ctrl K</kbd>
            </div>
            {searchOpen && search.trim().length >= 2 && (
              <div className="search-popover">
                <div className="search-popover-header">全局搜索 <span>{searchResults.length} 个结果</span></div>
                {searchResults.length ? searchResults.map((result, index) => (
                  <button key={`${result.reaction.id}-${result.sub}-${result.title}-${index}`} onClick={() => navigate(result.reaction.id, result.sub)}>
                    <span className={`search-result-icon ${result.type}`}><Icon name={result.type === 'feature' ? 'orbit' : result.type === 'kmc' ? 'path' : result.type === 'catalyst' ? 'atom' : 'flask'} size={14} /></span>
                    <span><strong>{result.title}</strong><small>{result.meta}</small></span>
                    <Icon name="arrow-right" size={13} />
                  </button>
                )) : <div className="search-empty">没有匹配内容，试试元素、催化剂或特征名称。</div>}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <button className="topbar-btn" onClick={() => setActionMode('new')} title="新增记录"><Icon name="plus" size={14} /><span>新增</span></button>
            <button className="topbar-btn" onClick={() => setActionMode('upload')} title="导入数据"><Icon name="upload" size={14} /><span>导入</span></button>
            <button className="topbar-btn icon-only" onClick={() => setActionMode('export')} title="导出当前数据"><Icon name="download" size={15} /></button>
            <button className="draft-button" onClick={() => setActionMode('drafts')} title="本地草稿"><Icon name="edit" size={14} /><span>{drafts.length}</span></button>
            <button className="user-button" onClick={() => setActionMode('login')} title="账户">
              {session ? <span className="user-avatar">{session.displayName.slice(0, 1).toUpperCase()}</span> : <Icon name="user" size={16} />}
              <span>{session?.displayName || '登录'}</span>
            </button>
          </div>
        </header>

        <main className="content-area" onClick={() => searchOpen && setSearchOpen(false)}>
          <div className="content-inner">{renderContent()}</div>
        </main>
      </div>

      <ActionCenter mode={actionMode} onClose={() => setActionMode(null)} reactions={REACTIONS_V2} activeReaction={activeReaction} activeSub={activeSub} session={session} onSessionChange={setSession} exportContext={exportContext} onDraftsChanged={() => setDraftVersion(value => value + 1)} onToast={showToast} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

Object.assign(window, { REACTIONS_V2, DATABASE_LABELS });
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
