// Configuración: tema, backup JSON, exportación CSV, reinicio e información.
import { store } from '../store.js';
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { applyTheme } from '../app.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';

const VERSION = '1.01';

const CHANGELOG = [
  ['1.01', 'Números de series y repeticiones más grandes y sin cortes al cargar dos dígitos.'],
  ['1.00', 'Primera versión: rutinas, biblioteca de +150 ejercicios, entrenamiento rápido, historial, estadísticas, progresión inteligente y PWA offline.'],
];

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV() {
  const rows = [['fecha', 'rutina', 'ejercicio', 'grupo', 'peso_kg', 'series', 'reps', 'rpe', 'notas']];
  store.history.forEach((s) => {
    (s.entries || []).forEach((e) => {
      rows.push([s.date, s.routineName || '', e.name, e.group || '', e.weight ?? '', e.sets ?? '', e.reps ?? '', e.rpe ?? '', (e.notes || '').replace(/[\n;]/g, ' ')]);
    });
  });
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
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
    row('download', 'Exportar backup (JSON)', 'Guardá una copia de todos tus datos', () => { download('gymjc-backup.json', store.export(), 'application/json'); toast('Backup exportado', 'success'); }, '#0a84ff'),
    row('upload', 'Importar backup (JSON)', 'Restaurá desde un archivo', importJSON, '#30d158'),
    row('list', 'Exportar CSV', 'Tu historial en planilla de cálculo', () => { download('gymjc-historial.csv', toCSV(), 'text/csv'); toast('CSV exportado', 'success'); }, '#ff9f0a'),
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
