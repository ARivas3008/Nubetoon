/* TVmaze public API: https://www.tvmaze.com/api (CC BY-SA, HTTPS+CORS). */
(() => {
  'use strict';
  const NT = window.NT;
  const base = 'https://api.tvmaze.com';
  const memory = new Map();
  async function request(path) {
    if (memory.has(path)) return memory.get(path);
    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(),9000);
      try {
        const response=await fetch(base + path,{signal:controller.signal,mode:'cors',headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error(`TVmaze HTTP ${response.status}`);
        return await response.json();
      } finally { clearTimeout(timer); }
    })();
    memory.set(path,task);
    try{return await task;}catch(e){memory.delete(path);throw e;}
  }
  function toItem(show) {
    const airedYear=Number(String(show.premiered||'').slice(0,4))||0;
    return NT.sanitize({
      id:'tvmaze-'+show.id, title:show.name, type:'tv', year:airedYear, tvmazeId:show.id,
      genres:Array.isArray(show.genres)?show.genres.slice(0,3):[],
      description:NT.cleanupText(show.summary),
      art:'assets/art/default.svg', tag:'TVMAZE'
    });
  }
  function poster(show){return NT.imageUrl(show?.image?.original || show?.image?.medium, 'assets/art/default.svg');}
  function chooseShow(results, item) {
    const name=NT.normalize(item.apiName||item.title);
    const year=Number(item.year)||0;
    const ranked=(results||[]).filter(r=>r.show&&r.show.id).map(r=>{
      const show=r.show, title=NT.normalize(show.name);
      const sy=Number(String(show.premiered||'').slice(0,4))||0;
      const score=(title===name?20:title.includes(name)||name.includes(title)?9:0)+(year&&sy?(sy===year?12:Math.abs(sy-year)<=2?3:-9):0)+(Number(r.score)||0);
      return {show,score};
    }).sort((a,b)=>b.score-a.score);
    return ranked[0]&&ranked[0].score>=0?ranked[0].show:null;
  }
  async function search(term){const q=NT.clean(term).slice(0,90);if(!q)return [];const results=await request('/search/shows?q='+encodeURIComponent(q));return Array.isArray(results)?results.map(r=>r.show).filter(Boolean):[];}
  async function images(tvmazeId){const data=await request(`/shows/${encodeURIComponent(tvmazeId)}/images`);return Array.isArray(data)?data:[];}
  async function episodes(tvmazeId){const data=await request(`/shows/${encodeURIComponent(tvmazeId)}/episodes`);return Array.isArray(data)?data.filter(e=>Number(e.number)>0):[];}
  async function show(tvmazeId){return request(`/shows/${encodeURIComponent(tvmazeId)}`);}
  async function enrich(item,{withImages=true}={}) {
    if(!item || item.type==='movie'||item.type==='wwe'||item.type==='novel' ||
      (item.source==='videoapi'&&String(item.apiName||'').startsWith('TMDb #')))return item;
    const enriched={...item};
    try {
      let result;
      if(item.tvmazeId)result=await show(item.tvmazeId);
      else {const found=await request('/search/shows?q='+encodeURIComponent(item.apiName||item.title));result=chooseShow(found,item);}
      if(!result)return enriched;
      enriched.tvmazeId=result.id;
      enriched.poster=poster(result);
      if(!enriched.year)enriched.year=Number(String(result.premiered||'').slice(0,4))||0;
      if(!enriched.description)enriched.description=NT.cleanupText(result.summary);
      if(!enriched.genres.length)enriched.genres=(result.genres||[]).slice(0,3);
      if(withImages){
        try {
          const gallery=await images(result.id);
          const bg=gallery.find(i=>i.type==='background' && i.resolutions?.original?.url);
          enriched.backdrop=NT.imageUrl(bg?.resolutions.original.url, enriched.art);
        } catch {/* poster works without gallery */}
      }
    } catch {/* offline fallback */}
    return enriched;
  }
  const fromShow = showRecord => {
    const i=toItem(showRecord);
    if(!i)return null;
    i.from='remote';i.poster=poster(showRecord);
    return i;
  };
  window.NTAPI={search,show,episodes,images,enrich,fromShow};
})();
