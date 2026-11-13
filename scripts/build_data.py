"""Build the offline application from the original CBDB SQLite snapshot.

No statistical result is copied from the former presentation. Source rows retain
their identity; display groups retain source IDs and record counts.
"""
import argparse
import collections
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_DEFAULT = ROOT / 'data/source/cbdb_20260523.sqlite3'


def year(value):
    return int(value) if value and value > 0 else None


def build_places(rows):
    places, lookup = {}, {}
    for row in rows:
        lon, lat = row['lon'], row['lat']
        has_coordinates = lon is not None and lat is not None and -180 <= lon <= 180 and -90 <= lat <= 90 and (lon or lat)
        key = (f"{row['name']}|{lon:.2f}|{lat:.2f}" if has_coordinates else f"{row['name']}|id:{row['id']}")
        if key not in places:
            places[key] = dict(key=key, name=row['name'] or '未詳', ids=[], lon=lon if has_coordinates else None, lat=lat if has_coordinates else None)
        places[key]['ids'].append(row['id'])
        lookup[row['id']] = key
    for p in places.values():
        p['ids'].sort()
    return places, lookup


def aggregate_locations(rows, places):
    groups = {}
    for row in rows:
        key = row['place']
        if key not in places:
            continue
        group = groups.setdefault(key, {'people': set(), 'records': 0, 'ids': set()})
        group['people'].add(row['person'])
        group['records'] += row.get('records', 1)
        if row.get('addrId') is not None:
            group['ids'].add(row['addrId'])
    return sorted([dict(places[k], ids=sorted(v['ids']) if v['ids'] else places[k]['ids'], count=len(v['people']), records=v['records']) for k, v in groups.items()], key=lambda p: (-p['count'], p['key']))


FIELD_LABELS = {
    'c_personid': '人物编号', 'c_name': '罗马字姓名', 'c_name_chn': '中文姓名',
    'c_birthyear': '出生年', 'c_deathyear': '卒年', 'c_death_age': '享年（数据库记载）',
    'c_female': '性别编码', 'c_dy': '朝代编码', 'c_index_year': '索引年',
    'c_index_addr_id': '索引地址编号', 'c_addr_id': '历史地址编号',
    'c_addr_type': '地址类别', 'c_firstyear': '起始年', 'c_lastyear': '终止年',
    'c_entry_code': '入仕途径编码', 'c_year': '入仕年份', 'c_sequence': '序号',
    'c_source': '文献来源编号', 'c_pages': '页码', 'c_notes': '原始备注',
    'c_posting_id': '任职记录编号', 'c_office_id': '官职编号',
    'c_assoc_id': '关联人物编号', 'c_assoc_code': '关系类别编码',
    'c_kin_id': '亲属人物编号', 'c_kin_code': '亲属关系编码',
    'c_index_year_type_code': '索引年类型', 'c_index_year_source_id': '索引年来源',
}


def build(database, legacy=None):
    connection = sqlite3.connect(f'file:{database.as_posix()}?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    query = lambda sql: [dict(r) for r in connection.execute(sql)]
    places, lookup = build_places(query('SELECT c_addr_id AS id, c_name_chn AS name, x_coord AS lon, y_coord AS lat FROM ADDR_CODES'))
    addr_types = {r['c_addr_type']: r['c_addr_desc_chn'] for r in query('SELECT * FROM BIOG_ADDR_CODES')}
    entry_types = {r['c_entry_code']: r['c_entry_desc_chn'] for r in query('SELECT * FROM ENTRY_CODES')}
    office_names = {r['c_office_id']: r['c_office_chn'] for r in query('SELECT c_office_id,c_office_chn FROM OFFICE_CODES')}
    alias_path = ROOT / 'assets/search-aliases.json'
    old_names = {int(k): v for k, v in json.loads(alias_path.read_text(encoding='utf8')).items()} if alias_path.exists() else {}
    conversion = {}
    if legacy and (legacy / 'output/tang_people_index.json').exists():
        old_names = {p['id']: p.get('ns', p['n']) for p in json.loads((legacy / 'output/tang_people_index.json').read_text(encoding='utf8'))['people']}
        html = (legacy / 'index.html').read_text(encoding='utf8')
        match = re.search(r'var S2T\s*=\s*\{(.*?)\n\s*\};', html, re.S)
        if match:
            conversion = dict(re.findall(r"'([^']+)'\s*:\s*'([^']+)'", match.group(1)))
        for p in json.loads((legacy / 'output/tang_people_index.json').read_text(encoding='utf8'))['people']:
            simplified = p.get('ns', p['n'])
            if len(simplified) == len(p['n']):
                for short_char, original_char in zip(simplified, p['n']):
                    if short_char != original_char:
                        conversion.setdefault(short_char, original_char)
        # Reuse the project's existing geographic reference outline as an asset.
        svg = re.search(r'<svg id="china-space-map".*?</svg>', html, re.S).group()
        outlines = re.findall(r'<path class="map-country-line" d="([^"]+)"', svg)
        (ROOT / 'assets').mkdir(exist_ok=True)
        alias_path.write_text(json.dumps(old_names, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
        (ROOT / 'assets/map-outline.js').write_text('window.PSGJ_MAP_OUTLINE=' + json.dumps(outlines, ensure_ascii=False) + ';', encoding='utf8')
        (ROOT / 'assets/search-chars.js').write_text('window.PSGJ_SEARCH_CHARS=' + json.dumps(conversion, ensure_ascii=False) + ';', encoding='utf8')

    people = {}
    for row in query('SELECT c_personid,c_name_chn,c_name,c_female,c_birthyear,c_deathyear,c_death_age,c_index_year FROM BIOG_MAIN WHERE c_dy=6'):
        pid = row['c_personid']
        people[pid] = dict(id=pid, name=row['c_name_chn'] or '未詳', roman=row['c_name'] or '', searchName=old_names.get(pid, row['c_name_chn']) or '', gender='女' if row['c_female'] == 1 else '男' if row['c_female'] == 0 else '未详', birth=year(row['c_birthyear']), death=year(row['c_deathyear']), age=year(row['c_death_age']), indexYear=year(row['c_index_year']), addresses=[], entries=[], postings=[])

    addr_rows = query('SELECT a.* FROM BIOG_ADDR_DATA a JOIN BIOG_MAIN b ON a.c_personid=b.c_personid WHERE b.c_dy=6')
    addr_groups = collections.defaultdict(dict)
    geo_rows, geo_people = [], set()
    for r in addr_rows:
        pid, aid = r['c_personid'], r['c_addr_id']
        key = lookup.get(aid)
        if key is None:
            continue
        p = places[key]
        groupkey = (key, r['c_addr_type'], year(r['c_firstyear']), year(r['c_lastyear']))
        group = addr_groups[pid].setdefault(groupkey, dict(key=key, name=p['name'], type=addr_types.get(r['c_addr_type'], '未詳'), typeCode=r['c_addr_type'], ids=[], start=groupkey[2], end=groupkey[3], records=0, sourceRows=[], lon=p['lon'], lat=p['lat']))
        if aid not in group['ids']:
            group['ids'].append(aid)
        group['records'] += 1
        group['sourceRows'].append(dict(addrId=aid, sequence=r['c_sequence'], source=r['c_source'], pages=r['c_pages'], notes=r['c_notes']))
        if r['c_addr_type'] == 1:
            geo_rows.append(dict(person=pid, place=key, addrId=aid))
            geo_people.add(pid)
    for pid, groups in addr_groups.items():
        people[pid]['addresses'] = sorted(groups.values(), key=lambda a: (a['typeCode'] != 1, a['start'] or 9999, a['typeCode'], a['key']))

    entry_rows = query('SELECT a.* FROM ENTRY_DATA a JOIN BIOG_MAIN b ON a.c_personid=b.c_personid WHERE b.c_dy=6')
    entry_groups = collections.defaultdict(dict)
    entry_summary = {}
    for r in entry_rows:
        pid, code, date = r['c_personid'], r['c_entry_code'], year(r['c_year'])
        g = entry_groups[pid].setdefault((code, date), dict(code=code, name=entry_types.get(code, '未詳'), year=date, records=0, sources=[], notes=[], sourceRows=[]))
        g['records'] += 1
        g['sourceRows'].append(dict(sequence=r['c_sequence'], source=r['c_source'], pages=r['c_pages'], notes=r['c_notes']))
        if r['c_source'] and r['c_source'] not in g['sources']:
            g['sources'].append(r['c_source'])
        if r['c_notes'] and r['c_notes'] not in g['notes']:
            g['notes'].append(r['c_notes'])
        s = entry_summary.setdefault(code, dict(people=set(), records=0))
        s['people'].add(pid)
        s['records'] += 1
    for pid, groups in entry_groups.items():
        people[pid]['entries'] = sorted(groups.values(), key=lambda e: (e['year'] or 9999, e['code']))
    entries = sorted([dict(code=k, name=entry_types.get(k, '未詳'), count=len(v['people']), records=v['records']) for k, v in entry_summary.items()], key=lambda e: (-e['count'], e['code']))

    posted_addr = query('SELECT a.* FROM POSTED_TO_ADDR_DATA a JOIN BIOG_MAIN b ON a.c_personid=b.c_personid WHERE b.c_dy=6')
    posting_places = collections.defaultdict(set)
    activity_rows = []
    for r in posted_addr:
        key = lookup.get(r['c_addr_id'])
        if key and r['c_addr_id'] > 0:
            posting_places[(r['c_posting_id'], r['c_office_id'])].add(key)
            activity_rows.append(dict(person=r['c_personid'], place=key, addrId=r['c_addr_id']))
    office_rows = query('SELECT a.* FROM POSTED_TO_OFFICE_DATA a JOIN BIOG_MAIN b ON a.c_personid=b.c_personid WHERE b.c_dy=6')
    office_groups = collections.defaultdict(dict)
    for r in office_rows:
        pid, oid, postingid = r['c_personid'], r['c_office_id'], r['c_posting_id']
        groupkey = (postingid, oid, year(r['c_firstyear']), year(r['c_lastyear']))
        g = office_groups[pid].setdefault(groupkey, dict(id=postingid, officeId=oid, office=office_names.get(oid) or '官职未詳', start=groupkey[2], end=groupkey[3], places=sorted(posting_places[(postingid, oid)]), records=0, sourceRows=[]))
        g['records'] += 1
        g['sourceRows'].append(dict(sequence=r['c_sequence'], source=r['c_source'], pages=r['c_pages'], notes=r['c_notes'], appointmentCode=r['c_appt_code'], assumeOfficeCode=r['c_assume_office_code']))
    for pid, groups in office_groups.items():
        people[pid]['postings'] = sorted(groups.values(), key=lambda r: (r['start'] or 9999, r['id'], r['officeId']))

    schema = []
    for name, label in [('BIOG_MAIN', '人物主表'), ('BIOG_ADDR_DATA', '地点记录'), ('ENTRY_DATA', '入仕记录'), ('POSTED_TO_OFFICE_DATA', '任职记录'), ('ASSOC_DATA', '社会关系')]:
        cols = query(f'PRAGMA table_info({name})')
        schema.append(dict(name=name, label=label, rows=connection.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0], columns=[dict(name=c['name'], type=c['type'], label=FIELD_LABELS.get(c['name'], ''), primary=bool(c['pk'])) for c in cols]))

    relations = []
    for r in query('SELECT a.c_assoc_id AS id,b.c_name_chn AS name,c.c_assoc_desc_chn AS type,a.c_assoc_first_year AS year FROM ASSOC_DATA a LEFT JOIN BIOG_MAIN b ON b.c_personid=a.c_assoc_id LEFT JOIN ASSOC_CODES c ON c.c_assoc_code=a.c_assoc_code WHERE a.c_personid=3915'):
        r['year'] = year(r['year'])
        relations.append(r)
    dufu_relations = len(relations)
    relation_groups = collections.Counter((r['id'], r['name'], r['type']) for r in relations)
    relations = [dict(id=k[0], name=k[1], type=k[2], records=v) for k, v in relation_groups.most_common() if k[1]]
    meta = dict(name='平生功绩', snapshot='2026-05-23', dynastyCode=6, people=len(people), geoPeople=len(geo_people), addressRecords=len(addr_rows), addressItems=sum(len(p['addresses']) for p in people.values()), entryPeople=len(entry_groups), entryRecords=len(entry_rows), entryItems=sum(len(p['entries']) for p in people.values()), postingPeople=len(office_groups), postingRecords=len(office_rows), activityPeople=len({r['person'] for r in activity_rows}), activityRecords=len(activity_rows), activityUnspecifiedRecords=len(posted_addr)-len(activity_rows), dufuRelations=dufu_relations, databasePeople=schema[0]['rows'])
    decade = collections.Counter((p['birth'] // 10) * 10 for p in people.values() if p['birth'] and 600 <= p['birth'] <= 920)
    summary = dict(meta=meta, geography=aggregate_locations(geo_rows, places), activity=aggregate_locations(activity_rows, places), entries=entries, schema=schema, relations=relations, births=[dict(year=k, count=v) for k, v in sorted(decade.items())], featured=[3915, 32540, 32227, 32174])
    # Include only referenced places; the complete code table stays in SQLite.
    used_keys = {a['key'] for p in people.values() for a in p['addresses']} | {r['place'] for r in activity_rows}
    summary['places'] = {k: v for k, v in places.items() if k in used_keys}
    people_list = sorted(people.values(), key=lambda p: p['id'])
    out = ROOT / 'data'
    out.mkdir(exist_ok=True)
    for filename, value, global_name in [('summary', summary, 'PSGJ_DATA'), ('people', people_list, 'PSGJ_PEOPLE')]:
        raw = json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        (out / f'{filename}.json').write_text(raw, encoding='utf8')
        (out / f'{filename}.js').write_text(f'window.{global_name}={raw};\n', encoding='utf8')
    connection.close()
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print('Built data/summary.js and data/people.js for offline use.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', type=Path, default=DB_DEFAULT)
    parser.add_argument('--legacy', type=Path)
    args = parser.parse_args()
    build(args.database.resolve(), args.legacy)
