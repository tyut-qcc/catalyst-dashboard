// Two-level navigation: reaction workspace -> database.
const { useEffect: useSidebarEffect, useState: useSidebarState } = React;

const SUB_LIBRARIES = [
  { id: 'dft', label: 'DFT Database', shortLabel: 'DFT', icon: 'orbit' },
  { id: 'microkinetic', label: 'Microkinetic Database', shortLabel: 'Microkinetic', icon: 'path' },
  { id: 'structure', label: 'Structure Database', shortLabel: 'Structure', icon: 'box' },
  { id: 'md', label: 'MD Database', shortLabel: 'MD', icon: 'molecule' },
];

function reactionIcon(id) {
  if (id.includes('NH3')) return 'atom';
  if (id.includes('C3H6')) return 'flame';
  if (id.includes('Alkane')) return 'bond';
  if (id.includes('CO2')) return 'co2';
  if (id.includes('F-T')) return 'gear';
  return 'flask';
}

function DevelopmentPanel({ title, description = '该版块尚无可核验的真实数据。' }) {
  return (
    <div className="development-panel">
      <span className="development-panel-icon"><Icon name="settings" size={26} /></span>
      <div className="eyebrow">IN DEVELOPMENT</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <strong>相关内容开发中……</strong>
    </div>
  );
}

function Sidebar({ reactions, activeReaction, activeSub, onNavigate, onDashboard, mobileOpen, draftCount, onOpenDrafts, onOpenApi }) {
  const [expanded, setExpanded] = useSidebarState(activeReaction === 'dashboard' ? null : activeReaction);

  useSidebarEffect(() => {
    if (activeReaction !== 'dashboard') setExpanded(activeReaction);
  }, [activeReaction]);

  const selectReaction = (reactionId) => {
    setExpanded(current => current === reactionId && activeReaction === reactionId ? current : reactionId);
    onNavigate(reactionId, null);
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <button className="sidebar-logo" onClick={onDashboard} aria-label="返回数据总览">
        <span className="sidebar-logo-mark">
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <polygon points="20,4 34,12 34,28 20,36 6,28 6,12" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.9" />
            <circle cx="20" cy="4" r="3" fill="#2563eb" />
            <circle cx="34" cy="12" r="3" fill="#2563eb" opacity="0.72" />
            <circle cx="34" cy="28" r="3" fill="#2563eb" opacity="0.5" />
            <circle cx="20" cy="36" r="3" fill="#2563eb" opacity="0.36" />
            <circle cx="6" cy="28" r="3" fill="#2563eb" opacity="0.5" />
            <circle cx="6" cy="12" r="3" fill="#2563eb" opacity="0.72" />
            <circle cx="20" cy="20" r="4" fill="#f59e0b" />
          </svg>
        </span>
        <span className="sidebar-logo-text">
          <span className="sidebar-logo-title">QCC Database</span>
          <span className="sidebar-logo-sub">Catalysis Data Platform</span>
        </span>
      </button>

      <nav className="sidebar-nav" aria-label="主导航">
        <div className="nav-section">
          <div className="nav-section-title">Workspace</div>
          <button className={`nav-item ${activeReaction === 'dashboard' ? 'active' : ''}`} onClick={onDashboard}>
            <span className="nav-item-icon"><Icon name="dashboard" size={17} /></span>
            <span>数据总览</span>
          </button>
        </div>

        <div className="nav-section reaction-nav-section">
          <div className="nav-section-title">Reaction types <span>{reactions.length}</span></div>
          {reactions.map(reaction => {
            const isExpanded = expanded === reaction.id;
            const isActive = activeReaction === reaction.id;
            return (
              <div className="reaction-nav-group" key={reaction.id}>
                <button className={`nav-item reaction-item ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`} onClick={() => selectReaction(reaction.id)}>
                  <span className="nav-item-icon"><Icon name={reactionIcon(reaction.id)} size={17} /></span>
                  <span className="nav-item-label">{reaction.label}</span>
                  <span className={`nav-status-dot ${reaction.isReal ? 'real' : 'development'}`} title={reaction.isReal ? '真实数据已入库' : '相关内容开发中'}></span>
                  <span className="nav-item-arrow"><Icon name="chevron-right" size={12} /></span>
                </button>

                <div className={`nav-submenu ${isExpanded ? 'open' : ''}`}>
                  {SUB_LIBRARIES.map(library => (
                    <button
                      key={library.id}
                      className={`nav-sub-item ${isActive && activeSub === library.id ? 'active' : ''}`}
                      onClick={() => onNavigate(reaction.id, library.id)}
                    >
                      <span className="nav-sub-icon"><Icon name={library.icon} size={13} /></span>
                      <span>{library.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-tool" onClick={onOpenDrafts}>
          <span><Icon name="edit" size={15} /> 本地草稿</span>
          <b>{draftCount}</b>
        </button>
        <button className="sidebar-tool" onClick={onOpenApi}>
          <span><Icon name="database" size={15} /> Backend API</span>
          <i className={QCC_API.backendConnected ? 'connected' : ''}>{QCC_API.backendConnected ? '已连接' : '未连接'}</i>
        </button>
        <div className="sidebar-version">Static frontend · v3.0</div>
      </div>
    </aside>
  );
}

function Icon({ name, size = 16, color = 'currentColor' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'save': return <svg {...common}><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'database': return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></svg>;
    case 'edit': return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>;
    case 'shield': return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" /><path d="m9 12 2 2 4-5" /></svg>;
    case 'warning': return <svg {...common}><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></svg>;
    case 'flame': return <svg {...common}><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7z" /><path d="M8 15a4 4 0 0 0 8 0" /></svg>;
    case 'bond': return <svg {...common}><circle cx="6" cy="12" r="3" /><circle cx="18" cy="12" r="3" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="15" y2="14" /></svg>;
    case 'co2': return <svg {...common}><circle cx="5" cy="12" r="3" /><circle cx="19" cy="12" r="3" /><circle cx="12" cy="12" r="4" /><path d="M8 10v4M16 10v4" /></svg>;
    case 'check': return <svg {...common}><path d="m5 12 5 5L20 7" /></svg>;
    case 'filter': return <svg {...common}><path d="M3 5h18M6 12h12M10 19h4" /></svg>;
    case 'layers': return <svg {...common}><polygon points="12,2 22,7 12,12 2,7" /><polygon points="2,17 12,22 22,17" /><polyline points="2,12 12,17 22,12" /></svg>;
    case 'zap': return <svg {...common}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>;
    case 'box': return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.3 7 12 12 20.7 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>;
    case 'play': return <svg {...common}><polygon points="6,4 20,12 6,20" /></svg>;
    case 'dashboard': return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>;
    case 'flask': return <svg {...common}><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3M7.5 14h9" /></svg>;
    case 'atom': return <svg {...common}><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></svg>;
    case 'orbit': return <svg {...common}><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4" /><path d="M12 8v4l3 2" /></svg>;
    case 'brain': return <svg {...common}><path d="M9.5 3a3 3 0 0 0-3 3v.5a3 3 0 0 0-2 2.8 3 3 0 0 0 1.5 2.6A3 3 0 0 0 5 14.5 3 3 0 0 0 8 17.5v.5a2 2 0 0 0 2 2h1M14.5 3a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 2.8 3 3 0 0 1-1.5 2.6A3 3 0 0 1 19 14.5 3 3 0 0 1 16 17.5v.5a2 2 0 0 1-2 2h-1M12 8v8" /></svg>;
    case 'path': return <svg {...common}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="m7 7 4 9M17 7l-4 9" /></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'download': return <svg {...common}><path d="M12 4v12m-5-5 5 5 5-5M5 20h14" /></svg>;
    case 'upload': return <svg {...common}><path d="M12 16V4m-5 5 5-5 5 5M5 20h14" /></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case 'info': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>;
    case 'chevron-left': return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'chevron-right': return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
    case 'molecule': return <svg {...common}><circle cx="6" cy="8" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="12" cy="17" r="2.5" /><path d="m8 9 3 6m5-6-3 6M8.5 8h7" /></svg>;
    case 'gear': return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

Object.assign(window, { Sidebar, Icon, SUB_LIBRARIES, DevelopmentPanel });
