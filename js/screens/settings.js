// Configuración: tema, backup JSON, exportación del historial, reinicio e
// información.
import { store } from '../store.js';
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { applyTheme, VERSION } from '../app.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { buildRows, toCSV, stamp, exportFiles, backupFile, downloadFile, shareOrDownload } from '../utils/export.js';

const CHANGELOG = [
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

function importJSON() {
  const input = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.import(reader.result);
        applyTheme();
        toast('Backup importado', 'success');
        navigate('home');
        location.reload();
      } catch {
        toast('Archivo inválido');
      }
    };
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
  input.remove();
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
    row('upload', 'Importar backup (JSON)', 'Restaurá desde un archivo', importJSON, '#30d158'),
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
