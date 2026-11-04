#!/usr/bin/env python3
"""Free My TV+: baut web/sources.js aus der Playlist-Uebersicht von iptv-org (PLAYLISTS.md) und den
Laenderlisten von Free-TV/IPTV. Alle Laender (mit Bundeslaendern/Regionen und Staedten), Sprachen, Themen und
Regionen, deutsch benannt und alphabetisch sortiert.

    python3 tools/make_iptv_sources.py PLAYLISTS.md make_playlist.py
"""
import json, re, sys
from babel import Locale
import pycountry

DE = Locale('de')
CATS = {'animation': 'Animation', 'auto': 'Auto & Motor', 'business': 'Wirtschaft', 'classic': 'Klassiker',
        'comedy': 'Comedy', 'cooking': 'Kochen', 'culture': 'Kultur', 'documentary': 'Dokus', 'education': 'Bildung',
        'entertainment': 'Unterhaltung', 'family': 'Familie', 'general': 'Allgemein', 'interactive': 'Interaktiv',
        'kids': 'Kinder', 'legislative': 'Politik & Parlament', 'lifestyle': 'Lifestyle', 'movies': 'Filme',
        'music': 'Musik', 'news': 'Nachrichten', 'outdoor': 'Natur & Outdoor', 'public': 'Öffentlich-rechtlich',
        'relax': 'Entspannung', 'religious': 'Religion', 'science': 'Wissenschaft', 'series': 'Serien',
        'shop': 'Shopping', 'sports': 'Sport', 'travel': 'Reisen', 'weather': 'Wetter', 'undefined': 'Ohne Thema'}
REGIONS = {'afr': 'Afrika', 'amer': 'Amerika', 'arab': 'Arabische Welt', 'asia': 'Asien', 'apac': 'Asien-Pazifik',
           'asean': 'Südostasien (ASEAN)', 'balkan': 'Balkan', 'benelux': 'Benelux', 'carib': 'Karibik',
           'cenamer': 'Mittelamerika', 'cee': 'Mittel- und Osteuropa', 'cas': 'Zentralasien', 'ceu': 'Mitteleuropa',
           'cis': 'GUS', 'eaf': 'Ostafrika', 'eas': 'Ostasien', 'eur': 'Europa', 'emea': 'Europa, Nahost, Afrika',
           'eu': 'Europäische Union', 'gcc': 'Golfstaaten', 'hispam': 'Hispanoamerika', 'latam': 'Lateinamerika',
           'lac': 'Lateinamerika und Karibik', 'maghreb': 'Maghreb', 'mideast': 'Naher Osten', 'mena': 'Nahost und Nordafrika',
           'nord': 'Skandinavien (Nordics)', 'neu': 'Nordeuropa', 'un': 'Vereinte Nationen', 'noram': 'Nordamerika (NORAM)', 'nam': 'Nordamerika', 'oce': 'Ozeanien', 'sas': 'Südasien',
           'sam': 'Südamerika', 'saf': 'Südliches Afrika', 'sea': 'Südostasien', 'ser': 'Südeuropa', 'ssa': 'Subsahara-Afrika',
           'waf': 'Westafrika', 'was': 'Westasien', 'wer': 'Westeuropa', 'caf': 'Zentralafrika', 'naf': 'Nordafrika',
           'nordics': 'Skandinavien', 'ww': 'Weltweit', 'int': 'International', 'southam': 'Südamerika', 'wafr': 'Westafrika'}

def key(s):
    t = s.lower()
    for a, b in (('ä', 'a'), ('ö', 'o'), ('ü', 'u'), ('ß', 'ss'), ('é', 'e'), ('è', 'e'), ('á', 'a'), ('í', 'i'), ('ó', 'o'), ('ç', 'c'), ('å', 'a'), ('ø', 'o')):
        t = t.replace(a, b)
    return t

def country_name(code, fallback):
    c = code.upper()
    if c == 'UK': c = 'GB'
    if c == 'INT': return 'International'
    if c == 'UNDEFINED': return 'Ohne Land'
    return short(DE.territories.get(c, fallback))

def short(n):
    return n.replace('Sonderverwaltungsregion ', '').replace('Sonderverwaltungszone ', '')

def lang_name(code, fallback):
    try:
        l = pycountry.languages.get(alpha_3=code)
        if l is not None and getattr(l, 'alpha_2', None) and l.alpha_2 in DE.languages: return DE.languages[l.alpha_2]
    except Exception: pass
    if code in DE.languages: return DE.languages[code]
    return fallback

def main(md_path, freetv_py):
    md = open(md_path, encoding='utf-8').read()
    cats, langs, countries, regions = [], [], [], []
    part = md.split('### Grouped by language')[0]
    for name, n, slug in re.findall(r'<tr><td[^>]*>([^<]+)</td><td align="right">(\d+)</td><td[^>]*><code>https://iptv-org\.github\.io/iptv/categories/([a-z_-]+)\.m3u</code>', part):
        cats.append([slug, CATS.get(slug, name), int(n)])
    part = md.split('### Grouped by language')[1].split('### Grouped by broadcast area')[0]
    for name, n, code in re.findall(r'<tr><td[^>]*>([^<]+)</td><td align="right">(\d+)</td><td[^>]*><code>https://iptv-org\.github\.io/iptv/languages/([a-z_-]+)\.m3u</code>', part):
        langs.append([code, lang_name(code, name), int(n)])
    part = md.split('#### Countries')[1].split('#### Regions')[0]
    cur_c = cur_s = None
    for line in part.splitlines():
        m = re.match(r'^(\s*)- (.+?) <code>https://iptv-org\.github\.io/iptv/(countries|subdivisions|cities)/([a-z0-9_-]+)\.m3u</code>', line)
        if not m: continue
        kind, code = m.group(3), m.group(4)
        name = re.sub(r'^[^\w(]+', '', m.group(2)).strip()   # Flagge vorne weg
        if kind == 'countries':
            cur_c = [code, country_name(code, name), []]; countries.append(cur_c); cur_s = None
        elif kind == 'subdivisions' and cur_c:
            cur_s = [code, name, []]; cur_c[2].append(cur_s)
        elif kind == 'cities':
            (cur_s[2] if cur_s else cur_c[2]).append([code, name])
    part = md.split('#### Regions')[1].split('</details>')[0]
    for name, code in re.findall(r'- (.+?) <code>https://iptv-org\.github\.io/iptv/regions/([a-z_-]+)\.m3u</code>', part):
        regions.append([code, REGIONS.get(code, name)])
    py = open(freetv_py, encoding='utf-8').read()
    ft = []
    for file, cc in re.findall(r'"([a-z_]+)": "([A-Z]{2})"', re.search(r'COUNTRY_CODES = \{(.*?)\n\}', py, re.S).group(1)):
        if file == 'hongkong': continue
        label = short(DE.territories.get(cc, file)) + (' (Abruf)' if file.endswith('_vod') else '')
        ft.append([file, label])
    def srt(lst, i=1):
        lst.sort(key=lambda x: key(x[i]))
        for x in lst:
            if len(x) > 2 and isinstance(x[2], list):
                srt(x[2])
                for y in x[2]:
                    if len(y) > 2 and isinstance(y[2], list): srt(y[2])
        return lst
    srt(cats); srt(langs); srt(countries); srt(regions); srt(ft)
    data = {'cat': cats, 'lang': langs, 'country': countries, 'region': regions, 'freetv': ft}
    out = ('// Free My TV+: alle IP-TV-Listen von iptv-org und Free-TV, erzeugt von tools/make_iptv_sources.py\n'
           'window.IPTV_SOURCES = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open('web/sources.js', 'w', encoding='utf-8').write(out)
    subs = sum(len(c[2]) for c in countries)
    print('Themen %d, Sprachen %d, Länder %d (mit %d Untergliederungen), Regionen %d, Free-TV %d, %d KB' %
          (len(cats), len(langs), len(countries), subs, len(regions), len(ft), len(out.encode()) // 1024))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
