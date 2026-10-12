/* ---------------------------------------------------------------------------
   resumen.js — El resumen para el profesional.

   Lee el mismo JSON que se descarga y lo ordena por subescala internalizante
   del SDQ (síntomas emocionales y relación con pares). Para cada ítem
   muestra en qué situación del juego se observó, qué hizo el niño y si eso
   coincide con la conducta que el guion marca como señal ("para mirar").

   Reglas (03_prototipo/resumen_por_area_v1.md):
   - Describe, no diagnostica: no hay puntajes ni conteos por subescala.
   - Los tiempos se comparan con el ritmo del mismo niño, no con normas.
   - Lo que el juego no cubre se dice ("sin dato en esta versión").
   - Una decisión que tomó el juego solo (por inactividad) no cuenta.

   Las relaciones ítem-conducta salen de las etiquetas `sdq` de guion.js:
   cambiar una relación no requiere tocar este archivo.
--------------------------------------------------------------------------- */

const Resumen = {

  SUBESCALAS_INTERNALIZANTES: ['emocional', 'pares'],
  ORDEN_CONFIANZA: ['baja', 'media', 'media-alta', 'alta'],

  pintar(contenedor, datos, guion) {
    if (!contenedor || !datos) return;
    guion = guion || window.GUION;
    const cfg = guion.resumen || {};
    const ev = datos.eventos || [];
    const t = (k, rep) => this.texto(k, rep);

    const situaciones = this.situaciones(guion);
    const ritmo = this.mediana(ev
      .filter((e) => e.nombre === 'bloque_colocado' && e.datos.colocado_por === 'nino')
      .map((e) => e.datos.latencia_ms));

    let html = `<h3 class="res-titulo">${t('res.titulo')}</h3>` +
      `<p class="res-intro">${t('res.intro')}</p>`;
    if (datos.sesion && datos.sesion.demo) {
      html += `<p class="res-demo">${t('res.demo', { p: datos.sesion.demo })}</p>`;
    }

    (cfg.subescalas || []).forEach((sub) => {
      html += `<section class="res-sub"><h4>${t(sub.titulo)}</h4><ul class="res-items">`;
      sub.items.forEach((item) => {
        const suyas = situaciones.filter((s) => s.item === item);
        if (!suyas.length) {
          const motivo = (cfg.sin_dato || {})[item];
          html += `<li class="res-item sin-dato"><span class="res-nombre">${t('res.item.' + item)}` +
            ` <small>(${item})</small></span>` +
            `<span class="res-linea">${t('res.sin_dato')}${motivo ? ': ' + t(motivo) : ''}</span></li>`;
          return;
        }
        const conf = this.confianzaMayor(suyas);
        html += `<li class="res-item"><span class="res-nombre">${t('res.item.' + item)}` +
          ` <small>(${item})</small></span>` +
          (conf ? `<span class="res-conf">${t('res.confianza')}: ${t('res.conf.' + conf)}</span>` : '');
        suyas.forEach((s) => { html += this.lineaSituacion(s, ev, ritmo, cfg, t); });
        html += `</li>`;
      });
      html += `</ul></section>`;
    });

    html += this.participacion(ev, t);
    html += this.fortalezas(ev, guion, t);
    html += `<p class="res-nota">${t('res.nota')}</p>`;
    contenedor.innerHTML = html;
  },

  /* Todas las situaciones del guion etiquetadas con un ítem internalizante:
     una por decisión (con las opciones que son señal o acompañan) y una por
     objeto que se mide por tiempo. */
  situaciones(guion) {
    const lista = [];
    const esInt = (tag) => this.SUBESCALAS_INTERNALIZANTES.includes(tag.subescala);
    Object.entries(guion.escenas || {}).forEach(([escena_id, esc]) => {
      Object.entries(esc.decisiones || {}).forEach(([decision_id, dec]) => {
        const porItem = {};
        dec.opciones.forEach((op) => (op.sdq || []).filter(esInt).forEach((tag) => {
          (porItem[tag.item] = porItem[tag.item] || []).push({ opcion: op, tag: tag });
        }));
        Object.entries(porItem).forEach(([item, ops]) => lista.push({
          tipo: 'decision', item: +item, escena_id, decision_id, dec, ops,
          confianza: ops.map((o) => o.tag.confianza).filter(Boolean)
        }));
      });
      (esc.marcas || []).filter((m) => m.tipo === 'toque_objeto').forEach((m) => {
        (m.sdq || []).filter(esInt).forEach((tag) => lista.push({
          tipo: 'objeto', item: tag.item, escena_id, objeto: m.objeto, tag,
          confianza: tag.confianza ? [tag.confianza] : []
        }));
      });
    });
    // Primero lo que es señal, después lo que acompaña.
    return lista.sort((a, b) => this.esAcompana(a) - this.esAcompana(b));
  },

  esAcompana(s) {
    return s.tipo === 'decision' && s.ops.every((o) => o.tag.rol === 'acompana') ? 1 : 0;
  },

  confianzaMayor(situaciones) {
    const todas = [].concat(...situaciones.map((s) => s.confianza));
    return todas.sort((a, b) => this.ORDEN_CONFIANZA.indexOf(b) - this.ORDEN_CONFIANZA.indexOf(a))[0] || null;
  },

  lineaSituacion(s, ev, ritmo, cfg, t) {
    const etiqueta = (estado, clase) => `<span class="res-estado ${clase}">${estado}</span>`;

    if (s.tipo === 'decision') {
      const e = ev.find((x) => x.escena_id === s.escena_id && x.datos && x.datos.decision_id === s.decision_id &&
        (x.nombre === 'opcion_elegida' || x.nombre === 'opcion_por_defecto'));
      const titulo = t('res.dec.' + s.decision_id);
      if (!e) return '';
      if (e.nombre === 'opcion_por_defecto') {
        return `<span class="res-linea">${titulo}: ${etiqueta(t('res.sin_respuesta'), 'neutro')}</span>`;
      }
      const op = s.dec.opciones.find((o) => o.id === e.datos.opcion_id);
      const marcada = s.ops.find((o) => o.opcion.id === e.datos.opcion_id);
      const eligio = `${t('res.eligio')} «${op ? this.texto(op.texto) : e.datos.opcion_id}»`;
      let estado;
      if (!marcada) estado = etiqueta(t('res.sin_senal'), 'neutro');
      else if (marcada.tag.rol === 'acompana') estado = etiqueta(t('res.acompana'), 'acompana');
      else estado = etiqueta(t('res.mirar'), 'mirar');
      return `<span class="res-linea">${titulo}: ${eligio}. ${estado}</span>`;
    }

    // Objeto que se mide por el tiempo del primer toque.
    const titulo = t('res.obj.' + s.objeto);
    const primero = ev.find((x) => x.nombre === 'toque_objeto' && x.datos.objeto_id === s.objeto && x.datos.n === 1);
    const repregunto = ev.some((x) => x.nombre === 'repregunta_inactividad' && x.datos.objeto_id === s.objeto);
    if (!primero) {
      return `<span class="res-linea">${titulo}: ${t('res.no_toco')}. ${etiqueta(t('res.sin_respuesta'), 'neutro')}</span>`;
    }
    const seg = (ms) => (ms / 1000).toFixed(1);
    let txt = `${titulo}: ${t('res.toco_tras', { s: seg(primero.datos.latencia_ms) })}`;
    if (ritmo) txt += ` (${t('res.ritmo', { s: seg(ritmo) })})`;
    const lento = ritmo && primero.datos.latencia_ms > (cfg.factor_tiempo || 2) * ritmo;
    if (repregunto) txt += `. ${t('res.repregunta')}`;
    const estado = (lento || repregunto) ? etiqueta(t('res.mirar'), 'mirar') : etiqueta(t('res.sin_senal'), 'neutro');
    return `<span class="res-linea">${txt}. ${estado}</span>`;
  },

  participacion(ev, t) {
    const elegidas = ev.filter((e) => e.nombre === 'opcion_elegida');
    const total = elegidas.length + ev.filter((e) => e.nombre === 'opcion_por_defecto').length;
    const repreguntas = ev.filter((e) => e.nombre === 'repregunta_inactividad').length;
    const lat = this.mediana(elegidas.map((e) =>
      e.datos.latencia_desde_fin_lectura_ms !== null && e.datos.latencia_desde_fin_lectura_ms !== undefined
        ? Math.max(0, e.datos.latencia_desde_fin_lectura_ms) : e.datos.latencia_ms));
    const ociosos = ev.filter((e) => e.nombre === 'toque_ocioso').length;
    const items = [t('res.p.elegidas', { n: elegidas.length, t: total })];
    if (lat !== null) items.push(t('res.p.latencia', { s: (lat / 1000).toFixed(1) }));
    items.push(t('res.p.repreguntas', { n: repreguntas }));
    items.push(t('res.p.ociosos', { n: ociosos }));
    return `<section class="res-sub res-contexto"><h4>${t('res.participo')}</h4><ul>` +
      items.map((i) => `<li>${i}</li>`).join('') + `</ul></section>`;
  },

  /* Lo prosocial va aparte, como fortaleza y contexto: no se marca nada. */
  fortalezas(ev, guion, t) {
    const items = [];
    const rep = ev.find((e) => e.nombre === 'reparto_fin');
    if (rep) {
      const d = rep.datos.por_destino || {};
      items.push(t('res.f.reparto', { tobi: d.tobi || 0, lira: d.lira || 0, caja: rep.datos.guardadas }));
    }
    ev.filter((e) => e.nombre === 'opcion_elegida').forEach((e) => {
      const esc = (guion.escenas || {})[e.escena_id];
      const dec = esc && esc.decisiones && esc.decisiones[e.datos.decision_id];
      if (!dec) return;
      const esPro = dec.opciones.some((o) => (o.sdq || []).some((tag) => tag.subescala === 'prosocial'));
      const op = dec.opciones.find((o) => o.id === e.datos.opcion_id);
      if (esPro && op) items.push(`${t('res.dec.' + e.datos.decision_id)}: ${t('res.eligio')} «${this.texto(op.texto)}»`);
    });
    const pelota = ev.find((e) => e.nombre === 'objeto_completado' && e.datos.voluntario);
    if (pelota) items.push(t(pelota.datos.completado_por === 'nino' ? 'res.f.pelota_si' : 'res.f.pelota_no'));
    if (!items.length) return '';
    return `<section class="res-sub res-contexto"><h4>${t('res.fortalezas')}</h4><ul>` +
      items.map((i) => `<li>${i}</li>`).join('') + `</ul></section>`;
  },

  mediana(nums) {
    const v = nums.filter((n) => typeof n === 'number' && isFinite(n)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  },

  texto(clave, reemplazos) {
    let s = I18n.t(clave);
    Object.entries(reemplazos || {}).forEach(([k, v]) => { s = s.split('{' + k + '}').join(v); });
    return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  }
};
