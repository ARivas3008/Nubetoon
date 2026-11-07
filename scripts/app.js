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
    function renderEpisodes(){const items=episodes.filter(e=>Number(e.season)===season).slice(0,80);$('watchFromDetail').href=NT.playerUrl(item,season,1);const list=$('detailEpisodes');list.replaceChildren();if(item.type==='movie'){list.append(NT.el('div',{class:'empty-state'},'Película: abre el reproductor para cargarla directamente con VideoAPI, si dispone de un ID de TMDb.'));return;}
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
    let item=await resolveFromParams();
    if(!item){
      $('playerStatus').textContent='No hay títulos disponibles. Vuelve al catálogo.';
      return;
    }
    let episodes=[],season=Number(NT.params().get('season'))||1,
        episode=Number(NT.params().get('episode'))||1,requestToken=0,embedToken=0;
    const screen=$('videoScreen'),seasonSel=$('playerSeason');
    const overlay=NT.el('div',{class:'player-episode-badge','aria-live':'polite'});
    const episodeName=NT.el('strong',{class:'player-episode-name'});
    overlay.append(episodeName);
    const synopsisText=$('episodeSynopsisText');
    const toggleSynopsis=$('toggleEpisodeSynopsis');
    const poster=$('seriesInfoPoster');
    let summaryVisible=true;
    const selectedEpisode=()=>episodes.find(e=>Number(e.season)===season&&Number(e.number)===episode)||null;
    const episodeNameOnly=()=>{
      if(item.type==='movie')return item.title;
      const name=NT.clean(selectedEpisode()?.name);
      return name||'Episodio '+episode;
    };
    const fullEpisodeName=()=>{
      if(item.type==='movie')return item.title;
      const name=episodeNameOnly();
      return NT.normalize(name)===NT.normalize('Episodio '+episode)
        ? name : 'Episodio '+episode+' · '+name;
    };
    function updateEpisodeSummary(){
      const ep=selectedEpisode();
      $('episodeSynopsisHeading').textContent=item.type==='movie'?item.title:episodeNameOnly();
      const description=item.type==='movie'
        ? NT.cleanupText(item.description)
        : NT.cleanupText(ep?.summary);
      synopsisText.textContent=description||(item.type==='movie'
        ? 'No hay sinopsis disponible para esta película.'
        : 'Todavía no hay un resumen disponible para este capítulo.');
    }
    function updateSeriesCard(){
      const href=NT.detailUrl(item);
      $('seriesInfoTitle').textContent=item.title;
      $('seriesInfoTitle').href=href;
      $('seriesInfoLink').href=href;
      $('seriesInfoPosterLink').href=href;
      $('seriesInfoPosterLink').setAttribute('aria-label','Abrir ficha de '+item.title);
      $('seriesInfoKicker').textContent=item.type==='movie'?'SOBRE LA PELÍCULA':'SOBRE LA SERIE';
      $('seriesInfoMeta').textContent=[item.year||null,filmType(item),...(item.genres||[]).slice(0,2)].filter(Boolean).join(' · ');
      $('seriesInfoDescription').textContent=NT.cleanupText(item.description)||'La sinopsis de este título todavía no está disponible.';
      poster.src=cover(item);
      poster.alt='Carátula de '+item.title;
    }
    poster.addEventListener('error',()=>{
      if(!poster.src.endsWith('/assets/art/default.svg'))poster.src='assets/art/default.svg';
    });
    function updateHead(){
      const href=NT.detailUrl(item);
      $('playerTitle').textContent=item.title;
      $('playerTitle').href=href;
      $('playerTitle').title='Abrir ficha de '+item.title;
      const label=fullEpisodeName();
      $('playerSubtitle').textContent=item.type==='movie'
        ? 'Película'+(item.year?' · '+item.year:'')
        : 'Temporada '+season+' · '+label;
      $('playerBreadcrumb').textContent=item.title;
      $('playerBreadcrumb').href=href;
      $('playerDetailLink').href=href;
      $('nextHeading').textContent=item.type==='movie'?'Más títulos':'Episodios';
      episodeName.textContent=episodeNameOnly();
      document.title=item.title+(item.type==='movie'?'':' · T'+season+' E'+episode)+' | NubeToon';
      NT.storeSelection(item,season,episode);
      updateEpisodeSummary();
      const target=NT.playerUrl(item,season,episode);
      if(location.pathname.split('/').pop()==='reproductor.html'){
        history.replaceState(null,'',target);
      }
    }
    function displayUnavailable(message){
      embedToken++;
      const placeholder=NT.el('div',{class:'player-placeholder'});
      placeholder.append(
        NT.el('div',{class:'player-play-symbol'},'▷'),
        NT.el('h2',{},'No podemos abrir este vídeo'),
        NT.el('p',{},message)
      );
      screen.replaceChildren(placeholder);
      $('playerStatus').textContent=message;
    }
    function videoUrl(){
      const id=Number(item.tmdb);
      if(!Number.isSafeInteger(id)||id<=0||id>999999999)return null;
      const kind=item.type==='movie'?'movie':item.type==='anime'?'anime':'tv';
      const path=kind==='movie'?'/e/movie/'+id:'/e/'+kind+'/'+id+'/'+season+'/'+episode;
      const options=new URLSearchParams({
        skin:'prime',
        primary_color:'8B5CF6',
        secondary_color:'17102B',
        icon_color:'F5F3FF',
        hide_title:'1',
        hide_controls:'0',
        subtitles:'1',
        quality_selector:'1'
      });
      return 'https://videoapi.la'+path+'?'+options.toString();
    }
    function loadEpisode(){
      const url=videoUrl();
      if(!url){
        displayUnavailable('No existe un ID de TMDb válido para reproducir este título.');
        return;
      }
      const load=++embedToken;
      const iframe=NT.el('iframe',{
        src:url,
        title:'VideoAPI · '+item.title+' · '+fullEpisodeName(),
        loading:'eager',
        sandbox:'allow-scripts allow-same-origin allow-forms allow-presentation',
        referrerpolicy:'origin',
        allow:'autoplay; fullscreen; encrypted-media; picture-in-picture',
        allowfullscreen:''
      });
      iframe.addEventListener('load',()=>{
        if(embedToken===load)$('playerStatus').textContent='Reproductor cargado. El contenido depende de VideoAPI.';
      });
      screen.replaceChildren(iframe,overlay);
      $('playerStatus').textContent='Conectando con el reproductor…';
    }
    function renderEpisodes(){
      if(item.type==='movie'){
        seasonSel.disabled=true;
        seasonSel.replaceChildren(new Option('—','1'));
        $('playerEpisodeChips').replaceChildren();
        return;
      }
      seasonSel.disabled=false;
      const seasons=seasonsFor(item,episodes);
      if(!seasons.includes(season))season=seasons[0]||1;
      // Solo se muestra el número de temporada; la etiqueta conserva el contexto.
      seasonSel.replaceChildren(...seasons.map(n=>new Option(String(n),String(n))));
      seasonSel.value=String(season);
      const inSeason=episodes.filter(e=>Number(e.season)===season).slice(0,80);
      const numbers=inSeason.map(e=>Number(e.number)).filter(n=>n>0);
      if(!numbers.includes(episode))episode=numbers[0]||1;
      const chips=$('playerEpisodeChips');
      chips.replaceChildren();
      for(const e of inSeason.slice(0,60)){
        const current=Number(e.number)===episode;
        const number=Number(e.number);
        const button=NT.el('button',{
          type:'button',
          class:'episode-chip'+(current?' is-active':''),
          title:'Episodio '+number+(e.name?' · '+e.name:''),
          'aria-label':'Seleccionar episodio '+number+(e.name?' · '+e.name:''),
          'aria-pressed':String(current)
        },String(number));
        button.addEventListener('click',()=>{
          if(episode===number)return;
          episode=number;
          renderEpisodes();
          updateHead();
          loadEpisode();
        });
        chips.append(button);
      }
    }
    function setSynopsisVisible(value){
      summaryVisible=value;
      synopsisText.hidden=!value;
      toggleSynopsis.setAttribute('aria-expanded',String(value));
      toggleSynopsis.replaceChildren(
        document.createTextNode(value?'Ocultar resumen ':'Mostrar resumen '),
        NT.el('span',{'aria-hidden':'true'},value?'⌃':'⌄')
      );
    }
    toggleSynopsis.addEventListener('click',()=>setSynopsisVisible(!summaryVisible));
    seasonSel.addEventListener('change',()=>{
      season=Number(seasonSel.value)||1;
      episode=1;
      renderEpisodes();
      updateHead();
      loadEpisode();
    });
    $('closePlayer').addEventListener('click',()=>loadEpisode());
    episodes=fallbackEpisodes(item);
    renderEpisodes();updateSeriesCard();updateHead();loadEpisode();
    const run=++requestToken;
    const enriched=await API.enrich(item);
    if(run!==requestToken)return;
    item={...item,...enriched};
    const realEpisodes=await getEpisodes(item);
    if(run!==requestToken)return;
    episodes=realEpisodes;
    const oldSeason=season,oldEpisode=episode;
    renderEpisodes();
    updateSeriesCard();
    updateHead();
    if(season!==oldSeason||episode!==oldEpisode)loadEpisode();
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
