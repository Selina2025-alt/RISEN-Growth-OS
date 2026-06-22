#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const C = {R:'[0m',Bo:'[1m',Re:'[31m',Gr:'[32m',Ye:'[33m',Bl:'[34m',Ma:'[35m',Cy:'[36m',Wh:'[37m',Gy:'[90m'};
const W = process.stdout.columns || 120;
const p = (s,n) => String(s||'').padEnd(n);
const pL = (s,n) => String(s||'').padStart(n);
const t = (s,n) => String(s||'').length<=n ? String(s||'') : String(s||'').slice(0,n-1)+'~';
const center = (s,w) => { w=w||W; const sl=s.length; return ' '.repeat(Math.floor((w-sl)/2))+s+' '.repeat(Math.ceil((w-sl)/2)); };

const dataPath = path.join(__dirname,'mock-data','agent5-complete-output.json');
if(!fs.existsSync(dataPath)){ console.log(C.Re+'ERROR: run node agent5-core.js first'+C.R); process.exit(1); }
const d = JSON.parse(fs.readFileSync(dataPath,'utf8'));
const pool = d.topic_pool.topics||[];
const routes = d.distribution_map.routes||[];
const cal = d.editorial_calendar.calendar||{};
const brief = d.topic_brief.brief||{};
const today = new Date().toISOString().slice(0,10);

const pCount={P0:0,P1:0,P2:0};
routes.forEach(r=>{ if(pCount[r.priority]!==undefined) pCount[r.priority]++; });
const byPlat={};
Object.values(cal).forEach(day=>{ (day.slots||[]).forEach(s=>{ byPlat[s.platform_name]=(byPlat[s.platform_name]||0)+1; }); });

const scTop = pool.slice(0,15).map((tp,i)=>{
  const si=(d.topic_scores&&d.topic_scores.results||[]).find(r=>r&&r.topic_id===tp.topic_id)||{};
  const top=((si.platform_ranking||[])[0])||{};
  return{rank:i+1,title:tp.title||'',platform:si.best_platform||'--',score:top.score||0};
});

const dateKeys = Object.keys(cal).sort();
const platColW = 16;
const dateColW = Math.floor((W-platColW-2)/Math.max(dateKeys.length,1));
const PLATNAMES = ['知乎','微信公众号','百家号','今日头条','雪球','网易新闻','搜狐号','腾讯新闻','新浪新闻','凤凰新闻','艾氪智能OS（短视频）','JovaAI视频号'];

const line = () => console.log(C.Cy+'+'+'-'.repeat(W-2)+'+'+C.R);

// HEADER
line();
console.log(C.Cy+'|'+C.R+center('Agent 5 · 趋势与选题智能体',W-2)+C.Cy+'|');
console.log(C.Cy+'|'+C.R+center('实时采集 · 动态选题 · 全平台分发',W-2)+C.Cy+'|');
console.log(C.Cy+'|'+C.R+center(today,W-2)+C.Cy+'|');
line();

// STATS
const sw=W-4;
line();
const s1='  '+C.Bo+C.Cy+'📡 选题'+C.R+'  '+C.Bo+C.Wh+pL(pool.length,3)+C.R+C.Gy+' 个母题  '+C.Bo+C.Cy+'🔀 方向'+C.R+'  '+C.Bo+C.Wh+pL(pool.length*5,4)+C.R+C.Gy+' 个  '+C.Bo+C.Cy+'📡 分发'+C.R+'  '+C.Bo+C.Wh+pL(routes.length,5)+C.R+C.Gy+' 条';
console.log(C.Cy+'|'+C.R+p(s1,sw)+C.Cy+'|'+C.R);
const pLine='  '+C.Gr+'■ P0 '+pL(pCount.P0,5)+'  '+C.Ye+'■ P1 '+pL(pCount.P1,5)+'  '+C.Gy+'■ P2 '+pL(pCount.P2,5)+'  '+C.Bo+C.Cy+'平台数 '+pL(Object.keys(byPlat).length,2)+' 个';
console.log(C.Cy+'|'+C.R+p(pLine,sw)+C.Cy+'|'+C.R);
line();
console.log('');

// TOPICS TABLE
console.log(C.Bo+C.Wh+center('【 TOP 15 选题池 】',W)+C.R);
const cols=[4,52,14,8,10];
const row = (cells) => { process.stdout.write(C.Cy+'|'+C.R); cells.forEach((c,i)=>{ const w=cols[i]; process.stdout.write((i===0?C.Wh+pL(c,w):C.Wh+p(c,w))+C.R+C.Cy+'|'+C.R; }); process.stdout.write('\n'); };
const tsep = () => { process.stdout.write(C.Cy+'|'); cols.forEach((w,i)=>{ process.stdout.write('-'.repeat(w)+(i<cols.length-1?'+':'+')); }); process.stdout.write(C.R+'\n'); };
tsep();
row(['#','选题标题','最优平台','得分','优先级']);
tsep();
scTop.forEach((r,i)=>{
  const sc=r.score>=3?C.Gr:r.score>=2.5?C.Ye:C.Gy;
  row([String(r.rank),t(r.title,cols[1]-1),p(r.platform,cols[2]),sc+pL(r.score.toFixed(2),cols[3]-2)+C.R,'--']);
  if(i<scTop.length-1) tsep();
});
tsep();
console.log('');

// CALENDAR
console.log(C.Bo+C.Wh+center('【 7日发布日历 】',W)+C.R);
process.stdout.write(C.Cy+'+'); process.stdout.write('-'.repeat(platColW)+'+'); dateKeys.forEach(()=>{ process.stdout.write('-'.repeat(dateColW)+'+'); }); process.stdout.write(C.R+'\n');
process.stdout.write(C.Cy+'|'+C.R+C.Wh+p('平台',platColW)+C.R+C.Cy+'|'+C.R);
dateKeys.forEach(d=>{ const wd=(cal[d]&&cal[d].weekday)||''; process.stdout.write(C.Wh+p(d.slice(5)+' '+wd,dateColW)+C.R+C.Cy+'|'+C.R); });
process.stdout.write('\n');
process.stdout.write(C.Cy+'+'); process.stdout.write('-'.repeat(platColW)+'+'); dateKeys.forEach(()=>{ process.stdout.write('-'.repeat(dateColW)+'+'); }); process.stdout.write(C.R+'\n');
PLATNAMES.forEach((plat)=>{
  process.stdout.write(C.Cy+'|'+C.R+C.Wh+p(plat,platColW)+C.R+C.Cy+'|'+C.R);
  dateKeys.forEach(d=>{
    const slots=(cal[d]&&cal[d].slots)||[];
    const slot=slots.find(s=>s&&s.platform_name===plat)||{};
    const time=(slot&&slot.time)?slot.time.slice(0,5):'  ';
    const pri=(slot&&slot.priority)||'';
    const col=pri==='P0'?C.Gr:pri==='P1'?C.Ye:C.Gy;
    process.stdout.write(col+p(time+' '+pri,dateColW)+C.R+C.Cy+'|'+C.R);
  });
  process.stdout.write('\n');
});
process.stdout.write(C.Cy+'+'); process.stdout.write('-'.repeat(platColW)+'+'); dateKeys.forEach(()=>{ process.stdout.write('-'.repeat(dateColW)+'+'); }); process.stdout.write(C.R+'\n');
console.log('');

// PLATFORM BARS
console.log(C.Bo+C.Wh+center('【 平台分发分布 】',W)+C.R);
const maxC=Math.max(...Object.values(byPlat),1);
Object.entries(byPlat).sort((a,b)=>b[1]-a[1]).forEach(([plat,count])=>{
  const barLen=Math.round((count/maxC)*50);
  process.stdout.write('  '+C.Wh+p(plat,16)+C.R+' '+C.Cy+'█'.repeat(barLen)+C.Gy+'░'.repeat(50-barLen)+C.R+'  '+C.Bo+C.Cy+pL(count,3)+C.R+C.Gy+' 条\n');
});
console.log('');

// TREND BRIEF
console.log(C.Bo+C.Wh+center('【 Trend Brief 示例 】',W)+C.R);
if(brief.brief_id){
  const si=(brief.meta&&brief.meta.search_intent)||{};
  const meta=brief.meta||{};
  const bi=W-4;
  console.log(C.Ma+'+'+'-'.repeat(bi)+'+'+C.R);
  const kv=(k,v)=>{ process.stdout.write(C.Cy+'|'+C.R+'  '+C.Bo+p(k,12)+C.R+' '+v+'\n'); };
  kv('Brief ID',C.Wh+(brief.brief_id||'--'));
  kv('选题',C.Wh+t(meta.topic_title||'--',60));
  kv('方向',C.Wh+t(meta.direction_title||'--',60));
  kv('目标平台',C.Gr+(meta.target_platform||'--')+' '+C.Gy+'/ '+C.Wh+(meta.target_account||'--'));
  kv('Search Intent',si.intent_type?C.Ye+si.intent_type+C.Gy+' (强度:'+si.intent_strength+')' :C.Gy+'--');
  kv('内容形式',C.Wh+(meta.content_form||'--'));
  console.log(C.Ma+'+'+'-'.repeat(bi)+'+'+C.R);
  const claims=brief.core_claims||[];
  if(claims.length>0){
    console.log(C.Bo+C.Ma+'\n  核心论点:'+C.R);
    claims.slice(0,3).forEach((c,i)=>console.log('  '+(i+1)+'. '+C.Wh+t(c.statement||'',W-8)));
  }
  const es=brief.evidence_sufficiency||{};
  const esCol=es.level==='sufficient'?C.Gr:es.level==='adequate'?C.Ye:C.Re;
  console.log('\n  '+C.Bo+C.Cy+'证据充分度: '+C.R+esCol+(es.message||'--')+C.Gy+'  (评分:'+(es.score||'?')+'/5)'+C.R);
} else {
  console.log(C.Gy+'  无数据'+C.R);
}
console.log('');
console.log(C.Gy+'  文件: mock-data/agent5-complete-output.json');
console.log(C.Gy+'  重生成: node agent5-core.js'+C.R);
