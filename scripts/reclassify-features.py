#!/usr/bin/env python3
"""Normalize dashboard feature taxonomy.
Catalyst features: elemental/basic properties, structural features, electronic structure.
Reaction parameters: energies and transition-state frequencies.
KMC outputs remain in dedicated visualization data.
"""
import sqlite3
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
db = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'catalyst_platform.sqlite'

with sqlite3.connect(db) as con:
    con.execute('BEGIN IMMEDIATE')
    con.execute("UPDATE catalyst_features SET feature_group='过渡态虚频' WHERE feature_name LIKE '%虚频%'")
    con.execute("UPDATE catalyst_features SET feature_group='反应能量' WHERE feature_group='吸附/脱附'")
    con.execute("UPDATE catalyst_features SET feature_group='元素/基础属性' WHERE feature_group='其他' AND reaction_id IN ('c3h6','nh3')")
    con.execute("UPDATE catalyst_features SET feature_group='反应能量' WHERE feature_group='其他' AND reaction_id='co' AND (feature_name LIKE '%能量%' OR feature_name LIKE '%energy%' OR feature_name LIKE '%Energy%')")
    con.execute("DELETE FROM catalyst_features WHERE feature_group='其他' AND reaction_id='co'")
    con.execute("UPDATE catalyst_features SET feature_group='元素/基础属性' WHERE feature_group='其他'")
    counts = con.execute('SELECT feature_group,count(*) FROM catalyst_features GROUP BY feature_group ORDER BY feature_group').fetchall()
    con.commit()
print(dict(counts))
