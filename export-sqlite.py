#!/usr/bin/env python3
"""Export the authoritative SQLite data for the static Vue dashboard.

kMC 动力学数据读取自适应精简后的代表集：
  kmc_configs_representative / kmc_events_representative
催化剂特征仍读取 catalyst_features（全量，不做精简）。

Usage: python3 export-sqlite.py [database.sqlite] [output_dir]
"""
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'catalyst_platform.sqlite'
OUT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else ROOT / 'public' / 'data'
OUT.mkdir(parents=True, exist_ok=True)


def write(name, value):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


with sqlite3.connect(f'{DB.as_uri()}?mode=ro', uri=True) as con:
    con.row_factory = sqlite3.Row
    reactions = [dict(r) for r in con.execute('SELECT * FROM reactions ORDER BY id')]
    catalyst_rows = [dict(r) for r in con.execute('SELECT * FROM catalysts')]
    catalysts = {c['id']: c for c in catalyst_rows}
    links = defaultdict(list)
    for row in con.execute('SELECT catalyst_id,reaction_id FROM catalyst_reactions'):
        links[row['reaction_id']].append(row['catalyst_id'])

    rep_cfg_total = con.execute('SELECT count(*) FROM kmc_configs_representative').fetchone()[0]
    rep_ev_total = con.execute('SELECT count(*) FROM kmc_events_representative').fetchone()[0]
    full_cfg_total = con.execute('SELECT count(*) FROM kmc_configs').fetchone()[0]
    full_ev_total = con.execute('SELECT count(*) FROM kmc_events').fetchone()[0]

    summary = {'catalystCount': len(catalysts), 'featureCount': con.execute('SELECT count(*) FROM catalyst_features').fetchone()[0],
               'kmcSegmentCount': con.execute('SELECT count(*) FROM kmc_segments').fetchone()[0],
               'kmcRepresentativeConfigCount': rep_cfg_total,
               'kmcRepresentativeEventRecordCount': rep_ev_total,
               'kmcFullConfigCount': full_cfg_total,
               'kmcFullEventRecordCount': full_ev_total,
               'sources': [dict(s) for s in con.execute('SELECT id,filename,sheet_name FROM sources')], 'reactions': []}
    for reaction in reactions:
        rid = reaction['id']
        ids = set(links[rid])
        features = []
        for row in con.execute('''SELECT id,catalyst_id,reaction_id,feature_group,feature_name,value_num,value_text,unit,temperature_K,source_id,source_row,source_col
            FROM catalyst_features WHERE reaction_id=? OR (reaction_id IS NULL AND catalyst_id IN
            (SELECT catalyst_id FROM catalyst_reactions WHERE reaction_id=?)) ORDER BY catalyst_id,feature_name,temperature_K,id''', (rid, rid)):
            f = dict(row)
            f['scope'] = 'global' if f.pop('reaction_id') is None else 'reaction'
            features.append(f)

        segments = []
        for s in con.execute('SELECT * FROM kmc_segments WHERE reaction_id=? ORDER BY catalyst_id,temperature_K,id', (rid,)):
            # 动力学展示只导出代表性构型（自适应采样后的骨架）
            configs = [dict(k) for k in con.execute(
                'SELECT id,configuration,steps,overall_rate,marker_value FROM kmc_configs_representative WHERE segment_id=? ORDER BY id', (s['id'],))]
            events = []
            if configs:
                events = [dict(e) for e in con.execute('''SELECT event_name,direction,rate,event_count,rate_flag FROM kmc_events_representative
                    WHERE config_id=? ORDER BY abs(coalesce(rate,0)) DESC LIMIT 12''', (configs[-1]['id'],))]
            segments.append({'id': s['id'], 'catalyst_id': s['catalyst_id'], 'feed': s['feed_label'], 'temperature_K': s['temperature_K'],
                             'source_id': s['source_id'], 'configs': configs,
                             'finalEvents': events})
            # 每段一个事件分片，仅包含代表构型的事件（含 rate_flag 异常标记）
            events_all = [dict(e) for e in con.execute('''SELECT e.config_id,e.event_name,e.direction,e.rate,e.event_count,e.rate_flag
                FROM kmc_events_representative e JOIN kmc_configs_representative k ON k.id=e.config_id
                WHERE k.segment_id=? ORDER BY e.config_id,e.id''', (s['id'],))]
            write(f'kmc/{s["id"]}.json', events_all)
        write(f'{rid}.json', {'catalysts': [{k: v for k, v in catalysts[i].items() if k != 'id'} | {'id': i} for i in sorted(ids)],
                              'features': features, 'segments': segments})
        valid_count = con.execute('SELECT valid_feature_count FROM v_reaction_data_counts WHERE reaction_id=?', (rid,)).fetchone()[0]
        stat = con.execute('SELECT * FROM v_reaction_statistics WHERE reaction_id=?', (rid,)).fetchone()
        rep_cfg = con.execute('''SELECT count(*) FROM kmc_configs_representative k JOIN kmc_segments s ON s.id=k.segment_id
            WHERE s.reaction_id=?''', (rid,)).fetchone()[0]
        rep_ev = con.execute('''SELECT count(*) FROM kmc_events_representative e
            JOIN kmc_configs_representative k ON k.id=e.config_id JOIN kmc_segments s ON s.id=k.segment_id
            WHERE s.reaction_id=?''', (rid,)).fetchone()[0]
        full_cfg = con.execute('''SELECT count(*) FROM kmc_configs k JOIN kmc_segments s ON s.id=k.segment_id
            WHERE s.reaction_id=?''', (rid,)).fetchone()[0]
        full_ev = con.execute('''SELECT count(*) FROM kmc_events e
            JOIN kmc_configs k ON k.id=e.config_id JOIN kmc_segments s ON s.id=k.segment_id
            WHERE s.reaction_id=?''', (rid,)).fetchone()[0]
        summary['reactions'].append({**reaction, 'catalystCount': len(ids), 'featureCount': sum(f['scope'] == 'reaction' for f in features),
                                     'validFeatureCount': valid_count,
                                     'kmcSegmentCount': len(segments), 'kmcPopulatedCount': sum(bool(s['configs']) for s in segments),
                                     'kmcConfigCount': rep_cfg,
                                     'kmcEventRecordCount': rep_ev,
                                     'kmcFullConfigCount': full_cfg,
                                     'kmcFullEventRecordCount': full_ev,
                                     'kineticValueCount': stat['kinetic_value_count'] if stat else 0})

    write('summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
