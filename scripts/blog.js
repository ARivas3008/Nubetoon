/* NubeToon Blog · publicaciones editoriales y enlaces a fichas/capítulos. */
(() => {
  'use strict';
  const NT=window.NT;
  const $=id=>document.getElementById(id);
  const tr=(text)=>window.NTI?.t(text)||text;
  const STORAGE_KEY='nubetoon.blog.local.v1';
  let catalog=[],published=[],localPosts=[],editingId=null,viewFilter='all';
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
    const mediaId=clean(raw.mediaId,130),item=catalog.find(x=>x.id===mediaId);
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
    const link=NT.el('a',{class:'blog-post-link',href:destination(post),'aria-label':tr('Abrir destino')+': '+post.title});
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
    footer.append(NT.el('span',{},item.title),NT.el('b',{},targetLabel(post)+' ↗'));
    text.append(meta,title,description,footer);
    link.append(media,text);
    article.append(link);
    const extras=NT.el('div',{class:'blog-post-extras'});
    if(post.blogspotUrl){
      extras.append(NT.el('a',{href:post.blogspotUrl,target:'_blank',rel:'noopener noreferrer',class:'blog-original-link'},tr('Leer en Blogspot')+' ↗'));
    }
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
  function syncTargets(){
    const id=$('blogMedia').value;
    const media=catalog.find(item=>item.id===id);
    const target=$('blogTarget');
    const episodeOption=[...target.options].find(opt=>opt.value==='episode');
    if(!media)return;
    episodeOption.disabled=media.type==='movie';
    if(media.type==='movie')target.value='detail';
    const isEpisode=target.value==='episode';
    $('blogChapterFields').hidden=!isEpisode;
    if(!isEpisode)return;
    const season=$('blogSeason'),ep=$('blogEpisode');
    const seasonNum=Number(season.value)||1,epNum=Number(ep.value)||1;
    const total=Math.max(1,Math.min(30,media.seasons?.length||1));
    season.replaceChildren(...Array.from({length:total},(_,i)=>new Option(String(i+1),String(i+1))));
    season.value=String(Math.min(total,seasonNum));
    const count=Math.max(1,Math.min(60,Number(media.seasons?.[Number(season.value)-1])||13));
    ep.replaceChildren(...Array.from({length:count},(_,i)=>new Option(String(i+1),String(i+1))));
    ep.value=String(Math.min(count,epNum));
  }
  function setEditor(open){
    $('blogEditor').hidden=!open;
    $('blogCompose').setAttribute('aria-expanded',String(open));
    if(open)$('blogTitle').focus();
  }
  function resetEditor(){
    editingId=null;
    $('blogForm').reset();
    $('blogFormHeading').textContent=tr('Nueva publicación');
    $('blogSave').textContent=tr('Guardar publicación');
    syncTargets();
  }
  function beginEdit(post){
    editingId=post.id;
    $('blogTitle').value=post.title;
    $('blogExcerpt').value=post.excerpt;
    $('blogBody').value=post.body||'';
    $('blogAuthor').value=post.author;
    $('blogMedia').value=post.mediaId;
    $('blogTarget').value=post.target;
    syncTargets();
    $('blogSeason').value=String(post.season);
    syncTargets();
    $('blogEpisode').value=String(post.episode);
    $('blogBlogspot').value=post.blogspotUrl;
    $('blogFormHeading').textContent=tr('Editar publicación');
    $('blogSave').textContent=tr('Guardar cambios');
    setEditor(true);
    $('blogEditor').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function onSubmit(event){
    event.preventDefault();
    const source=clean($('blogBlogspot').value,500);
    if(source&&!safeSource(source)){
      NT.notify(tr('Utiliza un enlace HTTPS válido.'));$('blogBlogspot').focus();return;
    }
    const raw={
      id:editingId||('local-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))),
      title:$('blogTitle').value,excerpt:$('blogExcerpt').value,body:$('blogBody').value,
      author:$('blogAuthor').value,mediaId:$('blogMedia').value,target:$('blogTarget').value,
      season:Number($('blogSeason').value)||1,episode:Number($('blogEpisode').value)||1,
      blogspotUrl:source,date:editingId?localPosts.find(x=>x.id===editingId)?.date:new Date().toISOString().slice(0,10)
    };
    const valid=normalizePost(raw);
    if(!valid){NT.notify(tr('Completa el título, resumen y contenido asociado.'));return;}
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
      const sel=$('blogMedia');
      sel.replaceChildren(...catalog.map(item=>new Option(item.title+(item.year?' ('+item.year+')':''),item.id)));
      localPosts=readLocal();
      syncTargets();
      $('blogCompose').addEventListener('click',()=>{if($('blogEditor').hidden)resetEditor();setEditor($('blogEditor').hidden);});
      $('blogCancel').addEventListener('click',()=>{resetEditor();setEditor(false);});
      $('blogMedia').addEventListener('change',syncTargets);
      $('blogTarget').addEventListener('change',syncTargets);
      $('blogSeason').addEventListener('change',syncTargets);
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
