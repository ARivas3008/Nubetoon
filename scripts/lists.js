/* NubeToon · listas de películas y series (sin episodios). */
(() => {
  'use strict';
  const NT=window.NT, API=window.NTAPI, $=id=>document.getElementById(id);
  const t=x=>window.NTI?.t(x)||x;
  const STORE='nubetoon.shared-lists.v1', MAX=20;
  let catalog=[],publicLists=[],privateLists=[],selected=[],editing=null;
  let kind='series',filter='all',querySequence=0,searchTimer;
  const clean=(x,n=500)=>String(x??'').trim().slice(0,n);
  const posterSafe=(value)=>{
    if(typeof value!=='string')return '';
    if(/^assets\/art\/[a-z0-9-]+\.svg$/i.test(value))return value;
    try{
      const u=new URL(value);
      if(u.protocol==='https:'&&['static.tvmaze.com','images.metahub.space','image.tmdb.org'].includes(u.hostname)&&!u.username&&!u.password)return u.href;
    }catch{}
    return '';
  };
  const mediaOf=entry=>catalog.find(m=>m.id===entry.mediaId) || null;
  const findSnap=raw=>{
    if(!raw || typeof raw!=='object')return null;
    const x=NT.sanitize(raw);
    return x && (x.type==='movie'||x.type==='tv'||x.type==='anime')?x:null;
  };
  const validItem=raw=>{
    if(!raw || typeof raw!=='object')return null;
    const id=clean(raw.mediaId,100);
    if(!id)return null;
    const snap=findSnap(raw.snapshot);
    if(snap&&snap.id!==id)return null;
    const item=catalog.find(m=>m.id===id)||snap;
    if(!item)return null;
    if(snap && !catalog.some(m=>m.id===id))catalog.push(snap);
    return {mediaId:id,snapshot:snap?{
      id:snap.id,title:snap.title,type:snap.type,year:snap.year,
      tmdb:snap.tmdb,tvmazeId:snap.tvmazeId,apiName:snap.apiName,
      description:snap.description,art:snap.art,genres:snap.genres
    }:null,poster:posterSafe(raw.poster)};
  };
  const normalize=(raw,scope='local')=>{
    if(!raw || typeof raw!=='object')return null;
    const title=clean(raw.title,120),description=clean(raw.description,1200);
    if(!title||!description||!Array.isArray(raw.items))return null;
    const ids=new Set(),items=raw.items.slice(0,MAX).map(validItem)
      .filter(x=>x&&!ids.has(x.mediaId)&&ids.add(x.mediaId));
    if(!items.length)return null;
    return {id:clean(raw.id,150)||'list-'+Date.now(),
      title,description,items,scope};
  };
  function localRead(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORE)||'[]');
      return Array.isArray(raw)?raw.slice(0,100).map(x=>normalize(x)).filter(Boolean):[];
    }catch{return []}
  }
  function localWrite(){
    try{localStorage.setItem(STORE,JSON.stringify(privateLists));return true}
    catch{NT.notify(t('No fue posible guardar en este navegador.'));return false}
  }
  const lookup=entry=>{
    const item=mediaOf(entry);
    return item?{item,poster:posterSafe(entry.poster)||posterSafe(item.poster)||item.art}:null;
  };
  function imgFor(entry){
    const ref=lookup(entry);
    const image=NT.el('img',{src:ref?.poster||'assets/art/default.svg',loading:'lazy',decoding:'async',alt:ref?.item.title||''});
    image.addEventListener('error',()=>{image.src='assets/art/default.svg'},{once:true});
    return image;
  }
  function kindOf(list){
    const types=list.items.map(i=>mediaOf(i)?.type==='movie'?'movie':'series');
    if(types.every(x=>x==='movie'))return 'movies';
    if(types.every(x=>x==='series'))return 'series';
    return 'mixed';
  }
  function renderCard(list){
    const a=NT.el('article',{class:'shared-list-card'});
    const link=NT.el('a',{class:'shared-list-card-link',href:'lista-compartida.html?list='+encodeURIComponent(list.id),
      'aria-label':t('Abrir lista')+': '+list.title});
    const collage=NT.el('div',{class:'shared-list-mosaic'});
    for(const entry of list.items.slice(0,4)){
      const cell=NT.el('div',{class:'shared-mosaic-item'});
      cell.append(imgFor(entry));collage.append(cell);
    }
    const body=NT.el('div',{class:'shared-list-card-content'});
    body.append(NT.el('h3',{},list.title),NT.el('p',{},list.description));
    const names=NT.el('div',{class:'shared-list-names'});
    names.textContent=list.items.map(x=>mediaOf(x)?.title).filter(Boolean).slice(0,4).join(' · ');
    const action=NT.el('span',{class:'shared-list-read'},t('Ver lista')+' ↗');
    body.append(names,action);
    link.append(collage,body);a.append(link);
    if(list.scope==='local'){
      const buttons=NT.el('div',{class:'shared-list-actions'});
      const edit=NT.el('button',{type:'button',class:'blog-subtle'},t('Editar'));
      edit.addEventListener('click',()=>editList(list));
      const remove=NT.el('button',{type:'button',class:'blog-subtle is-danger'},t('Eliminar'));
      remove.addEventListener('click',()=>{
        if(!confirm(t('¿Eliminar esta lista?')))return;
        const before=privateLists;
        privateLists=privateLists.filter(x=>x.id!==list.id);
        if(localWrite())render();else privateLists=before;
      });
      buttons.append(edit,remove);a.append(buttons);
    }
    return a;
  }
  function render(){
    const q=NT.normalize($('sharedListSearch').value);
    const source=[...privateLists,...publicLists];
    const result=source.filter(x=>(filter==='all'||kindOf(x)===filter) &&
       (!q||NT.normalize([x.title,x.description,...x.items.map(y=>mediaOf(y)?.title)].join(' ')).includes(q)));
    $('sharedCards').replaceChildren(...result.map(renderCard));
    $('sharedEmpty').hidden=!!result.length;
    $('sharedResultsCount').textContent=result.length+' '+t(result.length===1?'lista':'listas');
    $('sharedLocalCount').textContent=privateLists.length+' '+t(privateLists.length===1?'lista local':'listas locales');
    $('sharedExport').disabled=!privateLists.length;
  }
  function selectionRender(){
    const area=$('sharedSelected');area.replaceChildren();
    $('sharedCount').textContent=selected.length+' / '+MAX;
    for(let i=0;i<selected.length;i++){
      const entry=selected[i], item=mediaOf(entry);if(!item)continue;
      const row=NT.el('div',{class:'shared-selected-row'});
      const poster=NT.el('span',{class:'shared-selected-poster'});poster.append(imgFor(entry));
      const title=NT.el('span',{class:'shared-selected-title'},item.title);
      const up=NT.el('button',{type:'button',class:'shared-selected-move','aria-label':t('Mover arriba')},'↑');
      const down=NT.el('button',{type:'button',class:'shared-selected-move','aria-label':t('Mover abajo')},'↓');
      const del=NT.el('button',{type:'button',class:'shared-selected-remove','aria-label':t('Quitar título')},'×');
      up.disabled=i===0;down.disabled=i===selected.length-1;
      up.addEventListener('click',()=>move(i,-1));
      down.addEventListener('click',()=>move(i,1));
      del.addEventListener('click',()=>{selected.splice(i,1);selectionRender();});
      row.append(poster,title,up,down,del);area.append(row);
    }
    if(!selected.length)area.append(NT.el('p',{class:'shared-selected-empty'},t('Añade al menos una película o serie.')));
  }
  function move(i,d){const j=i+d;if(j<0||j>=selected.length)return;[selected[i],selected[j]]=[selected[j],selected[i]];selectionRender();}
  function addMedia(item,poster){
    if(!item)return;
    if(selected.some(x=>x.mediaId===item.id)){NT.notify(t('Este título ya está en la lista.'));return}
    if(selected.length>=MAX){NT.notify(t('Puedes añadir hasta 20 títulos.'));return}
    if(!catalog.some(x=>x.id===item.id))catalog.push(item);
    const fresh=validItem({mediaId:item.id,snapshot:item,poster:posterSafe(poster)||posterSafe(item.poster)});
    if(!fresh)return;
    selected.push(fresh);selectionRender();
    $('sharedMediaSearch').value='';$('sharedSearchResults').replaceChildren();
    $('sharedMediaSearch').focus();
    $('sharedSearchStatus').textContent=t('Título añadido a la lista.');
  }
  function switchKind(next){
    kind=next==='movie'?'movie':'series';
    document.querySelectorAll('[data-shared-kind]').forEach(b=>{
      const active=b.dataset.sharedKind===kind;
      b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));
    });
    $('sharedMediaSearch').placeholder=t(kind==='movie'?'Buscar película…':'Buscar serie…');
    $('sharedMediaSearch').value='';
    search();
  }
  const matches=item=>kind==='movie'?item.type==='movie':item.type==='tv'||item.type==='anime';
  function results(items,msg){
    const root=$('sharedSearchResults');root.replaceChildren();
    for(const row of items.slice(0,14)){
      const item=row.item;
      if(!item || !matches(item))continue;
      const b=NT.el('button',{type:'button',class:'blog-media-result'});
      const ic=NT.el('span',{class:'blog-media-result-icon'},kind==='movie'?'▣':'▤');
      b.append(ic,NT.el('span',{class:'blog-media-result-name'},item.title),NT.el('small',{},String(item.year||'')));
      b.addEventListener('click',()=>addMedia(item,row.poster||item.poster));
      root.append(b);
    }
    $('sharedSearchStatus').textContent=msg||t('Selecciona una película o serie para añadirla.');
  }
  async function search(){
    const token=++querySequence;
    const term=clean($('sharedMediaSearch').value,80);
    const local=catalog.filter(matches).filter(x=>!term||NT.normalize(x.title).includes(NT.normalize(term))).slice(0,8)
      .map(item=>({item,poster:item.poster}));
    results(local,term?t('Buscando títulos…'):t('Escribe el nombre para buscar.'));
    if(term.length<2)return;
    try{
      let remote=[];
      if(kind==='series'){
        const shows=await API.search(term);
        remote=shows.slice(0,16).map(show=>({item:API.fromShow(show),
          poster:show.image?.medium||show.image?.original})).filter(x=>x.item);
      }else{
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),7000);
        let response;
        try{response=await fetch('https://v3-cinemeta.strem.io/catalog/movie/top/search='+encodeURIComponent(term)+'.json',
          {mode:'cors',signal:controller.signal});}finally{clearTimeout(timer)}
        if(!response.ok)throw Error('movie search failed');
        const data=await response.json();
        remote=(Array.isArray(data.metas)?data.metas:[]).slice(0,20)
          .filter(x=>/^tt\d{5,12}$/.test(String(x.id||'')))
          .map(x=>{
            const item=NT.sanitize({id:'imdb-'+x.id,title:x.name,type:'movie',
              year:Number(String(x.releaseInfo||'').match(/\b(?:19|20)\d{2}\b/)?.[0])||0,
              art:'assets/art/default.svg',tag:'CINEMETA'});
            return {item,poster:x.poster};
          }).filter(x=>x.item);
      }
      if(token!==querySequence)return;
      const all=new Map();
      for(const value of [...local,...remote])if(value.item && matches(value.item)){
        const key=NT.normalize(value.item.title);
        if(!all.has(key))all.set(key,value);
      }
      results([...all.values()],all.size?'':t('No se encontraron títulos.'));
    }catch{
      if(token===querySequence)results(local,local.length?t('Resultados del catálogo local.'):t('La búsqueda externa no está disponible.'));
    }
  }
  function editor(open){
    $('sharedEditor').hidden=!open;
    $('sharedCompose').setAttribute('aria-expanded',String(open));
    if(open){$('sharedEditor').scrollIntoView({behavior:'smooth',block:'start'});$('sharedTitle').focus();}
  }
  function clear(){
    editing=null;selected=[];$('sharedForm').reset();
    $('sharedEditorHeading').textContent=t('Nueva lista');
    $('sharedSave').textContent=t('Guardar lista');
    selectionRender();switchKind('series');
  }
  function editList(list){
    editing=list.id;selected=list.items.map(x=>({...x}));
    $('sharedTitle').value=list.title;
    $('sharedDescription').value=list.description;
    selectionRender();switchKind('series');
    $('sharedEditorHeading').textContent=t('Editar lista');
    $('sharedSave').textContent=t('Guardar cambios');
    editor(true);
  }
  function save(event){
    event.preventDefault();
    const title=clean($('sharedTitle').value,120),description=clean($('sharedDescription').value,1200);
    if(!title||!description){NT.notify(t('Completa el título y la descripción.'));return}
    if(!selected.length){NT.notify(t('Añade al menos una película o serie.'));return}
    const raw={id:editing||'lista-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
      title,description,items:selected};
    const item=normalize(raw);
    if(!item){NT.notify(t('No se pudo guardar esta lista.'));return}
    // Preserve custom titles only on this browser, no episode references are created.
    const before=privateLists;
    privateLists=editing?privateLists.map(x=>x.id===editing?item:x):[item,...privateLists];
    if(!localWrite()){privateLists=before;return}
    clear();editor(false);render();NT.notify(t('Lista guardada en este navegador.'));
    $('sharedStart').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function exportAll(){
    const json=JSON.stringify({version:1,lists:privateLists.map(({scope,...x})=>x)},null,2);
    const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
    const a=NT.el('a',{href:url,download:'nubetoon-listas.json'});document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function loadPublic(){
    try{
      const response=await fetch('data/shared-lists.json',{cache:'no-store'});
      if(!response.ok)return[];
      const json=await response.json();
      return Array.isArray(json.lists)?json.lists.slice(0,100).map(x=>normalize(x,'public')).filter(Boolean):[];
    }catch{return[]}
  }
  async function enrichPosters(){
    const entries=[...privateLists,...publicLists].flatMap(x=>x.items);
    const ids=[...new Set(entries.map(x=>x.mediaId))];
    await Promise.allSettled(ids.map(async id=>{
      const item=catalog.find(x=>x.id===id);
      if(!item||item.type==='movie')return;
      Object.assign(item,await API.enrich(item,{withImages:false}));
    }));
    render();
  }
  async function start(){
    catalog=(await NT.loadCatalog()).items;
    privateLists=localRead();
    publicLists=await loadPublic();
    const compose=$('sharedCompose');
    compose.addEventListener('click',()=>{
      if($('sharedEditor').hidden)clear();
      editor($('sharedEditor').hidden);
    });
    $('sharedCancel').addEventListener('click',()=>{clear();editor(false)});
    $('sharedForm').addEventListener('submit',save);
    $('sharedMediaSearch').addEventListener('input',()=>{
      clearTimeout(searchTimer);searchTimer=setTimeout(search,290);
    });
    document.querySelectorAll('[data-shared-kind]').forEach(b=>b.addEventListener('click',()=>switchKind(b.dataset.sharedKind)));
    $('sharedListSearch').addEventListener('input',render);
    document.querySelectorAll('[data-shared-filter]').forEach(b=>b.addEventListener('click',()=>{
      filter=b.dataset.sharedFilter;
      document.querySelectorAll('[data-shared-filter]').forEach(x=>{
        const active=x===b;x.classList.toggle('is-active',active);x.setAttribute('aria-pressed',String(active));
      });render();
    }));
    $('sharedExport').addEventListener('click',exportAll);
    clear();render();enrichPosters();
  }
  start().catch(error=>{console.error('Shared list page failed',error);
    $('sharedResultsCount').textContent=t('No se pudieron cargar las listas.');});
})();
