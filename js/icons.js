(function(){
  'use strict';
  const paths={
    home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16',
    career:'M4 21h16M6 21V9h12v12M4 9l8-6 8 6M9 12v5m6-5v5',
    people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7a4 4 0 0 1 0 7.75',
    database:'M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Zm0 0v12c0 2.2-3.6 4-8 4s-8-1.8-8-4V6m0 6c0 2.2 3.6 4 8 4s8-1.8 8-4',
    search:'m21 21-5.5-5.5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    arrow:'M4 12h16m-6-6 6 6-6 6',
    left:'M20 12H4m6-6-6 6 6 6',
    external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
    plus:'M12 5v14M5 12h14',minus:'M5 12h14',
    target:'M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    copy:'M9 9h12v12H9Zm6-4V3H3v12h2',
    reset:'M3 4v6h6M3 10a9 9 0 1 1 2 8',
    close:'m6 6 12 12M6 18 18 6',
    chart:'M4 3v18h17M8 17v-6m5 6V7m5 10v-9',
    cube:'m12 3 9 5-9 5-9-5Zm-9 5v9l9 5 9-5V8m-9 5v9',
    pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    book:'M12 6v15m0-15C9 3 5 3 2 4v15c4-1 7-1 10 2m0-15c3-3 7-3 10-2v15c-4-1-7-1-10 2',
    file:'M14 2H4v20h16V8Zm0 0v6h6M8 13h8m-8 4h6',
    code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16',
    filter:'M4 5h16M7 12h10m-7 7h4',
    github:'M9 19c-4 1-4-2-6-2m12 5v-3.4c0-1 .1-1.5-.5-2.1 3.3-.4 6.5-1.6 6.5-7.3A5.8 5.8 0 0 0 19.4 5c.2-.8.1-2-.2-3-1.5-.1-3 1-4 1.5a14 14 0 0 0-6.4 0C7.7 2.8 6.3 1.9 4.8 2c-.4 1-.5 2.2-.2 3A5.8 5.8 0 0 0 3 9.2c0 5.7 3.2 6.9 6.5 7.3-.5.5-.6 1.2-.5 2.1V22',
  };
  function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.arrow}"/></svg>`;}
  function add(element,name){
    if(!element||element.querySelector(':scope > .ui-icon'))return;
    for(const node of [...element.childNodes]){
      if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent.replace(/[↗→←↓＋⌖×]/g,'').trim();
      else if(node.nodeType===Node.ELEMENT_NODE&&['SPAN','B'].includes(node.tagName)&&/^[\s↗→←↓＋⌖−×]+$/.test(node.textContent))node.remove();
    }
    element.insertAdjacentHTML('afterbegin',icon(name));element.classList.add('with-icon');
  }
  function decorate(root=document){
    const select=s=>[...root.querySelectorAll(s)];
    const actionIcons={'focus-search':'search','export-atlas':'download','export-entry':'download','export-people':'download','export-person':'download','copy-person':'copy','clear-search':'reset','clear-context':'close','prev-page':'left','next-page':'arrow','map-zoom-in':'plus','map-zoom-out':'minus','map-reset':'target','people-at-place':'people'};
    for(const el of select('[data-action]')){if(el.dataset.action==='focus-search'&&el.querySelector('svg:not(.ui-icon)'))el.querySelector('svg:not(.ui-icon)').remove();add(el,actionIcons[el.dataset.action]||'arrow');}
    const viewIcons={overview:'home',atlas:'map',career:'career',people:'people',sources:'database'};
    for(const el of select('[data-view]'))add(el,viewIcons[el.dataset.view]);
    for(const el of select('[data-map-mode]'))add(el,el.dataset.mapMode==='geo'?'pin':'career');
    for(const el of select('[data-chart-mode]'))add(el,el.dataset.chartMode==='3d'?'cube':'chart');
    for(const el of select('[data-profile-tab]'))add(el,{overview:'file',addresses:'pin',entries:'book',postings:'career'}[el.dataset.profileTab]);
    for(const el of select('[data-entry-code]'))add(el,'people');
    for(const el of select('[data-schema]'))add(el,'database');
    for(const el of select('.source-details summary'))add(el,'book');
    for(const el of select('.hero-actions a,.chapter,.file-links a,.dufu-heading a,.scope-note a,.site-footer .text-link,.method-intro a')){
      if(el.classList.contains('chapter')){add(el.querySelector('.chapter-bottom'),'arrow');continue;}
      const href=el.getAttribute('href')||'';
      add(el,href.includes('github.com')?'github':href.includes('summary.json')?'download':href.includes('data-method')?'file':href.startsWith('#atlas')?'map':href.startsWith('#people')?'people':href.startsWith('#sources')?'database':'external');
    }
    for(const el of select('.people-search-form button[type=submit]'))add(el,'search');
  }
  window.PSGJIcons={icon,decorate};decorate();
  for(const id of ['person-profile','map-selection','entry-table','schema-tabs']){
    const el=document.getElementById(id);if(!el)continue;
    new MutationObserver(()=>decorate(el)).observe(el,{childList:true,subtree:true});
  }
})();
