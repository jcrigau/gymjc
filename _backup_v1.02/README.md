# GymJC 💪

App para registrar entrenamientos en segundos. **Gratis, offline e instalable** en iPhone y Android sin pasar por las tiendas de aplicaciones. Es una PWA (Progressive Web App) hecha con HTML, CSS y JavaScript puro — sin frameworks ni servidores.

## Características

- **Inicio**: versión, rutinas y último entrenamiento con acceso rápido.
- **Rutinas**: crear, editar, duplicar, eliminar y reordenar ejercicios con *drag & drop*. Cada rutina tiene nombre, color e ícono.
- **Biblioteca**: +150 ejercicios agrupados por músculo, buscador instantáneo, favoritos y ejercicios personalizados.
- **Entrenamiento**: elegí una rutina, cargá cada ejercicio completo (peso, series, reps, RPE, notas) y marcalo como hecho.
- **Progresión inteligente**: te sugiere subir o mantener el peso según el RPE del último entrenamiento.
- **Historial**: calendario, lista cronológica, búsqueda y edición de registros.
- **Progreso**: gráficos de peso y volumen, mejor marca, RPE promedio y más.
- **Configuración**: tema claro/oscuro/sistema, backup JSON, exportación CSV y reinicio.
- **PWA**: manifest, service worker, íconos, splash e instalación. Funciona 100% offline.

## Cómo instalarla en el celular

1. Abrí la URL de la app en el navegador (Safari en iPhone, Chrome en Android).
2. **iPhone**: botón Compartir → *Agregar a pantalla de inicio*.
3. **Android**: menú ⋮ → *Instalar aplicación* / *Agregar a pantalla principal*.

Queda como una app más, con su ícono, y abre a pantalla completa sin barra del navegador.

## Publicar en GitHub Pages (automático y gratis)

1. Creá un repositorio en GitHub y subí todos estos archivos.
2. En **Settings → Pages**, elegí *Source: GitHub Actions*.
3. Cada `push` a la rama `main` publica la app sola (ver `.github/workflows/deploy.yml`).

También podés probarla en tu compu con cualquier servidor estático, por ejemplo:

```bash
npx serve .
# o
python -m http.server 8080
```

> Nota: el Service Worker requiere `http(s)` o `localhost`; abrir el `index.html` con doble clic (`file://`) no activa el modo offline.

## Estructura

```
index.html            # shell de la app
manifest.webmanifest  # metadatos PWA
sw.js                 # service worker (cache offline)
css/styles.css        # estilos (tema claro/oscuro, estética iOS)
js/
  app.js              # arranque: tema, router, service worker
  router.js           # router por hash
  store.js            # datos en localStorage
  data/exercises.js   # biblioteca de +150 ejercicios
  utils/              # dom, formato, progresión
  components/         # nav, sheet, toast, chart
  screens/            # home, routines, library, workout, history, stats, settings
icons/                # íconos e imagen de la PWA
```

Sin dependencias. Sin build. Todo corre en el navegador.
