/* ---------------------------------------------------------------------------
   registro.js — El registro de eventos. El producto real del prototipo.

   Implementa el esquema documentado en ESQUEMA_EVENTOS.md (puki.eventos.v1).

   Dos ideas de diseño que conviene no perder:

   - Todos los eventos tienen la MISMA forma, cambie lo que cambie. Un click de
     hoy y una Action Unit de mañana son el mismo tipo de objeto, con distinto
     `canal`. Eso es la decisión D1 y es lo que evita reescribir esto después.

   - Las "ventanas de análisis" se van armando solas mientras corre la sesión.
     Cuando termina, el equipo de Brasil ya tiene los recortes de video que
     tiene que mirar, sin tener que reconstruir nada a mano.
--------------------------------------------------------------------------- */

const ESQUEMA = 'puki.eventos.v1';
const VERSION_APP = '0.5.0';

class Registro {
  constructor(reloj, meta) {
    this.reloj = reloj;
    this.seq = 0;
    this.eventos = [];
    this.ventanas = [];

    /* La última ventana neutra vista. Cada clímax se guarda con la neutra
       más reciente como referencia, no con la del principio de la sesión.
       Ver ESQUEMA_EVENTOS.md sección 5. */
    this.neutraActual = null;

    this.sesion = {
      id_sesion: this._uuid(),
      id_participante: meta.id_participante || 'SIN_ID',
      grupo: meta.grupo || null,
      inicio_iso: reloj.iso(0),
      t0_epoch_ms: reloj.t0_epoch,
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      reloj: {
        fuente: 'performance.now()',
        monotonico: true,
        nota: 't_ms es milisegundos desde t0. t_epoch_ms = t0_epoch_ms + t_ms.',
        alineacion: 't_epoch_ms es la hora del sistema del dispositivo. Sirve para ' +
          'cruzar con otro registro hecho en el MISMO dispositivo (ej. la captura ' +
          'de ARKit en el mismo iPad). Ver DN-25.'
      },
      pulsos_sync: !!meta.pulsos_sync,
      perfil_sonido: meta.perfil_sonido || 'normal',
      velocidad_revision: meta.velocidad || 1,
      textos_revision: meta.textos_revision !== false,
      version_guion: (window.GUION && window.GUION.version) || null,
      version_app: VERSION_APP,
      idioma: meta.idioma || 'es',
      orden_escenas: meta.orden_escenas || [],
      dispositivo: {
        user_agent: navigator.userAgent,
        viewport: [window.innerWidth, window.innerHeight],
        dpr: window.devicePixelRatio || 1,
        orientacion: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
        modo_media: meta.modo_media || 'placeholder'
      }
    };
  }

  /* ---- El método central: registrar un evento -------------------------- */
  emitir(tipo, nombre, escena_id, canal, datos) {
    const t = this.reloj.ms();
    const ev = {
      seq: this.seq++,
      t_ms: +t.toFixed(1),
      t_epoch_ms: this.reloj.epoch(t),
      t_iso: this.reloj.iso(t),
      tipo: tipo,
      nombre: nombre,
      escena_id: escena_id || null,
      canal: canal || 'sistema',
      datos: datos || {}
    };
    this.eventos.push(ev);
    if (window.PUKI_DEBUG) console.log('[evento]', ev.t_ms, tipo, nombre, ev.datos);
    return ev;
  }

  /* ---- Ventanas de análisis -------------------------------------------- */

  /* Se llama al abrir un tramo neutro (línea base o washout). */
  abrirNeutra(id, escena_id) {
    this.neutraActual = { id: id, escena_id: escena_id, desde: this.reloj.ms(), hasta: null };
  }

  cerrarNeutra() {
    if (!this.neutraActual) return;
    this.neutraActual.hasta = this.reloj.ms();
    this.ventanas.push({
      id: this.neutraActual.id,
      escena_id: this.neutraActual.escena_id,
      emocion_esperada: 'neutra',
      aus_esperadas: [],
      intensidad_esperada: null,
      valencia: 0,
      activacion: 'baja',
      t_ventana_ms: [
        Math.round(this.neutraActual.desde),
        Math.round(this.neutraActual.hasta)
      ],
      notas: 'Tramo neutro de referencia. Verificar que efectivamente lo sea.'
    });
  }

  /* Se llama en cada clímax. `clim` viene tal cual del guion. `extra` agrega
     datos del momento (por ejemplo, si lo disparó el toque del niño). */
  registrarClimax(escena_id, clim, extra) {
    const cfg = (window.GUION && window.GUION.ventana) || { antes_ms: 500, despues_ms: 5000 };
    const t = this.reloj.ms();
    const ventana = clim.ventana_ms || cfg.despues_ms;

    /* Regla de rostro (DN-22): si durante la ventana algún personaje muestra
       la emoción objetivo, el niño podría estar imitando. Brasil tiene que
       saberlo para cada ventana. */
    const rostro = {
      referencia_facial_en_pantalla: !!clim.referencia_facial,
      regla_rostro: clim.referencia_facial ? 'B_excepcion_social' : 'A_sin_rostro',
      nota_rostro: clim.nota_rostro || null
    };

    this.emitir('estimulo', 'climax_emocional', escena_id, 'sistema', Object.assign({
      climax_id: clim.id,
      emocion_esperada: clim.emocion,
      aus_esperadas: clim.aus,
      intensidad_esperada: clim.intensidad,
      valencia: clim.valencia,
      activacion: clim.activacion,
      duracion_estimulo_ms: clim.duracion_ms,
      ventana_ms: ventana,
      descripcion: clim.descripcion
    }, rostro, extra || {}));

    const n = this.neutraActual;
    this.ventanas.push(Object.assign({
      id: clim.id,
      escena_id: escena_id,
      emocion_esperada: clim.emocion,
      aus_esperadas: clim.aus,
      intensidad_esperada: clim.intensidad,
      valencia: clim.valencia,
      activacion: clim.activacion,
      t_climax_ms: Math.round(t),
      t_ventana_ms: [Math.round(t - cfg.antes_ms), Math.round(t + ventana)],
      t_neutra_ms: n && n.hasta !== null ? [Math.round(n.desde), Math.round(n.hasta)] : null,
      referencia_neutra: n ? n.id : null,
      notas: clim.descripcion
    }, rostro));
  }

  /* ---- Salida ----------------------------------------------------------- */

  exportar() {
    const fin = this.reloj.ms();
    return {
      esquema: ESQUEMA,
      sesion: Object.assign({}, this.sesion, {
        fin_iso: this.reloj.iso(fin),
        duracion_ms: Math.round(fin)
      }),
      eventos: this.eventos,
      ventanas_analisis: this.ventanas
    };
  }

  nombreArchivo() {
    const d = new Date(this.sesion.t0_epoch_ms);
    const p = (n) => String(n).padStart(2, '0');
    const fecha = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
    const hora = p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    return `puki_${this.sesion.id_participante}_${fecha}_${hora}_${this.sesion.id_sesion.slice(0, 8)}.json`;
  }

  /* Copia de seguridad en el navegador, por si la tablet se cierra antes de
     que el adulto alcance a descargar el archivo. No sale del dispositivo. */
  guardarLocal() {
    try {
      localStorage.setItem('puki.sesion.' + this.sesion.id_sesion,
                           JSON.stringify(this.exportar()));
    } catch (e) {
      console.warn('No se pudo guardar copia local:', e);
    }
  }

  descargar() {
    const blob = new Blob([JSON.stringify(this.exportar(), null, 2)],
                          { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = this.nombreArchivo();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  _uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}


/* ---------------------------------------------------------------------------
   Detector de toques ociosos.

   Toques en zonas que no son interactivas. Se agrupan en "ráfagas": si pasan
   menos de 600 ms entre uno y otro, cuentan como la misma ráfaga.

   Es la medida conductual más barata del prototipo y no necesita que el niño
   elija nada: una ráfaga de seis toques justo después de que se cae la torre
   dice más que cualquier respuesta.
--------------------------------------------------------------------------- */
class DetectorToquesOciosos {
  constructor(registro, elemento) {
    this.registro = registro;
    this.ultimo = null;
    this.rafaga = 0;
    this.escena = null;
    this.contexto = 'neutro';

    elemento.addEventListener('pointerdown', (e) => {
      // Si el toque cayó sobre algo interactivo, no es ocioso.
      if (e.target.closest('.interactivo')) return;
      const ahora = this.registro.reloj.ms();
      const dt = this.ultimo === null ? null : ahora - this.ultimo;
      this.rafaga = (dt !== null && dt < 600) ? this.rafaga + 1 : 1;
      this.ultimo = ahora;

      this.registro.emitir('interaccion', 'toque_ocioso', this.escena, 'tactil', {
        posicion_toque: [Math.round(e.clientX), Math.round(e.clientY)],
        ms_desde_toque_anterior: dt === null ? null : Math.round(dt),
        conteo_en_rafaga: this.rafaga,
        contexto: this.contexto
      });
    });
  }

  ubicar(escena_id, contexto) {
    this.escena = escena_id;
    this.contexto = contexto || 'neutro';
  }
}
