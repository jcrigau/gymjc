// Configuración: tema, backup JSON, exportación del historial, reinicio e
// información.
import { store } from '../store.js';
import { h, icon } from '../utils/dom.js';
import { navigate } from '../router.js';
import { applyTheme, VERSION } from '../app.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { buildRows, toCSV, stamp, exportFiles, backupFile, downloadFile, shareOrDownload } from '../utils/export.js';
import { reviewAndImport } from '../components/importReview.js';
import { PLAN_PROFE } from '../data/planProfe.js';
import { planRestore, applyRestore } from '../utils/restore.js';

// Rutinas que viajan con la app (carpeta _rutinas). Para sumar una nueva:
// dejar el .json en esa carpeta, agregarla acá y a ASSETS en sw.js.
const BUNDLED_ROUTINES = [
  {
    title: 'Hipertrofia · Día A, B y C',
    sub: '3 rutinas con peso, series y descanso · 11/10/2026',
    file: './_rutinas/gymjc-rutinas-2026-10-11.json',
  },
];

const CHANGELOG = [
  ['1.21', 'Enviar con código ahora usa un buzón propio (apps.adnsanluis.com/gymjc) en vez de servicios ajenos, que no dejaban que la app los usara desde el teléfono. El código son 6 letras o números, sin distinguir mayúsculas. Todo lo demás igual: el sobre lleva las notas del profe, se entrega una sola vez y vence a los 7 días.'],
  ['1.20', 'Enviar rutinas con un código. Al compartir aparece "Enviar con código": escribís tu nombre, la app sube el sobre a un servicio de archivos temporales y te da un código corto (GYM-…) para mandar por WhatsApp. El que recibe lo escribe en Rutinas → Recibir y ve "Rutinas de Juan" con todo, incluidas las notas del profe. El sobre se borra al retirarlo y vence a los 7 días. Si el servicio no responde, queda el link de siempre.'],
  ['1.19', 'Recibir rutinas a distancia, más simple. Al tocar el link que te mandaron se abre una pantalla con un solo botón, "Copiar para la app". Después abrís GymJC desde el ícono y tocás Recibir: la app pega sola lo copiado y te muestra las rutinas. Ya no hay que mantener apretado el mensaje ni pegar a mano.'],
  ['1.18', 'Al recibir rutinas desde un link que se abrió en el navegador (y no en la app instalada), ahora avisa en grande que ese no es tu GymJC, para no importar en el lugar equivocado. El mensaje de WhatsApp indica copiar y pegar en la app en vez de tocar el link.'],
  ['1.17', 'Compartir rutinas con otras personas. En Rutinas hay dos botones nuevos: "Compartir" (una rutina se pasa por QR o link; varias juntas, por link de WhatsApp o mail) y "Recibir" (escaneás el QR con la cámara desde la app, o pegás el link). Viajan con el peso, series, repeticiones y descanso, y también los ejercicios propios. Funciona sin internet.'],
  ['1.16', 'Las rutinas de Hipertrofia (Día A, B y C) ahora vienen incluidas: en Configuración → Importar rutinas aparecen arriba y se cargan con un toque, sin tener que pasar ningún archivo al teléfono.'],
  ['1.15', 'Protección de datos. (1) Nueva opción "Recuperar historial": lee el CSV que exporta la app y vuelve a cargar los entrenamientos que falten, sin duplicar ni borrar nada; también recrea tus ejercicios propios. (2) "Importar backup" ya no acepta un archivo de rutinas (eso dejaba el historial vacío), avisa cuántos entrenamientos va a reemplazar y pide confirmación. (3) Antes de cualquier reemplazo o reinicio se guarda una copia automática, y aparece "Deshacer el último reemplazo" para volver atrás.'],
  ['1.14', 'Importar rutinas arreglado: el iPhone a veces no dejaba elegir el archivo (lo mostraba en gris). Ahora acepta cualquier archivo y, además, se puede pegar el texto de la rutina directamente, sin archivos. Si algo falla, explica por qué en vez de mostrar un cartel que desaparece. También reconoce nombres alternativos (por ejemplo "Isquiotibiales en máquina" entra como Curl femoral sentado) para no crear ejercicios duplicados.'],
  ['1.13', 'Tres mejoras: (1) los ejercicios por tiempo (plancha, etc.) tienen un cronómetro grande: Iniciar al empezar la serie y Detener al terminarla; marca la serie solo, guarda el tiempo de cada una y avisa con vibración y pitido cuando llegás al objetivo. (2) Al marcar la última serie ya no arranca el descanso, porque lo que sigue es cambiar de ejercicio; en cambio se destaca el botón Guardar. (3) Dentro de cada ejercicio hay un botón "¿No hay máquina?" que muestra los mejores reemplazos y qué hiciste la última vez en cada uno; al elegir uno se abre directo, con las series, repeticiones y descanso que había pedido el profe.'],
  ['1.12', 'Ahora podés marcar las series una por una. Al entrar a un ejercicio aparecen círculos numerados: tocás uno al terminar esa serie y el descanso arranca en ese momento (antes esperaba a que guardaras el ejercicio entero). El progreso se guarda solo, así que si cerrás la app a mitad del ejercicio no perdés nada, y en la lista el ejercicio queda marcado "En curso · 2 de 4 series". Tocando la última marcada la desmarcás, por si te pasaste.'],
  ['1.11', 'Seis mejoras para el gimnasio: (1) temporizador de descanso que arranca solo al guardar, con el tiempo que puso el profe, y avisa con vibración y sonido; (2) la pantalla ya no se apaga durante el entrenamiento; (3) cronómetro de duración que queda guardado en el historial; (4) te avisa cuando hacés un récord de peso 🏆; (5) al cambiar un ejercicio ahora te ofrece primero los equivalentes reales (mismo tipo de movimiento), ideal cuando la máquina está ocupada; (6) tocando la sugerencia o el plan del profe se cargan solos el peso, las series y las repeticiones.'],
  ['1.10', 'Corregido: los "Vuelos laterales" que hacías antes eran pájaros (inclinado, hombro posterior), no elevaciones laterales. Ahora abren la ficha correcta y se agregó la técnica de Pájaros. Las elevaciones laterales del plan nuevo (parado, hombro medio) siguen con su propia ficha, y cada una aclara en qué se diferencian.'],
  ['1.09', 'Nuevo botón "Cómo se hace" en cada ejercicio (dentro del entrenamiento y en la biblioteca): muestra un dibujo del cuerpo con los músculos que trabaja, la preparación, la ejecución paso a paso, los errores comunes y las advertencias de seguridad. Está cargado para los 38 ejercicios que usás o usaste alguna vez. Reconoce los nombres alternativos: "Subida al cajón" encuentra la técnica de Step up, "Vuelos laterales" la de Elevaciones laterales, y "Izquiotobiales"/"Isquiotibiales en máquina" la de Curl femoral sentado.'],
  ['1.08', 'Nuevo botón "Plan del profe · 8 semanas": suma las tres rutinas (Lunes A, Miércoles B, Viernes C) con el peso, series y RPE que indicó, sin borrar nada de lo que ya tenías. Durante el entrenamiento, cada ejercicio muestra ese objetivo (🎯) junto con la sugerencia automática de la app basada en tu última sesión. Se agregaron 4 ejercicios que faltaban en la biblioteca (Press inclinado 45° con mancuernas, Bird-dog, Pallof press, Gato-camello).'],
  ['1.07', 'Volumen corregido: la app ahora sabe si el peso es de una o dos mancuernas. Se anota siempre el peso de UNA sola y el volumen sale bien en todos los ejercicios. Cada ejercicio tiene una convención de carga editable, y al cargar un peso muy por encima de tu máximo te pregunta por las dudas.'],
  ['1.06', 'Si cerrás la app a mitad del entrenamiento, al volver lo retomás donde estabas (adiós registros duplicados) y el inicio ofrece "Continuar". Además, cada ejercicio de la lista muestra qué hiciste la vez anterior sin tener que abrirlo.'],
  ['1.05', 'Los ejercicios que se miden por tiempo (plancha, hollow hold, mountain climbers, bicicleta y todo cardio) ahora se cargan en segundos por serie en vez de peso y repeticiones. Al crear un ejercicio propio podés marcarlo como "se mide por tiempo".'],
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
  // Sin filtro `accept`: el iPhone no siempre reconoce un .json que llegó por
  // WhatsApp o iCloud como "tipo JSON" y lo deja en gris, sin poder elegirlo.
  // Tampoco display:none: algunos Safari no abren el selector de un input
  // oculto así; se lo saca de la vista corriéndolo fuera de la pantalla.
  const input = h('input', {
    type: 'file',
    style: 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0',
  });
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

/** Hoja simple para avisos que hay que poder leer con calma. */
function notice(title, message) {
  openSheet({
    title,
    body: (api) => h('div', {}, [
      h('div', { class: 'card', text: message }),
      h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => api.close() }, ['Cerrar']),
    ]),
  });
}

function importJSON() {
  const n = store.history.length;
  if (n && !confirm(`Esto REEMPLAZA todo lo que hay en la app, incluidos tus ${n} entrenamientos, por el contenido del archivo.\n\nSi querés sumar rutinas, cancelá y usá "Importar rutinas".\n\n¿Seguir?`)) return;
  pickFile((text) => {
    try {
      store.import(text);
      applyTheme();
      toast('Backup importado', 'success');
      navigate('home');
      location.reload();
    } catch (err) {
      notice('No se importó nada', err.message || 'El archivo no es un backup válido. Tus datos quedaron como estaban.');
    }
  });
}

/** Recupera el historial desde el CSV exportado. Suma, no reemplaza. */
function restoreHistory() {
  openSheet({
    title: 'Recuperar historial',
    subtitle: 'Desde el CSV de "Exportar historial". Suma lo que falte, no borra nada.',
    body: (api) => {
      const area = h('textarea', {
        class: 'textarea', style: 'min-height:120px;font-size:13px',
        placeholder: 'O pegá acá el contenido del CSV…',
      });
      const seguir = (text) => {
        if (!String(text || '').trim()) { toast('No hay nada para leer'); return; }
        let plan;
        try {
          plan = planRestore(text);
        } catch (err) {
          api.close();
          setTimeout(() => notice('No se pudo leer', err.message), 360);
          return;
        }
        api.close();
        setTimeout(() => openSheet({
          title: 'Recuperar historial',
          subtitle: `Archivo con ${plan.total} entrenamientos · ${plan.desde} a ${plan.hasta}`,
          body: (api2) => h('div', {}, [
            h('div', { class: 'card' }, [
              h('div', { style: 'font-size:17px;font-weight:700', text: plan.sessions.length
                ? `Se van a sumar ${plan.sessions.length} entrenamientos (${plan.registros} ejercicios)`
                : 'No hay nada para sumar' }),
              plan.yaEstaban ? h('div', { class: 'small muted', style: 'margin-top:4px', text: `${plan.yaEstaban} ya los tenés y no se tocan.` }) : null,
              plan.customs.length ? h('div', { class: 'small muted', style: 'margin-top:4px', text: `También se vuelven a crear ${plan.customs.length} ejercicios propios: ${plan.customs.map((c) => c.name).join(', ')}.` }) : null,
            ]),
            plan.sessions.length ? h('button', {
              class: 'btn', style: 'margin-top:10px', onClick: () => {
                const res = applyRestore(plan);
                api2.close();
                toast(`${res.sessions} entrenamientos recuperados`, 'success');
                navigate('history');
              },
            }, [icon('check'), 'Recuperar']) : null,
            h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => api2.close() }, ['Cerrar']),
          ]),
        }), 360);
      };

      return h('div', {}, [
        h('button', { class: 'btn', onClick: () => pickFile(seguir) }, [icon('upload'), 'Elegir el archivo CSV']),
        h('div', { style: 'height:14px' }),
        area,
        h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => seguir(area.value) }, [icon('check'), 'Leer lo pegado']),
      ]);
    },
  });
}

/** Vuelve a lo que había antes del último reemplazo o reinicio. */
function undoReplace() {
  const copy = store.safetyCopy();
  if (!copy) return;
  const cuando = new Date(copy.savedAt).toLocaleString('es');
  if (!confirm(`Volver a los datos guardados el ${cuando} (${copy.db.history.length} entrenamientos, ${copy.db.routines.length} rutinas)?\n\nLo que hay ahora queda guardado por si querés deshacer esto también.`)) return;
  store.restoreSafetyCopy();
  location.hash = '#/home';
  location.reload();
}

/** Importa rutinas: desde un archivo o pegando el texto. */
function importRoutines() {
  openSheet({
    title: 'Importar rutinas',
    subtitle: 'Se suman a las que ya tenés. No se borra nada.',
    body: (api) => {
      const area = h('textarea', {
        class: 'textarea', style: 'min-height:140px;font-size:14px',
        placeholder: 'Pegá acá el texto de la rutina…',
      });
      const seguir = (text) => {
        if (!String(text || '').trim()) { toast('No hay nada para importar'); return; }
        api.close();
        setTimeout(() => reviewAndImport(text), 360);
      };

      // Rutinas que ya vienen dentro de la app: se cargan con un toque, sin
      // tener que pasar ningún archivo al teléfono.
      const cargarIncluida = async (pack) => {
        try {
          const res = await fetch(pack.file);
          if (!res.ok) throw new Error('no disponible');
          seguir(await res.text());
        } catch {
          toast('No se pudo abrir esa rutina. Probá con conexión.');
        }
      };

      return h('div', {}, [
        h('div', { class: 'section-title', style: 'margin:0 4px 8px', text: 'Incluidas en la app' }),
        h('div', { class: 'list' }, BUNDLED_ROUTINES.map((pack) =>
          h('div', { class: 'row', onClick: () => cargarIncluida(pack) }, [
            h('div', { class: 'icon-badge', style: 'background:#0a84ff;width:36px;height:36px' }, [icon('dumbbell')]),
            h('div', { class: 'row-main' }, [
              h('div', { class: 'row-title', style: 'font-size:16px', text: pack.title }),
              h('div', { class: 'row-sub', text: pack.sub }),
            ]),
            icon('chevron'),
          ])
        )),

        h('div', { class: 'section-title', style: 'margin:20px 4px 8px', text: 'Desde un archivo' }),
        h('button', { class: 'btn secondary', onClick: () => pickFile(seguir) }, [icon('upload'), 'Elegir archivo']),

        h('div', { class: 'section-title', style: 'margin:20px 4px 8px', text: 'O pegá el texto' }),
        h('div', { class: 'small muted', style: 'margin:0 4px 8px', text: 'Si el archivo no se deja elegir: abrilo, copiá todo su contenido y pegalo acá.' }),
        area,
        h('div', { class: 'grid-2', style: 'margin-top:10px' }, [
          h('button', {
            class: 'btn secondary',
            onClick: async () => {
              try {
                area.value = await navigator.clipboard.readText();
              } catch {
                toast('Mantené apretado el cuadro y elegí Pegar');
                area.focus();
              }
            },
          }, [icon('copy'), 'Pegar']),
          h('button', { class: 'btn', onClick: () => seguir(area.value) }, [icon('check'), 'Revisar']),
        ]),
      ]);
    },
  });
}

/** Carga el plan de 8 semanas armado por el profe, sin necesitar archivo. */
function importPlanProfe() {
  reviewAndImport(JSON.stringify(PLAN_PROFE), {
    title: 'Plan del profe · 8 semanas',
    subtitleExtra: ' · con peso y series sugeridos',
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

  // Entrenamiento
  screen.appendChild(h('div', { class: 'section-title', text: 'Entrenamiento' }));

  const toggleRow = (title, sub, key, def = true) => {
    const input = h('input', {
      type: 'checkbox', style: 'width:22px;height:22px;flex-shrink:0',
      onChange: (e) => store.setSetting(key, e.target.checked),
    });
    input.checked = store.settings[key] !== false && (store.settings[key] ?? def) !== false;
    return h('label', { class: 'row', style: 'cursor:pointer' }, [
      h('div', { class: 'row-main' }, [
        h('div', { class: 'row-title', style: 'font-size:16px', text: title }),
        h('div', { class: 'row-sub', text: sub }),
      ]),
      input,
    ]);
  };

  const restInput = h('input', {
    class: 'input', inputmode: 'numeric', style: 'width:90px;text-align:center',
    value: store.settings.defaultRest ?? 90,
    onChange: (e) => {
      const n = Math.min(600, Math.max(10, parseInt(e.target.value) || 90));
      e.target.value = n;
      store.setSetting('defaultRest', n);
    },
  });

  screen.appendChild(h('div', { class: 'list' }, [
    toggleRow('Temporizador de descanso', 'Arranca al marcar cada serie (menos la última)', 'restTimer'),
    h('div', { class: 'row' }, [
      h('div', { class: 'row-main' }, [
        h('div', { class: 'row-title', style: 'font-size:16px', text: 'Descanso por defecto' }),
        h('div', { class: 'row-sub', text: 'Segundos, cuando la rutina no trae el dato del profe' }),
      ]),
      restInput,
    ]),
    toggleRow('Pantalla siempre encendida', 'Durante el entrenamiento, para no desbloquear entre series', 'keepAwake'),
  ]));

  // Datos
  screen.appendChild(h('div', { class: 'section-title', text: 'Datos' }));
  screen.appendChild(h('div', { class: 'list' }, [
    row('target', 'Plan del profe · 8 semanas', 'Lunes A, Miércoles B y Viernes C con peso y series sugeridos', importPlanProfe, '#ffd60a'),
    row('share', 'Exportar historial', 'Compartir o descargar en CSV y JSON', openExportSheet, '#0a84ff'),
    row('add', 'Importar rutinas', 'Sumá rutinas desde un archivo, sin borrar nada', importRoutines, '#30d158'),
    row('history', 'Recuperar historial', 'Desde un CSV exportado antes. Suma lo que falte', restoreHistory, '#bf5af2'),
    row('upload', 'Importar backup (JSON)', 'Reemplaza TODOS tus datos por los del archivo', importJSON, '#8e8e93'),
    store.safetyCopy() ? row('restart', 'Deshacer el último reemplazo', 'Vuelve a los datos que había antes', undoReplace, '#ff9f0a') : null,
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
