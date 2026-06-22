#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Agent 5 Rich Terminal Report - Python version (no escaping hell)"""
import json, os, sys
from datetime import datetime

# ── ANSI colors ──────────────────────────────────────────────────────────
R = '\x1b[0m'; Bo = '\x1b[1m'
Re = '\x1b[31m'; Gr = '\x1b[32m'; Ye = '\x1b[33m'
Bl = '\x1b[34m'; Ma = '\x1b[35m'; Cy = '\x1b[36m'; Wh = '\x1b[37m'; Gy = '\x1b[90m'

def p(s, n): return str(s or '').ljust(n)
def pL(s, n): return str(s or '').rjust(n)
def t(s, n): return str(s or '')[:n-1]+'…' if len(str(s or '')) > n else str(s or '')
def center(s, w): sl=len(s); return ' '*((w-sl)//2)+s+' '*((w-sl)-(w-sl)//2)

# ── Load data ───────────────────────────────────────────────────────────
data_path = os.path.join(os.path.dirname(__file__), 'mock-data', 'agent5-complete-output.json')
if not os.path.exists(data_path):
    print(Re+'ERROR: run node agent5-core.js first'+R); sys.exit(1)
with open(data_path) as f: d = json.load(f)

pool = d.get('topic_pool',{}).get('topics',[])
routes = d.get('distribution_map',{}).get('routes',[])
cal = d.get('editorial_calendar',{}).get('calendar',{})
brief = d.get('topic_brief',{}).get('brief',{})
today = datetime.now().strftime('%Y-%m-%d')

# Stats
pCount = {'P0':0,'P1':0,'P2':0}
for r in routes:
    if r.get('priority') in pCount: pCount[r['priority']] += 1

byPlat = {}
for day in cal.values():
    for s in day.get('slots',[]):
        pn = s.get('platform_name','')
        byPlat[pn] = byPlat.get(pn, 0) + 1

W = 120

# ── Header ───────────────────────────────────────────────────────────
line = lambda: print(Cy+'+'+'-'*W+'+'+R)
line()
print(Cy+'|'+R+center('Agent 5 · 趋势与选题智能体', W-2)+Cy+'|')
print(Cy+'|'+R+center('实时采集 · 动态选题 · 全平台分发', W-2)+Cy+'|')
print(Cy+'|' +R+center(today, W-2)+Cy+'|')
line()

sw = W-4
line()
s1 = (f'  {Bo}{Cy}📡 选题{R}  {Bo}{Wh}{pL(len(pool),3)}{R}{Gy} 个母题  '
      f'{Bo}{Cy}🔀 方向{R}  {Bo}{Wh}{pL(len(pool)*5,4)}{R}{Gy} 个  '
      f'{Bo}{Cy}📡 分发{R}  {Bo}{Wh}{pL(len(routes),5)}{R}{Gy} 条')
print(Cy+'|'+R+p(s1, sw)+Cy+'|'+R)
pLine = (f'  {Gr}■ P0 {pL(pCount["P0"],5)}  {Ye}■ P1 {pL(pCount["P1"],5)}  '
         f'{Gy}■ P2 {pL(pCount["P2"],5)}  {Bo}{Cy}平台数 {pL(len(byPlat),2)} 个')
print(Cy+'|'+R+p(pLine, sw)+Cy+'|'+R)
line()
print()

# ── TOP 15 Topics ─────────────────────────────────────────────────────
print(Bo+Wh+center('【 TOP 15 选题池 】', W)+R)
cols = [4, 52, 14, 8, 10]

def row(cells):
    parts = []
    for i, c in enumerate(cells):
        w = cols[i]
        cell = pL(c, w) if i == 0 else p(c, w)
        parts.append(Wh+cell+R)
    print(Cy+'|'+R+'|'.join(parts)+Cy+'|'+R)

def tsep():
    print(Cy+'+'+'+'.join(['-'*w for w in cols])+'+'+R)

tsep()
row(['#','选题标题','最优平台','得分','优先级'])
tsep()
scTop = []
for i, tp in enumerate(pool[:15]):
    si = next((r for r in (d.get('topic_scores',{}).get('results',[]) or [])
              if r and r.get('topic_id') == tp.get('topic_id')), {})
    top = ((si.get('platform_ranking') or [{}])[0]) or {}
    scTop.append({'rank':i+1,'title':tp.get('title',''),'platform':si.get('best_platform','--'),
                  'score':top.get('score',0)})

for r in scTop:
    sc = Gr if r['score']>=3 else Ye if r['score']>=2.5 else Gy
    row([str(r['rank']), t(r['title'], cols[1]-1), p(r['platform'], cols[2]),
         sc+pL(f"{r['score']:.2f}", cols[3]-2)+R, p('--', cols[4])])
    tsep()
print()

# ── Calendar ──────────────────────────────────────────────────────────
print(Bo+Wh+center('【 7日发布日历 】', W)+R)
dates = sorted(cal.keys())
platColW = 16
dateColW = max(1, (W - platColW - 2) // max(len(dates), 1))
PLATNAMES = ['知乎','微信公众号','百家号','今日头条','雪球','网易新闻','搜狐号',
            '腾讯新闻','新浪新闻','凤凰新闻','艾氪智能OS（短视频）','JovaAI视频号']

def hline(): print(Cy+'+'+'-'*platColW+'+'+'+'.join(['-'*dateColW]*len(dates))+'+'+R)

hline()
hdr = Cy+'|'+R+Bo+Bl+p('平台', platColW)+R+Cy+'|'+R
for dt in dates:
    wd = cal[dt].get('weekday','')
    hdr += Bo+Bl+p(dt[5:]+' '+wd, dateColW)+R+Cy+'|'+R
print(hdr)
hline()
for plat in PLATNAMES:
    line = Cy+'|'+R+Wh+p(plat, platColW)+R+Cy+'|'+R
    for dt in dates:
        slots = cal[dt].get('slots', [])
        slot = next((s for s in slots if s.get('platform_name') == plat), {})
        tme = (slot.get('time') or '')[:5] or '  '
        pri = slot.get('priority','') or ''
        col = Gr if pri=='P0' else Ye if pri=='P1' else Gy
        line += col+p(tme+' '+pri, dateColW)+R+Cy+'|'+R
    print(line)
hline()
print()

# ── Platform Bars ────────────────────────────────────────────────────────
print(Bo+Wh+center('【 平台分发分布 】', W)+R)
maxC = max(byPlat.values(), default=1)
for plat, cnt in sorted(byPlat.items(), key=lambda x: -x[1]):
    barLen = round(cnt/maxC*50)
    print(f'  {Wh}{p(plat,16)}{R} {Cy}{"█"*barLen}{Gy}{"░"*(50-barLen)}{R}  {Bo}{Cy}{pL(cnt,3)}{R}{Gy} 条')
print()

# ── Trend Brief ──────────────────────────────────────────────────────
print(Bo+Wh+center('【 Trend Brief 示例 】', W)+R)
if brief.get('brief_id'):
    si = (brief.get('meta') or {}).get('search_intent') or {}
    meta = brief.get('meta') or {}
    bi = W-4
    print(Ma+'+'+'-'*bi+'+'+R)

    def kv(k, v):
        print(Cy+'|'+R+f'  {Bo}{p(k,12)}{R} {v}')

    kv('Brief ID', Wh+(brief.get('brief_id') or '--'))
    kv('选题', Wh+t(meta.get('topic_title') or '--', 60))
    kv('方向', Wh+t(meta.get('direction_title') or '--', 60))
    kv('目标平台', Gr+(meta.get('target_platform') or '--')+' '+Gy+'/ '+Wh+(meta.get('target_account') or '--'))
    si_type = si.get('intent_type')
    kv('Search Intent', Ye+si_type+Gy+f' (强度:{si.get("intent_strength","?")}' if si_type else Gy+'--')
    kv('内容形式', Wh+(meta.get('content_form') or '--'))
    print(Ma+'+'+'-'*bi+'+'+R)

    claims = brief.get('core_claims') or []
    if claims:
        print(Bo+Ma+'\n  核心论点:'+R)
        for i, c in enumerate(claims[:3]):
            print(f'  {i+1}. {Wh}{t(c.get("statement","")[:W-8])}')
    es = brief.get('evidence_sufficiency') or {}
    esCol = Gr if es.get('level')=='sufficient' else Ye if es.get('level')=='adequate' else Re
    print(f'\n  {Bo}{Cy}证据充分度: {R}{esCol}{es.get("message","--")}  {Gy}(评分:{es.get("score","?")}/5){R}')
else:
    print(Gy+'  无数据'+R)

print()
print(Gy+f'  文件: mock-data/agent5-complete-output.json\n  重生成: node agent5-core.js{R}')
