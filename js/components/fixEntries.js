// "Corregir registros": para cuando anotaste un ejercicio creyendo que era
// otro (por ejemplo, "Curl femoral sentado" cuando en realidad hacías
// "Extensión de cuádriceps"). Muestra cada vez que lo anotaste, elegís cuáles
// estaban mal y a qué ejercicio van. Los demás quedan donde están.

import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { fmtEntry, fmtShort } from '../utils/format.js';

/** Registros de un ejercicio, del más reciente al más viejo. */
export function entriesOf(id) {
  const out = [];
  for (const s of store.history) {
    (s.entries || []).forEach((e, i) => {
      if (e.exerciseId === id) out.push({ key: `${s.id}|${i}`, date: s.date, routine: s.routineName || '', entry: e, session: s });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const check = (checked) => h('input', { type: 'checkbox', style: 'width:22px;height:22px;flex-shrink:0', checked: checked ? '' : null });

export function openFixEntries(ex, { onChange, openPicker } = {}) {
  const lista = entriesOf(ex.id);
  if (!lista.length) { toast('Este ejercicio no tiene registros'); return; }

  openSheet({
    title: 'Corregir registros',
    subtitle: `Marcá las veces que anotaste "${ex.name}" pero hiciste otro ejercicio`,
    body: (api) => {
      const marcas = new Map();
      const contador = h('div', { class: 'small muted', style: 'margin:8px 4px' });
      const actualizar = () => {
        const n = [...marcas.values()].filter((c) => c.checked).length;
        contador.textContent = `${n} de ${lista.length} marcados`;
        boton.disabled = !n;
      };

      // Agrupado por peso: suele ser lo que delata cuál era cuál.
      const filas = lista.map((it) => {
        const c = check(true);
        c.addEventListener('change', actualizar);
        marcas.set(it.key, c);
        return h('label', { class: 'row', style: 'cursor:pointer;gap:12px' }, [
          c,
          h('div', { class: 'row-main' }, [
            h('div', { class: 'row-title', style: 'font-size:16px', text: fmtEntry(it.entry) }),
            h('div', { class: 'row-sub', text: [fmtShort(it.date), it.routine, it.entry.notes].filter(Boolean).join(' · ') }),
          ]),
        ]);
      });

      const todos = (v) => { for (const c of marcas.values()) c.checked = v; actualizar(); };
      const boton = h('button', {
        class: 'btn', style: 'margin-top:12px',
        onClick: () => {
          const keys = [...marcas].filter(([, c]) => c.checked).map(([k]) => k);
          if (!keys.length) return;
          api.close();
          openPicker({
            exclude: new Set([ex.id]), closeOnPick: true,
            title: '¿Qué ejercicio hiciste?',
            subtitle: `Los ${keys.length} registros marcados pasan a ese ejercicio`,
            onPick: (to) => confirmMove(ex, to, keys, onChange),
          });
        },
      }, [icon('swap'), 'Elegir el ejercicio correcto']);

      const wrap = h('div', {}, [
        h('div', { class: 'grid-2' }, [
          h('button', { class: 'btn secondary small', onClick: () => todos(true) }, ['Marcar todos']),
          h('button', { class: 'btn secondary small', onClick: () => todos(false) }, ['Desmarcar todos']),
        ]),
        contador,
        h('div', { class: 'list' }, filas),
        boton,
      ]);
      actualizar();
      return wrap;
    },
  });
}

function confirmMove(from, to, keys, onChange) {
  const enRutinas = store.routines.filter((r) => (r.exercises || []).includes(from.id));
  // Días en que ya estaba anotado el ejercicio correcto: quedarían dos.
  const sesiones = new Set(keys.map((k) => k.split('|')[0]));
  const dobles = store.history.filter((s) => sesiones.has(s.id) && (s.entries || []).some((e) => e.exerciseId === to.id));
  const quedan = entriesOf(from.id).length - keys.length;

  openSheet({
    title: 'Corregir registros',
    subtitle: `"${from.name}" → "${to.name}"`,
    body: (api) => {
      const cambiarRutinas = check(enRutinas.length > 0 && quedan === 0);
      return h('div', {}, [
        h('div', {
          class: 'card',
          text: `Los ${keys.length} registros marcados pasan a "${to.name}", con su peso, series, repeticiones y notas. `
            + (quedan ? `Los otros ${quedan} quedan en "${from.name}". ` : `"${from.name}" queda sin registros. `)
            + 'Si te equivocás, en Ajustes está "Deshacer el último reemplazo".',
        }),
        dobles.length ? h('div', {
          class: 'card', style: 'border-color:var(--orange);margin-top:10px',
          text: `Ojo: en ${dobles.length} de esos días ya tenías anotado "${to.name}". Van a quedar dos registros ese día.`,
        }) : null,
        enRutinas.length ? h('label', { class: 'card', style: 'display:flex;gap:12px;align-items:center;margin-top:10px;cursor:pointer' }, [
          cambiarRutinas,
          h('div', {}, [
            h('div', { style: 'font-weight:600', text: `Cambiarlo también en mis rutinas` }),
            h('div', {
              class: 'small muted',
              text: `${enRutinas.map((r) => r.name).join(', ')}. Donde la rutina ya tiene "${to.name}", solo se saca "${from.name}".`,
            }),
          ]),
        ]) : null,
        h('button', {
          class: 'btn', style: 'margin-top:12px',
          onClick: () => {
            const n = store.moveEntries(from.id, to, keys, { routines: !!(cambiarRutinas && cambiarRutinas.checked) });
            api.close();
            toast(`${n} registro${n === 1 ? '' : 's'} corregido${n === 1 ? '' : 's'}`, 'success');
            onChange && onChange();
          },
        }, [icon('check'), 'Corregir']),
      ]);
    },
  });
}
