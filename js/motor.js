/* ---------------------------------------------------------------------------
   motor.js — El motor que ejecuta el guion.

   El motor NO sabe nada de Puki. No hay una sola mención a cajas, torres ni
   túneles acá. Solo sabe leer la estructura de data/guion.js y ejecutarla. Eso
   significa que cambiar la historia no requiere tocar este archivo.

   Cómo funciona una escena:

     1. Arranca el reloj de escena (Cronometro).
     2. En cada tic, revisa si el reloj pasó el tiempo de la próxima marca.
     3. Según el tipo de marca, hace algo: cambiar el texto, abrir una ventana
        de análisis, mostrar opciones, esperar que el niño toque un objeto,
        abrir una ventana de escucha, lanzar la minitarea.
     4. Cuando el reloj llega a `duracion_ms`, la escena termina.

   Lo importante: mientras el niño decide, toca un objeto o juega la minitarea,
   el reloj de escena SE DETIENE. Por eso lo que pasa después cae siempre a la
   misma distancia de la acción del niño, sin importar si se demoró 2 o 30
   segundos. El instante absoluto en la sesión sí varía, y por eso queda
   registrado con su timestamp real en el JSON.
--------------------------------------------------------------------------- */

class Motor {
  constructor(opciones) {
    this.guion = opciones.guion;
    this.registro = opciones.registro;
    this.reloj = opciones.reloj;
    this.detectorToques = opciones.detectorToques;
    this.modoMedia = opciones.modoMedia || 'placeholder';
    this.pulsosSync = !!opciones.pulsosSync;
    /* Velocidad de revisión (?velocidad=3 en la URL). Solo sirve para mirar el
       flujo rápido: una sesión con velocidad distinta de 1 no sirve para
       análisis, y queda marcado así en el JSON. */
    this.v = opciones.velocidad || 1;
    this.dom = opciones.dom;
    this.alTerminar = opciones.alTerminar || function () {};

    this.crono = new Cronometro(this.v);
    this.escenaActual = null;
    this.ramaElegida = null;
    this.indice = 0;
    this.abortar = false;
    this.saltarAlFinal = false;
    this.videoActivo = false;   // true mientras el video de la escena corre
    this.imagenActual = null;   // la imagen de fondo que se ve ahora

    /* Modo demo: un perfil de guion.demo. El juego se juega solo; ver
       demoTocar() y los puntos donde se usa. */
    this.demo = opciones.demo || null;
  }

  /* ---- Bucle principal -------------------------------------------------- */

  async correr() {
    const orden = this.guion.orden.filter((id) => {
      const e = this.guion.escenas[id];
      return e && e.activa !== false;
    });

    this.registro.sesion.orden_escenas = orden;
    this.precargarImagenes();
    this.registro.emitir('sistema', 'sesion_inicio', null, 'sistema', {
      total_escenas: orden.length
    });

    for (this.indice = 0; this.indice < orden.length; this.indice++) {
      if (this.abortar) break;

      const id = orden[this.indice];

      /* Salida anticipada durante la escena de frustración: no se corta la
         sesión, se salta directo a la escena alegre. Nunca se termina desde
         un estado emocional negativo. Ver DN-05. */
      if (this.saltarAlFinal) {
        if (id !== 'E5_alegria') continue;
        this.saltarAlFinal = false;
      }

      this.dom.progreso.textContent =
        `${I18n.t('ui.escena')} ${this.indice + 1} ${I18n.t('ui.de')} ${orden.length}`;

      await this.correrEscena(id);
    }

    this.registro.emitir('sistema', 'sesion_fin', null, 'sistema', {
      escenas_completadas: this.indice
    });
    this.registro.guardarLocal();
    this.alTerminar();
  }

  /* ---- Una escena ------------------------------------------------------- */

  async correrEscena(id) {
    const def = this.guion.escenas[id];
    const esWashout = def.tipo === 'washout';

    // Los tiempos de calma comparten la definición de la plantilla `washout`.
    // Los que llevan pulso de sincronía (W2 y W4) le agregan la marca al final,
    // después de que cerró el tramo neutro, para no contaminarlo con el flash.
    let escena;
    if (esWashout) {
      escena = Object.assign({}, this.guion.washout, def, { id: id });
      escena.marcas = this.guion.washout.marcas.slice();
      // Una calma con `base: true` (W0) es la línea base: el mismo tramo
      // neutro, pero registrado como cara en reposo.
      if (def.base) {
        escena.marcas = escena.marcas.map((m) =>
          m.tipo === 'neutra_inicio' ? Object.assign({}, m, { tipo: 'base_inicio' }) :
          m.tipo === 'neutra_fin' ? Object.assign({}, m, { tipo: 'base_fin' }) : m);
      }
      if (def.sync && this.pulsosSync) {
        escena.marcas.push({
          t: this.guion.washout.sync_t, tipo: 'sync', n: def.sync
        });
      }
    } else {
      escena = Object.assign({}, def, { id: id });
    }

    this.escenaActual = escena;
    this.ramaElegida = null;
    this.crono.reiniciar();

    // Cada escena parte limpia: sin viñeta y con el fondo sonoro normal.
    this.dom.escenario.classList.remove('vineta', 'con-musica');
    Sonido.ambienteNivel(1, 0.8);
    Sonido.musica(false);
    this.videoActivo = false;

    this.detectorToques.ubicar(id, esWashout ? 'washout' : 'escena');
    this.pintarFondo(escena);
    if (escena.imagen) this.mostrarImagen(escena.imagen);
    else this.ocultarImagen();

    this.registro.emitir('media', 'escena_inicio', id, 'sistema', {
      tipo: escena.tipo,
      duracion_prevista_ms: escena.duracion_ms,
      modo_media: this.modoMedia
    });

    if (this.modoMedia === 'video') await this.arrancarVideo(escena);

    // Marcas ordenadas por tiempo, con un puntero al siguiente pendiente.
    const marcas = (escena.marcas || []).slice().sort((a, b) => a.t - b.t);
    let siguiente = 0;

    this.crono.arrancar();

    while (true) {
      if (this.abortar) break;
      const t = this.crono.ms();

      while (siguiente < marcas.length && marcas[siguiente].t <= t) {
        const marca = marcas[siguiente++];
        await this.ejecutarMarca(escena, marca);
        if (this.abortar) break;
      }

      if (this.crono.ms() >= escena.duracion_ms) break;
      await this.frame();
    }

    this.crono.detener();
    if (this.modoMedia === 'video') this.detenerVideo();

    // Si la escena terminó con un tramo neutro abierto, se cierra igual.
    if (this.registro.neutraActual && this.registro.neutraActual.hasta === null) {
      this.registro.cerrarNeutra();
    }

    this.registro.emitir('media', 'escena_fin', id, 'sistema', {
      duracion_real_ms: Math.round(this.crono.ms() / this.v)
    });
  }

  /* ---- Qué hacer con cada tipo de marca --------------------------------- */

  async ejecutarMarca(escena, marca) {
    this.aplicarPresentacion(marca);

    switch (marca.tipo) {

      case 'beat': {
        const b = this.resolverRama(marca);
        if (!b) break;
        if (b.texto) this.dom.narracion.textContent = I18n.t(b.texto);
        if (b.emoji) this.dom.emoji.textContent = b.emoji;
        if (b.gesto) Sonido.gesto(b.gesto);
        // `solo_sin_video`: la frase ya viene dentro del video, así que la
        // app solo la dice cuando no hay video (modo placeholder).
        if (b.voz && !(b.solo_sin_video && this.videoActivo)) {
          // Si la frase cae justo en el borde de una ventana, espera un
          // instante a que se cierre en vez de perderse.
          if (Sonido.vozBloqueada) await this.esperarVozLibre(escena.id, 'beat', 600);
          this.decir(escena.id, I18n.t(b.voz), 'beat', b.hablante);
        }
        break;
      }

      case 'voz_video': {
        // La voz viene dentro del video: la app no la dice, pero queda en
        // el JSON cuándo empieza y termina, igual que sus propias voces.
        if (!this.videoActivo) break;
        const base = {
          texto: I18n.t(marca.texto), hablante: marca.hablante || 'puki',
          contexto: 'video', fuente: 'video'
        };
        this.registro.emitir('estimulo', 'voz_inicio', escena.id, 'sistema', base);
        setTimeout(() => this.registro.emitir('estimulo', 'voz_fin', escena.id, 'sistema', base),
          (marca.hasta - marca.t) / this.v);
        break;
      }

      case 'sync': {
        if (!this.pulsosSync) break;
        this.crono.detener();
        const datos = await pulsoSync(this.reloj, {});
        datos.n = marca.n;
        this.registro.emitir('sistema', 'pulso_sync', escena.id, 'sistema', datos);
        this.crono.arrancar();
        break;
      }

      case 'base_inicio':
        this.registro.abrirNeutra(escena.id + '_neutra', escena.id);
        this.registro.emitir('estimulo', 'linea_base_inicio', escena.id, 'sistema', {});
        this.detectorToques.ubicar(escena.id, 'linea_base');
        break;

      case 'base_fin':
        this.registro.emitir('estimulo', 'linea_base_fin', escena.id, 'sistema', {});
        this.registro.cerrarNeutra();
        this.detectorToques.ubicar(escena.id, 'escena');
        break;

      case 'neutra_inicio':
        this.registro.abrirNeutra(escena.id + '_neutra', escena.id);
        this.registro.emitir('estimulo', 'washout_inicio', escena.id, 'sistema', {});
        break;

      case 'neutra_fin':
        this.registro.emitir('estimulo', 'washout_fin', escena.id, 'sistema', {});
        this.registro.cerrarNeutra();
        break;

      case 'climax': {
        // Una escena puede tener varias ventanas (`climaxes`); `cual` elige.
        const clim = marca.cual ? (escena.climaxes || {})[marca.cual] : escena.climax;
        this.dispararClimax(escena, clim, null, marca.gesto);
        break;
      }

      case 'resolucion':
        this.dispararClimax(escena, escena.resolucion, 'resolucion_emocional', marca.gesto);
        break;

      case 'decision':
        this.crono.detener();
        await this.mostrarDecision(escena, marca.decision_id);
        this.crono.arrancar();
        break;

      case 'toque_objeto':
        this.crono.detener();
        await this.esperarObjeto(escena, marca);
        this.crono.arrancar();
        break;

      case 'escucha':
        // La ventana de escucha empieza cuando Puki terminó de hablar, no antes.
        this.crono.detener();
        await this.esperarSilencio();
        this.crono.arrancar();
        this.abrirEscucha(escena, marca);
        break;

      case 'minitarea':
        this.crono.detener();
        await this.correrMinitarea(escena, marca.rondas);
        this.crono.arrancar();
        break;

      case 'reparto':
        this.crono.detener();
        await this.correrReparto(escena);
        this.crono.arrancar();
        break;

      default:
        console.warn('Marca desconocida:', marca.tipo);
    }
  }

  /* Lo que cualquier marca puede cambiar en pantalla o en el sonido. */
  aplicarPresentacion(marca) {
    if (marca.emoji) this.dom.emoji.textContent = marca.emoji;
    if (marca.imagen) this.mostrarImagen(marca.imagen);
    if (marca.vineta !== undefined) this.dom.escenario.classList.toggle('vineta', !!marca.vineta);
    if (marca.ambiente !== undefined) Sonido.ambienteNivel(marca.ambiente);
    if (marca.musica !== undefined) {
      Sonido.musica(!!marca.musica, marca.corte_seco);
      // Mientras suena la música, la imagen salta al ritmo (el baile).
      this.dom.escenario.classList.toggle('con-musica', !!marca.musica);
    }
  }

  /* Un beat puede ser igual para todos o depender de la opción elegida. Si
     depende y la rama elegida no tiene nada en ese momento, no pasa nada. */
  resolverRama(marca) {
    if (marca.por_rama) {
      const r = marca.por_rama[this.ramaElegida];
      return r ? Object.assign({}, r) : null;
    }
    if (marca.texto_por_rama) {
      return Object.assign({}, marca, {
        texto: marca.texto_por_rama[this.ramaElegida] || Object.values(marca.texto_por_rama)[0]
      });
    }
    return marca;
  }

  dispararClimax(escena, clim, nombreEvento, gesto, extra) {
    if (!clim) return;

    /* Nadie habla durante la ventana de análisis. Si Puki hablara justo acá,
       el niño estaría mirándole la boca en vez de reaccionando a la historia, y
       lo que leería la cámara sería atención, no emoción. Regla de DN-09. */
    const cfg = this.guion.ventana || { despues_ms: 5000 };
    const ventana = clim.ventana_ms || cfg.despues_ms;
    Sonido.bloquearVoz(true, 'ventana ' + clim.id);
    setTimeout(() => Sonido.bloquearVoz(false), ventana / this.v);

    // El gesto sonoro SÍ suena: no es lenguaje, es parte del estímulo.
    if (gesto) Sonido.gesto(gesto);

    this.registro.registrarClimax(escena.id, clim, extra);
    if (nombreEvento === 'resolucion_emocional') {
      this.registro.emitir('estimulo', 'resolucion_emocional', escena.id, 'sistema', {
        climax_id: clim.id, emocion_esperada: clim.emocion
      });
    }
    this.detectorToques.ubicar(escena.id, 'post_climax');
    if (clim.emoji) this.dom.emoji.textContent = clim.emoji;

    /* La imagen del momento de medición queda QUIETA mientras dura la
       ventana: el fondo vivo se detiene, para que todos los niños vean
       exactamente lo mismo. */
    if (clim.imagen) this.mostrarImagen(clim.imagen, true);
    if (this.dom.fondo) {
      this.dom.fondo.classList.add('quieto');
      clearTimeout(this._tQuieto);
      this._tQuieto = setTimeout(() => this.dom.fondo.classList.remove('quieto'), ventana / this.v);
    }
    this.dom.narracion.textContent = clim.texto ? I18n.t(clim.texto) : clim.descripcion;
    this.mostrarMarcadorVentana(clim, ventana);
  }

  /* Marcador discreto en la esquina, para que quien revisa el prototipo vea
     cuándo está abierta una ventana. No es un estímulo para el niño. */
  mostrarMarcadorVentana(clim, ventana) {
    const b = this.dom.ventanaBadge;
    if (!b) return;
    b.textContent = `${I18n.t('ui.ventana')} · ${I18n.t('rv.emo.' + clim.emocion, clim.emocion)} · ${(ventana / 1000).toFixed(1)} s`;
    b.classList.add('visible');
    clearTimeout(this._tBadge);
    this._tBadge = setTimeout(() => b.classList.remove('visible'), ventana / this.v);
  }

  /* ---- Voz -------------------------------------------------------------- */

  /* Un personaje habla. Queda registrado cuándo EMPIEZA y cuándo TERMINA de
     sonar: el equipo de Brasil necesita saber cuándo el niño estaba
     escuchando, porque en esos tramos la cara responde al habla y no al
     estímulo emocional. */
  decir(escena_id, texto, contexto, hablante, alTerminar, extra) {
    const quien = hablante || 'puki';
    const vozGuion = (this.guion.voces && this.guion.voces[quien]) || {};
    // Con la velocidad de revisión la voz también se apura, pero poco (tope
    // ×1,5): más rápido ya no se entiende.
    const voz = this.v > 1
      ? Object.assign({}, vozGuion, { rate: (vozGuion.rate || 0.88) * Math.min(this.v, 1.5) })
      : vozGuion;
    const base = Object.assign({ texto: texto, hablante: quien, contexto: contexto || null },
      extra || {});

    const sono = Sonido.hablar(texto, voz, (fase, detalle) => {
      if (fase === 'inicio') {
        this.registro.emitir('estimulo', 'voz_inicio', escena_id, 'sistema', base);
        return;
      }
      if (fase === 'fin') {
        this.registro.emitir('estimulo', 'voz_fin', escena_id, 'sistema', base);
      } else {
        this.registro.emitir('estimulo', 'voz_interrumpida', escena_id, 'sistema',
          Object.assign({ motivo: detalle || null }, base));
      }
      if (alTerminar) alTerminar();
    });

    if (!sono) {
      this.registro.emitir('estimulo', 'voz_omitida', escena_id, 'sistema',
        Object.assign({ motivo: Sonido.motivoBloqueo || 'sin voz disponible' }, base));
    }
    return sono;
  }

  /* Como decir(), pero devuelve una promesa que se cumple cuando la frase
     termina. Tiene un respaldo por tiempo: algunos navegadores a veces no
     avisan que la voz terminó, y la sesión no puede quedarse esperando. */
  decirYEsperar(escena_id, texto, contexto, hablante, extra) {
    return new Promise((resolver) => {
      let listo = false;
      const fin = () => { if (!listo) { listo = true; resolver(); } };
      const sono = this.decir(escena_id, texto, contexto, hablante, fin, extra);
      if (!sono) { fin(); return; }
      /* Sin dividir por la velocidad de revisión: la voz siempre habla a
         ritmo normal. Si el respaldo se acortara, el botón iluminado se
         adelantaría a lo que Puki está leyendo. */
      const palabras = texto.split(/\s+/).length;
      setTimeout(fin, palabras * 550 + 2500);
    });
  }

  /* Para lo que NO se puede perder (la lectura de las opciones): si hay una
     ventana abierta, espera a que se cierre en vez de descartarse. */
  async esperarVozLibre(escena_id, contexto, tope_ms) {
    const tope = tope_ms || 7000;
    const t0 = this.reloj.ms();
    while (Sonido.vozBloqueada && (this.reloj.ms() - t0) < tope) {
      await this.esperar(120);
    }
    const espera = Math.round(this.reloj.ms() - t0);
    if (espera > 150) {
      this.registro.emitir('sistema', 'voz_postergada', escena_id, 'sistema', {
        contexto: contexto || null, espera_ms: espera
      });
    }
  }

  /* Espera a que nadie esté hablando (con tope), para que una pregunta o una
     ventana de escucha no se monte sobre la frase anterior. */
  async esperarSilencio(tope_ms) {
    const tope = tope_ms || 9000;
    const t0 = performance.now();
    while (Sonido.hablando() && performance.now() - t0 < tope) {
      await this.esperar(100);
    }
  }

  /* ---- Decisiones ------------------------------------------------------- */

  async mostrarDecision(escena, decision_id) {
    const dec = escena.decisiones[decision_id];

    /* Cuántas opciones se muestran. Con niños de 4 años tres opciones pueden
       ser mucha carga; el parámetro permite bajarlo sin tocar el guion. */
    const tope = this.guion.max_opciones || dec.opciones.length;
    const opciones = dec.opciones.slice(0, tope);
    const hablante = dec.hablante;

    await this.esperarSilencio();
    const volver = this.mirarAlNino();

    return new Promise((resolver) => {
      const panel = this.dom.opciones;
      panel.innerHTML = '';

      const pregunta = document.createElement('p');
      pregunta.className = 'pregunta';
      pregunta.textContent = I18n.t(dec.pregunta);
      panel.appendChild(pregunta);

      const fila = document.createElement('div');
      fila.className = 'fila-opciones';
      panel.appendChild(fila);

      let listo = false;
      let repreguntas = 0;
      let t_fin_lectura = null;
      const timers = [];
      const t_mostradas = this.reloj.ms();

      const terminar = (op, porDefecto, e) => {
        if (listo) return;
        listo = true;
        timers.forEach(clearTimeout);

        const ahora = this.reloj.ms();
        const datos = {
          decision_id: decision_id,
          opcion_id: op.id,
          opcion_indice: opciones.indexOf(op),
          latencia_ms: Math.round(ahora - t_mostradas),
          latencia_desde_fin_lectura_ms:
            t_fin_lectura === null ? null : Math.round(ahora - t_fin_lectura),
          repreguntas: repreguntas,
          hipotesis_mapeo_sdq: op.sdq || [],
          nota_interpretativa: 'Hipótesis de mapeo exploratoria, no es un puntaje SDQ (DN-23).'
        };

        if (porDefecto) {
          this.registro.emitir('interaccion', 'opcion_por_defecto', escena.id, 'sistema', datos);
        } else {
          datos.cambios_antes_de_confirmar = 0;
          datos.posicion_toque = e ? [Math.round(e.clientX), Math.round(e.clientY)] : null;
          this.registro.emitir('interaccion', 'opcion_elegida', escena.id, 'tactil', datos);
        }

        // Si el niño eligió antes de que Puki terminara de leer, se corta.
        Sonido.callar();
        this.ramaElegida = op.id;
        this.registro.emitir('media', 'rama_inicio', escena.id, 'sistema', {
          rama: op.id, por_defecto: !!porDefecto
        });
        panel.classList.remove('visible');
        panel.innerHTML = '';
        volver();
        this.detectorToques.ubicar(escena.id, 'escena');
        resolver(op.id);
      };

      const botones = opciones.map((op) => {
        const btn = document.createElement('button');
        btn.className = 'opcion interactivo';
        btn.setAttribute('aria-label', I18n.t(op.texto));
        btn.innerHTML =
          `<span class="op-dibujo">${Dibujos.html(op.dibujo, op.emoji)}</span>` +
          `<span class="op-texto">${I18n.t(op.texto)}</span>`;
        btn.addEventListener('click', (e) => terminar(op, false, e));
        fila.appendChild(btn);
        return btn;
      });

      panel.classList.add('visible');
      this.detectorToques.ubicar(escena.id, 'decision');

      this.registro.emitir('interaccion', 'opciones_mostradas', escena.id, 'sistema', {
        decision_id: decision_id,
        opciones: opciones.map((o) => o.id),
        opciones_definidas: dec.opciones.length,
        opciones_mostradas: opciones.length
      });

      /* Puki lee la pregunta y después cada opción por separado, como hace
         Dora, y el botón que está leyendo se ilumina (DN-33). Es la única
         forma de que un niño de 4 años, que no lee, sepa qué dibujo es cada
         opción. Esta lectura ESPERA si hay una ventana abierta, en vez de
         omitirse.

         Si el niño no toca nada, Puki repite la pregunta y después la historia
         sigue con la opción por defecto, para que la sesión nunca quede
         bloqueada. Los tiempos se cuentan desde que terminó la lectura. */
      const leer = async (contexto) => {
        await this.decirYEsperar(escena.id, I18n.t(dec.pregunta), contexto, hablante);
        for (let i = 0; i < opciones.length && !listo; i++) {
          botones[i].classList.add('leyendo');
          await this.decirYEsperar(escena.id, I18n.t(opciones[i].voz || opciones[i].texto),
            contexto, hablante, { opcion_id: opciones[i].id });
          botones[i].classList.remove('leyendo');
        }
      };

      this.esperarVozLibre(escena.id, 'opciones')
        .then(() => (listo ? null : leer('opciones')))
        .then(() => {
          if (listo) return;
          t_fin_lectura = this.reloj.ms();
          const inac = Object.assign({ repregunta_ms: 11000, auto_ms: 24000 },
            this.guion.inactividad || {}, dec.inactividad || {});

          // Modo demo: el niño simulado elige según su perfil.
          if (this.demo) {
            const i = opciones.findIndex((o) => o.id === (this.demo.decisiones || {})[decision_id]);
            if (i >= 0) timers.push(setTimeout(() => { if (!listo) this.demoTocar(botones[i]); },
              (this.demo.demora_ms || 2500) / this.v));
          }

          timers.push(setTimeout(() => {
            if (listo) return;
            repreguntas++;
            this.registro.emitir('interaccion', 'repregunta_inactividad', escena.id, 'sistema', {
              decision_id: decision_id, ms_sin_respuesta: inac.repregunta_ms
            });
            if (dec.repregunta) this.decir(escena.id, I18n.t(dec.repregunta), 'repregunta', hablante);
            else leer('repregunta');
          }, inac.repregunta_ms / this.v));

          timers.push(setTimeout(() => {
            if (listo) return;
            const op = opciones.find((o) => o.id === dec.defecto) || opciones[0];
            terminar(op, true);
          }, inac.auto_ms / this.v));
        });
    });
  }

  /* ---- Objeto que el niño toca (la caja, la gorra) ---------------------- */

  async esperarObjeto(escena, marca) {
    await this.esperarSilencio();

    const n = marca.toques || 1;
    /* `voluntario: true`: nadie le pide al niño que toque (ej. la pelota de
       Tobi). No hay repregunta, y a los `espera_ms` la historia sigue sola.
       Lo que pasa después depende de si tocó (`rama_si`) o no (`rama_no`). */
    const inac = marca.voluntario
      ? { repregunta_ms: Infinity, auto_ms: marca.espera_ms || 8000 }
      : Object.assign({ repregunta_ms: 11000, auto_ms: 24000 }, this.guion.inactividad || {});
    const panel = this.dom.objeto;
    const t_mostrado = this.reloj.ms();

    /* `pantalla`: el objeto es una imagen a pantalla completa (la caja vista
       desde arriba, entre las patitas de Puki). Se toca en cualquier parte y
       se sacude la imagen entera. */
    const contenido = marca.pantalla
      ? `<img class="obj-pantalla" src="${marca.pantalla}" alt="">` +
        (marca.pantalla_capa ? `<img class="obj-pantalla obj-capa" src="${marca.pantalla_capa}" alt="">` : '')
      : `<span class="obj-emoji">${Dibujos.html(marca.dibujo, marca.emoji || '❔')}</span>`;
    panel.innerHTML =
      `<button class="objeto-tocable interactivo">${contenido}` +
      `<span class="obj-texto">${I18n.t(marca.texto || '')}</span></button>` +
      `<p class="obj-nota"></p>`;
    panel.classList.add('visible');
    /* `grande: true`: el objeto llena la pantalla (la caja de la tierra), sin
       tarjeta, y se sacude cada vez más fuerte con cada toque. */
    panel.classList.toggle('grande', !!marca.grande && !marca.pantalla);
    panel.classList.toggle('pantalla', !!marca.pantalla);
    const btn = panel.querySelector('button');
    const nota = panel.querySelector('.obj-nota');
    this.detectorToques.ubicar(escena.id, 'objeto');

    this.registro.emitir('interaccion', 'objeto_mostrado', escena.id, 'sistema', {
      objeto_id: marca.objeto, toques_requeridos: n
    });

    let completadoPor = 'nino';
    for (let i = 1; i <= n; i++) {
      const t_pedido = this.reloj.ms();
      if (this.demo) {
        const cfg = (this.demo.objetos || {})[marca.objeto] || {};
        if (!(marca.voluntario && cfg.tocar === false)) {
          // Espera a que Puki termine de hablar, para no cortarle la frase.
          setTimeout(async () => { await this.esperarSilencio(6000); this.demoTocar(btn); },
            (i === 1 ? (cfg.primer_toque_ms || 2000) : 900) / this.v);
        }
      }
      const r = await this.esperarToqueObjeto(btn, escena, marca, inac);

      if (r.tipo === 'auto') {
        completadoPor = 'automatico';
        if (!marca.voluntario) this.registro.emitir('interaccion', 'sin_respuesta_timeout', escena.id, 'sistema', {
          objeto_id: marca.objeto, toques_hechos: i - 1, timeout_ms: inac.auto_ms
        });
        break;
      }

      this.registro.emitir('interaccion', 'toque_objeto', escena.id, 'tactil', {
        objeto_id: marca.objeto,
        n: i,
        de: n,
        latencia_ms: Math.round(this.reloj.ms() - t_pedido),
        posicion_toque: [Math.round(r.e.clientX), Math.round(r.e.clientY)]
      });

      const efecto = (marca.por_toque || [])[i - 1] || {};
      if (efecto.vibrar) this.vibrar(efecto.vibrar, escena.id, marca.objeto);
      if (efecto.gesto) Sonido.gesto(efecto.gesto);
      if (efecto.texto) {
        this.dom.narracion.textContent = I18n.t(efecto.texto);
        nota.textContent = I18n.t(efecto.texto);
      }
      if (efecto.voz && i < n) this.decir(escena.id, I18n.t(efecto.voz), 'toque_objeto', efecto.hablante);

      btn.classList.remove('golpe');
      void btn.offsetWidth;   // reinicia la animación
      btn.classList.add('golpe');
      btn.dataset.toques = i;
    }

    panel.classList.remove('visible', 'grande', 'pantalla');
    panel.innerHTML = '';
    this.detectorToques.ubicar(escena.id, 'escena');

    this.registro.emitir('interaccion', 'objeto_completado', escena.id, 'sistema', {
      objeto_id: marca.objeto,
      completado_por: completadoPor,
      voluntario: !!marca.voluntario,
      duracion_ms: Math.round(this.reloj.ms() - t_mostrado),
      hipotesis_mapeo_sdq: marca.sdq || []
    });

    if (marca.voluntario) {
      this.ramaElegida = completadoPor === 'nino' ? marca.rama_si : marca.rama_no;
      this.registro.emitir('media', 'rama_inicio', escena.id, 'sistema', {
        rama: this.ramaElegida, por_defecto: completadoPor !== 'nino'
      });
    }

    if (marca.climax_al_completar) {
      this.dispararClimax(escena, escena.climax, null, marca.gesto_climax, {
        disparado_por: completadoPor === 'nino' ? 'toque_nino' : 'automatico'
      });
    }
  }

  /* Espera un toque en el objeto. A los `repregunta_ms` Puki repite la
     invitación; a los `auto_ms` la historia sigue sola. */
  esperarToqueObjeto(btn, escena, marca, inac) {
    return new Promise((resolver) => {
      let listo = false;
      const al = (e) => {
        if (listo) return;
        listo = true;
        clearTimeout(t1); clearTimeout(t2);
        btn.removeEventListener('click', al);
        btn.classList.remove('llamativo');
        resolver({ tipo: 'toque', e: e });
      };
      const t1 = inac.repregunta_ms === Infinity ? null : setTimeout(() => {
        if (listo) return;
        this.registro.emitir('interaccion', 'repregunta_inactividad', escena.id, 'sistema', {
          objeto_id: marca.objeto, ms_sin_respuesta: inac.repregunta_ms
        });
        if (marca.voz_repregunta) this.decir(escena.id, I18n.t(marca.voz_repregunta), 'repregunta');
        btn.classList.add('llamativo');
      }, inac.repregunta_ms / this.v);
      const t2 = setTimeout(() => {
        if (listo) return;
        listo = true;
        btn.removeEventListener('click', al);
        resolver({ tipo: 'auto' });
      }, inac.auto_ms / this.v);
      btn.addEventListener('click', al);
    });
  }

  /* Vibración. Queda registrado si el dispositivo la soporta: Safari en iPad
     no implementa la vibración web, y eso hay que saberlo al mirar los datos. */
  vibrar(patron, escena_id, contexto) {
    const soportada = typeof navigator.vibrate === 'function';
    let ejecutada = false;
    if (soportada) {
      try { ejecutada = navigator.vibrate(patron); } catch (e) { ejecutada = false; }
    }
    this.registro.emitir('estimulo', 'vibracion', escena_id, 'sistema', {
      patron: patron, soportada: soportada, ejecutada: !!ejecutada, contexto: contexto || null
    });
  }

  /* ---- Ventana de escucha (voz o soplido del niño) ---------------------- */

  /* Hoy solo se MARCA la ventana en el JSON. El audio no se graba: queda
     pendiente de definir con el profesor guía (DN-26). */
  abrirEscucha(escena, marca) {
    const dur = marca.duracion_ms || 3000;
    this.registro.emitir('interaccion', 'ventana_voz_inicio', escena.id, 'sistema', {
      modo: marca.modo || 'habla',
      duracion_ms: dur,
      captura_audio: false,
      nota: 'Solo se marca la ventana; el audio no se graba (DN-26).'
    });
    if (marca.texto) this.dom.narracion.textContent = I18n.t(marca.texto);
    this.dom.escucha.classList.add('visible');
    this.detectorToques.ubicar(escena.id, 'escucha');

    setTimeout(() => {
      this.dom.escucha.classList.remove('visible');
      this.registro.emitir('interaccion', 'ventana_voz_fin', escena.id, 'sistema', {
        modo: marca.modo || 'habla'
      });
      this.detectorToques.ubicar(escena.id, 'escena');
    }, dur / this.v);
  }

  /* ---- Minitarea de la torre (escena de frustración) -------------------- */

  /* `indices` dice qué rondas se juegan en esta llamada. En el guion v2.2 la
     torre se juega en dos partes: rondas 1 y 2 (las dos caídas), después la
     respiración y la decisión, y al final la ronda 3 (el éxito). */
  async correrMinitarea(escena, indices) {
    const cfg = escena.minitarea;
    const rondas = indices || cfg.rondas.map((_, i) => i);
    const panel = this.dom.tarea;

    await this.esperarSilencio();
    panel.classList.add('visible');

    this.registro.emitir('interaccion', 'minitarea_inicio', escena.id, 'sistema', {
      tipo: cfg.tipo, bloques: cfg.bloques, rondas: rondas.map((i) => i + 1)
    });

    for (const r of rondas) {
      const ronda = cfg.rondas[r];
      const tope = ronda.cae_en > 0 ? ronda.cae_en : cfg.bloques;

      /* Cada piso de la torre puede ser un bloque distinto (`dibujos`, de
         abajo hacia arriba). El botón muestra el bloque que viene. */
      const nombreBloque = (b) => (cfg.dibujos && cfg.dibujos[b - 1]) || cfg.dibujo;
      const dibujoBloque = (b) => Dibujos.html(nombreBloque(b), '🧱');
      panel.innerHTML =
        `<p class="tarea-titulo">${I18n.t('tarea.toca_bloque')}</p>` +
        `<div class="torre" id="torre"></div>` +
        `<button class="bloque-fuente interactivo" id="bloqueFuente">${dibujoBloque(1)}</button>`;

      const torre = panel.querySelector('#torre');
      const fuente = panel.querySelector('#bloqueFuente');

      for (let b = 1; b <= tope; b++) {
        const t_pedido = this.reloj.ms();
        if (this.demo) setTimeout(async () => { await this.esperarSilencio(6000); this.demoTocar(fuente); },
          (this.demo.bloque_ms || 1400) / this.v);
        const resultado = await this.esperarToque(fuente, cfg.timeout_ayuda_ms / this.v);
        const latencia = this.reloj.ms() - t_pedido;

        this.registro.emitir('interaccion', 'bloque_colocado', escena.id,
          resultado === 'timeout' ? 'sistema' : 'tactil', {
            ronda: r + 1,
            bloque: b,
            latencia_ms: Math.round(latencia),
            colocado_por: resultado === 'timeout' ? 'puki_automatico' : 'nino'
          });

        Sonido.gesto('nota', b - 1);   // Do, Re, Mi, Fa, Sol
        const cubo = document.createElement('div');
        cubo.className = 'cubo cubo-' + nombreBloque(b);
        cubo.innerHTML = dibujoBloque(b);

        // El bloque baja despacito, y recién cuando se asienta se puede
        // poner el siguiente: así la torre no se arma a toques rápidos.
        fuente.disabled = true;
        torre.appendChild(cubo);
        await this.esperar(900);
        if (b < tope) fuente.innerHTML = dibujoBloque(b + 1);
        fuente.disabled = false;
      }

      if (ronda.cae_en > 0) {
        // La torre se cae.
        //
        // Se saca de la pantalla el botón del bloque ANTES de la espera. Si se
        // quedara, los toques del niño durante el derrumbe caerían sobre un
        // elemento marcado como `.interactivo` y el detector los descartaría:
        // se perderían justamente los toques impulsivos post-derrumbe, que son
        // la medida más informativa de esta escena.
        fuente.remove();

        if (ronda.voz_antes || ronda.gesto_antes) {
          if (ronda.voz_antes) this.decir(escena.id, I18n.t(ronda.voz_antes), 'minitarea', ronda.hablante_antes);
          Sonido.gesto(ronda.gesto_antes || 'pasos');
          await this.esperar(900);
        }
        if (ronda.causa === 'viento') {
          Sonido.gesto('viento');
          // Con el viento, la torre se tambalea antes de caer.
          torre.animate([
            { transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)' },
            { transform: 'rotate(3deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0deg)' }
          ], { duration: 600 / this.v, easing: 'ease-in-out' });
          await this.esperar(600);
        }

        Sonido.gesto('derrumbe');
        this.derrumbarTorre(torre, ronda.causa);
        panel.querySelector('.tarea-titulo').textContent =
          I18n.t(ronda.causa === 'viento' ? 'tarea.cayo_viento' : 'tarea.cayo_accidente');

        if (ronda.climax) {
          Sonido.ambienteNivel(0.1, 0.05);   // la música se corta en seco
          this.dispararClimax(escena, escena.climax, null, null, { disparado_por: 'minitarea' });
        }
        this.detectorToques.ubicar(escena.id, ronda.climax ? 'post_climax' : 'post_derrumbe');

        this.registro.emitir('estimulo', 'torre_derrumbada', escena.id, 'sistema', {
          ronda: r + 1, causa: ronda.causa, bloques_alcanzados: tope
        });

        if (ronda.voz_despues) {
          await this.esperar(900);
          this.decir(escena.id, I18n.t(ronda.voz_despues), 'minitarea');
        }

        // Ventana de toques impulsivos: la parte más informativa de la escena.
        await this.esperar(ronda.espera_ms || 3000);
        if (ronda.voz_despues) await this.esperarSilencio(5000);
        this.detectorToques.ubicar(escena.id, 'escena');
      } else {
        fuente.remove();
        panel.querySelector('.tarea-titulo').textContent = I18n.t('tarea.lograste');
        Sonido.gesto('fanfarria');
        this.registro.emitir('estimulo', 'torre_lograda', escena.id, 'sistema', {
          ronda: r + 1, bloques: tope
        });
        await this.esperar(2500);
      }
    }

    this.registro.emitir('interaccion', 'minitarea_fin', escena.id, 'sistema', {
      rondas: rondas.map((i) => i + 1)
    });
    panel.classList.remove('visible');
    panel.innerHTML = '';
  }

  /* La torre se cae: cada bloque sale volando por su lado, girando, y se
     desvanece al llegar al suelo (detrás queda la imagen de los bloques
     desparramados). Los recorridos son FIJOS, no física al azar: todos los
     niños ven exactamente la misma caída. Con el viento todo vuela hacia el
     mismo lado; en el choque, los bloques se reparten a ambos lados. */
  derrumbarTorre(torre, causa) {
    const cubos = [...torre.querySelectorAll('.cubo')];
    if (!cubos.length || typeof torre.animate !== 'function') {
      torre.classList.add('cae');
      return;
    }
    cubos.forEach((cubo, i) => {
      const lado = causa === 'viento' ? 1 : (i % 2 ? -1 : 1);
      const dx = lado * (90 + i * 55);
      const dy = 60 + (cubos.length - i) * 26;
      const giro = lado * (70 + i * 35);
      cubo.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * .45}px, ${-24 - i * 12}px) rotate(${giro * .4}deg)`, opacity: 1, offset: .35 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg)`, opacity: 1, offset: .8 },
        { transform: `translate(${dx * 1.05}px, ${dy}px) rotate(${giro}deg)`, opacity: 0 }
      ], { duration: 1300 / this.v, easing: 'cubic-bezier(.35, 0, .6, 1)', fill: 'forwards', delay: (cubos.length - 1 - i) * 40 / this.v });
    });
  }

  /* ---- Reparto de monedas (escena de la cajita) ------------------------- */

  /* Hay `monedas` en el centro, un destino a cada lado (Tobi a la izquierda,
     Lira a la derecha) y la caja al centro abajo. Cada toque en un destino le
     da una moneda; tocar la caja guarda las que quedan y termina. Todos los
     toques suenan igual, para no premiar ninguna opción. Si el niño deja de
     tocar, Puki dice "¡Listo!" y las que quedan van a la caja. */
  async correrReparto(escena) {
    const cfg = escena.reparto;
    const panel = this.dom.tarea;
    await this.esperarSilencio();
    const volver = this.mirarAlNino();

    const destinos = cfg.destinos;
    const dados = {};
    destinos.forEach((d) => { dados[d.id] = 0; });
    let quedan = cfg.monedas;
    const moneda = Dibujos.html(cfg.dibujo_moneda, '🟡');

    const boton = (d, clase) =>
      `<button class="rep-destino ${clase} interactivo" data-id="${d.id}">` +
      `<span class="rep-dibujo">${Dibujos.html(d.dibujo, d.emoji)}</span>` +
      `<span class="op-texto">${I18n.t(d.texto)}</span>` +
      `<span class="rep-pila"></span></button>`;

    panel.innerHTML =
      `<p class="pregunta">${I18n.t(cfg.pregunta_corta || cfg.pregunta)}</p>` +
      `<div class="rep-mesa">` +
        boton(destinos[0], 'izq') +
        `<div class="rep-centro">${Array.from({ length: cfg.monedas }, () =>
          `<span class="rep-moneda">${moneda}</span>`).join('')}</div>` +
        boton(destinos[1], 'der') +
      `</div>` +
      boton(cfg.guardar, 'abajo');
    panel.classList.add('visible');
    this.detectorToques.ubicar(escena.id, 'reparto');

    const t_mostrado = this.reloj.ms();
    this.registro.emitir('interaccion', 'reparto_inicio', escena.id, 'sistema', {
      monedas: cfg.monedas, destinos: destinos.map((d) => d.id), guardar: cfg.guardar.id
    });

    const botones = [...panel.querySelectorAll('.rep-destino')];
    const porId = (id) => botones.find((b) => b.dataset.id === id);
    const centro = panel.querySelector('.rep-centro');

    let listo = false;
    let leyendo = true;
    let t_fin_lectura = null;
    let ultimo = null;
    let timers = [];
    const limpiar = () => { timers.forEach(clearTimeout); timers = []; };

    return new Promise((resolver) => {
      const terminar = (motivo) => {
        if (listo) return;
        listo = true;
        limpiar();
        Sonido.callar();
        this.registro.emitir('interaccion', 'reparto_fin', escena.id, 'sistema', {
          terminado_por: motivo,
          por_destino: Object.assign({}, dados),
          guardadas: quedan,
          total_dadas: cfg.monedas - quedan,
          duracion_ms: Math.round(this.reloj.ms() - t_mostrado),
          hipotesis_mapeo_sdq: cfg.sdq || [],
          nota_interpretativa: 'Hipótesis de mapeo exploratoria, no es un puntaje SDQ (DN-23).'
        });
        const cerrar = () => {
          panel.classList.remove('visible');
          panel.innerHTML = '';
          volver();
          this.detectorToques.ubicar(escena.id, 'escena');
          resolver();
        };
        if (motivo === 'inactividad' && cfg.voz_listo) {
          centro.querySelectorAll('.rep-moneda:not(.ida)').forEach((m) => m.classList.add('a-caja'));
          this.decirYEsperar(escena.id, I18n.t(cfg.voz_listo), 'reparto')
            .then(() => this.esperar(600)).then(cerrar);
        } else {
          this.esperar(900).then(cerrar);
        }
      };

      /* Plazos: sin ningún toque, Puki repite la pregunta y después termina
         sola; con toques, termina tras `pausa_fin_ms` sin tocar. */
      const programar = () => {
        limpiar();
        if (listo || leyendo) return;
        const inac = Object.assign({ repregunta_ms: 11000, auto_ms: 24000 },
          this.guion.inactividad || {});
        if (ultimo === null) {
          timers.push(setTimeout(() => {
            if (listo) return;
            this.registro.emitir('interaccion', 'repregunta_inactividad', escena.id, 'sistema', {
              contexto: 'reparto', ms_sin_respuesta: inac.repregunta_ms
            });
            this.decir(escena.id, I18n.t(cfg.pregunta), 'repregunta');
          }, inac.repregunta_ms / this.v));
          timers.push(setTimeout(() => terminar('inactividad'), inac.auto_ms / this.v));
        } else {
          timers.push(setTimeout(() => terminar('inactividad'), (cfg.pausa_fin_ms || 8000) / this.v));
        }
      };

      botones.forEach((btn) => btn.addEventListener('click', (e) => {
        if (listo) return;
        const id = btn.dataset.id;
        const ahora = this.reloj.ms();
        const base = {
          destino: id,
          latencia_ms: Math.round(ahora - (ultimo !== null ? ultimo : t_mostrado)),
          antes_de_terminar_lectura: t_fin_lectura === null,
          posicion_toque: [Math.round(e.clientX), Math.round(e.clientY)]
        };
        ultimo = ahora;
        Sonido.gesto('moneda');
        btn.classList.remove('golpe'); void btn.offsetWidth; btn.classList.add('golpe');

        if (id === cfg.guardar.id) {
          this.registro.emitir('interaccion', 'reparto_guardar', escena.id, 'tactil',
            Object.assign(base, { guardadas: quedan }));
          centro.querySelectorAll('.rep-moneda:not(.ida)').forEach((m) => m.classList.add('a-caja'));
          terminar('caja');
          return;
        }
        if (quedan <= 0) return;
        quedan--;
        dados[id]++;
        const m = centro.querySelector('.rep-moneda:not(.ida)');
        if (m) m.classList.add('ida');
        btn.querySelector('.rep-pila')
          .insertAdjacentHTML('beforeend', `<span class="rep-moneda chica">${moneda}</span>`);
        this.registro.emitir('interaccion', 'moneda_dada', escena.id, 'tactil',
          Object.assign(base, { n_destino: dados[id], quedan: quedan }));
        if (quedan === 0) { terminar('agotadas'); return; }
        programar();
      }));

      /* Puki lee la pregunta y nombra cada destino; el que nombra se ilumina.
         El niño puede tocar mientras Puki lee. */
      const leer = async () => {
        await this.decirYEsperar(escena.id, I18n.t(cfg.pregunta), 'reparto');
        for (const d of [destinos[0], destinos[1], cfg.guardar]) {
          if (listo) break;
          const b = porId(d.id);
          b.classList.add('leyendo');
          await this.decirYEsperar(escena.id, I18n.t(d.voz || d.texto), 'reparto', null, { destino: d.id });
          b.classList.remove('leyendo');
        }
      };
      this.esperarVozLibre(escena.id, 'reparto').then(leer).then(() => {
        leyendo = false;
        t_fin_lectura = this.reloj.ms();
        programar();

        // Modo demo: los toques del reparto, uno tras otro.
        if (this.demo) {
          const seq = (this.demo.reparto || ['caja']).slice();
          const paso = async () => {
            if (listo || !seq.length) return;
            await this.esperarSilencio(6000);
            if (listo) return;
            this.demoTocar(porId(seq.shift()));
            setTimeout(paso, 1100 / this.v);
          };
          setTimeout(paso, 1500 / this.v);
        }
      });
    });
  }

  /* Espera un toque, o se rinde a los `timeout` ms y sigue sola.
     Nadie se queda atascado en la minitarea. */
  esperarToque(elemento, timeout) {
    return new Promise((resolver) => {
      let listo = false;
      const alTocar = () => {
        if (listo) return;
        listo = true;
        clearTimeout(reloj);
        elemento.removeEventListener('click', alTocar);
        resolver('toque');
      };
      const reloj = setTimeout(() => {
        if (listo) return;
        listo = true;
        elemento.removeEventListener('click', alTocar);
        this.registro.emitir('interaccion', 'sin_respuesta_timeout',
          this.escenaActual.id, 'sistema', { timeout_ms: Math.round(timeout * this.v) });
        resolver('timeout');
      }, timeout);
      elemento.addEventListener('click', alTocar);
    });
  }

  /* ---- Presentación ----------------------------------------------------- */

  pintarFondo(escena) {
    const ph = escena.placeholder || {};
    this.dom.escenario.style.setProperty('--fondo-escena', ph.fondo || '#eef2f5');
    this.dom.escenario.style.setProperty('--acento-escena', ph.acento || '#8fa8bb');
    this.dom.emoji.textContent = ph.emoji || '·';
    this.dom.titulo.textContent = I18n.t(escena.titulo);
    this.dom.narracion.textContent = '';
  }

  /* Imagen de fondo de la escena. Dos capas que se alternan, para pasar de
     una imagen a otra con un fundido. `inmediato`: sin fundido (los momentos
     de medición empiezan justo en su segundo). Una imagen vertical (la
     sombra de la bodega) se muestra completa sobre una copia difuminada de
     sí misma, en vez de recortarse. */
  mostrarImagen(src, inmediato) {
    const fondo = this.dom.fondo;
    if (!fondo || !src || src === this.imagenActual) return;
    this.imagenActual = src;
    const escena_id = this.escenaActual ? this.escenaActual.id : null;

    const pre = new Image();
    pre.onload = () => {
      if (this.imagenActual !== src) return;   // ya se pidió otra
      const capas = fondo.querySelectorAll('.capa-fondo');
      this._capa = this._capa ? 0 : 1;
      const sig = capas[this._capa];
      const ant = capas[this._capa ? 0 : 1];
      const img = sig.querySelector('img');
      img.src = src;
      sig.querySelector('.difuso').style.backgroundImage = `url("${src}")`;
      sig.classList.toggle('contener', pre.naturalWidth / pre.naturalHeight < 1.3);
      // El movimiento lento parte de cero con cada imagen nueva.
      img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
      sig.classList.toggle('sin-fundido', !!inmediato);
      ant.classList.toggle('sin-fundido', !!inmediato);
      sig.classList.add('activa');
      ant.classList.remove('activa');
      this.dom.escenario.classList.add('con-imagen');
      this.registro.emitir('media', 'imagen_mostrada', escena_id, 'sistema', {
        src: src, momento_medicion: !!inmediato
      });
    };
    pre.onerror = () => {
      if (this.imagenActual === src) this.imagenActual = null;
      this.registro.emitir('media', 'imagen_no_disponible', escena_id, 'sistema', { src: src });
    };
    pre.src = src;
  }

  /* Cuando Puki pregunta, se ve a Puki mirando al niño, tranquilo, esperando
     su respuesta (guion.imagen_pregunta), y las opciones aparecen abajo.
     Devuelve la función que vuelve a la imagen de la escena. */
  mirarAlNino() {
    const src = this.guion.imagen_pregunta;
    if (!src) return () => {};
    const previa = this.imagenActual;
    this.mostrarImagen(src);
    this.dom.escenario.classList.add('preguntando');
    return () => {
      this.dom.escenario.classList.remove('preguntando');
      if (previa && this.imagenActual === src) this.mostrarImagen(previa);
    };
  }

  ocultarImagen() {
    const fondo = this.dom.fondo;
    if (!fondo) return;
    this.imagenActual = null;
    fondo.querySelectorAll('.capa-fondo').forEach((c) => c.classList.remove('activa'));
    this.dom.escenario.classList.remove('con-imagen');
  }

  /* Carga todas las imágenes del guion al empezar, para que ninguna llegue
     tarde a su segundo (sobre todo las de los momentos de medición). */
  precargarImagenes() {
    const srcs = new Set();
    const juntar = (o) => {
      if (!o || typeof o !== 'object') return;
      if (typeof o.imagen === 'string') srcs.add(o.imagen);
      Object.values(o).forEach(juntar);
    };
    juntar(this.guion.escenas);
    juntar(this.guion.washout);
    if (this.guion.imagen_pregunta) srcs.add(this.guion.imagen_pregunta);
    this._precarga = [...srcs].map((s) => { const i = new Image(); i.src = s; return i; });
  }

  /* Modo demo: toca un elemento como lo haría un niño. Se ve un círculo
     donde "cae el dedo", y el click lleva coordenadas reales, igual que un
     toque de verdad. */
  demoTocar(el) {
    if (!el || !el.isConnected || el.disabled) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dedo = document.createElement('div');
    dedo.className = 'demo-dedo';
    dedo.style.left = x + 'px';
    dedo.style.top = y + 'px';
    document.body.appendChild(dedo);
    setTimeout(() => dedo.remove(), 900);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  }

  async arrancarVideo(escena) {
    if (!escena.video) return;   // escena sin video: queda la imagen o el placeholder
    const v = this.dom.video;
    v.src = escena.video;
    // Un video más corto que la escena puede repetirse (`video_bucle`), y
    // uno cuyo audio no sirve puede ir sin sonido (`video_silenciado`).
    // Con la velocidad de revisión (?velocidad= o el botón), el video también.
    v.defaultPlaybackRate = v.playbackRate = this.v;
    v.loop = !!escena.video_bucle;
    v.muted = !!escena.video_silenciado;
    try {
      await v.play();
      // Recién acá se muestra: si el archivo no existe, `play()` falla y el
      // video nunca tapa el placeholder.
      v.classList.add('visible');
      this.videoActivo = true;
      this.registro.emitir('media', 'media_play', escena.id, 'sistema', { src: escena.video });
    } catch (e) {
      v.classList.remove('visible');
      v.removeAttribute('src');
      // No es un error: la escena todavía no tiene video y sigue con el
      // placeholder. Queda registrado para saber qué vio el niño.
      this.registro.emitir('media', 'video_no_disponible', escena.id, 'sistema', {
        src: escena.video,
        detalle: String(e)
      });
    }
  }

  detenerVideo() {
    const v = this.dom.video;
    this.videoActivo = false;
    v.pause();
    v.classList.remove('visible');
    v.removeAttribute('src');
  }

  /* ---- Utilidades ------------------------------------------------------- */

  /* Un tic del bucle de la escena.

     Usa setTimeout y NO requestAnimationFrame a propósito. requestAnimationFrame
     se detiene por completo cuando la pantalla se apaga o la pestaña pasa a
     segundo plano: si eso ocurre a mitad de sesión, el guion se congela y no
     vuelve solo. setTimeout sigue corriendo (más lento, pero corre).

     La precisión no depende de esto: las marcas se disparan comparando contra
     el Cronometro, que mide tiempo real. */
  frame() {
    return new Promise((r) => setTimeout(r, 30));
  }

  esperar(ms) {
    return new Promise((r) => setTimeout(r, ms / this.v));
  }

  /* Salida anticipada. Si estamos en la escena de frustración, no se termina:
     se salta a la escena alegre. */
  pedirSalida() {
    const id = this.escenaActual ? this.escenaActual.id : null;
    this.registro.emitir('sistema', 'salida_anticipada', id, 'sistema', {
      escena_al_salir: id
    });
    Sonido.callar();
    if (id === 'E4_frustracion') {
      this.saltarAlFinal = true;
      this.crono.acumulado = this.escenaActual.duracion_ms / this.v;   // corta la escena
    } else {
      this.abortar = true;
    }
  }

  /* Botón de velocidad (para mostrar el prototipo). Acelera el reloj de
     escena y el video; la voz sigue a su ritmo. La sesión queda marcada como
     acelerada en el JSON y no sirve para análisis. */
  cambiarVelocidad(factor) {
    this.v = factor;
    this.crono.cambiarFactor(factor);
    const v = this.dom.video;
    v.defaultPlaybackRate = factor;   // para los videos que carguen después
    v.playbackRate = factor;
    const s = this.registro.sesion;
    s.velocidad_revision = Math.max(s.velocidad_revision || 1, factor);
    this.registro.emitir('sistema', 'velocidad_cambiada',
      this.escenaActual ? this.escenaActual.id : null, 'sistema', { velocidad: factor });
  }
}
