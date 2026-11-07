/* NubeToon · VideoAPI: public documented contract (https://videoapi.la/api)
 * Read-only metadata endpoints. No private API keys, no ad bypass, no postMessage.
 * GitHub Pages cache is optional; live access depends on provider CORS policy.
 */
(()=>{
  'use strict';
  const ORIGIN='https://videoapi.la';
  const FEEDS=Object.freeze({
    movie:'movies',tv:'tvshows',anime:'anime',novel:'novels',wwe:'wwe',
    episodes:'episodes','anime-episodes':'anime-episodes','novel-episodes':'novel-episodes'
  });
  const EMBED_TYPES=new Set(['movie','tv','anime','novel','wwe']);
  const requestCache=new Map();
  const goodId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0&&Number(v)<1e9;
  const integer=(v,min,max,otherwise)=>{
    const n=Number(v);
    return Number.isSafeInteger(n)&&n>=min&&n<=max?n:otherwise;
  };
  const normalType=x=>({series:'tv',tvshows:'tv',movies:'movie',animes:'anime',novels:'novel'}[x]||x);
  function queryParams(type,tmdb,season=1,episode=1,extra={}){
    type=normalType(type);
    if(!EMBED_TYPES.has(type)||!goodId(tmdb))throw new TypeError('VideoAPI: tipo o TMDb ID inválido.');
    const q=new URLSearchParams({type,tmdb:String(Number(tmdb))});
    if(type!=='movie'&&type!=='wwe'){
      q.set('season',String(integer(season,0,99,1)));
      q.set('episode',String(integer(episode,1,999,1)));
    }
    const allowed=['skin','primary_color','secondary_color','icon_color','hide_title','hide_controls','autoplay','auto_next','start_at','skip_intro','thumbnails','subtitles','quality_selector'];
    for(const key of allowed){
      const value=extra[key];
      if(value===undefined||value===null)continue;
      if(['primary_color','secondary_color','icon_color'].includes(key)){
        if(/^[A-Fa-f0-9]{6}$/.test(String(value)))q.set(key,String(value));
      }else if(key==='skin'){
        if(/^[a-z0-9-]{2,25}$/i.test(String(value)))q.set(key,String(value).toLowerCase());
      }else if(key==='start_at'){
        const n=integer(value,0,86400*7,null);if(n!==null)q.set(key,String(n));
      }else if(value==='0'||value==='1'||value===0||value===1||typeof value==='boolean'){
        q.set(key,String(Number(value)));
      }
    }
    return q;
  }
  function buildEmbed({type='tv',tmdb,season=1,episode=1,options={}}={}){
    const params=queryParams(type,tmdb,season,episode,options);
    const k=normalType(type);
    const path=k==='movie'||k==='wwe'?'/e/'+k+'/'+Number(tmdb):
      '/e/'+k+'/'+Number(tmdb)+'/'+params.get('season')+'/'+params.get('episode');
    params.delete('type');params.delete('tmdb');params.delete('season');params.delete('episode');
    return ORIGIN+path+(params.size?'?'+params.toString():'');
  }
  async function get(path,{timeout=6500,cacheMs=300000}={}){
    if(!/^\/api\/v1\/[a-z0-9/?&=_%-]+$/i.test(path))throw new Error('VideoAPI: ruta no permitida.');
    const now=Date.now(), prior=requestCache.get(path);
    if(prior&&prior.expires>now)return prior.promise;
    const task=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const response=await fetch(ORIGIN+path,{
          method:'GET',mode:'cors',cache:'no-store',
          headers:{Accept:'application/json'},signal:controller.signal
        });
        if(!response.ok)throw new Error('VideoAPI respondió HTTP '+response.status);
        return await response.json();
      }finally{clearTimeout(timer)}
    })();
    requestCache.set(path,{promise:task,expires:now+cacheMs});
    try{return await task}catch(error){requestCache.delete(path);throw error}
  }
  async function exists({type='tv',tmdb,season=1,episode=1}={}){
    type=normalType(type);
    if(!EMBED_TYPES.has(type)||!goodId(tmdb))return {available:null,path:null,verified:false,error:'invalid'};
    const path='/api/v1/public/exists/'+type+'/'+Number(tmdb)+
      ((type==='movie'||type==='wwe')?'':'/'+integer(season,0,99,1)+'/'+integer(episode,1,999,1));
    try{
      const data=await get(path,{timeout:3500});
      return {available:typeof data.exists==='boolean'?data.exists:null,
        path:typeof data.path==='string'&&/^\/e\/[a-z0-9/]+$/.test(data.path)?data.path:null,
        verified:typeof data.exists==='boolean',error:null};
    }catch(error){return {available:null,path:null,verified:false,error:error?.name||'network'}}
  }
  async function validate({type='tv',tmdb,season=1,episode=1,options={}}={}){
    const q=queryParams(type,tmdb,season,episode,options);
    try{
      const data=await get('/api/v1/public/validate-embed?'+q.toString(),{timeout:5500});
      return {valid:data.valid===true,hints:Array.isArray(data.hints)?data.hints.slice(0,8):[],
        error:typeof data.error==='string'?data.error:null,verified:true};
    }catch(error){return {valid:null,hints:[],error:error?.name||'network',verified:false}}
  }
  function family(kind){
    kind=normalType(kind);
    if(!Object.prototype.hasOwnProperty.call(FEEDS,kind))throw new TypeError('VideoAPI: familia inválida');
    return FEEDS[kind];
  }
  async function latest(kind='movie',page=1,limit=24){
    const route='/api/v1/public/wordpress/'+family(kind)+'/latest?page='+
      integer(page,1,1000,1)+'&limit='+integer(limit,1,48,24);
    const data=await get(route,{timeout:7000,cacheMs:120000});
    return {items:Array.isArray(data.items)?data.items:[],
      pagination:data.pagination&&typeof data.pagination==='object'?data.pagination:{},feed:kind};
  }
  async function stats(){
    const data=await get('/api/v1/catalog/public-stats',{timeout:5500,cacheMs:3600000});
    return data&&typeof data.stats==='object'?data.stats:null;
  }
  const safeImage=(input)=>{
    if(typeof input!=='string')return '';
    if(/^\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(input))return 'https://image.tmdb.org/t/p/w500'+input;
    try{
      const u=new URL(input);
      if(u.protocol==='https:'&&['static.tvmaze.com','images.metahub.space','image.tmdb.org'].includes(u.hostname)&&!u.username&&!u.password)return u.href;
    }catch{}
    return '';
  };
  function fromFeed(raw,typeHint){
    if(!raw||typeof raw!=='object')return null;
    const type=normalType(raw.type||typeHint||'movie');
    if(!EMBED_TYPES.has(type))return null;
    const tmdb=Number(raw.tmdb_id??raw.tmdb??raw.show_tmdb_id);
    if(!goodId(tmdb))return null;
    const title=String(raw.title||raw.name||raw.original_title||raw.original_name||'').trim().slice(0,120);
    const cover=safeImage(raw.poster_url||raw.poster||raw.poster_path||raw.image);
    const year=Number(String(raw.year||raw.release_date||raw.first_air_date||'').match(/\b(?:19|20)\d{2}\b/)?.[0])||0;
    const description=String(raw.overview||raw.description||raw.summary||'').replace(/<[^>]*>/g,' ').trim().slice(0,1300);
    const data={id:'videoapi-'+type+'-'+tmdb,title:title||'TMDb #'+tmdb,
      type,tmdb,year,art:'assets/art/default.svg',poster:cover,
      description,genres:Array.isArray(raw.genres)?raw.genres.filter(x=>typeof x==='string').slice(0,4):[],
      apiName:title||'TMDb #'+tmdb,tag:'VIDEOAPI',source:'videoapi'};
    const NT=window.NT;const sanitized=NT?.sanitize?NT.sanitize(data):data;
    if(!sanitized)return null;
    sanitized.poster=cover;
    sanitized.from='videoapi';
    sanitized.source='videoapi';
    return sanitized;
  }
  async function cachedCatalog(){
    try{
      const response=await fetch('data/videoapi-feed.json',{cache:'no-store'});
      if(!response.ok)throw new Error('Feed not found');
      const raw=await response.json();
      const entries=Array.isArray(raw.items)?raw.items:[];
      return {items:entries.slice(0,250).map(x=>fromFeed(x,x.type)).filter(Boolean),
        updated:typeof raw.updated==='string'?raw.updated:null,
        source:raw.source||'snapshot',stats:raw.stats||null};
    }catch{return {items:[],updated:null,source:'unavailable',stats:null}}
  }
  window.NTVideoAPI={origin:ORIGIN,feedTypes:FEEDS,buildEmbed,queryParams,exists,validate,latest,stats,fromFeed,cachedCatalog};
})();