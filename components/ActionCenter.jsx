// Reusable modal flows for local drafts and future API integration.
const { useEffect: useActionEffect, useMemo: useActionMemo, useState: useActionState } = React;

function Modal({ title, eyebrow, onClose, children, wide = false }) {
  useActionEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function DraftForm({ reactions, initialValue, activeReaction, activeSub, onSaved, onCancel }) {
  const [form, setForm] = useActionState(() => ({
    id: initialValue?.id || '',
    createdAt: initialValue?.createdAt,
    reaction: initialValue?.reaction || (activeReaction === 'dashboard' ? reactions[0].id : activeReaction),
    database: initialValue?.database || activeSub || 'dft',
    title: initialValue?.title || '',
    description: initialValue?.description || '',
    tags: Array.isArray(initialValue?.tags) ? initialValue.tags.join(', ') : (initialValue?.tags || ''),
    source: initialValue?.source || 'manual',
    file: initialValue?.file || null,
  }));

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const valid = form.title.trim() && form.reaction && form.database;

  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    const saved = QCC_API.drafts.save({
      ...form,
      tags: String(form.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    });
    onSaved(saved);
  };

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="static-mode-banner">
          <Icon name="info" size={15} />
          <span>当前保存为浏览器本地草稿，不会修改原始 JSON 文件。接入后端后可将此操作映射到 POST / PATCH 接口。</span>
        </div>

        <div className="form-grid two-columns">
          <label className="form-field">
            <span>反应类型</span>
            <select value={form.reaction} onChange={event => update('reaction', event.target.value)}>
              {reactions.map(reaction => <option key={reaction.id} value={reaction.id}>{reaction.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>数据库</span>
            <select value={form.database} onChange={event => update('database', event.target.value)}>
              {SUB_LIBRARIES.map(library => <option key={library.id} value={library.id}>{library.label}</option>)}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>记录名称 <em>*</em></span>
          <input
            autoFocus
            value={form.title}
            onChange={event => update('title', event.target.value)}
            placeholder="例如：Pt(111) CO adsorption energy"
          />
        </label>

        <label className="form-field">
          <span>说明</span>
          <textarea
            rows="4"
            value={form.description}
            onChange={event => update('description', event.target.value)}
            placeholder="补充计算方法、数据来源、单位或审核说明…"
          />
        </label>

        <label className="form-field">
          <span>标签</span>
          <input
            value={form.tags}
            onChange={event => update('tags', event.target.value)}
            placeholder="DFT, Pt, adsorption（用逗号分隔）"
          />
        </label>
      </div>
      <footer className="modal-footer">
        <button type="button" className="button button-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="button button-primary" disabled={!valid}>
          <Icon name="save" size={14} /> {form.id ? '保存修改' : '保存草稿'}
        </button>
      </footer>
    </form>
  );
}

function UploadForm({ reactions, activeReaction, activeSub, onSaved, onCancel }) {
  const [reaction, setReaction] = useActionState(activeReaction === 'dashboard' ? reactions[0].id : activeReaction);
  const [database, setDatabase] = useActionState(activeSub || 'dft');
  const [fileInfo, setFileInfo] = useActionState(null);
  const [parsing, setParsing] = useActionState(false);
  const [error, setError] = useActionState('');

  const inspectFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['json', 'csv', 'xyz', 'cif', 'traj', 'zip'].includes(extension)) {
        throw new Error('支持 JSON、CSV、XYZ、CIF、TRAJ 或 ZIP 文件');
      }
      let summary = '文件将在后端接入后上传并进行结构化校验';
      if (extension === 'json' || extension === 'csv') {
        const text = await file.text();
        if (extension === 'json') {
          const parsed = JSON.parse(text);
          const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed || {}).length;
          summary = `JSON 解析成功，检测到 ${count} 个顶层条目`;
        } else {
          const lines = text.split(/\r?\n/).filter(Boolean);
          summary = `CSV 解析成功，检测到约 ${Math.max(0, lines.length - 1)} 行数据`;
        }
      }
      setFileInfo({ name: file.name, size: file.size, type: file.type, extension, summary });
    } catch (fileError) {
      setFileInfo(null);
      setError(fileError.message || '文件解析失败');
    } finally {
      setParsing(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!fileInfo) return;
    const saved = QCC_API.drafts.save({
      reaction,
      database,
      title: fileInfo.name,
      description: fileInfo.summary,
      tags: ['import', fileInfo.extension],
      source: 'upload',
      file: fileInfo,
    });
    onSaved(saved);
  };

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="form-grid two-columns">
          <label className="form-field">
            <span>反应类型</span>
            <select value={reaction} onChange={event => setReaction(event.target.value)}>
              {reactions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>目标数据库</span>
            <select value={database} onChange={event => setDatabase(event.target.value)}>
              {SUB_LIBRARIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <label className={`drop-zone ${fileInfo ? 'has-file' : ''}`}>
          <input
            type="file"
            accept=".json,.csv,.xyz,.cif,.traj,.zip"
            onChange={event => inspectFile(event.target.files?.[0])}
          />
          <span className="drop-zone-icon"><Icon name={fileInfo ? 'check' : 'upload'} size={22} /></span>
          <strong>{fileInfo ? fileInfo.name : '选择待导入的数据文件'}</strong>
          <span>{fileInfo ? `${QCC_API.formatBytes(fileInfo.size)} · ${fileInfo.summary}` : 'JSON / CSV / XYZ / CIF / TRAJ / ZIP，建议单文件不超过 50 MB'}</span>
        </label>
        {parsing && <div className="inline-status">正在检查文件…</div>}
        {error && <div className="inline-error">{error}</div>}

        <div className="upload-checklist">
          <div><Icon name="check" size={13} /> 文件格式预检</div>
          <div><Icon name="check" size={13} /> 自动绑定当前反应与数据库</div>
          <div className="muted"><Icon name="clock" size={13} /> 服务端校验与权限审核待后端接入</div>
        </div>
      </div>
      <footer className="modal-footer">
        <button type="button" className="button button-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="button button-primary" disabled={!fileInfo || parsing}>
          保存为导入草稿
        </button>
      </footer>
    </form>
  );
}

function DraftList({ drafts, reactions, onEdit, onRemoved, onClose }) {
  const [pendingDelete, setPendingDelete] = useActionState(null);
  const reactionMap = useActionMemo(() => Object.fromEntries(reactions.map(item => [item.id, item.label])), [reactions]);
  const libraryMap = useActionMemo(() => Object.fromEntries(SUB_LIBRARIES.map(item => [item.id, item.label])), []);

  const remove = (id) => {
    QCC_API.drafts.remove(id);
    setPendingDelete(null);
    onRemoved();
  };

  return (
    <>
      <div className="modal-body draft-list-body">
        <div className="static-mode-banner">
          <Icon name="database" size={15} />
          <span>这些草稿仅保存在当前浏览器。正式后端建议增加 draft / pending / published / archived 状态与审核日志。</span>
        </div>
        {drafts.length === 0 ? (
          <div className="empty-state compact">
            <span className="empty-state-icon"><Icon name="edit" size={22} /></span>
            <strong>还没有本地草稿</strong>
            <span>通过“新增记录”或“导入数据”建立第一条草稿。</span>
          </div>
        ) : (
          <div className="draft-list">
            {drafts.map(draft => (
              <article className="draft-row" key={draft.id}>
                <div className={`draft-type-icon ${draft.source === 'upload' ? 'upload' : ''}`}>
                  <Icon name={draft.source === 'upload' ? 'upload' : 'edit'} size={16} />
                </div>
                <div className="draft-row-main">
                  <div className="draft-row-title">
                    <strong>{draft.title}</strong>
                    <span className="tag tag-amber">草稿</span>
                  </div>
                  <div className="draft-row-meta">
                    {reactionMap[draft.reaction] || draft.reaction} · {libraryMap[draft.database] || draft.database} · 更新于 {new Date(draft.updatedAt).toLocaleString('zh-CN')}
                  </div>
                  {draft.description && <p>{draft.description}</p>}
                </div>
                <div className="draft-row-actions">
                  <button className="text-button" onClick={() => onEdit(draft)}><Icon name="edit" size={13} /> 编辑</button>
                  {pendingDelete === draft.id ? (
                    <span className="delete-confirm">
                      <button onClick={() => remove(draft.id)}>确认删除</button>
                      <button onClick={() => setPendingDelete(null)}>取消</button>
                    </span>
                  ) : (
                    <button className="text-button danger" onClick={() => setPendingDelete(draft.id)}><Icon name="trash" size={13} /> 删除</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <footer className="modal-footer">
        <span className="modal-footer-note">共 {drafts.length} 条本地草稿</span>
        <button className="button button-secondary" onClick={onClose}>关闭</button>
      </footer>
    </>
  );
}

function LoginForm({ session, onSessionChange, onClose }) {
  const [displayName, setDisplayName] = useActionState(session?.displayName || 'Local Researcher');
  const [organization, setOrganization] = useActionState(session?.organization || 'Catalysis Lab');

  if (session) {
    return (
      <>
        <div className="modal-body">
          <div className="profile-card">
            <div className="user-avatar large">{session.displayName.slice(0, 1).toUpperCase()}</div>
            <div><strong>{session.displayName}</strong><span>{session.organization || '未填写机构'}</span></div>
            <span className="tag tag-teal">本地会话</span>
          </div>
          <div className="static-mode-banner">
            <Icon name="shield" size={15} />
            <span>当前没有真实账户系统、Token 或服务端权限。后端接入后应使用 HttpOnly Cookie 或短期访问令牌。</span>
          </div>
        </div>
        <footer className="modal-footer">
          <button className="button button-danger-ghost" onClick={() => { QCC_API.auth.logout(); onSessionChange(null); onClose(); }}>退出本地会话</button>
          <button className="button button-secondary" onClick={onClose}>关闭</button>
        </footer>
      </>
    );
  }

  const submit = (event) => {
    event.preventDefault();
    if (!displayName.trim()) return;
    onSessionChange(QCC_API.auth.enterLocalSession({ displayName, organization }));
    onClose();
  };

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="login-visual">
          <span><Icon name="shield" size={24} /></span>
          <div><strong>进入本地数据管理会话</strong><p>无需密码，不会向外部服务器发送任何信息。</p></div>
        </div>
        <label className="form-field">
          <span>显示名称 <em>*</em></span>
          <input value={displayName} onChange={event => setDisplayName(event.target.value)} />
        </label>
        <label className="form-field">
          <span>机构 / 课题组</span>
          <input value={organization} onChange={event => setOrganization(event.target.value)} />
        </label>
      </div>
      <footer className="modal-footer">
        <button type="button" className="button button-secondary" onClick={onClose}>取消</button>
        <button type="submit" className="button button-primary" disabled={!displayName.trim()}>进入本地会话</button>
      </footer>
    </form>
  );
}

function ExportPanel({ context, onClose, onExported }) {
  const [format, setFormat] = useActionState(context.rows?.length ? 'csv' : 'json');
  const canCSV = Array.isArray(context.rows) && context.rows.length > 0;
  const submit = () => {
    if (format === 'csv' && canCSV) QCC_API.downloadCSV(context.rows, context.name);
    else QCC_API.downloadJSON(context.data, context.name);
    onExported(format.toUpperCase());
    onClose();
  };
  return (
    <>
      <div className="modal-body">
        <div className="export-summary">
          <span className="export-summary-icon"><Icon name="download" size={20} /></span>
          <div><strong>{context.label}</strong><span>{context.description}</span></div>
        </div>
        <div className="choice-grid">
          <button className={`choice-card ${format === 'json' ? 'selected' : ''}`} onClick={() => setFormat('json')}>
            <strong>JSON</strong><span>保留完整嵌套结构，适合程序处理与备份。</span>
          </button>
          <button className={`choice-card ${format === 'csv' ? 'selected' : ''}`} disabled={!canCSV} onClick={() => setFormat('csv')}>
            <strong>CSV</strong><span>{canCSV ? '扁平表格格式，适合 Excel 与数据分析。' : '当前页面数据不适合扁平 CSV。'}</span>
          </button>
        </div>
        <div className="privacy-note"><Icon name="shield" size={14} /> 导出在浏览器本地生成，不会上传数据。</div>
      </div>
      <footer className="modal-footer">
        <button className="button button-secondary" onClick={onClose}>取消</button>
        <button className="button button-primary" onClick={submit}><Icon name="download" size={14} /> 下载 {format.toUpperCase()}</button>
      </footer>
    </>
  );
}

function ApiPanel({ onClose }) {
  const endpoints = [
    ['POST', '/auth/login', '登录并创建会话'],
    ['GET', '/reactions', '反应类型与数据库统计'],
    ['GET', '/reactions/:reaction/:database', '分页检索数据库记录'],
    ['POST', '/records', '新增记录或提交草稿'],
    ['PATCH', '/records/:id', '编辑记录与审核状态'],
    ['POST', '/uploads', '上传并校验数据文件'],
    ['GET', '/exports/:jobId', '下载异步导出结果'],
  ];
  return (
    <>
      <div className="modal-body">
        <div className="api-status-card">
          <span className={`backend-dot ${QCC_API.backendConnected ? 'connected' : ''}`}></span>
          <div><strong>{QCC_API.backendConnected ? 'Backend connected' : 'Static frontend mode'}</strong><span>{QCC_API.backendConnected ? QCC_API.baseUrl : '尚未配置 window.QCC_DB_API_BASE'}</span></div>
        </div>
        <div className="endpoint-list">
          {endpoints.map(([method, path, description]) => (
            <div className="endpoint-row" key={`${method}-${path}`}>
              <span className={`method-badge ${method.toLowerCase()}`}>{method}</span>
              <code>{path}</code>
              <span>{description}</span>
            </div>
          ))}
        </div>
        <div className="code-hint">
          <span>接入方式</span>
          <code>&lt;script&gt;window.QCC_DB_API_BASE = 'https://api.example.com';&lt;/script&gt;</code>
        </div>
      </div>
      <footer className="modal-footer">
        <span className="modal-footer-note">建议后端：FastAPI / Django / Node.js + PostgreSQL + 对象存储</span>
        <button className="button button-secondary" onClick={onClose}>关闭</button>
      </footer>
    </>
  );
}

function ActionCenter({ mode, onClose, reactions, activeReaction, activeSub, session, onSessionChange, exportContext, onDraftsChanged, onToast }) {
  const [editingDraft, setEditingDraft] = useActionState(null);
  const [draftsVersion, setDraftsVersion] = useActionState(0);
  const drafts = useActionMemo(() => QCC_API.drafts.list(), [draftsVersion, mode]);

  useActionEffect(() => setEditingDraft(null), [mode]);
  if (!mode) return null;

  const saved = (draft) => {
    setDraftsVersion(value => value + 1);
    onDraftsChanged();
    onToast(editingDraft ? '草稿已更新' : '草稿已保存', `${draft.title} · 仅保存在当前浏览器`);
    onClose();
  };

  if (mode === 'new' || (mode === 'drafts' && editingDraft)) {
    return (
      <Modal title={editingDraft ? '编辑本地草稿' : '新增数据记录'} eyebrow="DATA WORKFLOW" onClose={onClose}>
        <DraftForm
          reactions={reactions}
          initialValue={editingDraft}
          activeReaction={activeReaction}
          activeSub={activeSub}
          onSaved={saved}
          onCancel={editingDraft ? () => setEditingDraft(null) : onClose}
        />
      </Modal>
    );
  }

  if (mode === 'upload') {
    return (
      <Modal title="导入数据" eyebrow="IMPORT & VALIDATE" onClose={onClose}>
        <UploadForm reactions={reactions} activeReaction={activeReaction} activeSub={activeSub} onSaved={saved} onCancel={onClose} />
      </Modal>
    );
  }

  if (mode === 'drafts') {
    return (
      <Modal title="本地草稿与待提交数据" eyebrow="DRAFT WORKSPACE" onClose={onClose} wide>
        <DraftList drafts={drafts} reactions={reactions} onEdit={setEditingDraft} onRemoved={() => { setDraftsVersion(value => value + 1); onDraftsChanged(); }} onClose={onClose} />
      </Modal>
    );
  }

  if (mode === 'login') {
    return (
      <Modal title={session ? '账户与权限' : '登录 / 本地会话'} eyebrow="ACCOUNT" onClose={onClose}>
        <LoginForm session={session} onSessionChange={onSessionChange} onClose={onClose} />
      </Modal>
    );
  }

  if (mode === 'export') {
    return (
      <Modal title="导出当前数据" eyebrow="LOCAL EXPORT" onClose={onClose}>
        <ExportPanel context={exportContext} onClose={onClose} onExported={format => onToast('导出已开始', `${format} 文件正在由浏览器生成`)} />
      </Modal>
    );
  }

  if (mode === 'api') {
    return <Modal title="后端 API 接入建议" eyebrow="INTEGRATION CONTRACT" onClose={onClose} wide><ApiPanel onClose={onClose} /></Modal>;
  }

  return null;
}

Object.assign(window, { ActionCenter });
