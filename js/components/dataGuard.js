// Avisos cuando el guardado de datos falla. Los datos viven solo en el
// teléfono, así que un problema acá no puede mostrarse en un cartel que
// desaparece: queda una franja fija arriba hasta que se resuelve.
//
//  - No se pudo LEER lo guardado: la app queda en solo lectura (no pisa nada)
//    y ofrece seguir con la copia automática, descargar los datos tal cual
//    están o empezar de cero.
//  - No se pudo GUARDAR: avisa que lo último está solo en memoria y ofrece
//    sacar un backup en el momento.
import { store } from '../store.js';
import { h, icon } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { backupFile, shareOrDownload, stamp } from '../utils/export.js';

let banner = null;
let afterChange = () => {};

const fecha = (ms) => (ms
  ? new Date(ms).toLocaleString('es', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  : 'fecha desconocida');

const action = (label, sub, iconName, onClick, cls = 'btn secondary') => h('button', {
  class: cls,
  style: 'margin-top:10px;text-align:left;justify-content:flex-start',
  onClick,
}, [icon(iconName), h('div', { class: 'grow' }, [
  h('div', { text: label }),
  sub ? h('div', { class: 'small', style: 'opacity:.8;font-weight:500', text: sub }) : null,
])]);

/** Comparte o descarga el texto que no se pudo leer, sin modificarlo. */
export async function shareRescue(raw) {
  const file = new File([raw], `gymjc-rescate-${stamp()}.txt`, { type: 'text/plain' });
  const res = await shareOrDownload([file], {
    title: 'GymJC · datos a recuperar',
    text: 'Datos de GymJC que la app no pudo leer.',
  });
  if (res !== 'cancelled') toast(res === 'shared' ? 'Archivo compartido' : 'Archivo descargado', 'success');
}

function openLoadErrorSheet() {
  const err = store.health.loadError;
  if (!err) return;
  const { backup } = err;

  openSheet({
    title: 'No se pudieron leer tus datos',
    subtitle: 'La app no borró ni cambió nada',
    body: (api) => h('div', {}, [
      h('div', { class: 'card', text: 'Lo que estaba guardado sigue en este teléfono, intacto, pero la app no lo puede abrir. Hasta que elijas cómo seguir no se guarda nada nuevo, para no pisarlo.' }),

      backup ? action(
        'Seguir con la copia automática',
        `${backup.sessions} entrenamiento${backup.sessions === 1 ? '' : 's'} · de la última vez que abrió bien (${fecha(backup.savedAt)})`,
        'restart',
        () => {
          const ok = store.resolveLoadError('backup');
          api.close();
          afterChange();
          toast(ok ? 'Copia automática recuperada' : 'Recuperada, pero no se pudo guardar', ok ? 'success' : 'default');
        },
        'btn',
      ) : null,

      action(
        'Descargar los datos como están',
        'Un archivo para guardar o mandar a quien te pasó la app, y recuperarlos',
        'download',
        () => shareRescue(err.raw),
      ),

      action(
        'Empezar de cero',
        'La app arranca vacía. Los datos de antes quedan guardados aparte',
        'delete',
        () => {
          if (!confirm('La app va a arrancar vacía. Los datos que no se pudieron leer quedan guardados aparte (Configuración → Datos a recuperar).\n\n¿Seguir?')) return;
          store.resolveLoadError('empty');
          api.close();
          afterChange();
        },
        'btn danger',
      ),

      h('div', { class: 'small muted', style: 'margin:14px 4px 0', text: 'Si tenés un backup propio, también podés cerrar este aviso e importarlo desde Configuración → Importar backup.' }),
    ]),
  });
}

function openSaveErrorSheet() {
  const blocked = store.health.saveError === 'blocked';
  openSheet({
    title: 'No se pudo guardar',
    subtitle: blocked ? 'El navegador no está dejando guardar datos' : 'El teléfono se quedó sin espacio para la app',
    body: (api) => h('div', {}, [
      h('div', { class: 'card', text: 'Lo último que cargaste está solo en la memoria de la app: si la cerrás ahora, se pierde. Sacá un backup antes de salir.' }),

      action('Guardar backup ahora', 'Incluye lo que todavía no se pudo guardar', 'upload', async () => {
        const res = await shareOrDownload([backupFile()], { title: 'GymJC · backup' });
        if (res !== 'cancelled') toast(res === 'shared' ? 'Backup compartido' : 'Backup descargado', 'success');
      }, 'btn'),

      action('Reintentar', blocked ? 'Si estás en modo privado, abrí la app en una ventana normal' : 'Después de liberar espacio en el teléfono', 'restart', () => {
        if (store.retrySave()) {
          api.close();
          toast('Guardado', 'success');
        } else {
          toast('Sigue sin poder guardar');
        }
      }),
    ]),
  });
}

function paint() {
  const { loadError, saveError } = store.health;
  banner?.remove();
  banner = null;
  document.documentElement.classList.toggle('has-data-alert', !!(loadError || saveError));
  if (!loadError && !saveError) return;

  banner = h('button', {
    class: 'data-alert',
    onClick: () => (store.health.loadError ? openLoadErrorSheet() : openSaveErrorSheet()),
  }, [
    icon('info'),
    h('div', { class: 'grow' }, [
      h('div', { text: loadError ? 'No se pudieron leer tus datos' : 'No se pudo guardar' }),
      h('div', { class: 'small', text: loadError ? 'No se guarda nada nuevo. Tocá para resolverlo' : 'Lo último está solo en memoria. Tocá para sacar un backup' }),
    ]),
    icon('chevron'),
  ]);
  document.body.appendChild(banner);
}

/**
 * Arranca la vigilancia. `onChange` se llama cuando el usuario resolvió un
 * problema de lectura y hay que volver a dibujar la pantalla con sus datos.
 */
export function initDataGuard({ onChange } = {}) {
  if (onChange) afterChange = onChange;
  store.onHealth(paint);
  paint();
  if (store.health.loadError) openLoadErrorSheet();
}
