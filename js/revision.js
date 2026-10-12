/* ---------------------------------------------------------------------------
   revision.js — La sesión dibujada, para revisarla de un vistazo.

   La ve un adulto (Javiera, el profesor guía, el equipo de Brasil), nunca el
   niño. Lee el mismo JSON que se descarga y lo pinta:

   - una fila por escena, todas a la misma escala, con tres carriles:
       arriba   las ventanas de análisis (un color por emoción) y los tramos
                neutros;
       al medio lo que hace el niño: decidir, tocar la caja, armar la torre,
                los toques fuera de los botones, y cuándo Puki lo escucha;
       abajo    cuándo habla Puki y cuándo otro personaje;
   - una tabla con cada decisión.

   No calcula nada nuevo: todo sale del JSON. Por eso sirve también para
   explicarle el archivo a Brasil. Se usa en la pantalla final y en
   revision.html, que abre JSON guardados.
--------------------------------------------------------------------------- */

const Revision = {

  COLORES: {
    sorpresa: '#f0b429', tristeza: '#5b7fc4', asco: '#7d9a3a',
    miedo: '#7a5fa8', ira: '#d0533f', alegria: '#e07a3f', neutra: '#c3cbd1'
  },

  HABLANTES: {
    puki: 'Puki', puki_susurro: 'Puki (susurro)', lira: 'Lira', tobi: 'Tobi', todos: 'Todos'
  },

  pintar(contenedor, datos) {
    if (!contenedor || !datos) return;
    const ev = datos.eventos || [];
    const escenas = this.escenas(datos);
    const maxDur = Math.max(1, ...escenas.map((s) => s.hasta - s.desde));

    const tramos = [].concat(
      this.ventanas(datos),
      this.pares(ev, ['voz_inicio'], ['voz_fin', 'voz_interrumpida'],
        (e) => e.escena_id + '|' + e.datos.hablante + '|' + e.datos.texto, 'voz'),
      this.pares(ev, ['ventana_voz_inicio'], ['ventana_voz_fin'], (e) => e.escena_id, 'escucha'),
      this.pares(ev, ['opciones_mostradas'], ['opcion_elegida', 'opcion_por_defecto'],
        (e) => e.escena_id + '|' + e.datos.decision_id, 'decision'),
      this.pares(ev, ['objeto_mostrado'], ['objeto_completado'],
        (e) => e.escena_id + '|' + e.datos.objeto_id, 'objeto'),
      this.pares(ev, ['minitarea_inicio'], ['minitarea_fin'], (e) => e.escena_id, 'minitarea')
    );
    const puntos = ev.filter((e) =>
      e.nombre === 'toque_ocioso' || e.nombre === 'repregunta_inactividad');

    const filas = escenas.map((s) => {
      const dur = Math.max(1, s.hasta - s.desde);
      const mias = tramos.filter((x) => x.escena_id === s.id);
      const de = (clases) => mias.filter((x) => clases.includes(x.clase))
        .map((x) => this.banda(x, s.desde, dur)).join('');
      const marcas =
        puntos.filter((e) => e.escena_id === s.id).map((e) => this.punto(e, s.desde, dur)).join('') +
        mias.filter((x) => x.clase === 'decision').map((x) => this.eleccion(x, s.desde, dur)).join('');

      // La grilla de fondo marca cada 10 s; su tamaño depende de la escena.
      return `<div class="rv-fila">` +
        `<div class="rv-nombre"><b>${this.esc(s.id)}</b>` +
        `<span>${this.esc(this.tituloEscena(s))}</span><small>${this.seg(dur)}</small></div>` +
        `<div><div class="rv-pista" style="width:${(dur / maxDur * 100).toFixed(2)}%;` +
        `background-size:${(10000 / dur * 100).toFixed(3)}% 100%">` +
        `<div class="rv-carril">${de(['ventana', 'neutra'])}</div>` +
        `<div class="rv-carril">${de(['decision', 'objeto', 'minitarea', 'escucha'])}${marcas}</div>` +
        `<div class="rv-carril">${de(['voz'])}</div>` +
        `</div></div></div>`;
    }).join('');

    contenedor.innerHTML =
      this.avisos(datos) +
      `<h2 class="rv-titulo">${this.t('rv.titulo')}</h2>` +
      this.leyenda() +
      `<div class="rv-filas">${filas}</div>` +
      `<p class="rv-detalle">${this.t('rv.toca_detalle')}</p>` +
      this.tablaDecisiones(tramos.filter((x) => x.clase === 'decision'));

    // Tocar una franja muestra su detalle (en tablet no hay "pasar el mouse").
    const detalle = contenedor.querySelector('.rv-detalle');
    contenedor.onclick = (e) => {
      const el = e.target.closest('[data-info]');
      if (el) detalle.textContent = el.dataset.info;
    };
  },

  /* ---- Lo que se saca del JSON ------------------------------------------ */

  escenas(datos) {
    const lista = [];
    let actual = null;
    (datos.eventos || []).forEach((e) => {
      if (e.nombre === 'escena_inicio') {
        actual = { id: e.escena_id, tipo: e.datos.tipo, desde: e.t_ms, hasta: null };
        lista.push(actual);
      } else if (e.nombre === 'escena_fin' && actual && actual.id === e.escena_id) {
        actual.hasta = e.t_ms;
      }
    });
    const fin = (datos.sesion && datos.sesion.duracion_ms) || 0;
    lista.forEach((s) => { if (s.hasta === null) s.hasta = Math.max(s.desde, fin); });
    return lista;
  },

  ventanas(datos) {
    return (datos.ventanas_analisis || []).map((v) => {
      const neutra = v.emocion_esperada === 'neutra';
      const conRostro = v.regla_rostro === 'B_excepcion_social';
      const dur = this.seg(v.t_ventana_ms[1] - v.t_ventana_ms[0]);
      return {
        clase: neutra ? 'neutra' : 'ventana',
        extraClase: conRostro ? 'rv-con-rostro' : '',
        escena_id: v.escena_id,
        desde: v.t_ventana_ms[0],
        hasta: v.t_ventana_ms[1],
        color: this.COLORES[v.emocion_esperada] || '#999',
        info: neutra
          ? `${this.t('rv.leyenda_neutra')} · ${dur}`
          : `${this.emocion(v.emocion_esperada)} · ${v.id} · ${dur} · ` +
            this.t(conRostro ? 'rv.con_rostro' : 'rv.sin_rostro')
      };
    });
  },

  /* Junta cada evento que abre algo con el que lo cierra (voz_inicio con
     voz_fin, opciones_mostradas con opcion_elegida, etc.). */
  pares(eventos, abre, cierra, clave, clase) {
    const abiertos = {};
    const out = [];
    eventos.forEach((e) => {
      if (abre.includes(e.nombre)) {
        abiertos[clave(e)] = e;
      } else if (cierra.includes(e.nombre)) {
        const k = clave(e);
        const a = abiertos[k];
        if (!a) return;
        delete abiertos[k];
        out.push(Object.assign(
          { clase: clase, escena_id: a.escena_id, desde: a.t_ms, hasta: e.t_ms },
          this.describir(clase, a, e)));
      }
    });
    return out;
  },

  describir(clase, a, e) {
    const d = e.datos || {};
    const dur = this.seg(e.t_ms - a.t_ms);
    switch (clase) {
      case 'voz': {
        const quien = a.datos.hablante || 'puki';
        return {
          extraClase: quien.indexOf('puki') === 0 ? 'rv-voz-puki' : 'rv-voz-otro',
          info: `${this.HABLANTES[quien] || quien}: "${a.datos.texto}"` +
            (e.nombre === 'voz_interrumpida' ? ' · ' + this.t('rv.interrumpida') : '')
        };
      }
      case 'escucha':
        return {
          info: `${this.t('rv.leyenda_escucha')} (${a.datos.modo}) · ${dur} · ${this.t('rv.sin_audio')}`
        };
      case 'decision': {
        const porDefecto = e.nombre === 'opcion_por_defecto';
        const op = this.opcion(a.escena_id, d.decision_id, d.opcion_id);
        return {
          extraClase: porDefecto ? 'rv-por-defecto' : '',
          decision: {
            escena_id: a.escena_id, decision_id: d.decision_id, op: op, datos: d,
            porDefecto: porDefecto, n: (a.datos.opciones || []).length
          },
          info: `${this.t('rv.decision')} ${d.decision_id}: ${op.texto} · ` +
            this.t(porDefecto ? 'rv.por_defecto' : 'rv.toco') + ` · ${dur}`
        };
      }
      case 'objeto':
        return {
          info: `${this.t('rv.objeto')} · ` +
            this.t(d.completado_por === 'nino' ? 'rv.toco' : 'rv.por_defecto') + ` · ${dur}`
        };
      case 'minitarea':
        return {
          info: `${this.t('rv.torre')} · ${this.t('rv.rondas')} ${(a.datos.rondas || []).join(', ')} · ${dur}`
        };
    }
    return { info: '' };
  },

  /* El texto y el dibujo de una opción se buscan en el guion cargado. Si el
     JSON es de otra versión del guion y no la encuentra, queda el id. */
  opcion(escena_id, decision_id, opcion_id) {
    const escena = window.GUION && window.GUION.escenas[escena_id];
    const dec = escena && escena.decisiones && escena.decisiones[decision_id];
    const op = dec && dec.opciones.find((o) => o.id === opcion_id);
    const dib = op && typeof Dibujos !== 'undefined' ? Dibujos.svg(op.dibujo) : null;
    return {
      id: opcion_id,
      texto: op ? this.t(op.texto) : opcion_id,
      dibujo: dib || (op && op.emoji) || '',
      pregunta: dec ? this.t(dec.pregunta) : ''
    };
  },

  /* ---- Piezas de HTML ---------------------------------------------------- */

  banda(x, t0, dur) {
    const izq = Math.max(0, (x.desde - t0) / dur * 100);
    const ancho = Math.min(100 - izq, Math.max(0.6, (x.hasta - x.desde) / dur * 100));
    const color = x.color ? `;background-color:${x.color}` : '';
    return `<div class="rv-b rv-${x.clase} ${x.extraClase || ''}" ` +
      `style="left:${izq.toFixed(2)}%;width:${ancho.toFixed(2)}%${color}" ` +
      `title="${this.esc(x.info)}" data-info="${this.esc(x.info)}"></div>`;
  },

  punto(e, t0, dur) {
    const izq = Math.min(100, Math.max(0, (e.t_ms - t0) / dur * 100));
    const toque = e.nombre === 'toque_ocioso';
    const info = toque
      ? `${this.t('rv.leyenda_toque')} · ${e.datos.contexto} · ${this.t('rv.rafaga')} ${e.datos.conteo_en_rafaga}`
      : this.t('rv.leyenda_repregunta');
    return `<div class="rv-p ${toque ? 'rv-toque' : 'rv-repregunta'}" style="left:${izq.toFixed(2)}%" ` +
      `title="${this.esc(info)}" data-info="${this.esc(info)}"></div>`;
  },

  /* El dibujo de lo que eligió el niño, justo donde terminó de decidir. */
  eleccion(x, t0, dur) {
    const izq = Math.min(100, Math.max(0, (x.hasta - t0) / dur * 100));
    return `<div class="rv-eleccion${x.decision.porDefecto ? ' rv-por-defecto' : ''}" ` +
      `style="left:${izq.toFixed(2)}%" title="${this.esc(x.info)}" data-info="${this.esc(x.info)}">` +
      `${x.decision.op.dibujo}</div>`;
  },

  tablaDecisiones(decisiones) {
    if (!decisiones.length) return '';
    const filas = decisiones.map((x) => {
      const d = x.decision;
      const lat = d.datos.latencia_desde_fin_lectura_ms;
      const tiempo = (lat === null || lat === undefined) ? this.t('rv.antes_lectura') : this.seg(lat);
      const pos = (typeof d.datos.opcion_indice === 'number' ? d.datos.opcion_indice + 1 : '?') +
        ` ${this.t('ui.de', 'de')} ${d.n}`;
      return `<tr><td>${this.esc(d.escena_id)} · ${this.esc(d.decision_id)}</td>` +
        `<td class="rv-td-pregunta">${this.esc(d.op.pregunta)}</td>` +
        `<td><span class="rv-td-dib">${d.op.dibujo}</span>${this.esc(d.op.texto)}</td>` +
        `<td>${this.t(d.porDefecto ? 'rv.por_defecto' : 'rv.toco')}</td>` +
        `<td>${tiempo}</td><td>${d.datos.repreguntas || 0}</td><td>${pos}</td></tr>`;
    }).join('');
    const cols = ['col_decision', 'col_pregunta', 'col_eleccion', 'col_como',
                  'col_tiempo', 'col_repreguntas', 'col_posicion'];
    return `<h2 class="rv-titulo">${this.t('rv.decisiones')}</h2>` +
      `<div class="rv-tabla-marco"><table class="tabla rv-tabla"><tr>` +
      cols.map((k) => `<th>${this.t('rv.' + k)}</th>`).join('') +
      `</tr>${filas}</table></div>`;
  },

  /* Lo que conviene saber antes de mirar los datos. */
  avisos(datos) {
    const s = datos.sesion || {};
    const ev = datos.eventos || [];
    const lista = [];
    if (s.velocidad_revision && s.velocidad_revision !== 1) {
      lista.push(this.t('rv.aviso_velocidad').replace('{v}', s.velocidad_revision));
    }
    if (s.textos_revision) lista.push(this.t('rv.aviso_textos'));
    if (ev.some((e) => e.nombre === 'salida_anticipada')) lista.push(this.t('rv.aviso_salida'));
    const omitidas = ev.filter((e) => e.nombre === 'voz_omitida').length;
    if (omitidas) lista.push(this.t('rv.aviso_voz_omitida').replace('{n}', omitidas));
    if (!lista.length) return '';
    return '<ul class="rv-avisos">' + lista.map((x) => `<li>${this.esc(x)}</li>`).join('') + '</ul>';
  },

  leyenda() {
    const chip = (estilo, texto, clase) =>
      `<span class="rv-ley"><i class="${clase || ''}" style="${estilo}"></i>${this.esc(texto)}</span>`;
    const caja = (color) => `background-color:${color}`;
    const emociones = ['sorpresa', 'tristeza', 'asco', 'miedo', 'ira', 'alegria']
      .map((k) => chip(caja(this.COLORES[k]), this.emocion(k))).join('');
    return `<div class="rv-leyenda">` +
      `<div><b>${this.t('rv.carril_ventanas')}</b>${emociones}` +
        chip(caja(this.COLORES.neutra), this.t('rv.leyenda_neutra')) +
        chip(caja(this.COLORES.alegria), this.t('rv.leyenda_rostro'), 'rv-con-rostro') + `</div>` +
      `<div><b>${this.t('rv.carril_nino')}</b>` +
        chip(caja('#f6d58e'), this.t('rv.leyenda_decision')) +
        chip(caja('#f3c1a8'), this.t('rv.leyenda_objeto')) +
        chip('border:2px dashed #5fa88c', this.t('rv.leyenda_escucha')) +
        chip('width:2px;background:#37403C', this.t('rv.leyenda_toque')) +
        chip('width:9px;height:9px;border-radius:50%;background:#c9862a',
             this.t('rv.leyenda_repregunta')) + `</div>` +
      `<div><b>${this.t('rv.carril_voz')}</b>` +
        chip(caja('#5fa88c'), this.t('rv.leyenda_puki')) +
        chip(caja('#9aa7b1'), this.t('rv.leyenda_otro')) +
        `<span class="rv-ley">${this.t('rv.leyenda_grilla')}</span></div>` +
      `</div>`;
  },

  tituloEscena(s) {
    const def = window.GUION && window.GUION.escenas[s.id];
    if (def && def.titulo) return this.t(def.titulo);
    return s.tipo === 'washout' ? this.t('rv.calma') : '';
  },

  emocion(clave) { return this.t('rv.emo.' + clave, clave); },

  /* ---- Utilidades -------------------------------------------------------- */

  t(clave, respaldo) {
    return typeof I18n !== 'undefined' ? I18n.t(clave, respaldo) : (respaldo || clave);
  },

  seg(ms) {
    return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  },

  esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
};
