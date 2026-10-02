// XYZ-backed structure browser rendered with the same 3Dmol/WebGL approach as the reference Vue viewer.
const { useEffect, useMemo, useRef, useState } = React;

const ELEMENT_COLORS = {
  H: '#ffffff', He: '#d9ffff', Li: '#cc80ff', Be: '#c2ff00', B: '#ffb5b5',
  C: '#4b5563', N: '#3050f8', O: '#ff2d2d', F: '#90e050', Ne: '#b3e3f5',
  Na: '#ab5cf2', Mg: '#8aff00', Al: '#bfa6a6', Si: '#f0c8a0', P: '#ff8000',
  S: '#ffd92f', Cl: '#1ff01f', Ar: '#80d1e3', K: '#8f40d4', Ca: '#3dff00',
  Sc: '#e6e6e6', Ti: '#bfc2c7', V: '#a6a6ab', Cr: '#8a99c7', Mn: '#9c7ac7',
  Fe: '#e06633', Co: '#f090a0', Ni: '#50d050', Cu: '#c88033', Zn: '#7d80b0',
  Ga: '#c3b7b7', Ge: '#668f8f', As: '#bd80e3', Se: '#ffa100', Br: '#a62929',
  Kr: '#5cb8d1', Rb: '#702eb0', Sr: '#00ff00', Y: '#94ffff', Zr: '#94c7c7',
  Nb: '#73c2c9', Mo: '#54b5b5', Ru: '#248f8f', Rh: '#d8d8d8', Pd: '#d0d0d0',
  Ag: '#c0c0c0', Cd: '#ffd98f', In: '#a67573', Sn: '#668f8f', Sb: '#9e63b5',
  Te: '#d47a00', I: '#940094', Xe: '#429eb0', Cs: '#57178f', Ba: '#00c900',
  La: '#70d4ff', Ce: '#fff2a8', Ta: '#4da6ff', W: '#2194d6', Re: '#267dab',
  Os: '#266696', Ir: '#175487', Pt: '#d0d0e0', Au: '#ffd123', Hg: '#b8b8d0',
};

const ELEMENT_SYMBOLS = [
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
  'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
  'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
  'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
  'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm',
  'Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og',
];

function normalizeElement(value) {
  const cleaned = String(value || '').trim().replace(/[^A-Za-z]/g, '');
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  const exact = ELEMENT_SYMBOLS.find(symbol => symbol.toLowerCase() === lower);
  if (exact) return exact;
  return [...ELEMENT_SYMBOLS]
    .sort((first, second) => second.length - first.length)
    .find(symbol => lower.startsWith(symbol.toLowerCase())) || '';
}

function parseXYZNumber(value) {
  const normalized = String(value ?? '').trim().replace(/[dD]([+-]?\d+)$/, 'e$1');
  return normalized ? Number(normalized) : Number.NaN;
}

function parseXYZAtomLine(rawLine) {
  const parts = String(rawLine || '').trim().split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 4) return null;
  const maxElementIndex = Math.min(parts.length - 4, 3);
  for (let index = 0; index <= maxElementIndex; index += 1) {
    const element = normalizeElement(parts[index]);
    if (!element) continue;
    const coordinates = parts.slice(index + 1, index + 4).map(parseXYZNumber);
    if (coordinates.every(Number.isFinite)) {
      return { element, x: coordinates[0], y: coordinates[1], z: coordinates[2] };
    }
  }
  return null;
}

function parseXYZ(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const countMatch = String(lines[0] || '').trim().match(/^([+-]?\d+)$/);
  const declared = countMatch ? Number.parseInt(countMatch[1], 10) : null;
  const standard = Number.isInteger(declared) && declared > 0;
  const start = standard ? (parseXYZAtomLine(lines[1]) ? 1 : 2) : 0;
  const atoms = [];
  for (const line of lines.slice(start)) {
    const atom = parseXYZAtomLine(line);
    if (!atom) continue;
    atoms.push(atom);
    if (standard && atoms.length >= declared) break;
  }
  return {
    declared,
    comment: standard && start === 2 ? String(lines[1] || '').trim() : '',
    atoms,
    elements: [...new Set(atoms.map(atom => atom.element))].sort(),
  };
}

function atomToPdbLine(atom, serial) {
  const atomName = atom.element.padStart(4).slice(-4);
  const element = atom.element.toUpperCase().padStart(2).slice(-2);
  return [
    'HETATM', String(serial).padStart(5), ' ', atomName, ' ', 'XYZ', ' A', '   1', '    ',
    atom.x.toFixed(3).padStart(8), atom.y.toFixed(3).padStart(8), atom.z.toFixed(3).padStart(8),
    '  1.00  0.00          ', element,
  ].join('');
}

function atomsToPdb(atoms) {
  return `${atoms.map((atom, index) => atomToPdbLine(atom, index + 1)).join('\n')}\nEND\n`;
}

function applyViewerStyle(viewerModel, atoms, style) {
  if (!viewerModel) return;
  viewerModel.setStyle({}, {});
  atoms.forEach((atom, index) => {
    const color = ELEMENT_COLORS[atom.element] || '#b0b8c5';
    const serial = index + 1;
    if (style === 'sphere') {
      viewerModel.setStyle({ serial }, { sphere: { color, scale: 0.72 } });
    } else if (style === 'line') {
      viewerModel.setStyle({ serial }, { line: { color, linewidth: 2.2 } });
    } else {
      viewerModel.setStyle({ serial }, {
        stick: { color, radius: 0.17 },
        sphere: { color, scale: 0.29 },
      });
    }
  });
}

function XYZViewer({ model, name }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const viewerModelRef = useRef(null);
  const [style, setStyle] = useState('stick');
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    const library = window.$3Dmol;
    if (!host || !model?.atoms?.length) return undefined;
    if (!library?.createViewer) {
      setViewerError('3Dmol 渲染库未能加载，请刷新页面后重试。');
      return undefined;
    }

    setViewerError('');
    host.replaceChildren();
    const viewer = library.createViewer(host, {
      backgroundColor: '#0b1729',
      antialias: true,
      controlOptions: { trackball: true },
    });
    const viewerModel = viewer.addModel(atomsToPdb(model.atoms), 'pdb');
    if (!viewerModel) {
      setViewerError('当前 XYZ 文件无法生成三维模型。');
      return undefined;
    }

    viewerRef.current = viewer;
    viewerModelRef.current = viewerModel;
    applyViewerStyle(viewerModel, model.atoms, style);
    viewer.zoomTo();
    viewer.render();

    let animationFrame = null;
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        try { viewer.resize(); viewer.render(); } catch (error) { console.warn('3D viewer resize failed:', error); }
      });
    });
    resizeObserver?.observe(host);

    return () => {
      resizeObserver?.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      try { viewer.clear(); } catch (error) { console.warn('3D viewer cleanup failed:', error); }
      viewerRef.current = null;
      viewerModelRef.current = null;
      host.replaceChildren();
    };
  }, [model]);

  useEffect(() => {
    if (!viewerRef.current || !viewerModelRef.current || !model?.atoms?.length) return;
    applyViewerStyle(viewerModelRef.current, model.atoms, style);
    viewerRef.current.render();
  }, [style, model]);

  const resetView = () => {
    if (!viewerRef.current) return;
    viewerRef.current.zoomTo();
    viewerRef.current.render();
  };

  return <div className="xyz-viewer xyz-viewer-webgl">
    <div className="viewer-stage">
      <div ref={hostRef} className="xyz-webgl-canvas" role="img" aria-label={`${name} 三维结构`} />
      <div className="viewer-stage-glow" aria-hidden="true"></div>
      <div className="viewer-hud">
        <span><i className="viewer-live-dot"></i>WebGL 3D</span>
        <span>{model.atoms.length} atoms</span>
        <span>{model.elements.length} elements</span>
      </div>
      <div className="viewer-axis" aria-hidden="true"><i className="axis-x"></i><i className="axis-y"></i><i className="axis-z"></i><b>X</b><b>Y</b><b>Z</b></div>
      {viewerError && <div className="viewer-error"><Icon name="warning" size={18} />{viewerError}</div>}
    </div>
    <div className="viewer-toolbar">
      <div className="viewer-style-controls" aria-label="结构显示模式">
        <span className="viewer-toolbar-label">显示模式</span>
        <button className={style === 'stick' ? 'active' : ''} onClick={() => setStyle('stick')}>球棍</button>
        <button className={style === 'sphere' ? 'active' : ''} onClick={() => setStyle('sphere')}>空间填充</button>
        <button className={style === 'line' ? 'active' : ''} onClick={() => setStyle('line')}>线框</button>
      </div>
      <div className="viewer-action-controls">
        <button onClick={resetView}><Icon name="refresh" size={12} />重置视角</button>
        <span>拖动旋转 · 滚轮缩放 · 右键平移</span>
      </div>
    </div>
  </div>;
}

function encodePathSegments(relativePath) {
  return String(relativePath || '').split(/[\\/]+/).filter(Boolean).map(encodeURIComponent).join('/');
}

function structureFileUrl(path) {
  return encodePathSegments(path);
}

function StructureDB({ reactionLabel, reactionKey, structuresData }) {
  const entry = structuresData?.reactions?.[reactionKey] || null;
  const structures = entry?.structures || [];
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('all');
  const [catalyst, setCatalyst] = useState('all');
  const [selectedId, setSelectedId] = useState(structures[0]?.id || null);
  const [model, setModel] = useState(null);
  const [modelState, setModelState] = useState('idle');
  const [page, setPage] = useState(1);

  useEffect(() => { if (!selectedId && structures.length) setSelectedId(structures[0].id); }, [structures, selectedId]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return structures.filter(item => {
      if (family !== 'all' && item.family !== family) return false;
      if (catalyst !== 'all' && item.catalyst !== catalyst) return false;
      return !query || `${item.name} ${item.catalyst} ${item.pathway} ${item.elements.join(' ')}`.toLowerCase().includes(query);
    });
  }, [structures, search, family, catalyst]);
  useEffect(() => { setPage(1); }, [search, family, catalyst]);
  useEffect(() => { if (filtered.length && !filtered.some(item => item.id === selectedId)) setSelectedId(filtered[0].id); }, [filtered, selectedId]);
  const selected = structures.find(item => item.id === selectedId) || null;

  useEffect(() => {
    if (!selected?.path) return undefined;
    let alive = true;
    setModelState('loading');
    setModel(null);
    fetch(structureFileUrl(selected.path), { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`XYZ HTTP ${response.status}`);
        return response.text();
      })
      .then(text => {
        if (!alive) return;
        const parsed = parseXYZ(text);
        if (!parsed.atoms.length) throw new Error('XYZ 内容中没有可识别的原子坐标');
        setModel(parsed);
        setModelState('ready');
      })
      .catch(error => {
        console.error('XYZ model load failed:', error);
        if (alive) setModelState('error');
      });
    return () => { alive = false; };
  }, [selected]);

  if (!entry) return <DevelopmentPanel title={`${reactionLabel} · Structure Database`} />;
  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <div>
    <div className="page-header"><div className="page-header-top"><div><div className="page-header-title"><span className="accent-bar"></span>{reactionLabel} · Structure Database</div><div className="page-header-sub" style={{ marginTop: 6 }}>从 structures 目录按需读取 XYZ 坐标，并使用 WebGL 生成可旋转、缩放、平移和切换显示模式的三维结构。</div></div><span className="data-badge real"><Icon name="check" size={12} />{entry.modelCount.toLocaleString()} 个 XYZ 文件</span></div></div>

    <div className="structure-workbench">
      <div className="card structure-browser-panel">
        <div className="card-header"><div className="card-title"><Icon name="filter" size={15} />结构索引</div><span className="tag tag-gray">{filtered.length.toLocaleString()} 个模型</span></div>
        <div className="structure-filters"><div className="filter-search"><Icon name="search" size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索模型、催化剂、路径或元素" /></div><select value={family} onChange={event => setFamily(event.target.value)}><option value="all">全部类别</option>{entry.families.map(item => <option key={item} value={item}>{item}</option>)}</select><select value={catalyst} onChange={event => setCatalyst(event.target.value)}><option value="all">全部催化剂</option>{entry.catalysts.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="structure-list">{visible.map(item => <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(item.id)}><span className="structure-list-main"><strong>{item.name}</strong><small>{item.catalyst}{item.pathway ? ` · ${item.pathway}` : ''}</small></span><span className="structure-list-meta"><b>{item.atom_count ?? '—'}</b><small>atoms</small></span></button>)}</div>
        <div className="structure-pagination"><span>第 {page} / {totalPages} 页</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
      </div>

      <div className="card structure-viewer-card">
        <div className="card-header structure-viewer-header"><div><div className="card-title"><Icon name="box" size={15} />{selected?.name || '选择结构'}</div>{selected && <div className="structure-model-path" title={selected.path}>{selected.path}</div>}</div>{selected && <a className="topbar-btn" href={structureFileUrl(selected.path)} download><Icon name="download" size={13} />下载 XYZ</a>}</div>
        {modelState === 'loading' && <div className="structure-loading"><div className="structure-loader-orbit"><i></i><i></i><i></i></div><strong>正在构建三维结构</strong><span>读取坐标并计算原子连接关系…</span></div>}
        {modelState === 'error' && <div className="empty-state"><span className="empty-state-icon error"><Icon name="warning" size={22} /></span><strong>XYZ 文件读取失败</strong><span>{selected?.path}</span></div>}
        {modelState === 'ready' && model && <><XYZViewer model={model} name={selected.name} /><div className="structure-detail-strip"><div><span>催化剂</span><strong>{selected.catalyst}</strong></div><div><span>原子数</span><strong>{model.atoms.length}</strong></div><div><span>元素种类</span><strong>{model.elements.length}</strong></div><div><span>结构注释</span><strong title={model.comment || selected.path}>{model.comment || 'XYZ coordinate model'}</strong></div></div><div className="element-legend"><strong>元素图例</strong>{model.elements.map(element => <span key={element}><i style={{ background: ELEMENT_COLORS[element] || '#b0b8c5' }}></i>{element}</span>)}</div></>}
      </div>
    </div>
  </div>;
}

Object.assign(window, { StructureDB });
