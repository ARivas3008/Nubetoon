#!/usr/bin/env python3
"""Synchronize public VideoAPI catalogue feeds for GitHub Pages without a secret.
Fetches public metadata only; publishes no video files. Keeps last good cache
if network/provider is unavailable and does not fail the Pages deployment.
"""
from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE="https://videoapi.la"
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"data"/"videoapi-feed.json"
FAMILIES={"movie":"movies","tv":"tvshows","anime":"anime","novel":"novels","wwe":"wwe"}
LIMIT=24
MAX_PER_FAMILY=48

def read_json(path):
    req=Request(BASE+path,headers={"Accept":"application/json","User-Agent":"NubeToonPublicCatalogSync/1.0"})
    with urlopen(req,timeout=9) as response:
        return json.load(response)

def normalize(raw,kind):
    if not isinstance(raw,dict): return None
    try:
        identifier=int(raw.get("tmdb_id") or raw.get("tmdb") or raw.get("show_tmdb_id") or 0)
    except (ValueError,TypeError): return None
    if identifier<1 or identifier>=1_000_000_000: return None
    title=str(raw.get("title") or raw.get("name") or raw.get("original_title") or raw.get("original_name") or "").strip()[:120]
    poster=str(raw.get("poster_url") or raw.get("poster") or raw.get("poster_path") or raw.get("image") or "")[:350]
    if poster.startswith("/"):
        poster="https://image.tmdb.org/t/p/w500"+poster
    if poster and not poster.startswith(("https://static.tvmaze.com/","https://images.metahub.space/","https://image.tmdb.org/")):
        poster=""
    description=str(raw.get("overview") or raw.get("description") or raw.get("summary") or "").strip()[:1100]
    year=str(raw.get("year") or raw.get("release_date") or raw.get("first_air_date") or "")[:10]
    return {"tmdb_id":identifier,"type":kind,"title":title or f"TMDb #{identifier}",
            "poster":poster,"description":description,"year":year}

def main():
    previous={}
    if OUTPUT.exists():
        try: previous=json.loads(OUTPUT.read_text("utf-8"))
        except Exception: pass
    gathered=[]
    succeeded=[]
    for kind,route in FAMILIES.items():
        buf=[]
        for page in (1,2):
            endpoint=f"/api/v1/public/wordpress/{route}/latest?page={page}&limit={LIMIT}"
            try:
                result=read_json(endpoint)
                if not isinstance(result,dict):raise ValueError("Unexpected response format")
                page_items=result.get("items",[])
                if not isinstance(page_items,list):raise ValueError("Items must be a list")
                for raw in page_items:
                    item=normalize(raw,kind)
                    if item:buf.append(item)
                if len(page_items)<LIMIT:break
            except (OSError,ValueError,KeyError) as exc:
                print(f"{kind}: {type(exc).__name__}: {exc}")
                break
        if buf:
            succeeded.append(kind)
            gathered.extend(buf[:MAX_PER_FAMILY])
    old_items=previous.get("items",[]) if isinstance(previous.get("items"),list) else []
    previous_by_type={x.get("type"):[] for x in old_items if isinstance(x,dict)}
    for entry in old_items:
        if isinstance(entry,dict) and entry.get("type") in FAMILIES:
            previous_by_type.setdefault(entry["type"],[]).append(entry)
    merged=[]
    for kind in FAMILIES:
        own=[x for x in gathered if x["type"]==kind] if kind in succeeded else previous_by_type.get(kind,[])
        merged.extend(own[:MAX_PER_FAMILY])
    distinct={}
    for entry in merged:
        distinct.setdefault((entry["type"],entry["tmdb_id"]),entry)
    stats=previous.get("stats")
    try:
        result=read_json("/api/v1/catalog/public-stats")
        if isinstance(result.get("stats"),dict):stats=result["stats"]
    except (OSError,ValueError) as exc:
        print(f"Stats: {type(exc).__name__}: {exc}")
    if not distinct and not stats:
        print("VideoAPI unavailable: retaining checked-in JSON as safe fallback.")
        return
    content={
        "version":1,"source":"VideoAPI public WordPress feeds","updated":dt.datetime.now(dt.timezone.utc).isoformat(),
        "families_updated":succeeded,"stats":stats,"items":list(distinct.values())
    }
    OUTPUT.write_text(json.dumps(content,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Synced",len(content["items"]),"public catalogue items;", "families:",", ".join(succeeded) or "cached")

if __name__=="__main__":
    main()
