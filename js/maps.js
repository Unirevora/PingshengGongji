(function(){
  'use strict';
  const instances=new WeakMap(),live=new Set();
  const esc=PSGJCore.escapeHTML,format=n=>Number(n).toLocaleString('en-US');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const featured=new Set(['長安','洛陽','太原','成都府','揚州','湖州','蘇州','成紀','贊皇','江陵府','越州','范陽']);
  const normalize=text=>PSGJCore.normalize(text,window.PSGJ_SEARCH_CHARS||{});

  function createMap(container,rows,options={}){
    const previous=instances.get(container),saved=previous?.view();
    previous?.destroy();container.replaceChildren();container.classList.add('slippy-map');
    const hero=Boolean(options.hero);
    const map=L.map(container,{zoomControl:false,attributionControl:true,preferCanvas:true,
      dragging:!hero,scrollWheelZoom:!hero,doubleClickZoom:!hero,touchZoom:!hero,boxZoom:!hero,keyboard:!hero,
      minZoom:3,maxZoom:18,zoomSnap:.25,zoomDelta:.75,wheelPxPerZoomLevel:100,wheelDebounceTime:40,
      zoomAnimation:!reduced,fadeAnimation:!reduced,markerZoomAnimation:!reduced,
      maxBounds:[[8,60],[61,150]],maxBoundsViscosity:.7}).setView(saved?.center||[33,108.5],saved?.zoom||4);
    map.attributionControl.setPrefix(false);
    for(const [name,z] of [['paper',180],['basemap',200],['historyLabels',450]]){
      map.createPane(name);map.getPane(name).style.zIndex=z;
    }
    map.getPane('historyLabels').style.pointerEvents='none';
    L.geoJSON(window.PSGJ_GEOGRAPHY||{type:'FeatureCollection',features:[]},{pane:'paper',interactive:false,smoothFactor:.35,
      style:f=>f.properties?.layer==='river'?{color:'#667c69',weight:.8,opacity:.65,fill:false}:
        {color:'#7c8e6f',weight:.8,opacity:.8,fillColor:'#253223',fillOpacity:1}}).addTo(map);
    const sources={
      topo:{name:'Esri 地形',url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a> &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS'},
      osm:{name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'},
    };
    map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth 1:10m</a>');
    const valid=rows.filter(r=>r.lon!=null&&r.lat!=null&&r.lon>=69&&r.lon<=139&&r.lat>=15&&r.lat<=57);
    const points=hero?valid.slice(0,55):valid;
    const max=Math.max(...points.map(r=>r.count),1),markers=new Map(),labels=[];
    const group=L.featureGroup().addTo(map);
    let selected=null,fitted=Boolean(saved),frame,sourceSelect,readout,tiles,sourceTimer;
    let currentSource='paper',loaded=0,failed=0;
    function setStatus(message,state){
      container.dataset.mapStatus=state;
      const status=document.getElementById('map-basemap-status');
      if(!hero&&status){status.textContent=message;status.dataset.state=state;}
    }

    function updateLabels(){
      if(!map._loaded||!container.clientWidth)return;
      const z=map.getZoom(),bounds=map.getBounds().pad(.08),occupied=[];
      const sorted=labels.slice().sort((a,b)=>Number(b.row.key===selected)-Number(a.row.key===selected)||Number(b.featured)-Number(a.featured)||b.row.count-a.row.count);
      for(const item of sorted){
        const active=item.row.key===selected,loc=item.marker.getLatLng(),p=map.latLngToContainerPoint(loc);
        const showByZoom=active||item.featured||z>=7||(z>=5.5&&item.row.count>=25);
        const box={x:p.x+8,y:p.y-11,w:item.row.name.length*13+8,h:23};
        const collision=occupied.some(b=>box.x<b.x+b.w+8&&box.x+box.w+8>b.x&&Math.abs(box.y-b.y)<25);
        const show=bounds.contains(loc)&&showByZoom&&(active||!collision);
        if(show){if(!map.hasLayer(item.label))item.label.addTo(map);occupied.push(box);}
        else if(map.hasLayer(item.label))map.removeLayer(item.label);
        item.marker.setRadius(item.radius+(active?3:0));
        item.label.getElement()?.classList.toggle('selected',active);
      }
      container.dataset.zoomDetail=z>=8?'local':z>=6?'regional':'overview';
      if(readout){const c=map.getCenter();readout.textContent=`${c.lat.toFixed(2)}° N · ${c.lng.toFixed(2)}° E · Z${z.toFixed(1)}`;}
    }
    function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(updateLabels);}
    function select(key,focus=false){
      selected=key;
      for(const [id,m] of markers){const on=id===key;m.setStyle({color:on?'#fff2cc':'#d4b47a',weight:on?2:1,fillOpacity:on?1:.72});if(on)m.bringToFront();}
      const marker=markers.get(key);
      if(marker&&focus)map.flyTo(marker.getLatLng(),Math.max(map.getZoom(),8),{animate:!reduced,duration:.7});
      else if(marker&&!map.getBounds().pad(-.08).contains(marker.getLatLng()))map.panTo(marker.getLatLng(),{animate:!reduced});
      updateLabels();
    }
    for(const row of points.slice().reverse()){
      const radius=(hero?1.5:2)+Math.sqrt(row.count/max)*(hero?7.5:10);
      const marker=L.circleMarker([row.lat,row.lon],{radius,color:'#d4b47a',weight:1,fillColor:'#e4b863',fillOpacity:.72,bubblingMouseEvents:false}).addTo(group);
      markers.set(row.key,marker);
      if(!hero){
        marker.bindTooltip(`<strong>${esc(row.name)}</strong><span>${format(row.count)} 人 · ${row.ids.length} 个历史编码</span>`,{className:'map-place-tooltip',direction:'top',offset:[0,-8],opacity:1});
        marker.on('click',()=>{select(row.key);options.onSelect?.(row);});
      }
      const label=L.marker([row.lat,row.lon],{icon:L.divIcon({className:'historical-place-label',html:`<span>${esc(row.name)}</span>`,iconSize:[120,22],iconAnchor:[-9,11]}),interactive:false,keyboard:false,pane:'historyLabels'});
      labels.push({row,marker,label,radius,featured:featured.has(row.name)});
    }
    function setBase(key,notice=''){
      clearTimeout(sourceTimer);
      if(tiles){const oldLayer=tiles;tiles=null;if(map.hasLayer(oldLayer))map.removeLayer(oldLayer);oldLayer.off();}
      currentSource=key;loaded=0;failed=0;
      container.dataset.basemap=key;
      if(sourceSelect)sourceSelect.value=key;
      if(key==='paper'){setStatus(notice||'纸本底图 · 本地地理数据','paper');return;}
      const source=sources[key];if(!source){setBase('paper');return;}
      setStatus(`${source.name} · 加载中`,'loading');
      const layer=L.tileLayer(source.url,{
        pane:'basemap',maxZoom:18,maxNativeZoom:19,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,
        className:'psgj-map-tiles',attribution:source.attribution,
      });
      tiles=layer;
      const fallback=()=>{if(tiles===layer)setBase('paper',`${source.name} 暂不可用 · 已显示纸本底图`);};
      layer.on('tileload',()=>{if(tiles!==layer)return;loaded++;clearTimeout(sourceTimer);setStatus(`${source.name} · 已加载`,'ready');});
      layer.on('loading',()=>{
        clearTimeout(sourceTimer);loaded=0;failed=0;
        sourceTimer=setTimeout(()=>{if(!loaded)fallback();},8000);
      });
      layer.on('tileerror',()=>{if(tiles!==layer)return;if(++failed>=4&&!loaded)fallback();});
      layer.addTo(map);
      sourceTimer=setTimeout(()=>{if(!loaded)fallback();},8000);
    }
    if(!hero){
      const controls=L.control({position:'topright'});
      controls.onAdd=()=>{
        const box=L.DomUtil.create('div','map-tools'),search=L.DomUtil.create('input','map-place-search',box);
        search.type='search';search.placeholder='定位历史地点';search.setAttribute('aria-label','定位历史地点');
        const results=L.DomUtil.create('div','map-place-results',box);results.hidden=true;
        const sourceLabel=L.DomUtil.create('label','map-source-label',box);sourceLabel.append(document.createTextNode('底图'));
        sourceSelect=L.DomUtil.create('select','map-source-select',sourceLabel);sourceSelect.setAttribute('aria-label','选择地图底图');
        for(const [key,name] of [['paper','纸本 · 离线'],['topo','Esri · 地形'],['osm','OSM · 街道']]){const option=document.createElement('option');option.value=key;option.textContent=name;sourceSelect.append(option);}
        const choose=row=>{select(row.key,true);options.onSelect?.(row);results.hidden=true;search.value=row.name;};
        search.addEventListener('input',()=>{
          const q=normalize(search.value.trim());results.replaceChildren();results.hidden=!q;if(!q)return;
          const matches=valid.filter(r=>normalize(r.name).includes(q)||r.ids.some(id=>String(id)===q)).slice(0,8);
          for(const row of matches){const b=document.createElement('button');b.type='button';b.innerHTML=`${esc(row.name)}<small>${format(row.count)} 人 · #${row.ids[0]}</small>`;b.addEventListener('click',()=>choose(row));results.append(b);}
          if(!matches.length)results.textContent='未找到有坐标的地点';
        });
        search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();results.querySelector('button')?.click();}if(event.key==='Escape'){results.hidden=true;search.blur();}});
        sourceSelect.addEventListener('change',()=>setBase(sourceSelect.value));
        L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);return box;
      };controls.addTo(map);
      L.control.scale({imperial:false,position:'bottomleft',maxWidth:120}).addTo(map);
      const coordinates=L.control({position:'bottomright'});coordinates.onAdd=()=>{readout=L.DomUtil.create('div','map-coordinate-readout');return readout;};coordinates.addTo(map);
    }
    map.on('moveend zoomend resize',schedule);
    function fit(){
      if(!container.clientWidth||!container.clientHeight)return;
      map.invalidateSize({animate:false,pan:false});
      map.fitBounds(hero?[[22,98],[42,124]]:[[18.5,80],[44,126.5]],{padding:hero?[6,6]:[20,28],animate:false});fitted=true;updateLabels();
    }
    const controller={
      view:()=>({center:map.getCenter(),zoom:map.getZoom(),source:currentSource}),
      zoom(delta){map.setZoom(map.getZoom()+(delta>0?.75:-.75),{animate:!reduced});},
      reset(){select(null);fit();},select,
      resize(){if(container.clientWidth&&container.clientHeight){map.invalidateSize({animate:false,pan:false});if(!fitted)fit();schedule();}},
      destroy(){clearTimeout(sourceTimer);cancelAnimationFrame(frame);live.delete(controller);instances.delete(container);map.remove();tiles?.off();},
    };
    instances.set(container,controller);live.add(controller);
    setBase(hero?'paper':saved?.source||(navigator.onLine!==false&&location.protocol!=='file:'?'topo':'paper'));
    if(!saved)fit();requestAnimationFrame(controller.resize);
    return controller;
  }
  window.PSGJMaps={createMap,resize(){for(const item of live)item.resize();}};
})();
