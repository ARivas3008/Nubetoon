/* NubeToon Blog · publicaciones editoriales y enlaces a fichas/capítulos. */
(() => {
  'use strict';
  const NT=window.NT;
  const $=id=>document.getElementById(id);
  const tr=(text)=>window.NTI?.t(text)||text;
  const STORAGE_KEY='nubetoon.blog.local.v1';
  let catalog=[],published=[],localPosts=[],editingId=null,viewFilter='all';
  let mediaKind='series',selectedMedia=null,searchTimer=0,searchSequence=0,episodesForChoice=[];
  const dateLocale=()=>window.NTI?.lang==='en'?'en-US':'es-PE';
  const clean=(value,length=1000)=>String(value??'').trim().slice(0,length);
  const fallbackPoster='assets/art/default.svg';
  const safeSource=(value)=>{
    if(!value)return '';
    try{
      const u=new URL(value);
      if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
      if(/^(\d+\.){3}\d+$/.test(u.hostname)||u.hostname==='localhost')return '';
      return u.href;
    }catch{return '';}
  };
  const normalizePost=(raw,scope='local')=>{
    if(!raw||typeof raw!=='object')return null;
    const title=clean(raw.title,130),excerpt=clean(raw.excerpt,420);
    const mediaId=clean(raw.mediaId,130);
    let item=catalog.find(x=>x.id===mediaId);
    if(!item && raw.mediaSnapshot){
      const snapshot=NT.sanitize(raw.mediaSnapshot);
      if(snapshot && snapshot.id===mediaId){
        catalog.push(snapshot); item=snapshot;
      }
    }
    const target=raw.target==='episode'&&item?.type!=='movie'?'episode':'detail';
    const season=Math.max(1,Math.min(100,Math.floor(Number(raw.season)||1)));
    const episode=Math.max(1,Math.min(300,Math.floor(Number(raw.episode)||1)));
    const url=raw.blogspotUrl?safeSource(raw.blogspotUrl):'';
    if(!title||!excerpt||!item)return null;
    return {
      id:clean(raw.id,160)||'post-'+Date.now(),
      title,excerpt,
      body:clean(raw.body,5000),
      author:clean(raw.author,60)||'NubeToon',
      date:/^\d{4}-\d{2}-\d{2}$/.test(raw.date)?raw.date:new Date().toISOString().slice(0,10),
      mediaId,target,season,episode,blogspotUrl:url,
      demo:raw.demo===true,
      mediaSnapshot:raw.mediaSnapshot&&typeof raw.mediaSnapshot==='object'?{
        id:mediaId,title:item.title,type:item.type,year:item.year,
        art:item.art,tmdb:item.tmdb,tvmazeId:item.tvmazeId,
        apiName:item.apiName,seasons:item.seasons,description:item.description
      }:null,
      scope
    };
  };
  const getItem=post=>catalog.find(item=>item.id===post.mediaId);
  const destination=post=>{
    const media=getItem(post);
    if(!media)return 'catalogo.html';
    return post.target==='episode'&&media.type!=='movie'
      ?NT.playerUrl(media,post.season,post.episode)
      :NT.detailUrl(media);
  };
  const targetLabel=post=>{
    const media=getItem(post);
    if(!media)return tr('Ver catálogo');
    if(post.target==='episode')return tr('Ver capítulo')+' · T'+post.season+' E'+post.episode;
    return media.type==='movie'?tr('Ver película'):tr('Ver serie');
  };
  function readLocal(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(parsed)?parsed.slice(0,200).map(v=>normalizePost(v)).filter(Boolean):[];
    }catch{return [];}
  }
  function persist(){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(localPosts));
      return true;
    }catch{
      NT.notify(tr('No fue posible guardar en este navegador.'));
      return false;
    }
  }
  function renderPost(post){
    const item=getItem(post);
    const article=NT.el('article',{class:'blog-post'+(post.scope==='local'?' is-local':'')});
    const link=NT.el('a',{class:'blog-post-link',href:'articulo.html?post='+encodeURIComponent(post.id),'aria-label':tr('Leer artículo')+': '+post.title});
    const media=NT.el('div',{class:'blog-post-media'});
    const img=NT.el('img',{src:NT.imageUrl(item?.poster,item?.art),alt:tr('Carátula de')+' '+item.title,loading:'lazy',decoding:'async'});
    img.addEventListener('error',()=>{img.src=fallbackPoster;},{once:true});
    media.append(img,NT.el('span',{class:'blog-post-kind'},post.target==='episode'?tr('Capítulo'):item.type==='movie'?tr('Película'):tr('Serie')));
    const text=NT.el('div',{class:'blog-post-body'});
    const meta=NT.el('p',{class:'blog-post-meta'});
    meta.textContent=post.author+' · '+new Intl.DateTimeFormat(dateLocale(),{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(post.date+'T12:00:00Z'));
    const title=NT.el('h3',{},post.title);
    const description=NT.el('p',{class:'blog-post-excerpt'},post.excerpt);
    const footer=NT.el('div',{class:'blog-post-target'});
    footer.append(NT.el('span',{},item.title),NT.el('b',{},tr('Leer artículo')+' ↗'));
    text.append(meta,title,description,footer);
    link.append(media,text);
    article.append(link);
    const extras=NT.el('div',{class:'blog-post-extras'});
    if(post.scope==='local'){
      const edit=NT.el('button',{type:'button',class:'blog-subtle'},tr('Editar'));
      edit.addEventListener('click',()=>beginEdit(post));
      const remove=NT.el('button',{type:'button',class:'blog-subtle is-danger'},tr('Eliminar'));
      remove.addEventListener('click',()=>{
        if(!confirm(tr('¿Eliminar esta publicación local?')))return;
        localPosts=localPosts.filter(p=>p.id!==post.id);
        if(persist()){NT.notify(tr('Publicación eliminada.'));render();}
      });
      extras.append(edit,remove);
    }
    if(extras.childNodes.length)article.append(extras);
    return article;
  }
  function render(){
    const query=NT.normalize($('blogSearch').value);
    const everything=[...localPosts,...published].sort((a,b)=>b.date.localeCompare(a.date));
    const filtered=everything.filter(post=>{
      const item=getItem(post);
      if(!item)return false;
      if(viewFilter==='episodes'&&post.target!=='episode')return false;
      if(viewFilter==='movies'&&item.type!=='movie')return false;
      if(viewFilter==='series'&&(item.type==='movie'||post.target==='episode'))return false;
      return !query||NT.normalize([post.title,post.excerpt,post.author,item.title,post.body].join(' ')).includes(query);
    });
    $('blogGrid').replaceChildren(...filtered.map(renderPost));
    $('blogEmpty').hidden=filtered.length>0;
    $('blogResults').textContent=filtered.length+' '+tr(filtered.length===1?'publicación':'publicaciones');
    $('blogLocalCount').textContent=localPosts.length+' '+tr(localPosts.length===1?'entrada local':'entradas locales');
    $('blogExport').disabled=!localPosts.length;
  }
  const isSeries=item=>item&&(item.type==='tv'||item.type==='anime');
  const matchesKind=item=>mediaKind==='movie'?item.type==='movie':isSeries(item);
  function notifyMedia(message){$('blogMediaStatus').textContent=message}
  function syncTargets(){
    const item=selectedMedia;
    $('blogMedia').value=item?.id||'';
    $('blogTargetArea').hidden=!item;
    $('blogSelectedMedia').hidden=!item;
    if(!item){
      $('blogChapterFields').hidden=true;
      $('blogSelectedMedia').replaceChildren();
      return;
    }
    $('blogSelectedMedia').replaceChildren(
      NT.el('span',{class:'blog-selected-check','aria-hidden':'true'},'✓'),
      NT.el('span',{},item.title+(item.year?' · '+item.year:'')),
      NT.el('button',{type:'button',id:'blogClearMedia','aria-label':tr('Cambiar título')},'×')
    );
    $('blogClearMedia').addEventListener('click',()=>{selectedMedia=null;episodesForChoice=[];syncTargets();runSearch()});
    const sel=$('blogTarget');
    const option=[...sel.options].find(x=>x.value==='episode');
    option.disabled=!isSeries(item);
    if(!isSeries(item))sel.value='detail';
    $('blogChapterFields').hidden=sel.value!=='episode'||!isSeries(item);
    if(!$('blogChapterFields').hidden)populateChapters();
  }
  function populateChapters(){
    if(!selectedMedia||!isSeries(selectedMedia))return;
    const s=$('blogSeason'),e=$('blogEpisode'),selectedSeason=Number(s.value)||1,selectedEpisode=Number(e.value)||1;
    const fromApi=[...new Set(episodesForChoice.map(x=>Number(x.season)))].filter(x=>x>0).sort((a,b)=>a-b);
    const fallback=selectedMedia.seasons?.length||1;
    const seasons=fromApi.length?fromApi:Array.from({length:Math.max(1,Math.min(30,fallback))},(_,i)=>i+1);
    s.replaceChildren(...seasons.map(n=>new Option(String(n),String(n))));
    s.value=String(seasons.includes(selectedSeason)?selectedSeason:seasons[0]);
    const bySeason=episodesForChoice.filter(x=>Number(x.season)===Number(s.value));
    const counts=Math.min(80,Math.max(1,Number(selectedMedia.seasons?.[Number(s.value)-1])||13));
    const choices=bySeason.length?bySeason.map(x=>({n:Number(x.number),name:String(x.name||'')})).filter(x=>x.n>0):
      Array.from({length:counts},(_,i)=>({n:i+1,name:''}));
    e.replaceChildren(...choices.map(x=>new Option(String(x.n)+(x.name?' · '+x.name:''),String(x.n))));
    e.value=String(choices.some(x=>x.n===selectedEpisode)?selectedEpisode:choices[0]?.n||1);
  }
  async function loadEpisodeData(item){
    episodesForChoice=[];
    if(!item.tvmazeId||!isSeries(item))return;
    try{
      const response=await window.NTAPI.episodes(item.tvmazeId);
      if(selectedMedia?.id===item.id){
        episodesForChoice=Array.isArray(response)?response:[];
        if(!$('blogChapterFields').hidden)populateChapters();
      }
    }catch{/* Fallback uses season counts already stored in catalog. */}
  }
  function chooseMedia(item){
    selectedMedia=item;
    if(!catalog.some(existing=>existing.id===item.id))catalog.push(item);
    $('blogMediaSearch').value='';
    $('blogMediaResults').replaceChildren();
    $('blogTarget').value='detail';
    $('blogSeason').replaceChildren(new Option('1','1'));
    $('blogEpisode').replaceChildren(new Option('1','1'));
    notifyMedia(tr('Título seleccionado.'));
    syncTargets();
    loadEpisodeData(item);
  }
  function setMediaKind(kind,reset=true){
    mediaKind=kind==='movie'?'movie':'series';
    document.querySelectorAll('[data-media-kind]').forEach(button=>{
      const current=button.dataset.mediaKind===mediaKind;
      button.classList.toggle('is-active',current);
      button.setAttribute('aria-pressed',String(current));
    });
    $('blogMediaSearch').placeholder=tr(mediaKind==='movie'?'Buscar película…':'Buscar serie…');
    if(reset){selectedMedia=null;episodesForChoice=[];$('blogTarget').value='detail';$('blogMediaSearch').value=''}
    syncTargets();runSearch();
  }
  function showMediaResults(items,message){
    const result=$('blogMediaResults');
    result.replaceChildren();
    if(selectedMedia){return}
    if(!items.length){
      notifyMedia(message||tr('No se encontraron títulos.'));
      // Fallback honesto cuando un servicio externo de películas no responde.
      // La ficha será local y no dispondrá de vídeo hasta tener un ID TMDb.
      if(mediaKind==='movie' && NT.clean($('blogMediaSearch').value).length>=2){
        const name=NT.clean($('blogMediaSearch').value).slice(0,120);
        const fallback=NT.el('button',{type:'button',class:'blog-media-result blog-media-manual'});
        fallback.append(NT.el('span',{class:'blog-media-result-icon','aria-hidden':'true'},'+'),
          NT.el('span',{class:'blog-media-result-name'},tr('Crear ficha local de película')+': '+name));
        fallback.addEventListener('click',()=>{
          const media=NT.sanitize({id:'blog-movie-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
            title:name,type:'movie',art:'assets/art/default.svg',tag:'PERSONAL'});
          if(media)chooseMedia(media);
        });
        result.append(fallback);
      }
      return;
    }
    notifyMedia(tr('Selecciona un resultado para continuar.'));
    const unique=new Set();
    for(const entry of items.slice(0,12)){
      const item=entry.item;
      if(unique.has(item.id))continue;
      unique.add(item.id);
      const button=NT.el('button',{type:'button',class:'blog-media-result'});
      button.append(
        NT.el('span',{class:'blog-media-result-icon','aria-hidden':'true'},mediaKind==='movie'?'▣':'▤'),
        NT.el('span',{class:'blog-media-result-name'},item.title),
        NT.el('small',{},item.year||'—')
      );
      button.addEventListener('click',async()=>{
        if(entry.imdbId){
          // The public Cinemeta metadata may include a TMDb reference; never invent it.
          try{
            const data=await fetch('https://v3-cinemeta.strem.io/meta/movie/'+encodeURIComponent(entry.imdbId)+'.json');
            if(data.ok){
              const meta=(await data.json()).meta;
              const tmdb=Number(meta?.moviedb_id);
              if(Number.isSafeInteger(tmdb)&&tmdb>0)item.tmdb=tmdb;
            }
          }catch{/* Item remains a valid movie, even without a TMDb identifier. */}
        }
        chooseMedia(item);
      });
      result.append(button);
    }
  }
  async function runSearch(){
    const token=++searchSequence;
    const term=NT.clean($('blogMediaSearch').value).slice(0,80);
    const locals=catalog.filter(matchesKind).filter(x=>!term||NT.normalize(x.title).includes(NT.normalize(term)))
      .slice(0,8).map(item=>({item}));
    showMediaResults(locals,term?tr('No se encontraron títulos.'):tr('Escribe el nombre para buscar.'));
    if(selectedMedia||term.length<2)return;
    notifyMedia(tr('Buscando títulos…'));
    try{
      let remote=[];
      if(mediaKind==='series'){
        const shows=await window.NTAPI.search(term);
        remote=shows.slice(0,12).map(show=>({item:window.NTAPI.fromShow(show)}))
          .filter(x=>x.item&&matchesKind(x.item));
      }else{
        const endpoint='https://v3-cinemeta.strem.io/catalog/movie/top/search='+encodeURIComponent(term)+'.json';
        const controller=new AbortController();
        const kill=setTimeout(()=>controller.abort(),7000);
        let response;
        try{response=await fetch(endpoint,{signal:controller.signal,mode:'cors'});}finally{clearTimeout(kill)}
        if(!response.ok)throw Error('Film search unavailable');
        const data=await response.json();
        remote=(Array.isArray(data.metas)?data.metas:[]).slice(0,20).filter(x=>/^tt\d{5,12}$/.test(String(x.id||'')))
          .map(meta=>{
            const year=Number(String(meta.releaseInfo||'').match(/\b(?:19|20)\d{2}\b/)?.[0])||0;
            const item=NT.sanitize({
              id:'imdb-'+meta.id,title:meta.name,type:'movie',year,art:'assets/art/default.svg',
              tag:'CINEMETA',apiName:meta.name,description:''
            });
            return {item,imdbId:String(meta.id)};
          }).filter(x=>x.item);
      }
      if(token!==searchSequence||selectedMedia)return;
      const all=[...locals,...remote].filter(x=>x.item&&matchesKind(x.item));
      showMediaResults(all,all.length?'':tr('No se encontraron títulos.'));
    }catch{
      if(token!==searchSequence||selectedMedia)return;
      showMediaResults(locals,locals.length?'':tr('La búsqueda externa no está disponible. Prueba otro nombre o añade el título al catálogo.'));
    }
  }
  function setEditor(open){
    $('blogEditor').hidden=!open;
    $('blogCompose').setAttribute('aria-expanded',String(open));
    if(open)$('blogTitle').focus();
  }
  function resetEditor(){
    editingId=null;
    $('blogForm').reset();
    setMediaKind('series');
    $('blogFormHeading').textContent=tr('Nueva publicación');
    $('blogSave').textContent=tr('Guardar publicación');
    syncTargets();
  }
  function beginEdit(post){
    const item=getItem(post);
    if(!item)return;
    editingId=post.id;
    $('blogTitle').value=post.title;
    $('blogExcerpt').value=post.excerpt;
    $('blogBody').value=post.body||'';
    $('blogAuthor').value=post.author;
    setMediaKind(item.type==='movie'?'movie':'series',false);
    selectedMedia=item;
    $('blogTarget').value=post.target;
    $('blogSeason').replaceChildren(new Option(String(post.season),String(post.season)));
    $('blogEpisode').replaceChildren(new Option(String(post.episode),String(post.episode)));
    $('blogBlogspot').value=post.blogspotUrl;
    syncTargets();
    $('blogFormHeading').textContent=tr('Editar publicación');
    $('blogSave').textContent=tr('Guardar cambios');
    setEditor(true);
    loadEpisodeData(item);
    $('blogEditor').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function onSubmit(event){
    event.preventDefault();
    const source=clean($('blogBlogspot').value,500);
    if(source&&!safeSource(source)){
      NT.notify(tr('Utiliza un enlace HTTPS válido.'));$('blogBlogspot').focus();return;
    }
    const raw={
      id:editingId||('local-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))),
      title:$('blogTitle').value,excerpt:$('blogExcerpt').value,body:$('blogBody').value,
      author:$('blogAuthor').value,mediaId:$('blogMedia').value,target:$('blogTarget').value,
      mediaSnapshot:selectedMedia?{id:selectedMedia.id,title:selectedMedia.title,type:selectedMedia.type,
        year:selectedMedia.year,tmdb:selectedMedia.tmdb,tvmazeId:selectedMedia.tvmazeId,
        apiName:selectedMedia.apiName,description:selectedMedia.description,
        seasons:selectedMedia.seasons,art:selectedMedia.art}:null,
      season:Number($('blogSeason').value)||1,episode:Number($('blogEpisode').value)||1,
      blogspotUrl:source,date:editingId?localPosts.find(x=>x.id===editingId)?.date:new Date().toISOString().slice(0,10)
    };
    if(!selectedMedia){NT.notify(tr('Primero selecciona una película o serie.'));return}
    if(clean(raw.body,5000).length<70){NT.notify(tr('El artículo necesita al menos 70 caracteres.'));return}
    const valid=normalizePost(raw);
    if(!valid){NT.notify(tr('Completa el título, resumen y contenido asociado.'));return;}
    // A remote selection must be saved to the personal catalog before its detail link can resolve.
    if(!((await NT.loadCatalog()).items.some(x=>x.id===selectedMedia.id)))NT.addCustom(selectedMedia);
    const previous=[...localPosts];
    if(editingId)localPosts=localPosts.map(x=>x.id===editingId?valid:x);
    else localPosts.unshift(valid);
    if(!persist()){localPosts=previous;return;}
    NT.notify(editingId?tr('Publicación actualizada.'):tr('Publicación guardada en este navegador.'));
    resetEditor();setEditor(false);render();
    $('blogListStart').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function exportPosts(){
    const payload=JSON.stringify({version:1,posts:localPosts.map(({scope,...post})=>post)},null,2);
    const blob=new Blob([payload],{type:'application/json;charset=utf-8'});
    const objectURL=URL.createObjectURL(blob);
    const anchor=NT.el('a',{href:objectURL,download:'nubetoon-blog-posts.json'});
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectURL),1500);
  }
  async function loadPublished(){
    let list=[];
    try{
      const response=await fetch('data/blog-posts.json',{cache:'no-store'});
      if(response.ok){const json=await response.json();list=Array.isArray(json.posts)?json.posts:[];}
    }catch{/* Local mode keeps the editor usable. */}
    published=list.slice(0,80).map(raw=>normalizePost(raw,'public')).filter(Boolean);
  }
  async function enrichArt(){
    const ids=[...new Set([...localPosts,...published].map(post=>post.mediaId))];
    await Promise.allSettled(ids.map(async id=>{
      const media=catalog.find(item=>item.id===id);
      if(!media||media.type==='movie')return;
      const richer=await window.NTAPI.enrich(media);
      Object.assign(media,richer);
    }));
    render();
  }
  async function start(){
    try{
      catalog=(await NT.loadCatalog()).items;
      localPosts=readLocal();
      setMediaKind('series');
      $('blogCompose').addEventListener('click',()=>{if($('blogEditor').hidden)resetEditor();setEditor($('blogEditor').hidden);});
      $('blogCancel').addEventListener('click',()=>{resetEditor();setEditor(false);});
      document.querySelectorAll('[data-media-kind]').forEach(button=>button.addEventListener('click',()=>setMediaKind(button.dataset.mediaKind)));
      $('blogMediaSearch').addEventListener('input',()=>{
        clearTimeout(searchTimer);
        searchTimer=setTimeout(runSearch,290);
      });
      $('blogTarget').addEventListener('change',syncTargets);
      $('blogSeason').addEventListener('change',populateChapters);
      $('blogForm').addEventListener('submit',onSubmit);
      $('blogExport').addEventListener('click',exportPosts);
      $('blogSearch').addEventListener('input',render);
      document.querySelectorAll('[data-blog-filter]').forEach(button=>{
        button.addEventListener('click',()=>{
          viewFilter=button.dataset.blogFilter;
          document.querySelectorAll('[data-blog-filter]').forEach(x=>{
            x.classList.toggle('is-active',x===button);
            x.setAttribute('aria-pressed',String(x===button));
          });
          render();
        });
      });
      await loadPublished();render();enrichArt();
    }catch(error){
      console.error('NubeToon blog failed',error);
      $('blogResults').textContent=tr('No se pudieron cargar las publicaciones.');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
