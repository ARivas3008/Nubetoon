/* NubeToon article reader. No HTML injection: untrusted articles use textContent. */
(() => {
  'use strict';
  const NT=window.NT;
  const tr=k=>window.NTI?.t(k)||k;
  const root=document.getElementById('articleMain');
  const dataKey='nubetoon.blog.local.v1';
  const clean=(v,max=5000)=>String(v??'').trim().slice(0,max);
  const safeUrl=(input)=>{
    try{
      const u=new URL(input);
      return u.protocol==='https:'&&!u.username&&!u.password&&!u.port ? u.href : null;
    }catch{return null}
  };
  function node(tag,cls,value){
    const el=NT.el(tag,cls?{class:cls}:{});
    if(value!==undefined)el.textContent=value;
    return el;
  }
  function readLocal(){
    try{
      const posts=JSON.parse(localStorage.getItem(dataKey)||'[]');
      return Array.isArray(posts)?posts:[];
    }catch{return []}
  }
  async function readPublic(){
    try{
      const r=await fetch('data/blog-posts.json',{cache:'no-store'});
      if(!r.ok)return [];
      const data=await r.json();
      return Array.isArray(data.posts)?data.posts:[];
    }catch{return []}
  }
  function fail(){
    root.replaceChildren(node('h1','',tr('Artículo no encontrado.')),
                         node('p','blog-article-lead',tr('La publicación no está disponible en este navegador o fue eliminada.')));
  }
  function destination(post,item){
    return post.target==='episode'&&item.type!=='movie'
      ? NT.playerUrl(item,Math.max(1,Number(post.season)||1),Math.max(1,Number(post.episode)||1))
      : NT.detailUrl(item);
  }
  async function start(){
    const id=clean(new URLSearchParams(location.search).get('post'),160);
    if(!id){fail();return}
    const [catalogResult,published]=await Promise.all([NT.loadCatalog(),readPublic()]);
    const post=[...readLocal(),...published].find(x=>x&&x.id===id);
    if(!post){fail();return}
    let item=catalogResult.items.find(x=>x.id===post.mediaId);
    if(!item&&post.mediaSnapshot){
      const saved=NT.sanitize(post.mediaSnapshot);
      if(saved&&saved.id===post.mediaId){
        NT.addCustom(post.mediaSnapshot);
        item=saved;
      }
    }
    if(!item){fail();return}
    const title=clean(post.title,130),excerpt=clean(post.excerpt,420);
    if(!title||!excerpt){fail();return}
    document.title=title+' | NubeToon';
    const date=/^\d{4}-\d{2}-\d{2}$/.test(post.date)?post.date:'2026-11-07';
    const locale=window.NTI?.lang==='en'?'en-US':'es-PE';
    const meta=node('p','blog-article-byline',
      (clean(post.author,60)||'NubeToon')+' · '+
      new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))
    );
    const picture=node('div','blog-article-picture');
    const image=NT.el('img',{src:NT.imageUrl(item.poster,item.art),alt:tr('Carátula de')+' '+item.title,loading:'eager'});
    image.addEventListener('error',()=>{image.src='assets/art/default.svg'},{once:true});
    picture.append(image);
    const text=node('div','blog-article-text');
    const parts=clean(post.body,5000).split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    if(parts.length)for(const part of parts){text.append(node('p','',part))}
    else text.append(node('p','',excerpt));
    const callout=node('section','blog-article-destination');
    const associated=post.target==='episode'
      ?tr('Continúa con el capítulo seleccionado')
      :tr('Descubre la película o serie');
    callout.append(node('p','kicker',tr('CONTINÚA EN NUBETOON')),
                   node('h2','',associated),
                   node('p','',item.title+(post.target==='episode'?' · T'+post.season+' E'+post.episode:'')));
    const button=NT.el('a',{class:'btn btn-primary',href:destination(post,item)},post.target==='episode'?tr('Ir al capítulo')+' ↗':tr('Abrir ficha')+' ↗');
    callout.append(button);
    const source=safeUrl(post.blogspotUrl);
    if(source)callout.append(NT.el('a',{href:source,target:'_blank',rel:'noopener noreferrer',class:'blog-article-source'},tr('Leer entrada original en Blogspot')+' ↗'));
    root.replaceChildren(node('p','kicker',tr('ARTÍCULO / NUBETOON')),node('h1','blog-article-title',title),meta,
      node('p','blog-article-lead',excerpt),picture,text,callout);
  }
  start().catch(e=>{console.error('Article load failed',e);fail()});
})();
