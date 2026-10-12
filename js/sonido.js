/* ---------------------------------------------------------------------------
   sonido.js — El audio del prototipo, en tres capas.

   Diseño de audio (DN-09, ampliado en DN-27):

     Capa 1 · AMBIENTE   Fondo suave y continuo de patio. Nunca se corta del
                         todo; algunas escenas lo bajan (el túnel, la torre).
     Capa 2 · EFECTOS    Gestos de los personajes ("uhm", risitas, suspiros,
                         sin idioma) y sonidos del mundo (la caja, el viento,
                         el gruñido del túnel).
     Capa 3 · VOZ        Frases cortas a cámara, estilo Dora. Es la única capa
                         que necesita traducción.

   Las tres capas tienen volumen propio. El PERFIL DE BAJO ESTÍMULO baja el
   ambiente y los efectos y deja la voz casi igual, pensando en niños con
   sensibilidad auditiva.

   REGLA DURA: nadie habla dentro de una ventana de análisis. El motor llama a
   bloquearVoz() en cada clímax y la desbloquea al cerrarse la ventana.

   ESTADO: andamio de baja fidelidad. La voz la genera el navegador (suena a
   robot) y los efectos son tonos sintetizados. Ambos se reemplazan por
   archivos de audio reales sin tocar el resto del código: solo cambia lo que
   hay dentro de hablar() y gesto().
--------------------------------------------------------------------------- */

const Sonido = {
  ctx: null,
  habilitado: true,
  vozBloqueada: false,
  motivoBloqueo: null,
  idiomaVoz: 'es-CL',
  ambienteNodos: null,
  buses: null,
  bloqueosEvitados: 0,     // cuántas veces se calló por estar en una ventana
  _vivas: new Set(),       // frases en curso (ver hablar())

  AMBIENTE_BASE: 0.035,

  /* Volumen relativo de cada capa según el perfil. */
  PERFILES: {
    normal: { ambiente: 1.0, efectos: 1.0,  voz: 1.0 },
    bajo:   { ambiente: 0.5, efectos: 0.45, voz: 0.85 }
  },
  perfilActual: 'normal',
  niveles: { ambiente: 1.0, efectos: 1.0, voz: 1.0 },

  /* Tiene que llamarse desde un toque del usuario: los navegadores no dejan
     sonar nada antes de que la persona interactúe con la página. */
  iniciar(idioma, perfil) {
    if (idioma) this.idiomaVoz = idioma === 'pt' ? 'pt-BR' : idioma === 'en' ? 'en-US' : 'es-CL';
    // Chrome entrega la lista de voces con retraso: se pide desde ya.
    try { if ('speechSynthesis' in window) speechSynthesis.getVoices(); } catch (e) {}
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.buses = { ambiente: this.ctx.createGain(), efectos: this.ctx.createGain() };
      this.buses.ambiente.connect(this.ctx.destination);
      this.buses.efectos.connect(this.ctx.destination);
    } catch (e) {
      this.habilitado = false;
      console.warn('Sin audio:', e);
    }
    this.perfil(perfil || 'normal');
    this.prepararArchivos();
    return this.habilitado;
  },

  /* ---- Archivos de audio (11-10) ----------------------------------------- */

  /* Si existen, el ambiente del patio y la música del baile son archivos de
     audio; si no, se usa el sonido generado. Se usan elementos <audio> y no
     Web Audio porque así funcionan también con doble clic en index.html. */
  ARCHIVOS: {
    ambiente: { src: 'media/audio/ambiente_patio.mp3', volumen: 0.35 },
    musica:   { src: 'media/audio/musica_baile.mp3',   volumen: 0.5 }
  },
  pistas: {},

  prepararArchivos() {
    Object.entries(this.ARCHIVOS).forEach(([id, cfg]) => {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      const pista = { el, cfg, ok: false, timer: null };
      el.addEventListener('canplaythrough', () => { pista.ok = true; }, { once: true });
      el.addEventListener('error', () => { pista.ok = false; });
      el.src = cfg.src;
      this.pistas[id] = pista;
    });
  },

  _pistaLista(id) {
    const p = this.pistas[id];
    return p && p.ok ? p : null;
  },

  /* Lleva el volumen de una pista a `destino` en `seg` segundos. */
  _fundir(pista, destino, seg, alTerminar) {
    clearInterval(pista.timer);
    const el = pista.el;
    const pasos = Math.max(1, Math.round((seg || 0) * 20));
    const inicio = el.volume;
    let n = 0;
    if (!seg) { el.volume = Math.max(0, Math.min(1, destino)); if (alTerminar) alTerminar(); return; }
    pista.timer = setInterval(() => {
      n++;
      el.volume = Math.max(0, Math.min(1, inicio + (destino - inicio) * n / pasos));
      if (n >= pasos) { clearInterval(pista.timer); if (alTerminar) alTerminar(); }
    }, 50);
  },

  perfil(nombre) {
    this.perfilActual = this.PERFILES[nombre] ? nombre : 'normal';
    this.niveles = Object.assign({}, this.PERFILES[this.perfilActual]);
    if (this.buses) {
      this.buses.ambiente.gain.value = this.niveles.ambiente;
      this.buses.efectos.gain.value = this.niveles.efectos;
    }
  },

  /* ---- Capa 1: ambiente ------------------------------------------------- */

  /* Ruido filtrado muy suave, como viento entre hojas. En la versión final
     esto es un archivo de audio de patio de colegio en bucle. */
  ambiente(encender) {
    if (!this.habilitado || !this.ctx) return;

    const pista = this._pistaLista('ambiente');
    if (pista) {
      if (encender) {
        this.ambienteArchivo = pista;
        pista.el.volume = 0;
        pista.el.play().catch(() => {});
        this._fundir(pista, pista.cfg.volumen * this.niveles.ambiente, 2);
      } else if (this.ambienteArchivo) {
        const p = this.ambienteArchivo;
        this.ambienteArchivo = null;
        this._fundir(p, 0, 1.5, () => p.el.pause());
      }
      return;
    }

    if (!encender) {
      if (this.ambienteNodos) {
        const g = this.ambienteNodos.gan.gain;
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setValueAtTime(g.value, this.ctx.currentTime);
        g.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        const n = this.ambienteNodos;
        setTimeout(() => { try { n.fuente.stop(); } catch (e) {} }, 1800);
        this.ambienteNodos = null;
      }
      return;
    }
    if (this.ambienteNodos) return;

    /* Sin archivo de ambiente, no suena nada: el viento generado sonaba a
       ruido blanco (decidido por Javiera el 11-10). El código del viento
       queda abajo, por si se quiere volver a usar con `ambienteGenerado`. */
    if (!this.ambienteGenerado) return;

    const seg = 4;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seg, this.ctx.sampleRate);
    const dat = buf.getChannelData(0);
    for (let i = 0; i < dat.length; i++) dat[i] = (Math.random() * 2 - 1) * 0.5;

    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buf;
    fuente.loop = true;

    // Filtro pasa-bajos: saca los agudos y queda un susurro, no un "shhh".
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 420;

    const gan = this.ctx.createGain();
    gan.gain.setValueAtTime(0, this.ctx.currentTime);
    gan.gain.linearRampToValueAtTime(this.AMBIENTE_BASE, this.ctx.currentTime + 2);

    fuente.connect(filtro).connect(gan).connect(this.buses.ambiente);
    fuente.start();
    this.ambienteNodos = { fuente, gan };
  },

  /* Sube o baja el ambiente respecto de su volumen normal (1 = normal). */
  ambienteNivel(factor, segundos) {
    if (this.ambienteArchivo) {
      const p = this.ambienteArchivo;
      this._fundir(p, p.cfg.volumen * this.niveles.ambiente * factor, segundos === undefined ? 1.2 : segundos);
      return;
    }
    if (!this.ambienteNodos || !this.ctx) return;
    const g = this.ambienteNodos.gan.gain;
    const t = this.ctx.currentTime;
    const dur = segundos === undefined ? 1.2 : segundos;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.AMBIENTE_BASE * factor, t + dur);
  },

  /* ---- Música (va en la capa de ambiente) ------------------------------- */

  /* Musiquita pegajosa en bucle, para el baile. Va en la capa de ambiente,
     así que el perfil de bajo estímulo también la baja. `corteSeco` la corta
     de golpe (el peo del baile); si no, se apaga en menos de un segundo. En la
     versión final esto es un archivo de música. */
  musica(encender, corteSeco) {
    if (!this.habilitado || !this.ctx) return;

    const pista = this._pistaLista('musica');
    if (pista) {
      if (encender) {
        if (this.musicaArchivo) return;
        this.musicaArchivo = pista;
        pista.el.volume = 0;
        pista.el.play().catch(() => {});
        this._fundir(pista, pista.cfg.volumen * this.niveles.ambiente, 0.3);
      } else if (this.musicaArchivo) {
        const p = this.musicaArchivo;
        this.musicaArchivo = null;
        if (corteSeco) { clearInterval(p.timer); p.el.volume = 0; p.el.pause(); }
        else this._fundir(p, 0, 0.8, () => p.el.pause());
      }
      return;
    }

    if (!encender) {
      if (!this.musicaNodos) return;
      const m = this.musicaNodos;
      this.musicaNodos = null;
      clearInterval(m.timer);
      const t = this.ctx.currentTime;
      m.gan.gain.cancelScheduledValues(t);
      m.gan.gain.setValueAtTime(m.gan.gain.value, t);
      m.gan.gain.linearRampToValueAtTime(0, t + (corteSeco ? 0.04 : 0.8));
      setTimeout(() => { try { m.gan.disconnect(); } catch (e) {} }, 1200);
      return;
    }
    if (this.musicaNodos) return;

    const gan = this.ctx.createGain();
    gan.gain.setValueAtTime(0, this.ctx.currentTime);
    gan.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.3);
    gan.connect(this.buses.ambiente);

    // Melodía saltarina tipo ukelele sobre un bajo simple, en bucle.
    const melodia = [523, 659, 784, 659, 587, 698, 880, 698];
    const bajo = [131, 196, 147, 196];
    let paso = 0;
    const tocar = () => {
      const t = this.ctx.currentTime + 0.02;
      this._tono(melodia[paso % melodia.length], 0.16, t, 'triangle', 0.05, null, 0.01, gan);
      if (paso % 2 === 0) this._tono(bajo[(paso / 2) % bajo.length], 0.22, t, 'sine', 0.07, null, 0.01, gan);
      paso++;
    };
    tocar();
    this.musicaNodos = { gan, timer: setInterval(tocar, 250) };
  },

  /* ---- Capa 2: efectos (sin idioma) ------------------------------------- */

  gesto(nombre, param) {
    if (!this.habilitado || !this.ctx) return;
    const t = this.ctx.currentTime;
    const T = (hz, dur, d, tipo, vol, hasta, ataque) => this._tono(hz, dur, t + d, tipo, vol, hasta, ataque);
    const R = (dur, d, corte, vol, ataque) => this._ruido(dur, t + d, corte, vol, ataque);

    switch (nombre) {
      /* Gestos de los personajes */
      case 'uhm':        T(300, .18, 0, 'sine', .10, 260); T(260, .22, .20, 'sine', .09); break;
      case 'risita':     [0, .13, .26, .38].forEach((d, i) =>
                           T(520 + i * 55, .09, d, 'sine', .09, 620 + i * 55)); break;
      case 'suspiro':    R(.7, 0, 700, .05); break;
      case 'bostezo':    T(230, .9, 0, 'sine', .07, 180); break;
      case 'sniff':      R(.12, 0, 3000, .04); R(.12, .2, 3000, .04); break;
      case 'puaj':       T(300, .30, 0, 'sawtooth', .08, 170); R(.25, .28, 900, .05); break;
      case 'gulp':       T(320, .15, 0, 'sine', .08, 150); break;
      case 'inhala':     R(1.4, 0, 1800, .03, .6); break;
      case 'soplido':    R(1.2, 0, 900, .05, .1); break;
      case 'alegria':    [0, .12, .24].forEach((d, i) => T(520 + i * 130, .16, d, 'triangle', .10)); break;
      case 'risas':      for (let i = 0; i < 16; i++) {
                           const f = 360 + Math.random() * 340;
                           T(f, .12, i * .22 + Math.random() * .06, 'triangle', .055, f * .8);
                         } break;
      case 'piip':       T(1300, .12, 0, 'sine', .07, 1700); T(1300, .12, .18, 'sine', .06, 1750); break;
      case 'risas_cortas': for (let i = 0; i < 5; i++) {
                           const f = 380 + Math.random() * 300;
                           T(f, .11, i * .2, 'triangle', .045, f * .8);
                         } break;
      case 'peo':        T(105, .9, 0, 'sawtooth', .06, 72, .04); T(98, .85, .02, 'sawtooth', .04, 68, .04);
                         R(.8, 0, 500, .035, .04); break;
      case 'pfit':       T(150, .25, 0, 'sawtooth', .045, 105, .02); R(.2, 0, 600, .025, .02); break;

      /* Sonidos del mundo */
      case 'crujido':    R(.06, 0, 1500, .06); R(.06, .08, 1300, .05); R(.08, .17, 1100, .05);
                         T(180, .3, 0, 'sawtooth', .025, 140); break;
      case 'carton':     R(.3, 0, 1200, .05); break;
      case 'pop':        T(700, .08, 0, 'sine', .12, 200);
                         [.10, .22, .34, .50].forEach((d) => T(1568 + Math.random() * 420, .35, d, 'triangle', .045)); break;
      case 'viscoso':    [0, .35, .8, 1.3, 1.9].forEach((d) => {
                           R(.3, d, 350 + Math.random() * 500, .05, .08);
                           T(210, .28, d + .05, 'sine', .05, 110, .08);
                         });
                         T(215, 2.8, .4, 'sawtooth', .018, 235, .3); break;   // la mosca
      case 'rebote':     [0, .45, .8, 1.05].forEach((d, i) => T(110, .12, d, 'sine', .12 - i * .02, 70)); break;
      case 'grunido':    T(82, 1.6, 0, 'sawtooth', .07, 68, .15); T(82, 1.2, .3, 'sawtooth', .03, 70, .15); break;
      case 'melancolia': [784, 698, 659, 587, 523].forEach((f, i) => T(f, .5, i * .5, 'triangle', .045)); break;
      case 'magia':      T(300, .6, 0, 'triangle', .08, 1200); T(200, .3, .55, 'sine', .08, 420); break;
      case 'boing':      [0, .09, .18, .27, .36].forEach((d, i) =>
                           T(220 + i * 30, .1, d, 'sine', .08 - i * .01, 520 + i * 30)); break;
      case 'pasitos':    [0, .3, .6].forEach((d) => T(160, .08, d, 'sine', .08, 120)); break;
      case 'desinflar':  T(420, 1.3, 0, 'sawtooth', .035, 70); R(1.2, 0, 1200, .03); break;
      case 'pum':        T(90, .2, 0, 'sine', .12, 60); break;
      case 'pasos':      [0, .12, .24, .36, .48].forEach((d) => T(140, .06, d, 'sine', .07, 100)); break;
      case 'viento':     R(1.3, 0, 600, .06, .3); break;
      case 'derrumbe':   [0, .12, .2, .33, .45].forEach((d) => T(140 + Math.random() * 80, .1, d, 'square', .04, 90));
                         R(.6, 0, 900, .04); break;
      case 'fanfarria':  [523, 659, 784, 1047].forEach((f, i) => T(f, .22, i * .14, 'triangle', .09)); break;
      case 'nota': {     // Do, Re, Mi, Fa, Sol
        const escala = [523.25, 587.33, 659.25, 698.46, 783.99];
        T(escala[(param || 0) % escala.length], .25, 0, 'triangle', .09);
        break;
      }
      case 'bloque':     T(440, .10, 0, 'triangle', .08); break;
      case 'moneda':     T(1200, .08, 0, 'triangle', .08); T(1600, .12, .06, 'triangle', .06); break;
      case 'clac':       [0, .14, .4, .54].forEach((d) => T(900, .04, d, 'square', .05, 600)); break;
      case 'ooh':        T(330, .45, 0, 'sine', .09, 440); break;
      default:           T(440, .12, 0, 'sine', .07);
    }
  },

  /* ---- Capa 3: voz (con idioma) ----------------------------------------- */

  /* `alEvento(fase, detalle)` recibe 'inicio', 'fin' o 'error'. */
  hablar(texto, opciones, alEvento) {
    if (!texto) return false;

    // La regla dura. Si estamos dentro de una ventana de análisis, nadie habla.
    if (this.vozBloqueada) {
      this.bloqueosEvitados++;
      console.warn('Voz omitida (' + this.motivoBloqueo + '):', texto);
      return false;
    }
    if (!this.habilitado || !('speechSynthesis' in window)) return false;

    const cfg = opciones || {};
    try {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = cfg.idioma || this.idiomaVoz;
      const voz = this._mejorVoz(u.lang);
      if (voz) u.voice = voz;
      // Más lento y más agudo: se entiende mejor a los 4 años y suena a criatura
      // chica, no a locutor. Cada personaje trae sus valores desde el guion.
      u.rate = cfg.rate !== undefined ? cfg.rate : 0.88;
      let tono = cfg.pitch !== undefined ? cfg.pitch : 1.5;
      // En inglés las voces suenan metálicas con el tono tan alto: se sube
      // menos (Puki 1.5 → 1.2, Lira 1.8 → 1.32).
      if (u.lang.indexOf('en') === 0) tono = 1 + (tono - 1) * 0.4;
      u.pitch = tono;
      u.volume = Math.min(1, (cfg.volumen !== undefined ? cfg.volumen : 0.9) * this.niveles.voz);

      // Se guarda una referencia mientras suena: algunos navegadores pierden
      // el aviso de "terminó" si la frase queda sin referencia.
      this._vivas.add(u);
      const soltar = () => this._vivas.delete(u);
      u.onstart = () => { if (alEvento) alEvento('inicio'); };
      u.onend = () => { soltar(); if (alEvento) alEvento('fin'); };
      u.onerror = (ev) => { soltar(); if (alEvento) alEvento('error', ev && ev.error); };

      // Las frases se ENCOLAN en vez de cortarse entre sí. Solo callar() (que
      // se usa al abrir una ventana de análisis) vacía la cola.
      speechSynthesis.speak(u);
      return true;
    } catch (e) {
      console.warn('Sin voz:', e);
      return false;
    }
  },

  /* Elige la voz más natural instalada para el idioma: primero las
     "Natural" u "Online" de Microsoft, después las de Google, después
     cualquiera del idioma. Si no hay, el navegador usa la suya. */
  _mejorVoz(lang) {
    if (!('speechSynthesis' in window)) return null;
    const voces = speechSynthesis.getVoices();
    if (!voces.length) return null;
    const pref = lang.slice(0, 2).toLowerCase();
    const delIdioma = voces.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').indexOf(pref) === 0);
    if (!delIdioma.length) return null;
    const exacta = (v) => (v.lang || '').toLowerCase().replace('_', '-') === lang.toLowerCase();
    const puntaje = (v) => {
      let p = 0;
      if (/natural/i.test(v.name)) p += 8;
      if (/online/i.test(v.name)) p += 4;
      if (/google/i.test(v.name)) p += 6;
      if (exacta(v)) p += 2;
      return p;
    };
    return delIdioma.slice().sort((a, b) => puntaje(b) - puntaje(a))[0];
  },

  hablando() {
    return ('speechSynthesis' in window) && (speechSynthesis.speaking || speechSynthesis.pending);
  },

  callar() {
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  },

  bloquearVoz(bloquear, motivo) {
    this.vozBloqueada = !!bloquear;
    this.motivoBloqueo = bloquear ? (motivo || 'ventana de análisis') : null;
    if (bloquear) this.callar();
  },

  /* ---- Generadores ------------------------------------------------------- */

  /* `ataque`: segundos de subida. Por defecto 30 ms; los sonidos de los
     clímax usan 150 ms o más, para que nunca sean un corte abrupto. */
  _tono(hz, dur, cuando, tipo, vol, hastaHz, ataque, destino) {
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    const sub = Math.min(ataque || 0.03, dur * 0.8);
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(hz, cuando);
    if (hastaHz) osc.frequency.linearRampToValueAtTime(hastaHz, cuando + dur);
    gan.gain.setValueAtTime(0, cuando);
    gan.gain.linearRampToValueAtTime(vol || 0.08, cuando + sub);
    gan.gain.linearRampToValueAtTime(0, cuando + dur);
    osc.connect(gan).connect(destino || this.buses.efectos);
    osc.start(cuando);
    osc.stop(cuando + dur + 0.05);
  },

  _ruido(dur, cuando, corte, vol, ataque) {
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const dat = buf.getChannelData(0);
    for (let i = 0; i < dat.length; i++) dat[i] = (Math.random() * 2 - 1) * 0.5;
    const f = this.ctx.createBufferSource(); f.buffer = buf;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = corte || 800;
    const gan = this.ctx.createGain();
    const sub = Math.min(ataque || 0.08, dur * 0.8);
    gan.gain.setValueAtTime(0, cuando);
    gan.gain.linearRampToValueAtTime(vol || 0.05, cuando + sub);
    gan.gain.linearRampToValueAtTime(0, cuando + dur);
    f.connect(filtro).connect(gan).connect(this.buses.efectos);
    f.start(cuando); f.stop(cuando + dur);
  }
};
