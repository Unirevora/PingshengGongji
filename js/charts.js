(function () {
  'use strict';
  const {escapeHTML: esc} = window.PSGJCore;
  const charts = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = {red:'#e4b863',green:'#afb99a',ink:'#ece9dd',muted:'#bec5af',line:'rgba(231,226,199,.15)',paper:'#263025'};
  const nf = n => Number(n).toLocaleString('en-US');
  const short = (str, length = 12) => str.length > length ? str.slice(0,length) + '…' : str;
  const createMap = (...args) => window.PSGJMaps.createMap(...args);

  function initChart(id) {
    const dom = document.getElementById(id);
    if (!window.echarts) {dom.textContent='图表库未能加载，请检查本地 lib 目录。';return null;}
    let chart=charts.get(id);
    if(!chart){chart=echarts.init(dom,null,{renderer:'canvas'});charts.set(id,chart);}
    chart.resize();return chart;
  }

  function baseOption(){return {animation:!reducedMotion,animationDuration:450,textStyle:{fontFamily:'LaobaoSong, SimSun, serif',color:colors.ink},tooltip:{backgroundColor:colors.paper,borderColor:colors.line,borderWidth:1,padding:[10,14],textStyle:{fontSize:11,color:colors.ink},extraCssText:'box-shadow:0 4px 18px #29302012;border-radius:2px;max-width:300px;white-space:normal;'},aria:{enabled:true}};}

  function renderRanking(rows,mode,onSelect){
    const chart=initChart('atlas-chart');if(!chart)return;
    const help=document.getElementById('ranking-chart-help');
    if(help)help.textContent=mode==='3d'?'拖拽旋转 · 滚轮缩放 · 点击柱形定位地点':'点击柱形定位地点';
    const top=rows.slice(0,12);const compact=window.innerWidth<641;
    const label=r=>top.filter(p=>p.name===r.name).length>1?`${r.name} #${r.ids[0]}`:r.name;
    const common=baseOption();chart.off('click');chart.on('click',p=>{const r=top[p.dataIndex];if(r)onSelect(r);});
    if(mode==='3d'){
      try{
        const canvas=document.createElement('canvas');
        const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
        if(!gl)throw new Error('WebGL unavailable');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        const axisText={color:colors.ink,fontFamily:'LaobaoSong, SimSun, serif',fontSize:12};
        const axisLine={lineStyle:{color:'rgba(221,225,199,.5)',width:1}};
        const barLabel={show:true,distance:7,formatter:p=>`${top[p.dataIndex].name}\n${nf(top[p.dataIndex].count)} 人`,textStyle:{fontFamily:'LaobaoSong, SimSun, serif',fontSize:12,color:'#f5ead0',backgroundColor:'rgba(20,29,20,.85)',padding:[4,6],borderRadius:4}};
        chart.setOption({
          ...common,
          tooltip:{...common.tooltip,formatter:p=>`${esc(top[p.dataIndex].name)}<br>关联人物 <b>${nf(top[p.dataIndex].count)} 人</b>`},
          xAxis3D:{type:'category',name:'地点',nameTextStyle:axisText,data:top.map(label),axisLine,axisTick:{show:false},axisLabel:{interval:0,margin:12,textStyle:axisText}},
          yAxis3D:{type:'category',name:'',data:['关联人物'],axisLine,axisTick:{show:false},axisLabel:{show:false}},
          zAxis3D:{type:'value',name:'人数（人）',nameTextStyle:axisText,axisLine,axisLabel:{textStyle:axisText},splitLine:{lineStyle:{color:'rgba(221,225,199,.13)'}}},
          grid3D:{boxWidth:240,boxDepth:25,boxHeight:100,top:25,bottom:60,left:30,right:30,axisPointer:{show:false},viewControl:{alpha:18,beta:6,distance:compact?320:245,minDistance:170,maxDistance:400,autoRotate:false,panSensitivity:0},light:{main:{intensity:1.2,shadow:false},ambient:{intensity:.6}}},
          series:[{type:'bar3D',data:top.map((r,i)=>({name:r.name,value:[i,0,r.count]})),shading:'lambert',itemStyle:{color:colors.red,opacity:.94},label:barLabel,emphasis:{label:barLabel},barSize:12}],
        },true);
        document.getElementById('chart-fallback').hidden=true;return;
      }catch(error){document.getElementById('chart-fallback').textContent='当前设备未能启用三维图，已显示平面排行。';document.getElementById('chart-fallback').hidden=false;}
    }else document.getElementById('chart-fallback').hidden=true;
    chart.setOption({...common,grid:{left:compact?68:95,right:compact?50:65,top:25,bottom:38},tooltip:{...common.tooltip,trigger:'axis',axisPointer:{type:'shadow'},formatter:items=>{const r=top[items[0].dataIndex];return `${esc(r.name)}<br>关联人物 <b>${nf(r.count)}</b><br>原始记录 ${nf(r.records)}<br>历史地址编码 ${r.ids.join('、')}`;}},xAxis:{type:'value',name:'人数',nameTextStyle:{fontSize:10},axisLabel:{fontSize:10,color:colors.muted},splitLine:{lineStyle:{color:'rgba(255,255,255,.09)',type:'dashed'}},axisLine:{show:false},axisTick:{show:false}},yAxis:{type:'category',inverse:true,data:top.map(label),axisLine:{show:false},axisTick:{show:false},axisLabel:{fontSize:compact?10:12,color:colors.ink}},series:[{type:'bar',data:top.map((r,i)=>({value:r.count,itemStyle:{color:i<3?colors.red:'#adb99b'}})),barMaxWidth:17,label:{show:true,position:'right',fontSize:10,color:colors.muted,formatter:p=>nf(p.value)},emphasis:{itemStyle:{color:colors.red}}}]},true);
  }

  function renderEntry(summary,onSelect){
    const top=summary.entries.slice(0,7);
    const other=summary.entries.slice(7).reduce((n,r)=>n+r.records,0);
    const pie=initChart('entry-chart');const bar=initChart('entry-rank-chart');
    const common=baseOption();const compact=window.innerWidth<641;
    if(pie){
      pie.setOption({...common,color:['#d5b57a','#adb99b','#778d77','#c7c7ae','#657863','#d4ccaf','#566b55','#394b3a'],tooltip:{...common.tooltip,trigger:'item',formatter:p=>`${esc(p.name)}<br>${nf(p.value)} 条原始记录 · ${p.percent}%`},legend:{type:'scroll',bottom:0,left:0,right:0,textStyle:{fontSize:9,color:colors.muted},formatter:name=>short(name,12)},series:[{type:'pie',radius:['45%','73%'],center:['50%','45%'],avoidLabelOverlap:true,itemStyle:{borderColor:colors.paper,borderWidth:3},label:{show:false},emphasis:{scaleSize:4,label:{show:false}},data:[...top.map(r=>({name:r.name,value:r.records,code:r.code})),{name:'其他',value:other}]}],graphic:[{type:'text',left:'center',top:'37%',style:{text:nf(summary.meta.entryRecords),fontSize:35,fontFamily:'LaobaoSong, Georgia, serif',fill:colors.ink}},{type:'text',left:'center',top:'50%',style:{text:'条入仕记录',fontSize:11,fill:colors.muted}}]},true);
      pie.off('click');pie.on('click',p=>{if(p.data.code!=null)onSelect(p.data.code);});
    }
    if(bar){
      const rows=summary.entries.slice(0,8);
      bar.setOption({...common,grid:{left:compact?111:125,right:35,top:28,bottom:34},tooltip:{...common.tooltip,trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>{const r=rows[p[0].dataIndex];return `${esc(r.name)}<br>${nf(r.count)} 人 · ${nf(r.records)} 条记录`;}},xAxis:{type:'value',axisLabel:{fontSize:9,color:colors.muted},splitLine:{lineStyle:{color:'rgba(255,255,255,.09)',type:'dashed'}},axisLine:{show:false},axisTick:{show:false}},yAxis:{type:'category',inverse:true,data:rows.map(r=>short(r.name.replace(/^科舉[:：]?\s*/,''),compact?9:11)),axisLine:{show:false},axisTick:{show:false},axisLabel:{fontSize:9,color:colors.ink}},series:[{type:'bar',barMaxWidth:14,data:rows.map((r,i)=>({value:r.count,itemStyle:{color:i===0?colors.red:'#adb99b'}})),label:{show:true,position:'right',fontSize:9,color:colors.muted},emphasis:{itemStyle:{color:colors.red}}}]},true);
      bar.off('click');bar.on('click',p=>onSelect(rows[p.dataIndex].code));
    }
  }

  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{for(const chart of charts.values()){if(chart.getDom().offsetWidth)chart.resize();}window.PSGJMaps.resize();},120);});
  document.fonts?.ready.then(()=>{for(const chart of charts.values()){chart.setOption(chart.getOption());chart.resize();}});
  window.PSGJCharts={createMap,renderRanking,renderEntry,resize(){for(const chart of charts.values())if(chart.getDom().offsetWidth)chart.resize();window.PSGJMaps.resize();}};
})();
