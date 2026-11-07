# NubeToon — interfaz multipágina · Versión 3

NubeToon es una aplicación multipágina para explorar series, consultar fichas y episodios y reproducir contenido mediante un reproductor externo integrado cuando el proveedor lo permite. Usa TVmaze para metadatos e imágenes, VideoAPI para la reproducción y una interfaz responsive con internacionalización español/inglés. No aloja archivos audiovisuales.

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
| `reproductor.html` | Reproductor integrado, resumen desplegable, selector numérico de temporada y capítulos |
| `mi-lista.html` | Favoritos y última selección, guardados en el navegador |

`styles/main.css` define todo el diseño responsive y la animación; `scripts/core.js` contiene estado y validación; `scripts/api.js` contiene el cliente exclusivo de TVmaze; `scripts/app.js` crea las interacciones; `scripts/i18n.js` añade traducciones de interfaz y selección de idioma.

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

**Límite de TVmaze:** su catálogo se centra en series de televisión. No es una API de películas; por ello, las películas personales pueden añadirse al catálogo, pero **no obtienen automáticamente sus carátulas de TVmaze**. Para carátulas cinematográficas se necesitaría una integración adicional, por ejemplo TMDb con credenciales propias y su licencia. La integración automática actual no inventa carteles ni intenta usar servicios de procedencia desconocida.

## 4. Reproductor integrado

Al entrar en `reproductor.html`, se intenta cargar VideoAPI automáticamente utilizando el ID TMDb del título y, para series, los números de temporada y episodio. Se mantiene el `iframe` con sandbox; la disponibilidad, publicidad y controles internos dependen del proveedor. Los títulos procedentes únicamente de TVmaze requieren un ID de TMDb válido para reproducirse.

El reproductor muestra el nombre del episodio, un resumen editorial con las acciones Mostrar/Esconder y un único selector de temporada y capítulos. Su panel lateral muestra la sinopsis y la portada de la serie. La página no hospeda ni distribuye vídeos.

## 4.1 Idiomas

El módulo `scripts/i18n.js` soporta español (`es`) e inglés (`en`). El botón ES/EN del encabezado guarda la elección en `localStorage` y la mantiene en todas las páginas. Se traducen menús, formularios, accesibilidad, mensajes de interacción y las descripciones editoriales de los títulos incluidos. Las sinopsis y nombres de episodios obtenidos directamente de TVmaze conservan su idioma de origen.

## 5. Privacidad y seguridad

- El frontend no carga frameworks, bibliotecas JavaScript, fuentes ni scripts desde CDNs externos.
- La política CSP limita la carga remota a la API de TVmaze, su CDN de imágenes y el iframe de VideoAPI cargado al visitar el reproductor.
- Solo se aceptan URLs de imágenes bajo el dominio oficial `static.tvmaze.com`; el texto externo se muestra mediante `textContent`, no se ejecuta como HTML.
- Las listas, favoritos y selección se guardan en `localStorage` sin usuario ni contraseña; incluye lectura de favoritos de la versión `nubetoon.v2` cuando se utiliza el mismo origen.
- No se almacena ningún token ni contraseña de GitHub o de TMDb.
- El diseño reduce las animaciones si el sistema activa `prefers-reduced-motion`.
- Ninguna aplicación web puede certificar que un proveedor externo esté libre de malware; por eso se restringen orígenes y se recomienda no desactivar las protecciones del navegador.

## 6. Guía de uso

1. Abre Inicio (`index.html`) y entra a **Explorar catálogo**.
2. En `catalogo.html`, busca o filtra las series. A partir de 2 caracteres, la página puede consultar TVmaze para devolver más series.
3. Abre la ficha de un título. Si TVmaze lo reconoce, verás sus imágenes y episodios reales. Selecciona una temporada y un capítulo.
4. La selección abre `reproductor.html`, que carga automáticamente el reproductor si el título tiene un ID TMDb válido. Cambia de capítulo, consulta el resumen y la información de la serie.
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

## 10. Adaptación a móvil (versión actual)

Se han añadido ajustes para pantallas pequeñas: selector de temporada con números únicamente, encabezado de capítulos dispuesto en columna en móviles, tarjetas de episodios compactas, reproductor panorámico, navegación inferior y selector de idioma compacto. El destello de selección táctil se ha eliminado y se mantiene `:focus-visible` para accesibilidad.

## 11. Blog de películas y series

La página \`blog.html\` permite crear y listar publicaciones editoriales asociadas a películas y series del catálogo. Cada tarjeta dirige a la ficha del título (\`detalle.html\`) o directamente a un capítulo concreto (\`reproductor.html\` con \`season\` y \`episode\`). Se puede añadir opcionalmente una dirección HTTPS original de Blogspot/Blogger, que aparecerá como enlace separado; el sitio **no** obtiene ni publica automáticamente contenido a través de la API de Blogger.

El formulario permite escribir título, autor, resumen, texto adicional, película o serie, destino y temporada/capítulo. Los nuevos posts se guardan en el **localStorage del navegador**. Como GitHub Pages es un alojamiento estático, estos cambios **no se comparten** con otros visitantes y no hay cuentas ni backend editorial. El botón «Exportar mis publicaciones» descarga un JSON con las entradas locales. Para hacerlas públicas, el propietario debe incorporar el contenido del archivo exportado al arreglo \`posts\` en \`data/blog-posts.json\` (manteniendo el formato) y publicar un commit en \`main\`. El flujo de Pages incluye ahora \`blog.html\` y la carpeta \`data\`.

La distribución inicial lleva tres entradas **marcadas como ejemplos**, que enlazan a The Batman, Gravity Falls y Avatar. Puedes reemplazarlas o eliminarlas en \`data/blog-posts.json\`. Los textos de publicaciones externas, incluidos los de Blogspot, no se traducen automáticamente, mientras que la interfaz del Blog utiliza el selector ES/EN.
