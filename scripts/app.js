/* NubeToon pages — inicio / catalogo / detalle / reproductor / favoritos. */
(() => {
  'use strict';
  const NT=window.NT, API=window.NTAPI;
  const $=id=>document.getElementById(id);
  let collection=[];
  let searchTimer;
  const cover=item=>NT.imageUrl(item.poster,item.art);
  const banner=item=>NT.imageUrl(item.backdrop,item.art);
  const img=(src,alt='',cls='')=>{const node=NT.el('img',{src,alt,class:cls,loading:'lazy',decoding:'async'});node.addEventListener('error',()=>{if(node.getAttribute('src')!== 'assets/art/default.svg')node.src=NT.artUrl(null);},{once:true});return node;};
  const findItem=id=>collection.find(x=>x.id===id)||null;
  const filmType=item=>NT.types[item.type]||'Serie';
  const genreText=item=>(item.genres||[]).slice(0,2).join(' / ')||filmType(item);
  function displayArtwork(container,item){container.replaceChildren(img(banner(item),'','dynamic-backdrop'));}
  function card(item){
    const node=NT.el('article',{class:'media-card'});
    const link=NT.el('a',{class:'poster-link',href:NT.detailUrl(item),'aria-label':`Abrir detalles: ${item.title}`});
    link.append(img(cover(item),`Carátula de ${item.title}`,'poster-image'));
    link.append(NT.el('div',{class:'poster-shade'}));
    link.append(NT.el('span',{class:'poster-tag'},(item.tag||filmType(item)).toUpperCase()));
    link.append(NT.el('span',{class:'poster-play','aria-hidden':'true'},'▷'));
    const fav=NT.el('button',{class:'card-favorite'+(NT.isFavorite(item)?' is-saved':''),type:'button','aria-label':`Guardar o quitar ${item.title} de favoritos`,'aria-pressed':String(NT.isFavorite(item))},NT.isFavorite(item)?'♥':'♡');
    fav.addEventListener('click',()=>{const added=NT.toggleFavorite(item);fav.classList.toggle('is-saved',added);fav.textContent=added?'♥':'♡';fav.setAttribute('aria-pressed',String(added));NT.notify(added?'Añadido a Mi lista':'Eliminado de Mi lista');if(document.body.dataset.page==='lista')loadSaved();});
    const info=NT.el('div',{class:'media-info'});
    const h3=NT.el('h3');h3.append(NT.el('a',{href:NT.detailUrl(item)},item.title));
    info.append(h3,NT.el('p',{},[item.year||'—',genreText(item)].join(' · ')));
    node.append(link,fav,info);return node;
  }
  function showCards(node,items){if(!node)return;node.replaceChildren(...items.map(card));}
  async function refreshImages(items,callback){const results=await Promise.all(items.map(it=>API.enrich(it)));results.forEach((item,i)=>Object.assign(items[i],item));callback();}
  function compact(item){const link=NT.el('a',{class:'compact-card',href:NT.detailUrl(item)});link.append(img(cover(item),''));const text=NT.el('div');text.append(NT.el('b',{},item.title),NT.el('p',{},[item.year,genreText(item)].filter(Boolean).join(' · ')));link.append(text);return link;}
  function mountHome(){
    const featured=findItem('batman-2004')||collection[0];
    const render=()=>{
      showCards($('featuredGrid'),collection.slice(0,6));
      const recent=NT.loadSelection();const recentItem=recent&&findItem(recent.id);
      const picks=[...(recentItem?[recentItem]:[]),...collection.filter(x=>x.id!==recentItem?.id)].slice(0,3);
      $('recentGrid').replaceChildren(...picks.map(compact));
      if(featured){$('heroPrimary').href=NT.detailUrl(featured);$('heroDescription').textContent=featured.description||'Tu selección de historias comienza aquí.';if(featured.backdrop && featured.backdrop!==featured.art)displayArtwork($('heroBackdrop'),featured);}
    };
    render();refreshImages(collection,render);
  }
  function mountCatalog(){
    let filter='Todas',sort='recommended',query='',results=[];let searchSeq=0;
    const genres=['Todas','Acción','Aventura','Fantasía','Misterio','Comedia','Anime','Película'];
    const chipWrap=$('genreChips');
    for(const name of genres){const b=NT.el('button',{type:'button',class:'chip'+(filter===name?' is-active':'')},name);b.addEventListener('click',()=>{filter=name;chipWrap.querySelectorAll('button').forEach(x=>x.classList.toggle('is-active',x===b));render();});chipWrap.append(b);}
    function filtered(){const q=NT.normalize(query);const items=collection.filter(i=>{
      const t=NT.normalize([i.title,i.year,...i.genres].join(' '));
      const matchText=!q||t.includes(q);
      const matchType=filter==='Todas'||filter==='Anime'&&i.type==='anime'||filter==='Película'&&i.type==='movie'||i.genres.some(g=>NT.normalize(g)===NT.normalize(filter));
      return matchText&&matchType;
    });if(sort==='az')items.sort((a,b)=>a.title.localeCompare(b.title,'es'));if(sort==='latest')items.sort((a,b)=>b.year-a.year);return items;}
    function render(){const visible=filtered();showCards($('catalogGrid'),visible);$('localEmpty').hidden=visible.length!==0;$('resultsInfo').textContent=`${visible.length} títulos en tu biblioteca`;}
    const search=$('catalogSearch');
    async function remoteLookup(text){const seq=++searchSeq;const remote=$('remoteSection');if(text.length<2){remote.hidden=true;results=[];return;}
      remote.hidden=false;$('remoteStatus').textContent='Consultando TVmaze…';$('remoteGrid').replaceChildren();
      try {const shows=await API.search(text);if(seq!==searchSeq)return;results=shows.slice(0,12).map(API.fromShow).filter(Boolean).filter(item=>!collection.some(i=>NT.normalize(i.title)===NT.normalize(item.title)&&i.year===item.year));showCards($('remoteGrid'),results);$('remoteStatus').textContent=results.length?`${results.length} series encontradas`:'Sin resultados en TVmaze';}
      catch {if(seq!==searchSeq)return;$('remoteStatus').textContent='No se pudo conectar con TVmaze; tu biblioteca local sigue disponible.';}
    }
    const queryFromUrl=NT.params().get('q');if(queryFromUrl){search.value=queryFromUrl;query=search.value.trim();}
    search.addEventListener('input',()=>{query=search.value.trim();render();clearTimeout(searchTimer);searchTimer=setTimeout(()=>remoteLookup(query),430);});
    $('sortSelect').addEventListener('change',event=>{sort=event.target.value;render();});
    const dialog=$('addDialog'),form=$('addTitleForm');
    $('addCustom').addEventListener('click',()=>dialog.showModal());
    $('closeAdd').addEventListener('click',()=>dialog.close());$('cancelAdd').addEventListener('click',()=>dialog.close());
    form.addEventListener('submit',async ev=>{ev.preventDefault();const d=new FormData(form);const title=NT.clean(d.get('title')).slice(0,90);if(!title)return;
      const type=String(d.get('type'));const tmdb=Number(d.get('tmdb'));const year=Number(d.get('year'));const apiName=NT.clean(d.get('apiName'))||title;
      const item={id:'personal-'+Date.now(),title,type,year:Number.isInteger(year)?year:0,tmdb:Number.isInteger(tmdb)&&tmdb>0&&tmdb<1e9?tmdb:null,apiName,genres:[],description:'Añadido a tu biblioteca personal.',seasons:type==='movie'?[]:[13],art:'assets/art/default.svg',tag:'PERSONAL'};
      NT.addCustom(item);collection=(await NT.loadCatalog()).items;dialog.close();form.reset();query='';search.value='';$('remoteSection').hidden=true;render();NT.notify('Título agregado a tu biblioteca');await refreshImages(collection,render);
    });
    render();if(query)remoteLookup(query);refreshImages(collection,render);
  }
  async function resolveFromParams(){
    const p=NT.params();const tvmazeId=Number(p.get('tvmaze'));
    if(Number.isSafeInteger(tvmazeId)&&tvmazeId>0){
      try{return API.fromShow(await API.show(tvmazeId));}catch{return null;}
    }
    return findItem(p.get('id')) || (NT.loadSelection()&&findItem(NT.loadSelection().id))||collection[0]||null;
  }
  function setMeta(container,item){container.replaceChildren();for(const value of [item.year||null,filmType(item),...item.genres.slice(0,2)]){if(value)container.append(NT.el('span',{},value));}}
  function fallbackEpisodes(item){const list=[];const seasons=item.seasons.length?item.seasons:[13];seasons.forEach((count,i)=>{for(let j=1;j<=Math.min(count,60);j++)list.push({season:i+1,number:j,name:`Episodio ${j}`,summary:'',image:null,runtime:null});});return list;}
  async function getEpisodes(item){if(item.type==='movie')return [];if(item.tvmazeId){try{const eps=await API.episodes(item.tvmazeId);if(eps.length)return eps;}catch{}}return fallbackEpisodes(item);}
  function seasonsFor(item,episodes){const distinct=[...new Set(episodes.map(e=>Number(e.season)).filter(n=>n>0))].sort((a,b)=>a-b);return distinct.length?distinct:(item.type==='movie'?[]:[1]);}
  function mountDetail(){(async()=>{
    let item=await resolveFromParams();if(!item){$('detailTitle').textContent='No encontramos esta historia';$('detailDescription').textContent='Vuelve al catálogo para seleccionar un título.';return;}
    let episodes=[];const select=$('detailSeason');let season=1;
    function renderHero(){ $('detailTitle').textContent=item.title;$('detailKicker').textContent=`NUBETOON / ${filmType(item).toUpperCase()}`;setMeta($('detailMeta'),item);$('detailDescription').textContent=item.description||'Una historia para descubrir en tu colección.';if(item.backdrop&&item.backdrop!==item.art)displayArtwork($('detailBackdrop'),item);if(item.from==='remote')$('dataAttribution').textContent='Metadatos y carátulas: TVmaze · Identificador '+item.tvmazeId;else $('dataAttribution').textContent='Carteles y metadatos en línea: TVmaze (si están disponibles)';updateFav();}
    function updateFav(){const saved=NT.isFavorite(item);$('detailFavorite').textContent=saved?'♥ En Mi lista':'♡ Añadir a Mi lista';$('detailFavorite').setAttribute('aria-pressed',String(saved));}
    function renderEpisodes(){const items=episodes.filter(e=>Number(e.season)===season).slice(0,80);$('watchFromDetail').href=NT.playerUrl(item,season,1);const list=$('detailEpisodes');list.replaceChildren();if(item.type==='movie'){list.append(NT.el('div',{class:'empty-state'},'Película: abre el reproductor y elige un archivo local o introduce el identificador TMDb correspondiente.'));return;}
      if(!items.length){list.append(NT.el('div',{class:'empty-state'},'No hay episodios registrados para esta temporada.'));return;}
      items.forEach(ep=>{const link=NT.el('a',{class:'episode-row',href:NT.playerUrl(item,season,Number(ep.number)||1)});const epArt=ep.image?.original||ep.image?.medium;link.append(img(epArt?NT.imageUrl(epArt,item.art):cover(item),'','episode-image'));const body=NT.el('div');body.append(NT.el('small',{},`T${String(ep.season).padStart(2,'0')} · E${String(ep.number).padStart(2,'0')}`),NT.el('h3',{},ep.name||`Episodio ${ep.number}`),NT.el('p',{},NT.cleanupText(ep.summary)||'Seleccionar este capítulo en el reproductor'));link.append(body,NT.el('span',{class:'episode-arrow','aria-hidden':'true'},'▷'));list.append(link);});
    }
    $('detailFavorite').addEventListener('click',()=>{NT.toggleFavorite(item);updateFav();NT.notify('Se actualizó Mi lista');});
    select.addEventListener('change',()=>{season=Number(select.value)||1;renderEpisodes();});
    renderHero();
    const more=await API.enrich(item);item={...item,...more};renderHero();episodes=await getEpisodes(item);
    select.replaceChildren();seasonsFor(item,episodes).forEach(s=>select.add(new Option(`Temporada ${s}`,String(s))));select.disabled=item.type==='movie';season=Number(select.value)||1;renderEpisodes();
  })();}
  async function mountPlayer(){
    let item=await resolveFromParams();if(!item){$('playerStatus').textContent='No hay títulos disponibles.';return;}
    let episodes=[],season=Number(NT.params().get('season'))||1,episode=Number(NT.params().get('episode'))||1,token=0,objectUrl=null,source='local';
    const screen=$('videoScreen'),seasonSel=$('playerSeason'),episodeSel=$('playerEpisode'),showSel=$('playerShow'),tmdb=$('playerTmdb');
    function clearScreen(message='Selecciona un archivo de video para empezar.'){
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
      const wrapper=NT.el('div',{class:'player-placeholder'});wrapper.append(NT.el('div',{class:'player-play-symbol'},'▷'),NT.el('h2',{},'Tu propia pantalla.'),NT.el('p',{},message));screen.replaceChildren(wrapper);$('playerStatus').textContent=message;
    }
    function updateHead(){
      $('playerTitle').textContent=item.title;
      $('playerSubtitle').textContent=item.type==='movie'?`${item.year||''} · Película`:`Temporada ${season} · Episodio ${episode} · ${item.year||''}`;
      $('playerBreadcrumb').textContent=item.title;$('playerDetailLink').href=NT.detailUrl(item);$('nextHeading').textContent=item.type==='movie'?'Una película para disfrutar':`Temporada ${season} · Capítulo ${episode}`;
      NT.storeSelection(item,season,episode);
    }
    function drawEpisodes(){
      if(item.type==='movie'){seasonSel.disabled=true;episodeSel.disabled=true;seasonSel.replaceChildren(new Option('No aplica','1'));episodeSel.replaceChildren(new Option('Película','1'));$('playerEpisodeChips').replaceChildren();return;}
      seasonSel.disabled=false;episodeSel.disabled=false;
      const allSeasons=seasonsFor(item,episodes);
      if(!allSeasons.includes(season))season=allSeasons[0]||1;
      seasonSel.replaceChildren(...allSeasons.map(x=>new Option(`T${x}`,String(x))));seasonSel.value=String(season);
      const forSeason=episodes.filter(e=>Number(e.season)===season).slice(0,60);
      const epNos=forSeason.map(e=>Number(e.number)).filter(n=>n>0);
      if(!epNos.includes(episode))episode=epNos[0]||1;
      episodeSel.replaceChildren(...forSeason.map(e=>new Option(`E${e.number} · ${e.name||'Capítulo'}`,String(e.number))));episodeSel.value=String(episode);
      const chips=$('playerEpisodeChips');chips.replaceChildren();
      for(const e of forSeason.slice(0,20)){const b=NT.el('button',{type:'button',class:'episode-chip'+(Number(e.number)===episode?' is-active':''),title:e.name||`Episodio ${e.number}`},`E${String(e.number).padStart(2,'0')}`);b.addEventListener('click',()=>{episode=Number(e.number);clearScreen('Capítulo actualizado. Selecciona la fuente de video.');drawEpisodes();updateHead();});chips.append(b);}
    }
    async function setItem(newItem,keepQuery=false){
      if(!newItem)return;const run=++token;item=newItem;clearScreen();if(!keepQuery){season=1;episode=1;}
      $('playerTmdb').value=item.tmdb||'';
      const enriched=await API.enrich(item);if(run!==token)return;item={...item,...enriched};episodes=await getEpisodes(item);if(run!==token)return;drawEpisodes();updateHead();
    }
    for(const c of collection){showSel.add(new Option(c.title,c.id));}
    if(item.from==='remote' && !collection.some(c=>c.id===item.id)){showSel.add(new Option(item.title,item.id));}
    showSel.value=item.id;
    showSel.addEventListener('change',()=>{const c=findItem(showSel.value);if(c){season=1;episode=1;setItem(c);}});
    seasonSel.addEventListener('change',()=>{season=Number(seasonSel.value)||1;episode=1;clearScreen('Temporada actualizada. Selecciona una fuente.');drawEpisodes();updateHead();});
    episodeSel.addEventListener('change',()=>{episode=Number(episodeSel.value)||1;clearScreen('Capítulo actualizado. Selecciona una fuente.');drawEpisodes();updateHead();});
    function setSource(next){source=next;$('sourceLocal').classList.toggle('is-active',next==='local');$('sourceRemote').classList.toggle('is-active',next==='remote');$('sourceLocal').setAttribute('aria-pressed',String(next==='local'));$('sourceRemote').setAttribute('aria-pressed',String(next==='remote'));$('localSource').hidden=next!=='local';$('remoteSource').hidden=next!=='remote';$('remoteConsent').checked=false;$('connectRemote').disabled=true;}
    $('sourceLocal').addEventListener('click',()=>setSource('local'));$('sourceRemote').addEventListener('click',()=>setSource('remote'));
    $('openFile').addEventListener('click',()=>$('localFile').click());
    $('localFile').addEventListener('change',()=>{const file=$('localFile').files?.[0];if(!file)return;if(!file.type.startsWith('video/')&& !/\.(mp4|mkv|webm|ogg|mov)$/i.test(file.name)){NT.notify('Selecciona un archivo de video');return;}clearScreen();objectUrl=URL.createObjectURL(file);const video=NT.el('video',{controls:'',playsinline:'',preload:'metadata','aria-label':'Reproductor local'});video.src=objectUrl;screen.replaceChildren(video);$('playerStatus').textContent=`Archivo local: ${file.name} · No se envía a ningún servidor.`;});
    $('remoteConsent').addEventListener('change',()=>{$('connectRemote').disabled=!$('remoteConsent').checked;});
    $('connectRemote').addEventListener('click',()=>{
      if(source!=='remote'||!$('remoteConsent').checked)return;
      const id=tmdb.value.trim();if(!/^\d{1,9}$/.test(id)||Number(id)===0){NT.notify('Introduce un ID de TMDb válido (no de TVmaze).');tmdb.focus();return;}
      const kind=item.type==='movie'?'movie':item.type==='anime'?'anime':'tv';
      const path=kind==='movie'?`/e/movie/${id}`:`/e/${kind}/${id}/${season}/${episode}`;
      // Configuración predeterminada de VideoAPI: paleta violeta y controles del proveedor ocultos.
      // El iframe es de otro origen; no es posible modificar su DOM ni los controles
      // de un reproductor adicional que VideoAPI pudiera cargar.
      const params=new URLSearchParams({
        skin:'cinematic',
        primary_color:'8B5CF6',
        secondary_color:'1A1036',
        icon_color:'F5F3FF',
        hide_controls:'1'
      });
      const embedUrl='https://videoapi.la'+path+'?'+params.toString();
      clearScreen();
      const iframe=NT.el('iframe',{src:embedUrl,title:'Reproductor de VideoAPI (proveedor externo)',sandbox:'allow-scripts allow-same-origin allow-forms allow-presentation',referrerpolicy:'origin',allow:'autoplay; fullscreen; encrypted-media; picture-in-picture',allowfullscreen:''});
      screen.replaceChildren(iframe);
      $('playerStatus').textContent='VideoAPI usa un tema violeta y solicita ocultar los controles internos. Si se necesita pausar o avanzar, el proveedor puede requerir controles propios.';
      $('remoteConsent').checked=false;$('connectRemote').disabled=true;
    });
    $('closePlayer').addEventListener('click',()=>clearScreen('Reproductor cerrado. Puedes seleccionar otra fuente.'));
    window.addEventListener('beforeunload',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);});
    setSource('local');await setItem(item,true);
  }
  async function loadSaved(){
    const ids=NT.favoritesIds();const items=[];
    for(const id of ids){if(id.startsWith('tvmaze:')){const remoteId=Number(id.split(':')[1]);if(remoteId>0){try{items.push(API.fromShow(await API.show(remoteId)));}catch{}}}
      else {const item=findItem(id);if(item)items.push(item);}}
    showCards($('favoritesGrid'),items.filter(Boolean));$('savedEmpty').hidden=items.length!==0;
    refreshImages(items.filter(Boolean),()=>showCards($('favoritesGrid'),items.filter(Boolean)));
    const last=NT.loadSelection();const item=last&&(findItem(last.id)||items.find(i=>i.tvmazeId===last.tvmazeId));const mount=$('lastViewed');mount.replaceChildren();
    if(item){mount.append(img(cover(item),'','last-thumb'));const t=NT.el('div');t.append(NT.el('h3',{},item.title),NT.el('p',{},`Última selección · Temporada ${last.season} · Episodio ${last.episode}`),NT.el('a',{href:NT.playerUrl(item,last.season,last.episode),class:'text-link'},'Continuar selección ↗'));mount.append(t);}else{mount.append(NT.el('p',{},'Cuando selecciones un capítulo, aparecerá aquí para retomarlo.'));}
  }
  async function start(){
    try { collection=(await NT.loadCatalog()).items;const page=document.body.dataset.page;
      if(page==='inicio')mountHome();else if(page==='catalogo')mountCatalog();else if(page==='detalle')mountDetail();else if(page==='reproductor')mountPlayer();else if(page==='lista')loadSaved();
    } catch(e){console.error('NubeToon initialization issue',e);NT.notify('No pudimos iniciar esta página. Comprueba sus archivos.');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
