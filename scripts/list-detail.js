/* NubeToon · lector de listas compartidas. */
(() => {
 'use strict';
 const NT=window.NT,API=window.NTAPI,$=id=>document.getElementById(id);
 const t=x=>window.NTI?.t(x)||x,STORE='nubetoon.shared-lists.v1';
 const clean=(x,n=1200)=>String(x??'').trim().slice(0,n);
 const safe=(value)=>{
  if(typeof value!=='string')return'';
  if(/^assets\/art\/[a-z0-9-]+\.svg$/i.test(value))return value;
  try{const u=new URL(value);
    if(u.protocol==='https:'&&['static.tvmaze.com','images.metahub.space','image.tmdb.org'].includes(u.hostname)&&!u.username&&!u.password)return u.href;
  }catch{}return'';
 };
 const loaded=$('sharedDetailContent');
 function fail(){
  loaded.replaceChildren(NT.el('h1',{},t('Lista no encontrada.')),NT.el('p',{},t('Esta lista no está disponible en tu navegador o no se ha publicado.')));
 }
 async function getLists(){
  let local=[],pub=[];
  try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(value))local=value;}catch{}
  try{const res=await fetch('data/shared-lists.json',{cache:'no-store'});
    if(res.ok){const json=await res.json();if(Array.isArray(json.lists))pub=json.lists}
  }catch{}return [...local,...pub];
 }
 function poster(entry,item){
  return safe(entry.poster)||safe(item.poster)||item.art||'assets/art/default.svg';
 }
 async function main(){
  const id=clean(new URLSearchParams(location.search).get('list'),150);
  if(!id)return fail();
  const [data,posts]=await Promise.all([NT.loadCatalog(),getLists()]);
  const raw=posts.find(x=>x&&x.id===id);
  if(!raw||!Array.isArray(raw.items)||!raw.items.length)return fail();
  const title=clean(raw.title,120),description=clean(raw.description,1200);
  if(!title||!description)return fail();
  document.title=title+' | NubeToon';
  const items=[];
  for(const entry of raw.items.slice(0,20)){
    const mediaId=clean(entry.mediaId,100);
    let item=data.items.find(x=>x.id===mediaId);
    if(!item&&entry.snapshot){
      const snap=NT.sanitize(entry.snapshot);
      if(snap&&snap.id===mediaId){
        // Provide a working detail page for valid custom titles in this browser.
        NT.addCustom(entry.snapshot);
        item=snap;data.items.push(snap);
      }
    }
    if(item)items.push({entry,item});
  }
  if(!items.length)return fail();
  const headline=NT.el('header',{class:'shared-detail-heading'});
  headline.append(NT.el('p',{class:'kicker'},t('LISTA COMPARTIDA / NUBETOON')),
    NT.el('h1',{},title),NT.el('p',{class:'shared-detail-intro'},description));
  const gallery=NT.el('div',{class:'shared-detail-posters'});
  const cells=[];
  for(const record of items){
    const {entry,item}=record;
    const a=NT.el('a',{class:'shared-detail-title',href:NT.detailUrl(item),'aria-label':t('Ver ficha')+': '+item.title});
    const img=NT.el('img',{src:poster(entry,item),alt:item.title,loading:'lazy',decoding:'async'});
    img.addEventListener('error',()=>{img.src='assets/art/default.svg'},{once:true});
    a.append(NT.el('div',{class:'shared-detail-cover'},''),NT.el('span',{},item.title));
    a.firstChild.append(img);
    cells.push({img,record});
    gallery.append(a);
  }
  loaded.replaceChildren(headline,gallery);
  const btn=$('sharedShare');
  if(btn){
    btn.hidden=false;
    const isLocal=posts.indexOf(raw)!==-1 && (()=>{try{
      const local=JSON.parse(localStorage.getItem(STORE)||'[]');
      return Array.isArray(local)&&local.some(x=>x.id===id);
    }catch{return false}})();
    if(isLocal){btn.textContent=t('Solo en este navegador');btn.disabled=true}
    else btn.addEventListener('click',async()=>{
      const link=location.href;
      try{
        if(navigator.share){await navigator.share({title,url:link});return}
        await navigator.clipboard.writeText(link);NT.notify(t('Enlace copiado.'));
      }catch{/* Share aborted, no false success message. */}
    });
  }
  // Enrich TVmaze covers with actual poster URLs, preserving selected order.
  await Promise.allSettled(cells.map(async({img,record})=>{
    if(record.item.type==='movie'||safe(record.entry.poster))return;
    const enriched=await API.enrich(record.item,{withImages:false});
    if(img.isConnected)img.src=poster(record.entry,enriched);
  }));
 }
 main().catch(e=>{console.error('Shared list reader failed',e);fail()});
})();
