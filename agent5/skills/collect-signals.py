#!/usr/bin/env python3
"""
Signal Collector — 统一采集 aihot / follow-builders / tech-news-digest 三个技能的信号
输出标准化 RawSignal[] JSON
"""
import json, sys, os, re, time
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError
from html import unescape

TIMEOUT = 10
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

def fetch_json(url, headers=None):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    req = Request(url, headers=h)
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'[WARN] fetch_json failed {url}: {e}', file=sys.stderr)
        return None

def fetch_text(url, headers=None):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    req = Request(url, headers=h)
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f'[WARN] fetch_text failed {url}: {e}', file=sys.stderr)
        return None

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def short_hash(s):
    h = 0
    for c in s.encode():
        h = ((h << 5) - h) + c
        h &= 0xFFFFFFFF
    return format(abs(h), 'x')[:8]

# ─── Aihot ────────────────────────────────────────────────────────────────

def collect_aihot(limit=8):
    data = fetch_json(f'https://aihot.virxact.com/api/public/items?mode=selected&take={limit}')
    if not data:
        return []
    items = data.get('items') or []
    category_map = {
        'industry': '行业洞察', 'ai-products': '产品发布', 'paper': '论文研究',
        'tip': '利他（教程）', 'product': '企业案例', 'people': '人物观点',
        'security': '行业洞察', 'policy': '行业洞察'
    }
    results = []
    for i, item in enumerate(items):
        cat = item.get('category') or ''
        results.append({
            'id': f'SIG-AIHOT-{item.get("id") or short_hash(item.get("title",""))}',
            'type': 'aihot',
            'title': item.get('title') or item.get('title_en') or f'AI热点 {i+1}',
            'summary': item.get('summary') or '',
            'url': item.get('url') or None,
            'published_at': item.get('publishedAt') or None,
            'collected_at': now_iso(),
            'tags': [cat] if cat else [],
            'weight': min(1.5, (float(item.get('score') or 0)) / 70 + 0.8),
            'content_type': category_map.get(cat, '行业洞察'),
            'metadata': {
                'aihot_id': str(item.get('id') or ''),
                'source_name': item.get('source') or '',
                'category': cat,
                'score': item.get('score') or 0
            }
        })
    print(f'[aihot] ✓ 获得 {len(results)} 条信号', file=sys.stderr)
    return results

# ─── Follow Builders（blogs only，不需要API key） ───────────────────────────

def collect_follow_builders():
    # 直接从博客 RSS / 网页抓取最新文章
    sources = [
        {'name': 'Anthropic Engineering', 'url': 'https://www.anthropic.com/engineering', 'type': 'scrape'},
        {'name': 'Claude Blog', 'url': 'https://claude.com/blog', 'type': 'scrape'},
    ]
    results = []

    # RSS feed URLs for builders
    rss_feeds = [
        ('Anthropic', 'https://www.anthropic.com/feed.xml'),
        ('OpenAI', 'https://openai.com/blog/feed'),
        ('DeepMind', 'https://deepmind.google/blog/rss.xml'),
    ]
    for name, url in rss_feeds:
        xml = fetch_text(url)
        if not xml:
            continue
        # Parse basic RSS
        items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
        for item in items[:3]:
            title_m = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item)
            link_m = re.search(r'<link>(.*?)</link>', item)
            pub_m = re.search(r'<pubDate>(.*?)</pubDate>', item)
            title = unescape(title_m.group(1) or title_m.group(2) or '').strip() if title_m else ''
            link = (link_m.group(1) or '').strip() if link_m else ''
            pub = (pub_m.group(1) or '').strip() if pub_m else None
            if title and link:
                results.append({
                    'id': f'SIG-FB-{short_hash(link)}',
                    'type': 'follow-builders',
                    'title': title,
                    'summary': '',
                    'url': link,
                    'published_at': pub,
                    'collected_at': now_iso(),
                    'tags': [name],
                    'weight': 1.0,
                    'content_type': '行业洞察',
                    'metadata': {'source': name, 'feed': 'rss'}
                })
        if results:
            print(f'[follow-builders] ✓ {name} → {len([r for r in results if r["metadata"]["source"]==name])} 条', file=sys.stderr)

    # Also try direct page scrape for blogs with no RSS
    for src in sources:
        html = fetch_text(src['url'])
        if not html:
            continue
        # Find article links
        links = re.findall(r'href="(https://[^"]*(?:article|blog|news)[^"]*)"[^>]*>([^<]{10,80})</a>', html)
        for link, title in links[:3]:
            title = unescape(title).strip()
            results.append({
                'id': f'SIG-FB-{short_hash(link)}',
                'type': 'follow-builders',
                'title': title,
                'summary': '',
                'url': link,
                'published_at': None,
                'collected_at': now_iso(),
                'tags': [src['name']],
                'weight': 1.0,
                'content_type': '行业洞察',
                'metadata': {'source': src['name'], 'feed': 'scrape'}
            })
    print(f'[follow-builders] ✓ 共 {len(results)} 条信号', file=sys.stderr)
    return results[:15]  # 最多15条

# ─── Tech News Digest（RSS fetch） ─────────────────────────────────────────

def collect_tech_news():
    # 直接抓取主流技术 RSS
    rss_sources = [
        ('HackerNews', 'https://hnrss.org/frontpage'),
        ('TechCrunch', 'https://techcrunch.com/feed/'),
        ('MIT Tech Review', 'https://www.technologyreview.com/feed/'),
        ('VentureBeat AI', 'https://venturebeat.com/category/ai/feed/'),
        ('AI News', 'https://www.artificialintelligence-news.com/feed/'),
    ]
    results = []
    for name, url in rss_sources:
        xml = fetch_text(url)
        if not xml:
            continue
        items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
        count = 0
        for item in items[:5]:
            title_m = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item)
            link_m = re.search(r'<link>(.*?)</link>', item)
            desc_m = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', item)
            pub_m = re.search(r'<pubDate>(.*?)</pubDate>', item)
            title = unescape(title_m.group(1) or title_m.group(2) or '').strip() if title_m else ''
            link = (link_m.group(1) or '').strip() if link_m else ''
            desc = unescape(desc_m.group(1) or desc_m.group(2) or '').strip() if desc_m else ''
            pub = (pub_m.group(1) or '').strip() if pub_m else None
            if title and link:
                results.append({
                    'id': f'SIG-TN-{short_hash(link)}',
                    'type': 'tech-news',
                    'title': title,
                    'summary': re.sub(r'<[^>]+>', '', desc)[:200],
                    'url': link,
                    'published_at': pub,
                    'collected_at': now_iso(),
                    'tags': [name],
                    'weight': 1.0,
                    'content_type': '行业洞察',
                    'metadata': {'source': name, 'feed': 'rss'}
                })
                count += 1
        if count:
            print(f'[tech-news] ✓ {name} → {count} 条', file=sys.stderr)
    print(f'[tech-news] ✓ 共 {len(results)} 条信号', file=sys.stderr)
    return results[:20]

# ─── Main ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    signals = []

    if mode in ('all', 'aihot'):
        signals += collect_aihot(8)
    if mode in ('all', 'follow-builders', 'builders'):
        signals += collect_follow_builders()
    if mode in ('all', 'tech-news', 'tn'):
        signals += collect_tech_news()

    # 去重（按 title 相似度）
    seen = set()
    deduped = []
    for s in signals:
        key = s['title'][:40].lower()
        if key not in seen:
            seen.add(key)
            deduped.append(s)

    output = {
        'collected_at': now_iso(),
        'total': len(deduped),
        'sources': {
            'aihot': len([s for s in deduped if s['type'] == 'aihot']),
            'follow-builders': len([s for s in deduped if s['type'] == 'follow-builders']),
            'tech-news': len([s for s in deduped if s['type'] == 'tech-news']),
        },
        'signals': deduped
    }
    json.dump(output, sys.stdout, ensure_ascii=False)
