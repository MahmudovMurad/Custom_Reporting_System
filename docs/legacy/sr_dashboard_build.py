#!/usr/bin/env python3
"""SR Auto dashboard — data pipeline.

Sheet snapshot :  python3 build.py --sheet sheet.csv <modifiedTime> "<title>" out.html
Payload        :  python3 build.py --payload payload_full.json <modifiedTime> "<title>" out.html
Hazır JSON     :  python3 build.py --json data.json out.html          (əvvəlki build-in dash-data JSON-u; yalnız template dəyişəndə)
Xlsx (test)    :  python3 build.py --xlsx test_data.xlsx [...] out.html
Şablon: eyni qovluqda template.html və ya sr_dashboard_template.html (tam HTML sənədi ola bilər; __DATA__ yer tutucusu daxilindədir).
Tam export     :  python3 build.py --export data_baza.txt <modifiedTime> out.html
  ("## Sheet name: Main Data" / "## Sheet name: Real Stock" bölmələri olan mətn exportu — Main Data + bazar + Real Stock hamısı bir yerdə)
  xlsx sütunları: Date, Brend, Model, Növ, Kanal, Haradan Gəlib, Satış kanalı
  Növ = "Market Sales Split" sətirləri ana panelə düşmür, bazar lövhəsinə (mk) gedir

Data sətir səviyyəsində gün × Brend × Model × Növ × Kanal × Satış kanalı × Haradan Gəlib
üzrə cəmlənir, sütunlu (columnar) binar formata salınır, gzip + base64 ilə
template.html daxilindəki __DATA__ yerinə yazılır. Səhifə heç bir serverə ehtiyac duymur.
"""
import sys, json, gzip, base64, os, re, datetime as dt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
NOV_ORDER = ['Müraciət', 'Trafik', 'Sales']
MARKET_NOV = 'market sales split'


def _norm(s):
    return re.sub(r'\s+', ' ', str(s).replace('İ', 'I').replace('ı', 'i').strip().lower())


def pack(df, meta):
    """df sütunları: date(datetime.date), brand, model, nov, kanal, satis, haradan, cnt"""
    start = min(df['date']); end = max(df['date'])
    dims = {}
    codes = {}
    for col in ['brand', 'model', 'nov', 'kanal', 'satis', 'haradan']:
        vals = df[col].fillna('').astype(str).str.strip()
        totals = df.assign(_v=vals).groupby('_v')['cnt'].sum().sort_values(ascending=False)
        order = [v for v in totals.index if v != '']
        if col == 'nov':
            order = [v for v in NOV_ORDER if v in order] + [v for v in order if v not in NOV_ORDER]
        order = [''] + order                      # 0 = boş
        idx = {v: i for i, v in enumerate(order)}
        codes[col] = vals.map(idx).to_numpy()
        dims[col] = order
        lim = 65535 if col == 'model' else 255
        assert len(order) <= lim, f'{col}: çox dəyər ({len(order)})'
    day = np.array([(d - start).days for d in df['date']], dtype='<u2')
    cnt = df['cnt'].to_numpy()
    assert cnt.max() <= 65535
    o = np.argsort(day, kind='stable')
    parts = [day[o].astype('<u2'), codes['model'][o].astype('<u2'), cnt[o].astype('<u2')]
    parts += [codes[c][o].astype('u1') for c in ['brand', 'nov', 'kanal', 'satis', 'haradan']]
    raw = b''.join(p.tobytes() for p in parts)
    blob = base64.b64encode(gzip.compress(raw, 9)).decode()
    return {'meta': meta, 'start': start.isoformat(), 'ndays': (end - start).days + 1,
            'n': int(len(day)), 'dims': dims, 'blob': blob}


def load_xlsx(paths):
    """xlsx → (gün səviyyəsində cəmlənmiş ana data, bazar lövhəsi mk, sətir sayı)."""
    import pandas as pd
    frames = []
    for p in paths:
        x = pd.read_excel(p)
        x = x.rename(columns={'Date': 'date', 'Brend': 'brand', 'Model': 'model', 'Növ': 'nov',
                              'Kanal': 'kanal', 'Satış kanalı': 'satis', 'Haradan Gəlib': 'haradan'})
        for c in ['kanal', 'satis', 'haradan', 'model']:
            if c not in x: x[c] = ''
        x = x[['date', 'brand', 'model', 'nov', 'kanal', 'satis', 'haradan']]
        x['date'] = pd.to_datetime(x['date'], errors='coerce').dt.date
        frames.append(x.dropna(subset=['date']))
    x = pd.concat(frames, ignore_index=True)
    for c in ['brand', 'model', 'nov', 'kanal', 'satis', 'haradan']:
        x[c] = x[c].fillna('').astype(str).str.strip()
    is_mk = x['nov'].map(_norm) == MARKET_NOV
    mk_rows = x[is_mk]; x = x[~is_mk]
    g = x.groupby(['date', 'brand', 'model', 'nov', 'kanal', 'satis', 'haradan'], dropna=False).size().rename('cnt').reset_index()
    return g, market_from_frame(mk_rows), len(x)


def market_from_frame(m):
    """Market Sales Split sətirləri (hər sətir 1 ədəd) → {months, brands, models, rows}."""
    from collections import OrderedDict
    months, brands, models, rows = OrderedDict(), OrderedDict(), OrderedDict(), {}
    for d, b, md in zip(m['date'], m['brand'], m['model']):
        ym = f'{d.year}-{d.month:02d}'; b = re.sub(r'\s+', ' ', b).strip(); md = re.sub(r'\s+', ' ', md).strip() or '(model yoxdur)'
        if not b: continue
        for dd, k in ((months, ym), (brands, b), (models, md)):
            dd.setdefault(k, len(dd))
        key = (months[ym], brands[b], models[md]); rows[key] = rows.get(key, 0) + 1
    ms = sorted(months); remap = {months[k]: i for i, k in enumerate(ms)}
    return {'months': ms, 'brands': list(brands), 'models': list(models),
            'rows': [[remap[k[0]], k[1], k[2], v] for k, v in rows.items()]}


CHANNEL_NOV = {'kanal': ('müraciət', 'muraciet'), 'haradan': ('trafik', 'traffic'), 'satis': ('sales', 'satış', 'satis')}


def load_sheet_csv(path):
    """Google Sheet CSV exportu → gün səviyyəsində cəmlənmiş cədvəl (səhifədəki buildFromCSV ilə eyni qaydalar)."""
    import pandas as pd
    x = pd.read_csv(path, dtype=str, keep_default_na=False)
    x = x.rename(columns={'Date': 'date', 'Brend': 'brand', 'Model': 'model', 'Növ': 'nov',
                          'Kanal': 'kanal', 'Satış kanalı': 'satis', 'Haradan Gəlib': 'haradan'})
    x['date'] = pd.to_datetime(x['date'].str.strip(), format='%d-%b-%y', errors='coerce').dt.date
    bad = int(x['date'].isna().sum()); x = x.dropna(subset=['date'])
    nv = x['nov'].map(_norm)
    x = x[nv != MARKET_NOV]; nv = nv[nv != MARKET_NOV]
    for c in ['brand', 'model', 'nov', 'kanal', 'satis', 'haradan']:
        v = x[c].astype(str).str.strip()
        if c in CHANNEL_NOV:
            v = v.where((v != '') | ~nv.isin(CHANNEL_NOV[c]), '(boş)')
        key = v.map(_norm)                     # yazılış variantlarını birləşdir, ən çox işlənəni göstər
        best = (pd.DataFrame({'k': key, 'v': v}).groupby(['k', 'v']).size().reset_index(name='n')
                .sort_values('n', ascending=False).drop_duplicates('k').set_index('k')['v'])
        x[c] = key.map(best)
    g = x.groupby(['date', 'brand', 'model', 'nov', 'kanal', 'satis', 'haradan']).size().rename('cnt').reset_index()
    return g, len(x), bad


def RS_NUM(s):
    """28,900.00 ₼ · 65.900.00 ₼ · 2890 · 10% → ədəd (ayırıcılar hər iki formada oxunur)."""
    t = re.sub(r'[^\d.,]', '', str(s))
    if not t:
        return None
    m = re.search(r'[.,](\d{1,2})$', t)                 # sonuncu ayırıcı 1-2 rəqəmlə bitirsə — onluq hissə
    dec = m.group(1) if m else ''
    whole = re.sub(r'[.,]', '', t[:m.start()] if m else t)
    if not whole:
        return None
    return float(whole + ('.' + dec if dec else ''))


def RS_INT(s):
    v = RS_NUM(s)
    return int(round(v)) if v is not None else 0


def load_real_stock(path):
    """Real Stock vərəqi: Model adı yalnız qrupun ilk sətrindədir (yuxarıdan doldurulur)."""
    import csv
    rows = []
    with open(path, encoding='utf-8-sig') as f:
        brand = model = ''
        for r0 in csv.DictReader(f):
            r = {_norm(k): v for k, v in r0.items() if k}
            r.setdefault(_norm('Beh Sayı'), r.get('beh', ''))
            g = lambda k: (r.get(_norm(k)) or '').strip()
            brand = g('Brend adı') or brand
            model = g('Model adı') or model
            ver = g('Model növü')
            nums = [g(c) for c in ('Stok sayı', 'Real Stok', 'Hədəf', 'Actual Satış', 'Beh Sayı')]
            if not model or not (ver or any(nums)):
                continue
            mud = re.sub(r'\s+', ' ', g('Müddət')).strip()
            mud = 'Cash' if mud.lower() == 'cash' else (re.sub(r'(?i)^(\d+)\s*ay$', r'\1 ay', mud) or '')
            rows.append({
                'brand': re.sub(r'\s+', ' ', brand), 'model': re.sub(r'\s+', ' ', model), 'version': ver,
                'year': int(g('İstehsal ili')) if g('İstehsal ili').isdigit() else None,
                'price': RS_NUM(g('Nağd qiymət')), 'faiz': RS_NUM(g('Faiz')),
                'ilkin': RS_NUM(g('İlkin ödəniş')), 'muddet': mud, 'ayliq': RS_NUM(g('Aylıq ödəniş')),
                'stok': RS_INT(g('Stok sayı')), 'real': RS_INT(g('Real Stok')), 'hedef': RS_INT(g('Hədəf')),
                'actual': RS_INT(g('Actual Satış')), 'beh': RS_INT(g('Beh Sayı')), 'qeyd': g('Qeyd'),
            })
    return rows


def load_market(path):
    """Market Sales Split (gviz: Date, Brend, Model, count) → {months, brands, models, rows}."""
    import csv
    from collections import OrderedDict
    months, brands, models, rows = OrderedDict(), OrderedDict(), OrderedDict(), []
    with open(path, encoding='utf-8-sig') as f:
        for r in csv.reader(f):
            if len(r) < 4 or r[0].strip().lower() == 'date':
                continue
            m = re.match(r'^(\d{4})-(\d{1,2})', r[0].strip())
            if not m:
                continue
            ym = f'{m.group(1)}-{int(m.group(2)):02d}'
            brand = re.sub(r'\s+', ' ', r[1]).strip()
            model = re.sub(r'\s+', ' ', r[2]).strip() or '(model yoxdur)'
            cnt = int(float(r[3] or 0))
            if not brand or cnt <= 0:
                continue
            for d, k in ((months, ym), (brands, brand), (models, model)):
                d.setdefault(k, len(d))
            rows.append([months[ym], brands[brand], models[model], cnt])
    ms = sorted(months); remap = {months[k]: i for i, k in enumerate(ms)}
    return {'months': ms, 'brands': list(brands), 'models': list(models), 'rows': [[remap[r[0]], r[1], r[2], r[3]] for r in rows]}


def load_export(path):
    """Bütün vərəqlərin mətn exportu ("## Sheet name: X" başlıqlı CSV bölmələri) → (ana df, records, bad, mk, rs)."""
    import csv, io, collections
    t = open(path, encoding='utf-8-sig').read()
    parts = re.split(r'^## Sheet name: (.*)$', t, flags=re.M)
    sheets = {n.strip(): b.strip('\n') + '\n' for n, b in zip(parts[1::2], parts[2::2])}
    main = next(v for k, v in sheets.items() if _norm(k) == 'main data')
    tmp = os.path.join(HERE, '_export_main.csv'); open(tmp, 'w', encoding='utf-8').write(main)
    df, records, bad = load_sheet_csv(tmp); os.remove(tmp)
    mk = collections.Counter()
    for r in csv.reader(io.StringIO(main)):
        if len(r) > 3 and _norm(r[3]) == MARKET_NOV:
            try: d = dt.datetime.strptime(r[0].strip(), '%d-%b-%y')
            except ValueError: continue
            mk[(f'{d.year}-{d.month:02d}', r[1].strip(), r[2].strip())] += 1
    mkp = os.path.join(HERE, 'market_split.csv')
    with open(mkp, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(['Date', 'Brend', 'Model', 'count'])
        for (ym, b, m), c in sorted(mk.items()): w.writerow([ym, b, m, c])
    rs = next((v for k, v in sheets.items() if _norm(k) == 'real stock'), None)
    if rs: open(os.path.join(HERE, 'real_stock.csv'), 'w', encoding='utf-8').write(rs)
    return df, records, bad


def add_boards(pl):
    rs_path = os.path.join(HERE, 'real_stock.csv')
    if os.path.exists(rs_path):
        pl['rs'] = load_real_stock(rs_path)
        print(f'Real Stock: {len(pl["rs"])} sətir')
    mk_path = os.path.join(HERE, 'market_split.csv')
    if os.path.exists(mk_path):
        pl['mk'] = load_market(mk_path)
        print(f'Market Sales Split: {len(pl["mk"]["rows"])} sətir, {len(pl["mk"]["brands"])} brend, {len(pl["mk"]["months"])} ay')
    return pl


HEAD = ('<!doctype html><html lang="az"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>SR Auto Satış Paneli</title>'
        '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
TAIL = '</body></html>'


def template_inner(tpl):
    """Şablon tam HTML sənədi kimi saxlanıbsa (sr_dashboard_template.html) yalnız <body> içini götür."""
    if tpl.lstrip()[:9].lower() == '<!doctype':
        return tpl[tpl.index('<body>') + 6:tpl.rindex('</body>')]
    return tpl


def inject(payload, out):
    for name in ('template.html', 'sr_dashboard_template.html'):
        tp = os.path.join(HERE, name)
        if os.path.exists(tp): break
    tpl = template_inner(open(tp, encoding='utf-8').read())
    js = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    assert '__DATA__' in tpl
    page = tpl.replace('__DATA__', js)
    open(out, 'w', encoding='utf-8').write(page)          # claude.ai artifact üçün (skelet platformadan gəlir)
    # Brauzerdə birbaşa açmaq / GitHub Pages / serverə qoymaq üçün tam HTML (Google Sheet qoşulması burada işləyir)
    open(out[:-5] + '_standalone.html', 'w', encoding='utf-8').write(HEAD + page + TAIL)
    print(f'{out}: {payload["n"]:,} sətir, {payload["ndays"]} gün, blob {len(payload["blob"])/1024:.0f} KB'
          + (f', mk {len(payload["mk"]["rows"])} sətir' if payload.get('mk') else ''))


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == '--json':
        # python3 build.py --json data.json [<modifiedTime>] out.html — real_stock.csv / market_split.csv varsa həmin lövhələr yenilənir
        pl = json.load(open(sys.argv[2], encoding='utf-8'))
        if len(sys.argv) > 4: pl['meta']['modifiedTime'] = sys.argv[3]
        inject(add_boards(pl), sys.argv[-1]); sys.exit(0)
    if mode == '--payload':
        pl = json.load(open(sys.argv[2], encoding='utf-8'))
        pl = pl.get('payload', pl)
        pl['meta'] = {'source': 'snapshot', 'modifiedTime': sys.argv[3], 'title': sys.argv[4],
                      'records': pl.pop('records'), 'skipped': pl.pop('skipped', 0)}
        inject(add_boards(pl), sys.argv[-1]); sys.exit(0)
    if mode == '--sheet':
        df, records, bad = load_sheet_csv(sys.argv[2])
        meta = {'source': 'snapshot', 'modifiedTime': sys.argv[3], 'title': sys.argv[4], 'records': records, 'skipped': bad}
        inject(add_boards(pack(df, meta)), sys.argv[-1]); sys.exit(0)
    if mode == '--export':
        df, records, bad = load_export(sys.argv[2])
        meta = {'source': 'snapshot', 'modifiedTime': sys.argv[3], 'title': 'data baza', 'records': records, 'skipped': bad}
        inject(add_boards(pack(df, meta)), sys.argv[-1]); sys.exit(0)
    if mode == '--xlsx':
        df, mk, records = load_xlsx(sys.argv[2:-1])
        last = max(df['date'])
        meta = {'source': 'snapshot', 'title': 'test_data', 'records': records,
                'modifiedTime': dt.datetime.fromtimestamp(os.path.getmtime(sys.argv[2])).isoformat()}
        pl = pack(df, meta)
        if mk['rows']:
            pl['mk'] = mk
        inject(add_boards(pl), sys.argv[-1]); sys.exit(0)
    print(__doc__); sys.exit(1)
