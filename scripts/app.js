/* NubeToon pages — inicio / catalogo / detalle / reproductor / favoritos. */
(() => {
  'use strict';
  const NT=window.NT, API=window.NTAPI, VIDEO=window.NTVideoAPI;
  const tr=(key,values={})=>window.NTI?.t(String(key),values)||String(key);
  const $=id=>document.getElementById(id);
  let collection=[];
  let searchTimer;
  const cover=item=>NT.imageUrl(item.poster,item.art);
  const banner=item=>NT.imageUrl(item.backdrop,item.art);
  const img=(src,alt='',cls='')=>{const node=NT.el('img',{src,alt,class:cls,loading:'lazy',decoding:'async'});node.addEventListener('error',()=>{if(node.getAttribute('src')!== 'assets/art/default.svg')node.src=NT.artUrl(null);},{once:true});return node;};
  const findItem=id=>collection.find(x=>x.id===id)||null;
  const filmType=item=>tr(NT.types[item.type]||tr('Serie'));
  const genreText=item=>(item.genres||[]).slice(0,2).map(g=>tr(g)).join(' / ')||filmType(item);
  function displayArtwork(container,item){container.replaceChildren(img(banner(item),'','dynamic-backdrop'));}
  function card(item){
    const node=NT.el('article',{class:'media-card'});
    const link=NT.el('a',{class:'poster-link',href:NT.detailUrl(item),'aria-label':`${tr('Abrir detalles')}: ${item.title}`});
    link.append(img(cover(item),`${tr('Carátula de')} ${item.title}`,'poster-image'));
    link.append(NT.el('div',{class:'poster-shade'}));
    link.append(NT.el('span',{class:'poster-tag'},(item.tag||filmType(item)).toUpperCase()));
    link.append(NT.el('span',{class:'poster-play','aria-hidden':'true'},'▷'));
    const fav=NT.el('button',{class:'card-favorite'+(NT.isFavorite(item)?' is-saved':''),type:'button','aria-label':`${tr('Guardar o quitar')} ${item.title} ${tr('de favoritos')}`,'aria-pressed':String(NT.isFavorite(item))},NT.isFavorite(item)?'♥':'♡');
    fav.addEventListener('click',()=>{const added=NT.toggleFavorite(item);fav.classList.toggle('is-saved',added);fav.textContent=added?'♥':'♡';fav.setAttribute('aria-pressed',String(added));NT.notify(added?tr('Añadido a Mi lista'):tr('Eliminado de Mi lista'));if(document.body.dataset.page==='lista')loadSaved();});
    const info=NT.el('div',{class:'media-info'});
    const h3=NT.el('h3');h3.append(NT.el('a',{href:NT.detailUrl(item)},item.title));
    info.append(h3,NT.el('p',{},[item.year||'—',genreText(item)].join(' · ')));
    node.append(link,fav,info);return node;
  }
  function showCards(node,items){if(!node)return;node.replaceChildren(...items.map(card));}
  async function refreshImages(items,callback){
    // No lanzar centenares de llamadas a TVmaze al cargar feeds amplios.
    const eligible=items.filter(it=>it.type!=='movie'&&it.type!=='wwe'&&it.type!=='novel'&&it.source!=='videoapi').slice(0,28);
    if(!eligible.length)return;
    const results=await Promise.all(eligible.map(it=>API.enrich(it)));
    results.forEach((item,i)=>Object.assign(eligible[i],item));
    callback();
  }
  function compact(item){const link=NT.el('a',{class:'compact-card',href:NT.detailUrl(item)});link.append(img(cover(item),''));const text=NT.el('div');text.append(NT.el('b',{},item.title),NT.el('p',{},[item.year,genreText(item)].filter(Boolean).join(' · ')));link.append(text);return link;}
  function mountHome(){
    const featured=findItem('batman-2004')||collection[0];
    const render=()=>{
      showCards($('featuredGrid'),collection.slice(0,6));
      const recent=NT.loadSelection();const recentItem=recent&&findItem(recent.id);
      const picks=[...(recentItem?[recentItem]:[]),...collection.filter(x=>x.id!==recentItem?.id)].slice(0,3);
      $('recentGrid').replaceChildren(...picks.map(compact));
      if(featured){$('heroPrimary').href=NT.detailUrl(featured);$('heroDescription').textContent=featured.description?tr(featured.description):tr('Tu selección de historias comienza aquí.');if(featured.backdrop && featured.backdrop!==featured.art)displayArtwork($('heroBackdrop'),featured);}
    };
    render();refreshImages(collection,render);
  }
  function mountCatalog(){
    let filter='Todas',sort='recommended',query='',results=[];let searchSeq=0;
    const genres=['Todas','Acción','Aventura','Fantasía','Misterio','Comedia','Anime','Película','Novela','WWE'];
    const chipWrap=$('genreChips');
    for(const name of genres){const b=NT.el('button',{type:'button',class:'chip'+(filter===name?' is-active':'')},tr(name));b.addEventListener('click',()=>{filter=name;chipWrap.querySelectorAll('button').forEach(x=>x.classList.toggle('is-active',x===b));render();});chipWrap.append(b);}
    function filtered(){const q=NT.normalize(query);const items=collection.filter(i=>{
      const t=NT.normalize([i.title,i.year,...i.genres].join(' '));
      const matchText=!q||t.includes(q);
      const matchType=filter==='Todas'||filter==='Anime'&&i.type==='anime'||filter==='Película'&&i.type==='movie'||filter==='Novela'&&i.type==='novel'||filter==='WWE'&&i.type==='wwe'||i.genres.some(g=>NT.normalize(g)===NT.normalize(filter));
      return matchText&&matchType;
    });if(sort==='az')items.sort((a,b)=>a.title.localeCompare(b.title,'es'));if(sort==='latest')items.sort((a,b)=>b.year-a.year);return items;}
    function render(){const visible=filtered();showCards($('catalogGrid'),visible);$('localEmpty').hidden=visible.length!==0;$('resultsInfo').textContent=tr('{n} títulos en tu biblioteca',{n:visible.length});}
    const search=$('catalogSearch');
    async function remoteLookup(text){const seq=++searchSeq;const remote=$('remoteSection');if(text.length<2){remote.hidden=true;results=[];return;}
      remote.hidden=false;$('remoteStatus').textContent=tr('Consultando TVmaze…');$('remoteGrid').replaceChildren();
      try {const shows=await API.search(text);if(seq!==searchSeq)return;results=shows.slice(0,12).map(API.fromShow).filter(Boolean).filter(item=>!collection.some(i=>NT.normalize(i.title)===NT.normalize(item.title)&&i.year===item.year));showCards($('remoteGrid'),results);$('remoteStatus').textContent=results.length?tr('{n} series encontradas',{n:results.length}):tr('Sin resultados en TVmaze');}
      catch {if(seq!==searchSeq)return;$('remoteStatus').textContent=tr('No se pudo conectar con TVmaze; tu biblioteca local sigue disponible.');}
    }
    const queryFromUrl=NT.params().get('q');if(queryFromUrl){search.value=queryFromUrl;query=search.value.trim();}
    search.addEventListener('input',()=>{query=search.value.trim();render();clearTimeout(searchTimer);searchTimer=setTimeout(()=>remoteLookup(query),430);});
    $('sortSelect').addEventListener('change',event=>{sort=event.target.value;render();});
    const dialog=$('addDialog'),form=$('addTitleForm');
    $('addCustom').addEventListener('click',()=>dialog.showModal());
    $('closeAdd').addEventListener('click',()=>dialog.close());$('cancelAdd').addEventListener('click',()=>dialog.close());
    form.addEventListener('submit',async ev=>{ev.preventDefault();const d=new FormData(form);const title=NT.clean(d.get('title')).slice(0,90);if(!title)return;
      const type=String(d.get('type'));const tmdb=Number(d.get('tmdb'));const year=Number(d.get('year'));const apiName=NT.clean(d.get('apiName'))||title;
      const item={id:'personal-'+Date.now(),title,type,year:Number.isInteger(year)?year:0,tmdb:Number.isInteger(tmdb)&&tmdb>0&&tmdb<1e9?tmdb:null,apiName,genres:[],description:tr('Añadido a tu biblioteca personal.'),seasons:type==='movie'?[]:[13],art:'assets/art/default.svg',tag:'PERSONAL'};
      NT.addCustom(item);collection=(await NT.loadCatalog()).items;dialog.close();form.reset();query='';search.value='';$('remoteSection').hidden=true;render();NT.notify(tr('Título agregado a tu biblioteca'));await refreshImages(collection,render);
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
  function setMeta(container,item){container.replaceChildren();for(const value of [item.year||null,filmType(item),...item.genres.slice(0,2)]){if(value)container.append(NT.el('span',{},tr(value)));}}
  function fallbackEpisodes(item){if(item.type==='wwe')return [];const list=[];const seasons=item.seasons.length?item.seasons:[13];seasons.forEach((count,i)=>{for(let j=1;j<=Math.min(count,60);j++)list.push({season:i+1,number:j,name:`${tr('Episodio')} ${j}`,summary:'',image:null,runtime:null});});return list;}
  async function getEpisodes(item){if(item.type==='movie'||item.type==='wwe')return [];if(item.tvmazeId){try{const eps=await API.episodes(item.tvmazeId);if(eps.length)return eps;}catch{}}return fallbackEpisodes(item);}
  function seasonsFor(item,episodes){const distinct=[...new Set(episodes.map(e=>Number(e.season)).filter(n=>n>0))].sort((a,b)=>a-b);return distinct.length?distinct:((item.type==='movie'||item.type==='wwe')?[]:[1]);}
  function seasonPicker(select,prefix){
    const root=$(prefix+'Picker'),trigger=$(prefix+'Trigger'),
      value=$(prefix+'Value'),panel=$(prefix+'Panel'),
      choices=$(prefix+'Choices'),dismiss=$(prefix+'Dismiss');
    if(!root||!trigger||!panel||!choices)throw Error('Selector de temporada incompleto');
    function close(restoreFocus=false){
      panel.hidden=true;
      trigger.setAttribute('aria-expanded','false');
      root.classList.remove('is-open');
      if(restoreFocus)trigger.focus();
    }
    function render(){
      value.textContent=select.value||'—';
      choices.replaceChildren();
      for(const option of select.options){
        const active=option.value===select.value;
        const row=NT.el('button',{type:'button',class:'season-menu-choice'+(active?' is-current':''),'aria-pressed':String(active)});
        row.append(NT.el('span',{},tr('Temporada')+' '+option.value),
                   NT.el('span',{class:'season-menu-choice-mark','aria-hidden':'true'},active?'✓':'›'));
        row.addEventListener('click',()=>{
          const changed=select.value!==option.value;
          select.value=option.value;
          close(true);
          if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
          else render();
        });
        choices.append(row);
      }
      trigger.disabled=select.disabled;
      if(select.disabled)close();
    }
    trigger.addEventListener('click',()=>{
      if(!panel.hidden){close();return;}
      render();
      panel.hidden=false;
      root.classList.add('is-open');
      trigger.setAttribute('aria-expanded','true');
      choices.querySelector('.is-current')?.focus();
    });
    dismiss.addEventListener('click',()=>close(true));
    select.addEventListener('change',render);
    document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!root.contains(event.target))close();});
    document.addEventListener('keydown',event=>{if(!panel.hidden&&event.key==='Escape'){event.preventDefault();close(true);}});
    render();
    return {render,close};
  }
  function mountDetail(){(async()=>{
    let item=await resolveFromParams();if(!item){$('detailTitle').textContent=tr('No encontramos esta historia');$('detailDescription').textContent=tr('Vuelve al catálogo para seleccionar un título.');return;}
    let episodes=[];const select=$('detailSeason');let season=1;
    const picker=seasonPicker(select,'detailSeason');
    function renderHero(){ $('detailTitle').textContent=item.title;$('detailKicker').textContent=`NUBETOON / ${filmType(item).toUpperCase()}`;setMeta($('detailMeta'),item);$('detailDescription').textContent=item.description?tr(item.description):tr('Una historia para descubrir en tu colección.');if(item.backdrop&&item.backdrop!==item.art)displayArtwork($('detailBackdrop'),item);updateFav();}
    function updateFav(){const saved=NT.isFavorite(item);$('detailFavorite').textContent=saved?'♥ '+tr('En Mi lista'):'♡ '+tr('Añadir a Mi lista');$('detailFavorite').setAttribute('aria-pressed',String(saved));}
    function renderEpisodes(){const items=episodes.filter(e=>Number(e.season)===season).slice(0,80);$('watchFromDetail').href=NT.playerUrl(item,season,1);const list=$('detailEpisodes');list.replaceChildren();if(item.type==='movie'||item.type==='wwe'){list.append(NT.el('div',{class:'empty-state'},tr('Película: abre el reproductor para cargarla directamente con VideoAPI, si dispone de un ID de TMDb.')));return;}
      if(!items.length){list.append(NT.el('div',{class:'empty-state'},tr('No hay episodios registrados para esta temporada.')));return;}
      items.forEach(ep=>{const link=NT.el('a',{class:'episode-row',href:NT.playerUrl(item,season,Number(ep.number)||1)});const epArt=ep.image?.original||ep.image?.medium;link.append(img(epArt?NT.imageUrl(epArt,item.art):cover(item),'','episode-image'));const body=NT.el('div');body.append(NT.el('small',{},`T${String(ep.season).padStart(2,'0')} · E${String(ep.number).padStart(2,'0')}`),NT.el('h3',{},ep.name||`${tr('Episodio')} ${ep.number}`),NT.el('p',{},NT.cleanupText(ep.summary)||tr('Seleccionar este capítulo en el reproductor')));link.append(body,NT.el('span',{class:'episode-arrow','aria-hidden':'true'},'▷'));list.append(link);});
    }
    $('detailFavorite').addEventListener('click',()=>{NT.toggleFavorite(item);updateFav();NT.notify(tr('Se actualizó Mi lista'));});
    select.addEventListener('change',()=>{season=Number(select.value)||1;renderEpisodes();});
    renderHero();
    const more=await API.enrich(item);item={...item,...more};renderHero();episodes=await getEpisodes(item);
    select.replaceChildren();seasonsFor(item,episodes).forEach(s=>select.add(new Option(String(s),String(s))));select.disabled=item.type==='movie'||item.type==='wwe';season=Number(select.value)||1;picker.render();renderEpisodes();
  })();}
  async function mountPlayer(){
    let item=await resolveFromParams();
    if(!item){
      $('playerStatus').textContent=tr('No hay títulos disponibles. Vuelve al catálogo.');
      return;
    }
    let episodes=[],season=Number(NT.params().get('season'))||1,
        episode=Number(NT.params().get('episode'))||1,requestToken=0,embedToken=0;
    const screen=$('videoScreen'),seasonSel=$('playerSeason');
    const picker=seasonPicker(seasonSel,'playerSeason');
    const synopsisText=$('episodeSynopsisText');
    const toggleSynopsis=$('toggleEpisodeSynopsis');
    const poster=$('seriesInfoPoster');
    let summaryVisible=true;
    const selectedEpisode=()=>episodes.find(e=>Number(e.season)===season&&Number(e.number)===episode)||null;
    const episodeNameOnly=()=>{
      if(item.type==='movie'||item.type==='wwe')return item.title;
      const name=NT.clean(selectedEpisode()?.name);
      return name||tr('Episodio')+' '+episode;
    };
    const fullEpisodeName=()=>{
      if(item.type==='movie'||item.type==='wwe')return item.title;
      const name=episodeNameOnly();
      return NT.normalize(name)===NT.normalize(tr('Episodio')+' '+episode)
        ? name : tr('Episodio')+' '+episode+' · '+name;
    };
    function updateEpisodeSummary(){
      const ep=selectedEpisode();
      $('episodeSynopsisHeading').textContent=(item.type==='movie'||item.type==='wwe')?item.title:episodeNameOnly();
      const description=(item.type==='movie'||item.type==='wwe')
        ? tr(NT.cleanupText(item.description))
        : NT.cleanupText(ep?.summary);
      synopsisText.textContent=description||((item.type==='movie'||item.type==='wwe')
        ? tr('No hay sinopsis disponible para esta película.')
        : tr('Todavía no hay un resumen disponible para este capítulo.'));
    }
    function updateSeriesCard(){
      const href=NT.detailUrl(item);
      $('seriesInfoTitle').textContent=item.title;
      $('seriesInfoTitle').href=href;
      $('seriesInfoLink').href=href;
      $('seriesInfoPosterLink').href=href;
      $('seriesInfoPosterLink').setAttribute('aria-label',tr('Abrir ficha de')+' '+item.title);
      $('seriesInfoKicker').textContent=(item.type==='movie'||item.type==='wwe')?tr('SOBRE LA PELÍCULA'):tr('SOBRE LA SERIE');
      $('seriesInfoMeta').textContent=[item.year||null,filmType(item),...(item.genres||[]).slice(0,2)].filter(Boolean).join(' · ');
      $('seriesInfoDescription').textContent=(item.description?tr(NT.cleanupText(item.description)):'')||tr('La sinopsis de este título todavía no está disponible.');
      poster.src=cover(item);
      poster.alt=tr('Carátula de')+' '+item.title;
    }
    poster.addEventListener('error',()=>{
      if(!poster.src.endsWith('/assets/art/default.svg'))poster.src='assets/art/default.svg';
    });
    function updateHead(){
      const href=NT.detailUrl(item);
      $('playerTitle').textContent=item.title;
      $('playerTitle').href=href;
      $('playerTitle').title=tr('Abrir ficha de')+' '+item.title;
      const label=fullEpisodeName();
      $('playerSubtitle').textContent=(item.type==='movie'||item.type==='wwe')
        ? tr('Película')+(item.year?' · '+item.year:'')
        : tr('Temporada')+' '+season+' · '+label;
      $('playerBreadcrumb').textContent=item.title;
      $('playerBreadcrumb').href=href;
      $('playerDetailLink').href=href;
      $('nextHeading').textContent=(item.type==='movie'||item.type==='wwe')?tr('Más títulos'):tr('Episodios');
      document.title=item.title+((item.type==='movie'||item.type==='wwe')?'':' · T'+season+' E'+episode)+' | NubeToon';
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
        NT.el('h2',{},tr('No podemos abrir este vídeo')),
        NT.el('p',{},message)
      );
      screen.replaceChildren(placeholder);
      $('playerStatus').textContent=message;
    }
    function videoUrl(){
      try{
        if(!VIDEO)return null;
        return VIDEO.buildEmbed({
          type:item.type,tmdb:item.tmdb,season,episode,
          options:{
            skin:'prime',primary_color:'8B5CF6',secondary_color:'17102B',
            icon_color:'F5F3FF',hide_title:0,hide_controls:0,
            subtitles:1,quality_selector:1,skip_intro:1,thumbnails:1
          }
        });
      }catch{return null}
    }
    function loadEpisode(){
      const url=videoUrl();
      if(!url){
        displayUnavailable(tr('No existe un ID de TMDb válido para reproducir este título.'));
        return;
      }
      const load=++embedToken;
      const iframe=NT.el('iframe',{
        src:url,
        title:'Reproducción · '+item.title+' · '+fullEpisodeName(),
        loading:'eager',
        sandbox:'allow-scripts allow-same-origin allow-forms allow-presentation',
        referrerpolicy:'origin',
        allow:'autoplay; fullscreen; encrypted-media; picture-in-picture',
        allowfullscreen:''
      });
      iframe.addEventListener('load',()=>{
        if(embedToken===load)$('playerStatus').textContent=tr('Reproductor listo.');
      });
      screen.replaceChildren(iframe);
      $('playerStatus').textContent=tr('Conectando con el reproductor…');
      // Comprobar el contrato público sin bloquear el iframe si CORS no está habilitado.
      if(VIDEO){
        VIDEO.exists({type:item.type,tmdb:item.tmdb,season,episode}).then(result=>{
          if(embedToken!==load)return;
          if(result.verified&&result.available===false){
            $('playerStatus').textContent=tr('Este título no figura como disponible en el catálogo del proveedor.');
          }else if(result.verified&&result.available===true){
            screen.dataset.providerAvailability='available';
          }
        }).catch(()=>{});
      }
    }
    function renderEpisodes(){
      if(item.type==='movie'||item.type==='wwe'){
        seasonSel.disabled=true;
        seasonSel.replaceChildren(new Option('—','1'));
        $('playerEpisodeChips').replaceChildren();
        picker.render();
        return;
      }
      seasonSel.disabled=false;
      const seasons=seasonsFor(item,episodes);
      if(!seasons.includes(season))season=seasons[0]||1;
      // Solo se muestra el número de temporada; la etiqueta conserva el contexto.
      seasonSel.replaceChildren(...seasons.map(n=>new Option(String(n),String(n))));
      seasonSel.value=String(season);
      picker.render();
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
          title:tr('Episodio')+' '+number+(e.name?' · '+e.name:''),
          'aria-label':tr('Seleccionar episodio')+' '+number+(e.name?' · '+e.name:''),
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
        document.createTextNode(tr(value?'Esconder':'Mostrar')),
        NT.el('span',{'aria-hidden':'true'},value?'⌃':'⌄')
      );
    }
    toggleSynopsis.addEventListener('click',()=>setSynopsisVisible(!summaryVisible));
    setSynopsisVisible(summaryVisible);
    seasonSel.addEventListener('change',()=>{
      season=Number(seasonSel.value)||1;
      episode=1;
      renderEpisodes();
      updateHead();
      loadEpisode();
    });

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
    if(item){mount.append(img(cover(item),'','last-thumb'));const t=NT.el('div');t.append(NT.el('h3',{},item.title),NT.el('p',{},tr('Última selección')+` · ${tr('Temporada')} ${last.season} · ${tr('Episodio')} ${last.episode}`),NT.el('a',{href:NT.playerUrl(item,last.season,last.episode),class:'text-link'},tr('Continuar selección ↗')));mount.append(t);}else{mount.append(NT.el('p',{},tr('Cuando selecciones un capítulo, aparecerá aquí para retomarlo.')));}
  }
  async function start(){
    try { collection=(await NT.loadCatalog()).items;const page=document.body.dataset.page;
      if(page==='inicio')mountHome();else if(page==='catalogo')mountCatalog();else if(page==='detalle')mountDetail();else if(page==='reproductor')mountPlayer();else if(page==='lista')loadSaved();
    } catch(e){console.error('NubeToon initialization issue',e);NT.notify(tr('No pudimos iniciar esta página. Comprueba sus archivos.'));}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
