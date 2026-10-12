/* ---------------------------------------------------------------------------
   reloj.js — Todo lo que tiene que ver con medir el tiempo.

   Hay DOS relojes en el prototipo y es importante no confundirlos:

   1. Reloj de SESIÓN (clase Reloj): parte en 0 cuando empieza la sesión y no
      se detiene nunca. Es el que va en el JSON, el que se sincroniza con la
      cámara de Brasil. Usa performance.now(), que es "monotónico": no se
      mueve aunque el sistema operativo ajuste la hora a mitad de sesión.

   2. Reloj de ESCENA (clase Cronometro): mide dentro de una escena y SÍ se
      detiene, cada vez que el niño está decidiendo o jugando la minitarea.
      Sirve para que las marcas del guion caigan donde corresponde sin importar
      cuánto se demoró el niño en elegir.
--------------------------------------------------------------------------- */

class Reloj {
  constructor() {
    this.t0_epoch = Date.now();      // hora de pared al arrancar
    this.p0 = performance.now();     // referencia monotónica
  }

  /* Milisegundos desde el inicio de la sesión. El número clave del proyecto. */
  ms() {
    return performance.now() - this.p0;
  }

  /* Hora de pared correspondiente a un t_ms dado. */
  epoch(ms) {
    return Math.round(this.t0_epoch + (ms === undefined ? this.ms() : ms));
  }

  iso(ms) {
    return new Date(this.epoch(ms)).toISOString();
  }
}


class Cronometro {
  /* `factor` acelera el reloj de escena para revisar el flujo rápido
     (?velocidad=3 en la URL). En una sesión real vale 1. */
  constructor(factor) {
    this.factor = factor || 1;
    this.acumulado = 0;
    this.desde = null;   // null = detenido
  }

  arrancar() {
    if (this.desde === null) this.desde = performance.now();
  }

  detener() {
    if (this.desde !== null) {
      this.acumulado += performance.now() - this.desde;
      this.desde = null;
    }
  }

  ms() {
    return (this.acumulado + (this.desde === null ? 0 : performance.now() - this.desde)) * this.factor;
  }

  reiniciar() {
    this.acumulado = 0;
    this.desde = null;
  }

  /* Cambia la velocidad sin saltos (botón de velocidad): el tiempo de escena
     ya transcurrido se conserva y desde ahora avanza con el factor nuevo. */
  cambiarFactor(factor) {
    const ahora = this.ms();
    this.factor = factor || 1;
    this.acumulado = ahora / this.factor;
    if (this.desde !== null) this.desde = performance.now();
  }
}


/* ---------------------------------------------------------------------------
   Pulso de sincronía ("la claqueta").

   Pinta la pantalla completa de blanco y hace sonar un tono, para que ambos
   queden grabados en el video de la cámara. Devuelve el instante EN QUE EL
   NAVEGADOR REALMENTE PINTÓ el flash, que puede ser uno o dos frames después
   de que se pidió. Ese es el dato que hay que usar para alinear los relojes.
--------------------------------------------------------------------------- */
function pulsoSync(reloj, opciones) {
  const cfg = Object.assign({
    flash_ms: 200, flash_color: '#FFFFFF', beep_hz: 1000, beep_ms: 200
  }, opciones || {});

  return new Promise((resolver) => {
    const t_solicitado = reloj.ms();

    const capa = document.createElement('div');
    capa.className = 'pulso-sync';
    capa.style.background = cfg.flash_color;
    document.body.appendChild(capa);

    // Tono. Si el navegador bloquea el audio, seguimos igual con el flash.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.frequency.value = cfg.beep_hz;
      osc.type = 'sine';
      // Subida y bajada suaves: un corte seco suena a "clic" y molesta.
      gan.gain.setValueAtTime(0, ctx.currentTime);
      gan.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gan.gain.setValueAtTime(0.25, ctx.currentTime + cfg.beep_ms / 1000 - 0.02);
      gan.gain.linearRampToValueAtTime(0, ctx.currentTime + cfg.beep_ms / 1000);
      osc.connect(gan).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + cfg.beep_ms / 1000);
      setTimeout(() => ctx.close(), cfg.beep_ms + 200);
    } catch (e) {
      console.warn('Pulso sync sin audio:', e);
    }

    let resuelto = false;
    const terminar = (t_pintado, confiable) => {
      if (resuelto) return;
      resuelto = true;
      capa.remove();
      resolver({
        flash_ms: cfg.flash_ms,
        flash_color: cfg.flash_color,
        beep_hz: cfg.beep_hz,
        beep_ms: cfg.beep_ms,
        t_flash_solicitado_ms: +t_solicitado.toFixed(1),
        t_flash_pintado_ms: +t_pintado.toFixed(1),
        /* Si es false, el instante del flash NO sirve para sincronizar con la
           cámara: es una estimación, no una confirmación de que se pintó. */
        confirmado: confiable
      });
    };

    // Doble rAF: el primero es "voy a pintar", el segundo confirma que pintó.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const t_pintado = reloj.ms();
        setTimeout(() => terminar(t_pintado, true), cfg.flash_ms);
      });
    });

    /* Red de seguridad. Si la pantalla está apagada o la pestaña en segundo
       plano, requestAnimationFrame deja de dispararse y la promesa de arriba no
       se resuelve NUNCA: la sesión se congela ahí para siempre, sin ningún
       aviso. Este respaldo la destraba y marca el pulso como no confiable, para
       que nadie lo use después creyendo que sirve para alinear los relojes. */
    setTimeout(() => terminar(reloj.ms(), false), cfg.flash_ms + 1500);
  });
}
