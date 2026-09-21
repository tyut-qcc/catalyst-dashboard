#!/usr/bin/env python3
"""Add dashboard views and an audit log without changing raw observations."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / 'catalyst_platform.sqlite'
VALID = """value_num IS NOT NULL OR (value_text IS NOT NULL AND
    upper(trim(value_text)) NOT IN ('', '—', '-', '/', 'N/A', 'NA', 'NAN', 'NONE', 'NULL', '#VALUE!', '#REF!', '#DIV/0!', '#N/A', '#NUM!'))"""


def migrate(con):
    con.execute('''CREATE TABLE IF NOT EXISTS feature_edit_history (
        id INTEGER PRIMARY KEY, feature_id INTEGER, action TEXT NOT NULL,
        before_json TEXT, after_json TEXT, edited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )''')
    con.execute('DROP VIEW IF EXISTS v_reaction_data_counts')
    con.execute(f'''CREATE VIEW v_reaction_data_counts AS
        SELECT r.id reaction_id,
            count(f.id) raw_feature_count,
            coalesce(sum(CASE WHEN {VALID} THEN 1 ELSE 0 END),0) valid_feature_count
        FROM reactions r LEFT JOIN catalyst_features f ON f.reaction_id=r.id GROUP BY r.id''')


if __name__ == '__main__':
    with sqlite3.connect(DB) as con:
        migrate(con)
        print(con.execute('SELECT * FROM v_reaction_data_counts ORDER BY reaction_id').fetchall())
