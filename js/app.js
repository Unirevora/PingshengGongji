(function () {
  'use strict';
  const data=window.PSGJ_DATA,people=window.PSGJ_PEOPLE;
  if(!data||!people){document.getElementById('main').innerHTML='<p class="noscript-note">数据未能加载。请保持 data 目录与 index.html 在同一项目文件夹内。</p>';return;}
  const {escapeHTML:esc,searchPeople,makeCSV,normalize}=window.PSGJCore;
  const chars=window.PSGJ_SEARCH_CHARS||{};
  const charts=window.PSGJCharts;
  const $=id=>document.getElementById(id);
  const nf=n=>Number(n).toLocaleString('en-US');
  const date=n=>n?`${n} 年`:'未详';
  const life=p=>`${p.birth||'生年未详'}—${p.death||'卒年未详'}`;
  const personById=new Map(people.map(p=>[p.id,p]));
  const state={view:'overview',mapMode:'geo',chartMode:'2d',atlasSelected:null,query:'',searchMode:'name',period:'',page:0,selected:3915,profileTab:'overview',place:null,placeMode:null,entryCode:null};
  let results=people,atlasMap,heroMap,toastTimer,searchTimer;
  const perPage=6;
  const views=['overview','atlas','career','people','sources'];

  for(const el of document.querySelectorAll('[data-stat]')){const value=data.meta[el.dataset.stat];if(value!=null)el.textContent=nf(value);}
  $('entry-coverage').textContent=`占唐代样本 ${ (data.meta.entryPeople/data.meta.people*100).toFixed(2)}%`;
  const jinshi=data.entries.find(e=>e.code===36);
  $('jinshi-note').textContent=`进士（笼统）关联 ${nf(jinshi.count)} 人，共 ${nf(jinshi.records)} 条记录。它在这份入仕资料中最常见。比较时要同时记住：有记录者共 1,824 人，未覆盖其余唐代人物。`;

  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
  function save(filename,text,type='text/csv;charset=utf-8'){
    const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(`已导出 ${filename}`);
  }
  function getAtlasRows(){return state.mapMode==='geo'?data.geography:data.activity;}
  function peopleHash(){
    const params=new URLSearchParams();
    if(state.selected!=null)params.set('id',state.selected);
    if(state.query)params.set('q',state.query);
    if(state.searchMode!=='name')params.set('mode',state.searchMode);
    if(state.period)params.set('period',state.period);
    if(state.place){params.set('place',state.place);params.set('placeMode',state.placeMode||'geo');}
    if(state.entryCode!=null)params.set('entry',state.entryCode);
    return 'people'+(params.size?'?'+params.toString():'');
  }
  function syncPeopleURL(){history.replaceState(null,'','#'+peopleHash());}

  function buildOverview(){
    heroMap=charts.createMap($('hero-map'),data.geography,{hero:true});
    const dufu=personById.get(3915);
    $('dufu-address-count').textContent=dufu.addresses.length;
    $('dufu-posting-count').textContent=dufu.postings.length;
    const dated=dufu.postings.filter(p=>p.start).slice(0,4);
    $('dufu-timeline').innerHTML=dated.map(p=>`<div class="timeline-row"><span class="timeline-year">${p.start}</span><div><h3>${esc(p.office)}</h3><p>${p.places.length?p.places.map(k=>esc(data.places[k]?.name||'地点未详')).join(' · '):'任职地点未详'} · 任职记录 #${p.id}</p></div></div>`).join('')+`<div class="timeline-row"><span class="timeline-year unknown">年未详</span><div><h3>策試</h3><p>入仕编码 329 · 数据库该条未载确切年份</p></div></div>`;
  }

  function renderAtlas(){
    const rows=getAtlasRows();
    const isGeo=state.mapMode==='geo';
    $('atlas-mode-title').textContent=isGeo?'籍贯来源':'任职活动';
    $('ranking-title').textContent=isGeo?'籍贯地排行':'任职地排行';
    const covered=isGeo?data.meta.geoPeople:data.meta.activityPeople;
    $('atlas-coverage').textContent=`${nf(covered)} / ${nf(data.meta.people)} 人 · ${(covered/data.meta.people*100).toFixed(2)}% 有${isGeo?'籍贯':'任职地'}记录`;
    for(const b of document.querySelectorAll('[data-map-mode]')){const active=b.dataset.mapMode===state.mapMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}
    $('atlas-ranks').innerHTML=rows.slice(0,12).map((r,i)=>`<button class="rank-row${state.atlasSelected===r.key?' selected':''}" data-place-key="${esc(r.key)}" aria-label="选择${esc(r.name)}，${nf(r.count)}人"><small>${String(i+1).padStart(2,'0')}</small><span>${esc(r.name)}</span><strong>${nf(r.count)}</strong><i class="rank-bar" style="--value:${r.count/rows[0].count}"></i></button>`).join('');
    atlasMap=charts.createMap($('atlas-map'),rows,{onSelect:selectPlace});
    charts.renderRanking(rows,state.chartMode,selectPlace);
    if(state.atlasSelected){const selected=rows.find(r=>r.key===state.atlasSelected);if(selected)selectPlace(selected);else clearAtlasSelection();}
  }
  function clearAtlasSelection(){state.atlasSelected=null;$('map-selection').classList.remove('visible');atlasMap?.select(null);}
  function selectPlace(row,focus=false){
    state.atlasSelected=row.key;atlasMap?.select(row.key,focus);
    for(const r of document.querySelectorAll('[data-place-key]'))r.classList.toggle('selected',r.dataset.placeKey===row.key);
    $('map-selection').innerHTML=`<h3>${esc(row.name)} <small>${nf(row.count)} 人</small></h3><p>${row.ids.length} 个历史编码 · ${nf(row.records)} 条地点记录</p><button class="text-link" data-action="people-at-place">查看关联人物 →</button>`;
    $('map-selection').classList.add('visible');
  }

  function renderEntryTable(){
    const q=normalize($('entry-filter').value,chars);
    const rows=data.entries.filter(e=>normalize(e.name,chars).includes(q)||String(e.code).includes(q));
    $('entry-table').innerHTML=rows.length?rows.map(e=>`<tr><td>${esc(e.name)}<small>编码 ${e.code}</small></td><td class="count">${nf(e.count)}</td><td class="count">${nf(e.records)}</td><td><button class="text-button" data-entry-code="${e.code}">查看人物 →</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty-state">没有匹配的入仕途径</td></tr>';
  }
  function filterByEntry(code){
    state.entryCode=Number(code);state.place=null;state.query='';state.period='';state.searchMode='name';state.page=0;
    state.selected=null;
    if(state.view==='people'){renderPeople(true);syncPeopleURL();}else location.hash=peopleHash();
  }

  function syncSearchUI(){
    $('people-query').value=state.query;$('search-mode').value=state.searchMode;$('birth-period').value=state.period;
    const placeholders={name:'输入姓名、拼音或 CBDB 编号，如 杜甫',address:'输入相关地点，支持简繁体，如 长安',entry:'输入入仕途径，如 进士、策试',office:'输入任职官职，如 參軍、刺史'};
    $('people-query').placeholder=placeholders[state.searchMode];
  }
  function runSearch(){
    if(state.view!=='people')return;
    state.query=$('people-query').value.trim();state.searchMode=$('search-mode').value;state.period=$('birth-period').value;state.page=0;
    renderPeople(true);
    syncPeopleURL();
  }
  function renderPeople(selectFirst=false){
    syncSearchUI();
    results=searchPeople(people,{query:state.query,mode:state.searchMode,period:state.period,place:state.place,placeMode:state.placeMode,entryCode:state.entryCode},chars);
    if(selectFirst){
      if(results.length){state.selected=results[0].id;state.profileTab='overview';}
      else state.selected=null;
    }
    const restricted=state.place||state.entryCode!=null;
    $('active-filters').hidden=!restricted;
    if(restricted){
      const label=state.place?`${state.placeMode==='geo'?'籍贯':'任职地'}：${data.places[state.place]?.name||'选定地点'}`:`入仕：${data.entries.find(e=>e.code===state.entryCode)?.name||state.entryCode}`;
      $('active-filters').innerHTML=`<span>当前筛选 · ${esc(label)}</span><button class="text-button" data-action="clear-context">清除筛选 ×</button>`;
    }
    const pages=Math.max(1,Math.ceil(results.length/perPage));state.page=Math.min(state.page,pages-1);
    $('result-count').textContent=`${nf(results.length)} 位匹配人物`;
    const slice=results.slice(state.page*perPage,(state.page+1)*perPage);
    $('people-results').innerHTML=slice.length?slice.map(p=>`<button class="person-result${p.id===state.selected?' active':''}" data-result-person="${p.id}" aria-pressed="${p.id===state.selected}"><span class="person-result-top"><strong>${esc(p.name)}</strong><span class="person-id">#${p.id}</span></span><small>${esc(life(p))} · ${p.addresses.length} 个地点</small></button>`).join(''):'<div class="empty-state"><strong>未找到人物</strong><p>试试更短的关键词，或调整出生年代。</p><button class="text-button" data-action="clear-search">清除检索条件 →</button></div>';
    $('page-label').textContent=`${state.page+1} / ${nf(pages)}`;
    document.querySelector('[data-action="prev-page"]').disabled=state.page===0;
    document.querySelector('[data-action="next-page"]').disabled=state.page>=pages-1;
    renderProfile();
  }
  function pickPerson(id,updateHash=true){
    const p=personById.get(Number(id));if(!p)return;
    state.selected=p.id;state.profileTab='overview';
    if(!results.some(r=>r.id===p.id)){
      state.query='';state.period='';state.place=null;state.entryCode=null;results=people;
    }
    const index=results.findIndex(r=>r.id===p.id);if(index>=0)state.page=Math.floor(index/perPage);
    if(updateHash)syncPeopleURL();
    renderPeople();
    if(window.innerWidth<=640)$('person-profile').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }

  function renderProfile(){
    const p=personById.get(state.selected);
    if(!p){$('person-profile').innerHTML='<div class="empty-state"><strong>选择一位人物</strong><p>检索人物，或从左侧结果中选择一位。</p></div>';return;}
    const rawAddresses=p.addresses.reduce((n,r)=>n+r.records,0);
    const rawEntries=p.entries.reduce((n,r)=>n+r.records,0);
    const rawPostings=p.postings.reduce((n,r)=>n+r.records,0);
    const tabs=[['overview','人物概览'],['addresses','地点记录'],['entries','入仕记录'],['postings','任职记录']];
    $('person-profile').innerHTML=`<div class="profile-heading"><div><p class="eyebrow">PERSONAL RECORD / CBDB #${p.id}</p><h2>${esc(p.name)}</h2><p class="profile-life"><span>${esc(life(p))}</span><span>${esc(p.gender)}</span>${p.age?`<span>记载享年 ${p.age}</span>`:''}</p></div><div class="profile-actions"><button data-action="copy-person">复制链接</button><button data-action="export-person">导出档案 ↓</button></div></div><div class="profile-stats"><div><strong>${p.addresses.length}</strong><span>地点条目 · 原始 ${rawAddresses} 条</span></div><div><strong>${p.entries.length}</strong><span>入仕条目 · 原始 ${rawEntries} 条</span></div><div><strong>${p.postings.length}</strong><span>任职条目 · 原始 ${rawPostings} 条</span></div></div><div class="profile-tabs" role="tablist" aria-label="人物记录分类">${tabs.map(([key,label])=>`<button id="profile-tab-${key}" role="tab" aria-controls="profile-content" aria-selected="${state.profileTab===key}" tabindex="${state.profileTab===key?0:-1}" data-profile-tab="${key}" class="${state.profileTab===key?'active':''}">${label}</button>`).join('')}</div><div class="profile-content" id="profile-content" role="tabpanel" aria-labelledby="profile-tab-${state.profileTab}"></div>`;
    if(state.profileTab==='overview')renderProfileOverview(p);
    if(state.profileTab==='addresses')renderAddresses(p);
    if(state.profileTab==='entries')renderPersonEntries(p);
    if(state.profileTab==='postings')renderPostings(p);
  }

  function renderProfileOverview(p){
    const home=p.addresses.filter(a=>a.typeCode===1);
    const places=[];const seen=new Set();
    for(const a of p.addresses){if(!seen.has(a.key)){places.push(a);seen.add(a.key);}}
    $('profile-content').innerHTML=`<div class="profile-overview-grid"><div class="profile-detail-block"><h3>基本身份</h3><dl class="identity-list"><dt>人物编号</dt><dd>${p.id}</dd><dt>罗马字姓名</dt><dd>${esc(p.roman||'未详')}</dd><dt>出生 / 卒年</dt><dd>${date(p.birth)} / ${date(p.death)}</dd><dt>索引年</dt><dd>${date(p.indexYear)}</dd><dt>籍贯记录</dt><dd>${home.length?home.map(a=>esc(a.name)).join('、'):'未记载'}</dd><dt>入仕途径</dt><dd>${p.entries.length?[...new Set(p.entries.map(e=>esc(e.name)))].join('、'):'未记载'}</dd></dl></div><div class="profile-detail-block"><h3>相关地点</h3><div class="profile-place-tags">${places.slice(0,10).map(a=>`<span>${esc(a.name)}<small>${esc(a.type)}</small></span>`).join('')||'<p class="record-count-note">数据库暂无地点记录</p>'}</div>${places.length>10?`<button class="text-button" data-profile-tab="addresses">查看全部 ${places.length} 个相关地点 →</button>`:''}</div></div><div class="person-note">籍贯记录是数据库中的基本地址，不一定是出生地。索引年用于人物年代定位，不能一律当作出生年。同名人物以 CBDB 编号区分。</div>${p.postings.length?`<div class="profile-mini-timeline"><h3>任职记录节选</h3>${p.postings.slice(0,4).map(r=>postingRow(r)).join('')}<button class="text-button" data-profile-tab="postings">查看全部 ${p.postings.length} 个任职条目 →</button></div>`:''}${p.id===3915?renderDufuRelations():''}`;
  }
  function postingRow(r){return `<div class="mini-posting"><span>${r.start||'年未详'}</span><div>${esc(r.office)}<small>${r.places.length?r.places.map(k=>esc(data.places[k]?.name||'地点未详')).join(' · '):'任职地未详'} · 记录 #${r.id}</small></div></div>`;}
  function renderDufuRelations(){
    const relatives=data.relations.filter(r=>[32540,32227,32174].includes(r.id));
    const rest=data.relations.filter(r=>!relatives.includes(r));
    return `<div class="profile-relations"><h3>杜甫的社会关系记录</h3><p class="record-count-note">共 ${data.meta.dufuRelations} 条原始关系记录。下列关系标签沿用数据库表述。</p><div class="relation-chips">${[...relatives,...rest].slice(0,8).map(r=>personById.has(r.id)?`<button data-person="${r.id}">${esc(r.name)}<small>${esc(r.type)}</small></button>`:`<span class="small-tag">${esc(r.name)} · ${esc(r.type)}</span>`).join('')}</div></div>`;
  }
  function emptyRecords(label){return `<div class="empty-state"><strong>${label}未记载</strong><p>缺失记录不表示该人物没有相应经历。</p></div>`;}
  function sourceDetails(rows){
    if(!rows?.length)return '';
    return `<details class="source-details"><summary>查看 ${rows.length} 条原始依据</summary>${rows.map((r,i)=>`<p>${i+1}. 序号 ${r.sequence??'未详'}${r.addrId!=null?` · 地址 #${r.addrId}`:''}<br>来源编号 ${r.source||'未载'} · 页码 ${esc(r.pages||'未载')}${r.notes?`<br>${esc(r.notes)}`:''}${r.assumeOfficeCode!=null?`<br>赴任状态编码 ${r.assumeOfficeCode}`:''}</p>`).join('')}</details>`;
  }
  function renderAddresses(p){
    $('profile-content').innerHTML=p.addresses.length?`<p class="record-count-note">按地点、类别与起止年合并展示；“原始条数”保留归并前的数量。</p><div class="table-scroll"><table class="data-table profile-table"><thead><tr><th>地点 / 地址编码</th><th>地点类别</th><th>年代</th><th>原始条数</th></tr></thead><tbody>${p.addresses.map(a=>`<tr><td>${esc(a.name)}<small>${a.ids.join(' / ')}</small>${sourceDetails(a.sourceRows)}</td><td>${esc(a.type)}</td><td>${a.start||a.end?`${a.start||'未详'}—${a.end||'未详'}`:'年未详'}</td><td>${a.records}</td></tr>`).join('')}</tbody></table></div><div class="person-note">这些是人物地点记录。任职地点见“任职记录”，不由“前住地”或“游历”推断。</div>`:emptyRecords('地点');
  }
  function renderPersonEntries(p){
    $('profile-content').innerHTML=p.entries.length?`<p class="record-count-note">同一途径与年份合并展示；具体出处与原始备注保留在详情中。</p><div class="table-scroll"><table class="data-table profile-table"><thead><tr><th>入仕途径</th><th>年份</th><th>原始条数</th></tr></thead><tbody>${p.entries.map(e=>`<tr><td>${esc(e.name)}<small>编码 ${e.code}</small>${sourceDetails(e.sourceRows)}</td><td>${e.year||'年未详'}</td><td>${e.records}</td></tr>`).join('')}</tbody></table></div>`:emptyRecords('入仕');
  }
  function renderPostings(p){
    $('profile-content').innerHTML=p.postings.length?`<p class="record-count-note">按任职编号、官职编号与起止年展示；缺失年份不以传记补齐。</p><div class="table-scroll"><table class="data-table profile-table"><thead><tr><th>官职 / 记录</th><th>任职地点</th><th>年代</th></tr></thead><tbody>${p.postings.map(r=>`<tr><td>${esc(r.office)}<small>任职 #${r.id} · 官职 #${r.officeId}</small>${sourceDetails(r.sourceRows)}</td><td>${r.places.length?r.places.map(k=>esc(data.places[k]?.name||'未详')).join('、'):'未详'}</td><td>${r.start||r.end?`${r.start||'未详'}—${r.end||'未详'}`:'年未详'}</td></tr>`).join('')}</tbody></table></div>`:emptyRecords('任职');
  }

  function renderSchema(index=0){
    const table=data.schema[index];
    $('schema-tabs').innerHTML=data.schema.map((t,i)=>`<button id="schema-tab-${i}" role="tab" aria-controls="schema-panel" aria-selected="${i===index}" tabindex="${i===index?0:-1}" data-schema="${i}">${esc(t.label)}</button>`).join('');
    $('schema-panel').setAttribute('aria-labelledby',`schema-tab-${index}`);
    $('schema-panel').innerHTML=`<div class="schema-summary"><code>${table.name}</code><span>全库 ${nf(table.rows)} 条记录 · ${table.columns.length} 个字段 · 以人物编号关联</span></div><div class="field-list">${table.columns.map(c=>`<div class="field-row"><code>${esc(c.name)}${c.primary?'<b class="key-tag">主键</b>':''}</code><span>${esc(c.label||'原始字段')} · ${esc(c.type)}</span></div>`).join('')}</div>`;
  }

  function route(){
    clearTimeout(searchTimer);
    const raw=location.hash.slice(1)||'overview';const [requested,queryString='']=raw.split('?');
    const next=views.includes(requested)?requested:'overview';const old=state.view;state.view=next;
    for(const v of views)$(`view-${v}`).hidden=v!==next;
    for(const a of document.querySelectorAll('[data-view]')){if(a.dataset.view===next)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    const titles={overview:'唐代人物的山河与仕途',atlas:'山河分布',career:'入仕与任职',people:'人物档案',sources:'数据与方法'};
    document.title=`平生功绩 · ${titles[next]}`;
    if(next==='atlas')requestAnimationFrame(renderAtlas);
    if(next==='career'){renderEntryTable();requestAnimationFrame(()=>charts.renderEntry(data,filterByEntry));}
    if(next==='people'){
      const params=new URLSearchParams(queryString),id=Number(params.get('id'));
      state.query=params.get('q')||'';state.searchMode=params.get('mode')||'name';
      if(!['name','address','entry','office'].includes(state.searchMode))state.searchMode='name';
      state.period=params.get('period')||'';state.place=params.get('place')||null;state.placeMode=params.get('placeMode')||'geo';state.entryCode=params.has('entry')?Number(params.get('entry')):null;
      state.selected=personById.has(id)?id:3915;state.profileTab='overview';state.page=0;
      renderPeople(false);
      if(!results.some(p=>p.id===state.selected)){state.selected=results[0]?.id??null;renderPeople(false);}
      const index=results.findIndex(p=>p.id===state.selected);if(index>=0){state.page=Math.floor(index/perPage);renderPeople(false);}
      syncPeopleURL();
    }
    if(next==='sources')renderSchema();
    if(old!==next)window.scrollTo({top:0,behavior:'instant'});
    requestAnimationFrame(()=>charts.resize());
  }

  document.addEventListener('click',async e=>{
    const person=e.target.closest('[data-person]');if(person){
      state.query='';state.place=null;state.entryCode=null;state.period='';state.searchMode='name';state.selected=Number(person.dataset.person);state.profileTab='overview';
      if(state.view!=='people'){location.hash=peopleHash();}else{results=people;pickPerson(state.selected);}return;
    }
    const result=e.target.closest('[data-result-person]');if(result){pickPerson(result.dataset.resultPerson);return;}
    const profileTab=e.target.closest('[data-profile-tab]');if(profileTab){state.profileTab=profileTab.dataset.profileTab;renderProfile();$(`profile-tab-${state.profileTab}`)?.focus({preventScroll:true});return;}
    const schema=e.target.closest('[data-schema]');if(schema){renderSchema(Number(schema.dataset.schema));$(`schema-tab-${schema.dataset.schema}`).focus({preventScroll:true});return;}
    const mode=e.target.closest('[data-map-mode]');if(mode){state.mapMode=mode.dataset.mapMode;clearAtlasSelection();renderAtlas();return;}
    const chartMode=e.target.closest('[data-chart-mode]');if(chartMode){state.chartMode=chartMode.dataset.chartMode;for(const b of document.querySelectorAll('[data-chart-mode]')){const active=b===chartMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}charts.renderRanking(getAtlasRows(),state.chartMode,selectPlace);return;}
    const rank=e.target.closest('[data-place-key]');if(rank){const row=getAtlasRows().find(r=>r.key===rank.dataset.placeKey);if(row)selectPlace(row,true);return;}
    const entry=e.target.closest('[data-entry-code]');if(entry){filterByEntry(entry.dataset.entryCode);return;}
    const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='focus-search'){if(state.view!=='people'){location.hash='people';setTimeout(()=>$('people-query').focus(),30);}else $('people-query').focus();}
    if(action==='map-zoom-in')atlasMap?.zoom(.25);
    if(action==='map-zoom-out')atlasMap?.zoom(-.25);
    if(action==='map-reset'){atlasMap?.reset();clearAtlasSelection();}
    if(action==='people-at-place'){state.place=state.atlasSelected;state.placeMode=state.mapMode;state.entryCode=null;state.query='';state.period='';state.page=0;state.searchMode='name';state.selected=null;location.hash=peopleHash();}
    if(action==='clear-context'){state.place=null;state.entryCode=null;state.page=0;renderPeople(true);syncPeopleURL();}
    if(action==='clear-search'){state.query='';state.period='';state.searchMode='name';state.place=null;state.entryCode=null;state.page=0;state.selected=3915;state.profileTab='overview';renderPeople();syncPeopleURL();}
    if(action==='prev-page'&&state.page>0){state.page--;renderPeople();}
    if(action==='next-page'&&(state.page+1)*perPage<results.length){state.page++;renderPeople();}
    if(action==='copy-person'){
      const url=`${location.href.split('#')[0]}#people?id=${state.selected}`;
      try{await navigator.clipboard.writeText(url);toast('已复制人物档案链接');}catch(error){toast('浏览器限制剪贴板，可复制地址栏中的档案链接');}
    }
    if(action==='export-atlas'){save(`平生功绩_${state.mapMode==='geo'?'籍贯':'任职地'}.csv`,makeCSV(['地点','关联人数','原始记录数','地址编码','经度','纬度'],getAtlasRows().map(r=>[r.name,r.count,r.records,r.ids.join('|'),r.lon,r.lat])));}
    if(action==='export-entry'){save('平生功绩_入仕途径.csv',makeCSV(['途径编码','途径名称','关联人数','原始记录数'],data.entries.map(r=>[r.code,r.name,r.count,r.records])));}
    if(action==='export-people'){save('平生功绩_人物检索.csv',makeCSV(['CBDB编号','姓名','出生年','卒年','性别','地点条目','入仕条目','任职条目'],results.map(p=>[p.id,p.name,p.birth,p.death,p.gender,p.addresses.length,p.entries.length,p.postings.length])));}
    if(action==='export-person'){const p=personById.get(state.selected);if(p)save(`平生功绩_${p.name}_${p.id}.json`,JSON.stringify(p,null,2),'application/json;charset=utf-8');}
  });
  $('people-search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);runSearch();});
  $('people-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,180);});
  $('search-mode').addEventListener('change',runSearch);
  $('birth-period').addEventListener('change',runSearch);
  $('entry-filter').addEventListener('input',renderEntryTable);
  document.addEventListener('keydown',e=>{
    const tag=e.target.tagName;
    if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();document.querySelector('[data-action="focus-search"]').click();}
    if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&e.target.getAttribute('role')==='tab'){
      e.preventDefault();const tabs=[...e.target.parentElement.querySelectorAll('[role=tab]')];const i=tabs.indexOf(e.target);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();
    }
    if(e.key==='Escape'){$('toast').hidden=true;clearAtlasSelection();}
  });
  window.addEventListener('hashchange',route);
  buildOverview();route();
  window.PSGJ_APP={state,getResults:()=>results};
})();
