// XYZ-backed structure browser with a dependency-free interactive ball-and-stick viewer.
const { useEffect, useMemo, useRef, useState } = React;

const ELEMENT_COLORS = {
  H: '#f8fafc', C: '#334155', N: '#2563eb', O: '#ef4444', Ce: '#f59e0b',
  Pt: '#94a3b8', Pd: '#8b5cf6', Cu: '#f97316', Fe: '#b45309', Co: '#7c3aed',
  Ni: '#16a34a', Mn: '#db2777', Cr: '#0f766e', Rh: '#ec4899', Ru: '#06b6d4',
  Ti: '#64748b', V: '#22c55e', Zr: '#38bdf8', Mo: '#0891b2', W: '#475569',
  Re: '#6366f1', Ta: '#4f46e5', Nb: '#0ea5e9', Ir: '#a855f7', Os: '#0284c7',
  Au: '#eab308', Ag: '#cbd5e1', Sn: '#64748b', Y: '#84cc16', Sc: '#a3e635', Ge: '#14b8a6',
};

const COVALENT_RADII = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, Ce: 2.04, Pt: 1.36, Pd: 1.39,
  Cu: 1.32, Fe: 1.32, Co: 1.26, Ni: 1.24, Mn: 1.39, Cr: 1.39, Rh: 1.42,
  Ru: 1.46, Ti: 1.60, V: 1.53, Zr: 1.75, Mo: 1.54, W: 1.62, Re: 1.51,
  Ta: 1.70, Nb: 1.64, Ir: 1.41, Os: 1.44, Au: 1.36, Ag: 1.45, Sn: 1.39,
  Y: 1.90, Sc: 1.70, Ge: 1.20,
};

function parseXYZ(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const declared = Number.parseInt(lines[0], 10);
  const atoms = [];
  for (const line of lines.slice(2)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4 || !/^[A-Z][a-z]?$/.test(parts[0])) continue;
    const coordinates = parts.slice(1, 4).map(Number);
    if (coordinates.some(value => !Number.isFinite(value))) continue;
    atoms.push({ element: parts[0], x: coordinates[0], y: coordinates[1], z: coordinates[2] });
  }
  return { declared, comment: lines[1]?.trim() || '', atoms };
}

function XYZViewer({ model, name }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const [rotation, setRotation] = useState({ x: -0.55, y: 0.65 });
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 760, height: 520 });

  const geometry = useMemo(() => {
    const atoms = model?.atoms || [];
    if (!atoms.length) return { atoms: [], bonds: [], span: 1 };
    const center = atoms.reduce((acc, atom) => ({ x: acc.x + atom.x, y: acc.y + atom.y, z: acc.z + atom.z }), { x: 0, y: 0, z: 0 });
    center.x /= atoms.length; center.y /= atoms.length; center.z /= atoms.length;
    const centered = atoms.map(atom => ({ ...atom, x: atom.x - center.x, y: atom.y - center.y, z: atom.z - center.z }));
    let span = 1;
    centered.forEach(atom => { span = Math.max(span, Math.abs(atom.x), Math.abs(atom.y), Math.abs(atom.z)); });
    const bonds = [];
    for (let a = 0; a < centered.length; a += 1) {
      for (let b = a + 1; b < centered.length; b += 1) {
        const first = centered[a]; const second = centered[b];
        const dx = first.x - second.x; const dy = first.y - second.y; const dz = first.z - second.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const threshold = ((COVALENT_RADII[first.element] || 1.25) + (COVALENT_RADII[second.element] || 1.25)) * 1.18;
        if (distance > 0.35 && distance <= threshold) bonds.push([a, b]);
      }
    }
    return { atoms: centered, bonds, span };
  }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setCanvasSize({ width: Math.max(320, rect.width), height: Math.max(360, rect.height) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geometry.atoms.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvasSize.width * dpr);
    canvas.height = Math.round(canvasSize.height * dpr);
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    const gradient = context.createRadialGradient(canvasSize.width * 0.5, canvasSize.height * 0.42, 20, canvasSize.width * 0.5, canvasSize.height * 0.5, canvasSize.width * 0.65);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#edf3fb');
    context.fillStyle = gradient; context.fillRect(0, 0, canvasSize.width, canvasSize.height);
    const cosX = Math.cos(rotation.x); const sinX = Math.sin(rotation.x); const cosY = Math.cos(rotation.y); const sinY = Math.sin(rotation.y);
    const scale = Math.min(canvasSize.width, canvasSize.height) / (geometry.span * 2.65) * zoom;
    const projected = geometry.atoms.map((atom, index) => {
      const x1 = atom.x * cosY + atom.z * sinY;
      const z1 = -atom.x * sinY + atom.z * cosY;
      const y2 = atom.y * cosX - z1 * sinX;
      const z2 = atom.y * sinX + z1 * cosX;
      const perspective = 1 + z2 / (geometry.span * 9);
      return { ...atom, index, depth: z2, px: canvasSize.width / 2 + x1 * scale * perspective, py: canvasSize.height / 2 - y2 * scale * perspective, perspective };
    });
    const byIndex = Object.fromEntries(projected.map(atom => [atom.index, atom]));
    geometry.bonds.map(pair => ({ pair, depth: (byIndex[pair[0]].depth + byIndex[pair[1]].depth) / 2 })).sort((a, b) => a.depth - b.depth).forEach(({ pair }) => {
      const first = byIndex[pair[0]]; const second = byIndex[pair[1]];
      context.beginPath(); context.moveTo(first.px, first.py); context.lineTo(second.px, second.py);
      context.strokeStyle = 'rgba(100,116,139,.48)'; context.lineWidth = Math.max(1, 2.2 * ((first.perspective + second.perspective) / 2)); context.stroke();
    });
    projected.sort((a, b) => a.depth - b.depth).forEach(atom => {
      const baseRadius = atom.element === 'H' ? 3.2 : atom.element === 'O' ? 5.2 : atom.element === 'Ce' ? 8.2 : 6.5;
      const radius = Math.max(2.5, baseRadius * atom.perspective * Math.min(1.35, zoom));
      const atomGradient = context.createRadialGradient(atom.px - radius * .35, atom.py - radius * .35, radius * .1, atom.px, atom.py, radius);
      atomGradient.addColorStop(0, '#ffffff'); atomGradient.addColorStop(.22, ELEMENT_COLORS[atom.element] || '#64748b'); atomGradient.addColorStop(1, '#1e293b');
      context.beginPath(); context.arc(atom.px, atom.py, radius, 0, Math.PI * 2); context.fillStyle = atomGradient; context.fill(); context.strokeStyle = 'rgba(15,23,42,.18)'; context.lineWidth = 1; context.stroke();
    });
  }, [geometry, rotation, zoom, canvasSize]);

  const pointerDown = event => { pointerRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); };
  const pointerMove = event => {
    if (!pointerRef.current) return;
    const dx = event.clientX - pointerRef.current.x; const dy = event.clientY - pointerRef.current.y;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setRotation(current => ({ x: current.x + dy * 0.008, y: current.y + dx * 0.008 }));
  };

  return <div className="xyz-viewer"><canvas ref={canvasRef} aria-label={`${name} 三维结构`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { pointerRef.current = null; }} onPointerCancel={() => { pointerRef.current = null; }} onWheel={event => { event.preventDefault(); setZoom(value => Math.max(.45, Math.min(2.6, value * (event.deltaY > 0 ? .9 : 1.1)))); }} /><div className="viewer-toolbar"><button onClick={() => setZoom(value => Math.min(2.6, value * 1.15))}>放大</button><button onClick={() => setZoom(value => Math.max(.45, value / 1.15))}>缩小</button><button onClick={() => { setRotation({ x: -0.55, y: 0.65 }); setZoom(1); }}>重置视角</button><span>拖动旋转 · 滚轮缩放</span></div></div>;
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
    let alive = true; setModelState('loading'); setModel(null);
    fetch(encodeURI(selected.path)).then(response => { if (!response.ok) throw new Error('XYZ load failed'); return response.text(); }).then(text => { if (alive) { setModel(parseXYZ(text)); setModelState('ready'); } }).catch(() => { if (alive) setModelState('error'); });
    return () => { alive = false; };
  }, [selected]);

  if (!entry) return <DevelopmentPanel title={`${reactionLabel} · Structure Database`} />;
  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <div>
    <div className="page-header"><div className="page-header-top"><div><div className="page-header-title"><span className="accent-bar"></span>{reactionLabel} · Structure Database</div><div className="page-header-sub" style={{ marginTop: 6 }}>直接索引 structures 目录中的 XYZ 坐标；选择模型后按需读取文件，并在浏览器中生成可旋转、缩放的球棍结构。</div></div><span className="data-badge real"><Icon name="check" size={12} />{entry.modelCount.toLocaleString()} 个 XYZ 文件</span></div></div>

    <div className="structure-workbench">
      <div className="card structure-browser-panel">
        <div className="card-header"><div className="card-title"><Icon name="filter" size={15} />结构索引</div><span className="tag tag-gray">{filtered.length.toLocaleString()} 个模型</span></div>
        <div className="structure-filters"><div className="filter-search"><Icon name="search" size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索模型、催化剂、路径或元素" /></div><select value={family} onChange={event => setFamily(event.target.value)}><option value="all">全部类别</option>{entry.families.map(item => <option key={item} value={item}>{item}</option>)}</select><select value={catalyst} onChange={event => setCatalyst(event.target.value)}><option value="all">全部催化剂</option>{entry.catalysts.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="structure-list">{visible.map(item => <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(item.id)}><span className="structure-list-main"><strong>{item.name}</strong><small>{item.catalyst}{item.pathway ? ` · ${item.pathway}` : ''}</small></span><span className="structure-list-meta"><b>{item.atom_count ?? '—'}</b><small>atoms</small></span></button>)}</div>
        <div className="structure-pagination"><span>第 {page} / {totalPages} 页</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
      </div>

      <div className="card structure-viewer-card">
        <div className="card-header"><div className="card-title"><Icon name="box" size={15} />{selected?.name || '选择结构'}</div>{selected && <a className="topbar-btn" href={encodeURI(selected.path)} download><Icon name="download" size={13} />下载 XYZ</a>}</div>
        {modelState === 'loading' && <div className="structure-loading"><div className="skeleton skeleton-card"></div><span>正在读取 XYZ 坐标…</span></div>}
        {modelState === 'error' && <div className="empty-state"><span className="empty-state-icon error"><Icon name="warning" size={22} /></span><strong>XYZ 文件读取失败</strong><span>{selected?.path}</span></div>}
        {modelState === 'ready' && model && <><XYZViewer model={model} name={selected.name} /><div className="structure-detail-strip"><div><span>催化剂</span><strong>{selected.catalyst}</strong></div><div><span>原子数</span><strong>{model.atoms.length}</strong></div><div><span>元素</span><strong>{selected.elements.join(' / ')}</strong></div><div><span>坐标文件</span><strong title={selected.path}>{selected.path}</strong></div></div><div className="element-legend">{selected.elements.map(element => <span key={element}><i style={{ background: ELEMENT_COLORS[element] || '#64748b' }}></i>{element}</span>)}</div></>}
      </div>
    </div>
  </div>;
}

Object.assign(window, { StructureDB });
