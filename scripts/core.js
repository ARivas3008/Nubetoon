/* NubeToon core — browser-only, no framework. */
(() => {
  'use strict';
  const prefix = 'nubetoon-v3-';
  const safeTypes = new Set(['tv', 'anime', 'movie', 'novel', 'wwe']);
  const storage = {
    read(key, fallback) { try { let v = localStorage.getItem(prefix + key); if (!v) { const legacy = {favorites:'favorites',custom:'personal',selection:'last'}[key]; if (legacy) v = localStorage.getItem('nubetoon.v2.' + legacy); } return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const originalArt = ['batman.svg','avatar.svg','gravity.svg','samurai.svg','future.svg','garden.svg'];
  const artUrl = candidate => {
    if (typeof candidate === 'string' && /^assets\/art\/[a-z0-9-]+\.svg$/i.test(candidate)) return candidate;
    return 'assets/art/default.svg';
  };
  function imageUrl(candidate, fallback) {
    try {
      const url=new URL(candidate,location.href);
      if(url.protocol==='https:' && !url.username && !url.password &&
        ['static.tvmaze.com','images.metahub.space','image.tmdb.org'].includes(url.hostname))
        return url.href;
    }catch {}
    return artUrl(fallback);
  }
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = safeTypes.has(raw.type) ? raw.type : 'tv';
    const id = clean(raw.id).slice(0,100);
    const title = clean(raw.title).slice(0,120);
    if (!id || !title) return null;
    return {
      id, title, year: Number(raw.year) || 0, type,
      tmdb: Number.isSafeInteger(Number(raw.tmdb)) && Number(raw.tmdb) > 0 && Number(raw.tmdb) < 1e9 ? Number(raw.tmdb) : null,
      apiName: clean(raw.apiName || title).slice(0,120),
      tvmazeId: Number(raw.tvmazeId) || null,
      genres: Array.isArray(raw.genres) ? raw.genres.map(clean).filter(Boolean).slice(0,4) : [],
      description: clean(raw.description).slice(0,2000),
      seasons: Array.isArray(raw.seasons) ? raw.seasons.map(n => Math.min(60,Math.max(0,Number(n) || 0))).slice(0,30) : [],
      art: artUrl(raw.art),
      poster: raw.poster?imageUrl(raw.poster,null):'',
      backdrop: raw.backdrop?imageUrl(raw.backdrop,null):'',
      tag: clean(raw.tag).slice(0,35) || 'NUBETOON',
      from: raw.from==='videoapi'?'videoapi':'library',
      source: raw.source==='videoapi'?'videoapi':'library'
    };
  }
  let catalogCache;
  async function loadCatalog() {
    if (catalogCache) return catalogCache;
    let data = window.NUBETOON_FALLBACK_CATALOG || { items: [] };
    if (location.protocol !== 'file:') {
      try { const res = await fetch('data/catalog.json', {cache:'no-store'}); if(res.ok) data=await res.json(); } catch { /* preserve packaged fallback */ }
    }
    let external=[];
    try {
      if(window.NTVideoAPI){
        const remote=await window.NTVideoAPI.cachedCatalog();
        external=remote.items||[];
      }
    }catch {/* Mantener catálogo empaquetado y listas locales. */}
    const combined=[...(Array.isArray(data.items)?data.items:[]),...storage.read('custom',[]),...external]
      .map(sanitize).filter(Boolean);
    const ids = new Set();
    catalogCache = { featured: clean(data.featured), items: combined.filter(item => !ids.has(item.id) && ids.add(item.id)) };
    return catalogCache;
  }
  function addCustom(item){
    const safe=sanitize(item);if(!safe)return false;
    const existing=storage.read('custom',[]);
    const at=existing.findIndex(x=>x&&x.id===safe.id);
    if(at>=0)existing[at]=item;else existing.push(item);
    const ok=storage.write('custom',existing);
    if(ok)catalogCache=null;
    return ok;
  }
  const favorites = () => new Set(storage.read('favorites', []));
  const isFavorite = item => favorites().has(item.tvmazeId && item.from === 'remote' ? `tvmaze:${item.tvmazeId}` : item.id);
  function toggleFavorite(item){const set=favorites();const key=item.from === 'remote' ? `tvmaze:${item.tvmazeId}` : item.id; const added=!set.has(key);if(added)set.add(key);else set.delete(key);storage.write('favorites',[...set]);return added;}
  const favoritesIds = () => [...favorites()];
  const storeSelection = (item, season=1, episode=1) => storage.write('selection',{id:item.id,tvmazeId:item.from==='remote'?item.tvmazeId:null,season,episode,title:item.title});
  const loadSelection = () => storage.read('selection', null);
  const params = () => new URLSearchParams(location.search);
  const detailUrl = item => item.from==='remote' && item.tvmazeId ? `detalle.html?tvmaze=${encodeURIComponent(item.tvmazeId)}` : `detalle.html?id=${encodeURIComponent(item.id)}`;
  const playerUrl = (item, season=1, episode=1) => `reproductor.html?${item.from==='remote' && item.tvmazeId ? 'tvmaze='+encodeURIComponent(item.tvmazeId) : 'id='+encodeURIComponent(item.id)}&season=${Number(season)||1}&episode=${Number(episode)||1}`;
  function notify(message){const root=document.getElementById('toastStack');if(!root)return;const el=document.createElement('div');el.className='toast';el.textContent=message;root.append(el);setTimeout(()=>el.remove(),3300);}
  function el(tag,attributes={},text){const node=document.createElement(tag);Object.entries(attributes).forEach(([key,value])=>{if(value===undefined||value===null)return;if(key==='class')node.className=value;else if(key==='dataset')Object.entries(value).forEach(([k,v])=>node.dataset[k]=v);else node.setAttribute(key,String(value));});if(text!==undefined)node.textContent=text;return node;}
  const types={tv:'Serie',anime:'Anime',movie:'Película',novel:'Novela',wwe:'WWE'};
  const cleanupText = value => clean(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  window.NT={prefix,storage,clean,normalize,sanitize,artUrl,imageUrl,originalArt,loadCatalog,addCustom,favorites,isFavorite,toggleFavorite,favoritesIds,storeSelection,loadSelection,params,detailUrl,playerUrl,notify,el,types,cleanupText};
})();
