#!/usr/bin/env python3
"""Start the local SQLite write API and the Vite dashboard together."""
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / 'catalyst_platform.sqlite'
PORT = 8765
LOCK = threading.Lock()
GROUPS = {'元素/基础属性', '反应能量', '电子结构', '结构特征', '过渡态虚频'}


def run_script(name):
    subprocess.run([sys.executable, str(ROOT / 'scripts' / name)], cwd=ROOT, check=True)


def regenerate():
    run_script('export-sqlite.py')


def validate(data, con, old=None):
    if not isinstance(data, dict):
        raise ValueError('提交的数据格式有误')
    cid = data.get('catalyst_id', old['catalyst_id'] if old else None)
    rid = data.get('reaction_id', old['reaction_id'] if old else None)
    if old and (cid != old['catalyst_id'] or rid != old['reaction_id']):
        raise ValueError('记录所属催化剂和反应不能在编辑时更改')
    if rid is None:
        if not old or old['reaction_id'] is not None:
            raise ValueError('新增记录必须指定反应')
    elif con.execute('SELECT 1 FROM catalyst_reactions WHERE catalyst_id=? AND reaction_id=?', (cid, rid)).fetchone() is None:
        raise ValueError('请选择属于当前反应的催化剂')
    group = str(data.get('feature_group', old['feature_group'] if old else '')).strip()
    name = str(data.get('feature_name', old['feature_name'] if old else '')).strip()
    if group not in GROUPS or not name or len(name) > 500:
        raise ValueError('请选择有效类别并填写指标名称')
    value_num = data.get('value_num', old['value_num'] if old else None)
    value_text = data.get('value_text', old['value_text'] if old else None)
    if value_num in ('', None):
        value_num = None
    else:
        value_num = float(value_num)
        if not math.isfinite(value_num):
            raise ValueError('数值必须是有限数字')
    value_text = str(value_text).strip() if value_text is not None else None
    value_text = value_text or None
    if value_num is None and value_text is None:
        raise ValueError('数值与文字值至少填写一项')
    if value_num is not None and value_text is not None:
        raise ValueError('数值与文字值只能填写一项')
    temp = data.get('temperature_K', old['temperature_K'] if old else None)
    temp = None if temp in ('', None) else float(temp)
    if temp is not None and (not math.isfinite(temp) or temp < 0):
        raise ValueError('温度必须是非负有限数字')
    unit = str(data.get('unit', old['unit'] if old else '') or '').strip() or None
    return {'catalyst_id': cid, 'reaction_id': rid, 'feature_group': group, 'feature_name': name,
            'value_num': value_num, 'value_text': value_text, 'unit': unit, 'temperature_K': temp}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def request_body(self):
        size = int(self.headers.get('Content-Length', 0))
        if size <= 0 or size > 32768:
            raise ValueError('请求内容为空或过大')
        return json.loads(self.rfile.read(size))

    def allowed(self):
        origin = self.headers.get('Origin', '')
        return not origin or bool(re.fullmatch(r'https?://(?:localhost|127\.0\.0\.1):\d+', origin))

    def do_GET(self):
        if urlsplit(self.path).path == '/api/status':
            self.send_json(200, {'editable': True})
        else:
            self.send_json(404, {'error': '接口不存在'})

    def do_POST(self):
        self.mutate('add')

    def do_PATCH(self):
        self.mutate('edit')

    def do_DELETE(self):
        self.mutate('delete')

    def mutate(self, action):
        path = urlsplit(self.path).path
        match = re.fullmatch(r'/api/features/(\d+)', path) if action != 'add' else None
        if not self.allowed():
            self.send_json(403, {'error': '仅允许本机页面操作'}); return
        if (action == 'add' and path != '/api/features') or (action != 'add' and not match):
            self.send_json(404, {'error': '接口不存在'}); return
        committed = False
        try:
            data = self.request_body() if action != 'delete' else None
            with LOCK:
                with sqlite3.connect(DB) as con:
                    con.row_factory = sqlite3.Row
                    old = None
                    if match:
                        row = con.execute('SELECT * FROM catalyst_features WHERE id=?', (int(match[1]),)).fetchone()
                        if row is None:
                            self.send_json(404, {'error': '记录不存在'}); return
                        old = dict(row)
                    if action == 'add':
                        record = validate(data, con)
                        cols = ','.join(record)
                        cur = con.execute(f'INSERT INTO catalyst_features ({cols}) VALUES ({",".join("?" for _ in record)})', tuple(record.values()))
                        feature_id = cur.lastrowid
                        after = dict(con.execute('SELECT * FROM catalyst_features WHERE id=?', (feature_id,)).fetchone())
                    elif action == 'edit':
                        record = validate(data, con, old)
                        con.execute('''UPDATE catalyst_features SET feature_group=?,feature_name=?,value_num=?,value_text=?,unit=?,temperature_K=? WHERE id=?''',
                                    (record['feature_group'],record['feature_name'],record['value_num'],record['value_text'],record['unit'],record['temperature_K'],old['id']))
                        feature_id = old['id']
                        after = dict(con.execute('SELECT * FROM catalyst_features WHERE id=?', (feature_id,)).fetchone())
                    else:
                        feature_id = old['id']
                        con.execute('DELETE FROM catalyst_features WHERE id=?', (feature_id,))
                        after = None
                    con.execute('INSERT INTO feature_edit_history (feature_id,action,before_json,after_json) VALUES (?,?,?,?)',
                                (feature_id,action,json.dumps(old,ensure_ascii=False) if old else None,json.dumps(after,ensure_ascii=False) if after else None))
                committed = True
                regenerate()
            self.send_json(200, {'ok': True, 'id': feature_id})
        except (ValueError, TypeError, json.JSONDecodeError) as e:
            self.send_json(400, {'error': str(e)})
        except Exception as e:
            self.send_json(500, {'error': f'{"SQLite 已提交，但展示数据导出失败" if committed else "SQLite 写入失败"}：{e}'})


def main():
    backup = DB.with_name('catalyst_platform.before_edits.sqlite')
    if not backup.exists():
        shutil.copy2(DB, backup)
    run_script('migrate-dashboard.py')
    regenerate()
    aimd = ROOT / 'public' / 'aimd'
    if aimd.exists() and any(aimd.glob('*.xyz')) and not (aimd / 'analysis' / 'index.json').exists():
        try:
            subprocess.run(['node', str(ROOT / 'scripts' / 'analyze-aimd-structures.cjs')], cwd=ROOT, check=True)
        except subprocess.CalledProcessError:
            print('AIMD 结构分析未完成，请检查 XYZ 格式', file=sys.stderr)
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f'SQLite 编辑接口：http://127.0.0.1:{PORT}/api/status', flush=True)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if npm is None:
        raise SystemExit('未找到 npm，请先安装 Node.js 并运行 npm ci')
    try:
        return subprocess.call([npm, 'run', 'dev'], cwd=ROOT)
    finally:
        server.shutdown()


if __name__ == '__main__':
    raise SystemExit(main())
