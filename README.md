# NubeToon — interfaz multipágina · Versión 3

NubeToon es un proyecto personal de catálogo de series y reproducción **de archivos que ya tienes**, con la posibilidad de solicitar un reproductor externo de VideoAPI bajo consentimiento explícito. El rediseño conserva la esencia de la versión anterior y distribuye la aplicación en **páginas HTML independientes**, con estilos y JavaScript compartidos.

## 1. Abrir la aplicación

Puedes abrir `index.html` directamente con un navegador moderno. Para un uso más fiable de `data/catalog.json` y evitar limitaciones de `file://`, también puedes abrir la carpeta desde un servidor HTTP local:

```sh
cd NubeToon-Multipagina
python -m http.server 8000
```

Visita `http://localhost:8000/`. **No se necesitan npm, node_modules, paquetes ni instalaciones adicionales.** Si no tienes acceso a la red, la aplicación usa las ilustraciones SVG locales y el catálogo de respaldo de JavaScript.

## 2. Páginas

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Portada visual, destacado, selección inicial y accesos rápidos |
| `catalogo.html` | Buscador independiente, filtros, catálogo local y resultados remotos de TVmaze |
| `detalle.html` | Ficha, carátulas, fondos de TVmaze y guía real de capítulos (si están disponibles) |
| `reproductor.html` | Selección de temporadas/capítulos, MP4/WebM local y VideoAPI bajo consentimiento |
| `mi-lista.html` | Favoritos y última selección, guardados en el navegador |

`styles/main.css` define todo el diseño responsive y la animación; `scripts/core.js` contiene estado y validación; `scripts/api.js` contiene el cliente exclusivo de TVmaze; `scripts/app.js` crea y conecta las interacciones en cada página.

`data/catalog.json` es la fuente de títulos del proyecto y `data/catalog-fallback.js` su respaldo para `file://`. Si editas el JSON, sincroniza el respaldo con `python scripts/sync_catalog.py`.

## 3. API para carátulas, fondos y capítulos: TVmaze

**Proveedor:** [TVmaze](https://www.tvmaze.com/api), una API REST pública que permite peticiones CORS desde navegadores y sirve los datos e imágenes por HTTPS. No exige registrar una API key.

Se utilizan los siguientes endpoints:

```
GET https://api.tvmaze.com/search/shows?q=NAME
GET https://api.tvmaze.com/shows/{id}
GET https://api.tvmaze.com/shows/{id}/images
GET https://api.tvmaze.com/shows/{id}/episodes
```

El cliente selecciona el programa más compatible con el nombre original y el año del catálogo, toma el `image.original` para los pósters y busca una imagen clasificada como `background` en la galería oficial. Si no existe o la API no responde, muestra el SVG incluido en `assets/art/` sin que la navegación se bloquee. Para imágenes y metadatos se atribuye a TVmaze, cuya licencia API es **CC BY-SA**; hay un enlace de atribución en el pie de todas las páginas. Comprueba requisitos de licencia si reutilizas la información públicamente.

**Límite de TVmaze:** su catálogo se centra en series de televisión. No es una API de películas; por ello, las películas personales pueden añadirse y reproducirse como archivo local, pero **no obtienen automáticamente sus carátulas de TVmaze**. Para carátulas cinematográficas se necesitaría una integración adicional, por ejemplo TMDb con credenciales propias y su licencia. La integración automática actual no inventa carteles ni intenta usar servicios de procedencia desconocida.

## 4. Reproductor y API externa

**Opción A — Archivo local:** se crea un `blob:` a partir del archivo seleccionado mediante el `<input type=file>` del navegador; no se sube a NubeToon ni a un servidor remoto. El archivo se descarta al cerrar el vídeo o cambiar de título. Que un formato MP4/MKV/WebM reproduzca bien depende de los códecs compatibles con el navegador.

**Opción B — VideoAPI (externo):** se solicita manualmente un iframe en `https://videoapi.la`. Se requiere introducir o revisar un **ID de TMDb**, que es diferente del ID de TVmaze. Para títulos del catálogo que ya poseen un ID de TMDb, el campo aparece prellenado. Esta opción exige marcar una casilla de autorización **cada vez que se conecta**, utiliza `sandbox` sin permisos de ventanas emergentes y `referrerpolicy="origin"`. La versión externa puede exigir un dominio autorizado, mostrar publicidad o no funcionar debido a su sandbox; **no se garantiza disponibilidad ni seguridad del contenido remoto**.

La aplicación **no incluye archivos de vídeo, no descarga material audiovisual y no elude derechos de autor.** Utilízala con contenidos que tengas derecho a visualizar.

## 5. Privacidad y seguridad

- El frontend no carga frameworks, bibliotecas JavaScript, fuentes ni scripts desde CDNs externos.
- La política CSP limita la carga remota a la API de TVmaze, su CDN de imágenes y el iframe de VideoAPI bajo autorización.
- Solo se aceptan URLs de imágenes bajo el dominio oficial `static.tvmaze.com`; el texto externo se muestra mediante `textContent`, no se ejecuta como HTML.
- Las listas, favoritos y selección se guardan en `localStorage` sin usuario ni contraseña; incluye lectura de favoritos de la versión `nubetoon.v2` cuando se utiliza el mismo origen.
- No se almacena ningún token ni contraseña de GitHub o de TMDb.
- El diseño reduce las animaciones si el sistema activa `prefers-reduced-motion`.
- Ninguna aplicación web puede certificar que un proveedor externo esté libre de malware; por eso se restringen orígenes y se recomienda no desactivar las protecciones del navegador.

## 6. Guía de uso

1. Abre Inicio (`index.html`) y entra a **Explorar catálogo**.
2. En `catalogo.html`, busca o filtra las series. A partir de 2 caracteres, la página puede consultar TVmaze para devolver más series.
3. Abre la ficha de un título. Si TVmaze lo reconoce, verás sus imágenes y episodios reales. Selecciona una temporada y un capítulo.
4. La selección abre `reproductor.html`; elige reproducir un vídeo local o, si lo deseas, conecta VideoAPI después de aceptar sus condiciones.
5. Guarda favoritos con el botón ♡ y consúltalos en `mi-lista.html`.

## 7. Publicación en GitHub Pages

Los archivos de NubeToon se han cargado en [ARivas3008/Nubetoon](https://github.com/ARivas3008/Nubetoon). El flujo de GitHub Actions se encarga de publicar las páginas HTML, CSS, JavaScript y JSON desde `main`. **El propietario debe activar primero GitHub Pages en Settings → Pages → Build and deployment → Source: GitHub Actions**. Una vez habilitado, ejecuta la acción de despliegue y visita `https://arivas3008.github.io/Nubetoon/` (enlace operativo solo tras un despliegue satisfactorio). Para VideoAPI podría ser necesario registrar el dominio de GitHub Pages con el proveedor.

## 8. Mockup y flujo

- `docs/MOCKUP_FIGMA.png`: tablero ilustrativo estilo Figma con inicio, buscador, detalle, reproductor, flujo, componentes y móvil. **Es un mockup conceptual, no un archivo `.fig` editable ni una captura exacta del producto.**
- `docs/FLUJO.md`: flujo de usuario y diagrama de la estructura.
- `original/`: copia de los archivos entregados antes del rediseño.

### Créditos e inspiración

Inspiración de diseño: Sword of Convallaria, Unseen Studio, galerías Dribbble de plataformas de streaming y transiciones suaves de sitios destacados por Orpetron. Las ilustraciones locales son originales del proyecto anterior y no copias extraídas de esas páginas. TVmaze suministra datos e imágenes de terceros; NubeToon no es un servicio oficial de ninguno de ellos.

## 9. Identidad visual y publicación (versión 4)

El encabezado y el pie de las cinco páginas utilizan `assets/art/logo-mark.svg`,
un símbolo vectorial propio que combina una nube y un botón **play**.
Su paleta coincide con `styles/main.css`: cian `#4dd9ef`, violeta
`#7c5cff`, fondo azul noche `#101625` y texto claro.
`assets/art/favicon.svg` reproduce la misma marca.

Hay un workflow de GitHub Actions listo en `.github/workflows/pages.yml`
que publica el sitio estático en GitHub Pages al subir el contenido a `main`.
**La publicación exige activar Pages una vez desde Settings → Pages → Source: GitHub Actions.** El token de GitHub Actions no puede habilitar Pages en este repositorio; la activación debe efectuarla el propietario.