#!/usr/bin/env python3
"""Genera el respaldo offline desde el JSON maestro sin dependencias adicionales."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'data/catalog.json').read_text(encoding='utf-8'))
(root/'data/catalog-fallback.js').write_text(
    '// Archivo de respaldo para file://; sincronizado desde data/catalog.json.\n'
    + 'window.NUBETOON_FALLBACK_CATALOG = '
    + json.dumps(raw,ensure_ascii=False,indent=2) + ';\n',encoding='utf-8'
)
print('Catálogo sincronizado')
