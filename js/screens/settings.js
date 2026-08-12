// Configuración: tema, backup JSON, exportación del historial, reinicio e
// información.
import { store } from '../store.js';
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { applyTheme, VERSION } from '../app.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { buildRows, toCSV, stamp, exportFiles, backupFile, downloadFile, shareOrDownload } from '../utils/export.js';
import { planImport, applyImport } from '../utils/import.js';

const CHANGELOG = [
  ['1.04', 'Nueva opción "Importar rutinas": sumás rutinas desde un archivo sin pisar las que ya tenés ni tocar el historial. Los ejercicios que no existan se crean solos.'],
  ['1.03', 'Exportación del historial rehecha: se comparte al toque desde el celular (WhatsApp, Mail, Drive) y el CSV ahora incluye volumen, 1RM estimado y semana para analizar el progreso en la compu.'],
  ['1.02', 'Durante el entrenamiento ya podés cambiar un ejercicio por otro, quitarlo o agregar uno extra, solo por ese día.'],
  ['1.01', 'Números de series y repeticiones más grandes y sin cortes al cargar dos dígitos.'],
  ['1.00', 'Primera versión: rutinas, biblioteca de +150 ejercicios, entrenamiento rápido, historial, estadísticas, progresión inteligente y PWA offline.'],
];

/** Hoja de exportación: explica qué se lleva y ofrece compartir o descargar. */
function openExportSheet() {
  const rows = buildRows();

  if (!rows.length) {
    toast('Todavía no hay entrenamientos para exportar');
    return;
  }

  const sesiones = new Set(rows.map((r) => r.sesion_id)).size;
  const desde = rows[0].fecha;
  const hasta = rows[rows.length - 1].fecha;

  const act = (label, sub, iconName, onClick, cls = 'btn secondary') => h('button', {
    class: cls,
    style: 'margin-top:10px;text-align:left;justify-content:flex-start',
    onClick,
  }, [icon(iconName), h('div', { class: 'grow' }, [
    h('div', { text: label }),
    h('div', { class: 'small muted', text: sub }),
  ])]);

  openSheet({
    title: 'Exportar historial',
    subtitle: `${rows.length} registros · ${sesiones} entrenamientos · ${desde} a ${hasta}`,
    body: (api) => h('div', {}, [
      h('div', { class: 'card' }, [
        h('div', { class: 'small muted', text: 'Cada fila es un ejercicio registrado, con volumen, 1RM estimado y semana ya calculados para graficar el progreso.' }),
      ]),
      act('Compartir los dos CSV', 'WhatsApp, Mail, Drive… (recomendado en el celular)', 'share', async () => {
        const { files } = exportFiles();
        const res = await shareOrDownload(files, {
          title: 'GymJC · historial',
          text: `Historial de entrenamientos GymJC (${rows.length} registros, ${desde} a ${hasta}).`,
        });
        if (res === 'cancelled') return;
        api.close();
        toast(res === 'shared' ? 'Historial compartido' : 'Archivos descargados', 'success');
      }, 'btn'),
      act('Descargar CSV para Excel', 'Separador ; y coma decimal, abre con doble clic', 'download', () => {
        downloadFile(new File([toCSV(rows, 'excel')], `gymjc-historial-excel-${stamp()}.csv`, { type: 'text/csv' }));
        api.close();
        toast('CSV para Excel descargado', 'success');
      }),
      act('Descargar CSV estándar', 'Separador , y punto decimal: Sheets, pandas, R', 'list', () => {
        downloadFile(new File([toCSV(rows, 'std')], `gymjc-historial-${stamp()}.csv`, { type: 'text/csv' }));
        api.close();
        toast('CSV estándar descargado', 'success');
      }),
      act('Backup completo (JSON)', 'Todo: rutinas, historial y ajustes. Sirve para restaurar', 'upload', async () => {
        const file = backupFile();
        const res = await shareOrDownload([file], { title: 'GymJC · backup' });
        if (res === 'cancelled') return;
        api.close();
        toast(res === 'shared' ? 'Backup compartido' : 'Backup descargado', 'success');
      }),
    ]),
  });
}

/** Abre el selector de archivos y devuelve el texto del elegido. */
function pickFile(onText) {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
  // El input se saca del DOM recién cuando el usuario eligió (o canceló): si se
  // quita antes, algunos navegadores móviles pierden el evento y no pasa nada.
  const cleanup = () => input.remove();
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) { cleanup(); return; }
    const reader = new FileReader();
    reader.onload = () => { onText(reader.result); cleanup(); };
    reader.onerror = () => { toast('No se pudo leer el archivo'); cleanup(); };
    reader.readAsText(file);
  });
  input.addEventListener('cancel', cleanup);
  document.body.appendChild(input);
  input.click();
}

function importJSON() {
  pickFile((text) => {
    try {
      store.import(text);
      applyTheme();
      toast('Backup importado', 'success');
      navigate('home');
      location.reload();
    } catch {
      toast('Archivo inválido');
    }
  });
}

/** Importa rutinas sumándolas a las que ya existen, con confirmación previa. */
function importRoutines() {
  pickFile((text) => {
    let planned;
    try {
      planned = planImport(text);
    } catch (err) {
      toast(err.message || 'Archivo inválido');
      return;
    }

    const { plan, toCreate, warnings } = planned;

    openSheet({
      title: 'Importar rutinas',
      subtitle: `${plan.length} rutina${plan.length > 1 ? 's' : ''} · ${toCreate.length} ejercicio${toCreate.length === 1 ? '' : 's'} nuevo${toCreate.length === 1 ? '' : 's'}`,
      body: (api) => h('div', {}, [
        h('div', { class: 'card' }, [
          h('div', { class: 'small muted', text: 'Se suman a tus rutinas actuales. No se toca el historial ni se borra nada.' }),
        ]),

        ...plan.map((r) => h('div', { class: 'card' }, [
          h('div', { style: 'font-weight:700;margin-bottom:6px', text: r.name }),
          ...r.items.map((it) => h('div', { class: 'small muted' }, [
            it.status === 'nuevo'
              ? `+ ${it.pending.name} · ${it.pending.group} · nuevo`
              : `• ${it.exercise.name} · ${it.exercise.group}`,
          ])),
        ])),

        warnings.length ? h('div', { class: 'card' }, [
          h('div', { style: 'font-weight:700;margin-bottom:6px', text: 'Avisos' }),
          ...warnings.map((w) => h('div', { class: 'small muted', text: w })),
        ]) : null,

        h('button', {
          class: 'btn', style: 'margin-top:10px', onClick: () => {
            try {
              const res = applyImport(planned);
              api.close();
              toast(`${res.routines} rutina${res.routines > 1 ? 's' : ''} importada${res.routines > 1 ? 's' : ''}`, 'success');
              navigate('routines');
            } catch {
              toast('No se pudo importar');
            }
          },
        }, [icon('check'), 'Importar']),
        h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => api.close() }, ['Cancelar']),
      ]),
    });
  });
}

function row(iconName, title, sub, onClick, accent) {
  return h('div', { class: 'row', onClick }, [
    h('div', { class: 'icon-badge', style: `background:${accent || 'var(--bg-elev-2)'};color:${accent ? '#fff' : 'var(--text)'};width:36px;height:36px` }, [icon(iconName)]),
    h('div', { class: 'row-main' }, [
      h('div', { class: 'row-title', style: 'font-size:16px', text: title }),
      sub ? h('div', { class: 'row-sub', text: sub }) : null,
    ]),
    icon('chevron'),
  ]);
}

export default function SettingsScreen() {
  const screen = h('div', { class: 'screen' });
  screen.appendChild(h('div', { class: 'header' }, [
    h('button', { class: 'icon-btn', onClick: () => navigate('home'), 'aria-label': 'Volver' }, [icon('back')]),
    h('h1', { style: 'font-size:28px', text: 'Configuración' }),
    h('div', { style: 'width:40px' }),
  ]));

  // Tema
  screen.appendChild(h('div', { class: 'section-title', text: 'Apariencia' }));
  const seg = h('div', { class: 'segmented' });
  [['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Sistema']].forEach(([val, label]) => {
    seg.appendChild(h('button', {
      class: store.settings.theme === val ? 'active' : '',
      text: label,
      onClick: () => {
        store.setTheme(val);
        applyTheme();
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === label));
      },
    }));
  });
  screen.appendChild(seg);

  // Datos
  screen.appendChild(h('div', { class: 'section-title', text: 'Datos' }));
  screen.appendChild(h('div', { class: 'list' }, [
    row('share', 'Exportar historial', 'Compartir o descargar en CSV y JSON', openExportSheet, '#0a84ff'),
    row('add', 'Importar rutinas', 'Sumá rutinas desde un archivo, sin borrar nada', importRoutines, '#30d158'),
    row('upload', 'Importar backup (JSON)', 'Reemplaza TODOS tus datos por los del archivo', importJSON, '#8e8e93'),
    row('restart', 'Restablecer datos', 'Borra todo sin posibilidad de deshacer', () => {
      if (confirm('¿Seguro? Se borrarán todas las rutinas y el historial.')) { store.reset(); applyTheme(); location.hash = '#/home'; location.reload(); }
    }, '#ff453a'),
  ]));

  // Información
  screen.appendChild(h('div', { class: 'section-title', text: 'Información' }));
  screen.appendChild(h('div', { class: 'list' }, [
    h('div', { class: 'row' }, [
      h('div', { class: 'icon-badge', style: 'background:var(--accent);width:36px;height:36px' }, [icon('info')]),
      h('div', { class: 'row-main' }, [h('div', { class: 'row-title', style: 'font-size:16px', text: 'Versión' })]),
      h('div', { class: 'pill', text: VERSION }),
    ]),
    row('note', 'Changelog', 'Novedades de cada versión', () => openSheet({
      title: 'Changelog',
      body: h('div', { class: 'list' }, CHANGELOG.map(([v, txt]) => h('div', { class: 'card' }, [
        h('div', { class: 'pill', style: 'margin-bottom:6px', text: v }),
        h('div', { text: txt }),
      ]))),
    })),
  ]));

  screen.appendChild(h('div', { style: 'text-align:center;color:var(--text-3);font-size:13px;margin-top:24px', text: `GymJC ${VERSION} · Hecho para entrenar` }));

  return screen;
}
