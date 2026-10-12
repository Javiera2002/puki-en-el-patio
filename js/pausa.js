/* ---------------------------------------------------------------------------
   pausa.js — Pausa de verdad: congela todo el juego.

   El juego avanza con muchas esperas (setTimeout / setInterval): la voz, las
   repreguntas, la opción por defecto, la torre, el modo demo. Si solo se
   detuviera el reloj de escena, esas esperas seguirían corriendo y, al volver,
   Puki ya habría elegido solo. Por eso este archivo se carga PRIMERO y
   reemplaza setTimeout / setInterval por versiones que cuentan "tiempo de
   juego": mientras está en pausa, ese tiempo no avanza, y al reanudar cada
   espera sigue desde donde quedó.

   Además, al pausar se detienen el reloj de escena, la voz, la música, el
   video y las animaciones, y queda registrado en el JSON (pausa_inicio y
   pausa_fin), porque los tiempos de respuesta de ese momento incluyen la
   pausa.
--------------------------------------------------------------------------- */

(function () {
  const nST = window.setTimeout.bind(window);
  const nCT = window.clearTimeout.bind(window);

  let pausado = false;
  let inicioPausa = 0;
  let acumulado = 0;
  const virt = () => performance.now() - acumulado - (pausado ? performance.now() - inicioPausa : 0);

  let siguienteId = 1;
  const timers = new Map();

  function programar(t) {
    nCT(t.nativo);
    t.nativo = nST(() => tic(t.id), pausado ? 100 : Math.max(0, t.vence - virt()));
  }

  function tic(id) {
    const t = timers.get(id);
    if (!t) return;
    if (pausado || virt() < t.vence - 1) { programar(t); return; }
    if (t.repetir) { t.vence += t.ms; programar(t); } else timers.delete(id);
    if (typeof t.fn === 'function') t.fn.apply(window, t.args);
  }

  function crear(fn, ms, args, repetir) {
    const espera = Math.max(repetir ? 4 : 0, +ms || 0);
    const t = { id: siguienteId++, fn, args, ms: espera, vence: virt() + espera, repetir, nativo: null };
    timers.set(t.id, t);
    programar(t);
    return t.id;
  }

  window.setTimeout = (fn, ms, ...args) => crear(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => crear(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => {
    const t = timers.get(id);
    if (t) { nCT(t.nativo); timers.delete(id); }
  };

  window.Pausa = {
    get activa() { return pausado; },
    /* motor, registro y Sonido son variables globales con let/const (no
       cuelgan de window): se buscan por su nombre. */
    _m() { return typeof motor !== 'undefined' ? motor : null; },
    _r() { return typeof registro !== 'undefined' ? registro : null; },
    _s() { return typeof Sonido !== 'undefined' ? Sonido : null; },
    _medios: [],
    _cronoCorria: false,

    pausar() {
      if (pausado) return;
      pausado = true;
      inicioPausa = performance.now();
      document.body.classList.add('pausado');

      const m = this._m();
      this._cronoCorria = !!(m && m.crono && m.crono.desde !== null);
      if (this._cronoCorria) m.crono.detener();

      try { if (window.speechSynthesis) speechSynthesis.pause(); } catch (e) {}
      try { if (this._s() && this._s().ctx) this._s().ctx.suspend(); } catch (e) {}
      this._medios = [...document.querySelectorAll('video')]
        .concat(Object.values((this._s() && this._s().pistas) || {}).map((p) => p.el))
        .filter((el) => el && !el.paused);
      this._medios.forEach((el) => el.pause());

      if (this._r()) {
        this._r().emitir('sistema', 'pausa_inicio', m && m.escenaActual ? m.escenaActual.id : null, 'sistema', {});
      }
    },

    reanudar() {
      if (!pausado) return;
      const dur = performance.now() - inicioPausa;
      acumulado += dur;
      pausado = false;
      document.body.classList.remove('pausado');

      const m = this._m();
      if (this._cronoCorria && m && m.crono) m.crono.arrancar();
      try { if (window.speechSynthesis) speechSynthesis.resume(); } catch (e) {}
      try { if (this._s() && this._s().ctx) this._s().ctx.resume(); } catch (e) {}
      this._medios.forEach((el) => el.play().catch(() => {}));
      this._medios = [];
      timers.forEach((t) => programar(t));

      if (this._r()) {
        this._r().emitir('sistema', 'pausa_fin', m && m.escenaActual ? m.escenaActual.id : null, 'sistema', {
          duracion_ms: Math.round(dur),
          nota: 'Los tiempos de respuesta medidos durante la pausa la incluyen.'
        });
      }
    },

    alternar() { if (pausado) this.reanudar(); else this.pausar(); }
  };
})();
