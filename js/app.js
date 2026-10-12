/* ---------------------------------------------------------------------------
   app.js — Arma todo y lo pone a andar.

   Cinco pantallas, en este orden:
     #inicio  → el adulto elige el idioma y comienza (lo técnico, escondido)
     #saludo  → Puki saluda; el niño (o el adulto) toca play
     #juego   → la sesión
     #cierre  → Puki se despide; un botón discreto lleva a los resultados
     #fin     → resultados para el adulto: código, cuestionario, detalle
--------------------------------------------------------------------------- */

window.PUKI_DEBUG = false;   // ponlo en true para ver los eventos en la consola

let reloj = null;
let registro = null;
let motor = null;
let idiomaElegido = 'es';
let codigoSesion = null;

/* Código automático de la sesión: P-AAAAMMDD-HHMM-XXX. La fecha y la hora
   permiten ordenar las sesiones; las 3 letras al azar evitan que dos
   sesiones que parten el mismo minuto queden con el mismo código. Sin
   letras que se confunden (O/0, I/1). Ningún dato de la persona. */
function generarCodigo() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let azar = '';
  for (let i = 0; i < 3; i++) azar += letras[Math.floor(Math.random() * letras.length)];
  return `P-${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-` +
         `${dos(d.getHours())}${dos(d.getMinutes())}-${azar}`;
}

const NOMBRES_IDIOMA = { es: 'Español', en: 'English', pt: 'Português' };

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === id));
}

const $ = (sel) => document.querySelector(sel);

const dom = {
  inicio:    null, juego: null, fin: null,
  escenario: null, emoji: null, titulo: null, narracion: null,
  opciones:  null, tarea: null, objeto: null, escucha: null,
  video: null, progreso: null, ventanaBadge: null, fondo: null
};

/* Velocidad de revisión: index.html?velocidad=3 acelera el guion para mirar
   el flujo completo en pocos minutos. Solo para revisar; queda marcado en el
   JSON y esa sesión no sirve para análisis. */
/* Modo demo: index.html?demo=tipico (o emocional, pares). El juego se juega
   solo con el perfil de guion.demo, y en una esquina aparece lo que se va
   registrando. Sirve para grabar el video; la sesión queda marcada como demo. */
function perfilDemo() {
  const id = new URLSearchParams(location.search).get('demo');
  const perfiles = (window.GUION.demo && window.GUION.demo.perfiles) || {};
  if (!id) return null;
  const nombre = perfiles[id] ? id : 'tipico';
  return perfiles[nombre] ? { nombre: nombre, perfil: perfiles[nombre] } : null;
}

function velocidadRevision() {
  const v = parseFloat(new URLSearchParams(location.search).get('velocidad'));
  return v > 0 && v <= 10 ? v : 1;
}

/* ---- Arranque ---------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  dom.inicio    = $('#inicio');
  dom.juego     = $('#juego');
  dom.fin       = $('#fin');
  dom.escenario = $('#escenario');
  dom.emoji     = $('#emoji');
  dom.titulo    = $('#tituloEscena');
  dom.narracion = $('#narracion');
  dom.opciones  = $('#opciones');
  dom.tarea     = $('#tarea');
  dom.objeto    = $('#objeto');
  dom.escucha   = $('#escucha');
  dom.video     = $('#video');
  dom.progreso  = $('#progreso');
  dom.ventanaBadge = $('#ventanaBadge');
  dom.fondo     = $('#fondo');

  // Idioma: un botón por cada diccionario que exista.
  const caja = $('#botonesIdioma');
  const marcar = () => caja.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.idioma === idiomaElegido)));
  ['es', 'en', 'pt'].filter((c) => I18n.disponibles().includes(c)).forEach((cod) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.idioma = cod;
    b.textContent = NOMBRES_IDIOMA[cod] || cod.toUpperCase();
    b.addEventListener('click', () => {
      idiomaElegido = cod;
      I18n.usar(cod);
      I18n.aplicar();
      document.documentElement.lang = cod;
      marcar();
    });
    caja.appendChild(b);
  });
  idiomaElegido = (window.GUION && window.GUION.idioma_inicial) || 'es';
  I18n.usar(idiomaElegido);
  document.documentElement.lang = idiomaElegido;
  marcar();

  codigoSesion = generarCodigo();
  $('#codigoInicio').textContent = codigoSesion;
  $('#inpParticipante').placeholder = codigoSesion;

  I18n.aplicar();

  // Comenzar (adulto) → Puki saluda → play (niño o adulto) → la sesión.
  $('#btnEmpezar').addEventListener('click', () => mostrarPantalla('saludo'));
  $('#btnJugar').addEventListener('click', empezar);
  $('#btnSalir').addEventListener('click', confirmarSalida);
  $('#btnPausa').addEventListener('click', () => Pausa.pausar());
  $('#btnContinuar').addEventListener('click', () => Pausa.reanudar());
  $('#btnResultados').addEventListener('click', mostrarResultados);
  $('#btnDescargar').addEventListener('click', () => registro && registro.descargar());
  $('#btnVerJson').addEventListener('click', verJson);
  $('#btnNueva').addEventListener('click', () => location.reload());
  $('#btnDetalle').addEventListener('click', () => {
    const d = $('#detalle');
    d.hidden = !d.hidden;
  });
  $('#btnCopiar').addEventListener('click', copiarCodigo);

  // Si la dirección trae ?desde= o ?velocidad=, se avisa en la pantalla de
  // inicio: son para revisar, y esa sesión no es la completa.
  const params = new URLSearchParams(location.search);
  const avisos = [];
  const desdeId = params.get('desde');
  const desdeEsc = desdeId && window.GUION.escenas[desdeId];
  if (desdeEsc) avisos.push(I18n.t('ui.aviso_desde').replace('{e}', I18n.t(desdeEsc.titulo)));
  if (perfilDemo()) avisos.push(I18n.t('ui.aviso_demo').replace('{p}', perfilDemo().nombre));
  if (velocidadRevision() !== 1) avisos.push(I18n.t('ui.aviso_velocidad').replace('{v}', velocidadRevision()));
  if (avisos.length) {
    const caja = $('#avisosRevision');
    caja.className = 'aviso-revision';
    caja.textContent = avisos.join(' ');
    $('.avanzadas').open = true;
  }

  /* Grabación del video (index.html?demo=emocional&auto=1): la sesión parte
     sola y, al terminar, abre los resultados y recorre el resumen despacio.
     Solo funciona junto con el modo demo. */
  if (perfilDemo() && params.get('auto') === '1') {
    // Sin subtítulos del juego: en el video habla la narración.
    document.body.classList.add('grabacion');
    setTimeout(() => $('#btnEmpezar').click(), 1500);
    /* El play lo toca la persona que graba: los navegadores solo dejan
       sonar una página después de un toque real. Desde ahí, todo sigue solo. */
  }

  // Evitar el zoom por doble toque, que en tablet arruina la interacción.
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
});


/* Ejecuta algo opcional sin que pueda frenar ni romper lo que viene después.
   Si falla o se cuelga, solo queda un aviso en la consola. */
function pedirSinEsperar(fn) {
  try {
    const p = fn();
    if (p && typeof p.catch === 'function') {
      p.catch((e) => console.warn('Función opcional no disponible:', e && e.name));
    }
  } catch (e) {
    console.warn('Función opcional no disponible:', e && e.name);
  }
}


/* ---- Empezar la sesión -------------------------------------------------- */

async function empezar() {
  /* Si alguien del equipo escribió un código en "Opciones avanzadas", manda
     ese; si no, el automático. */
  const escrito = ($('#inpParticipante').value || '').trim();
  if (escrito) codigoSesion = escrito;
  const id_participante = codigoSesion;
  const grupo = ($('#inpGrupo').value || '').trim() || null;
  const idioma = idiomaElegido;
  const modoMedia = $('#selModo').value;
  const perfilSonido = $('#selPerfil').value;
  const pulsosSync = $('#chkSync').checked;
  const textosRevision = $('#chkTextos').checked;
  const velocidad = velocidadRevision();

  /* Revisión: index.html?desde=W1 empieza la sesión en esa escena, para mirar
     un video sin pasar por las anteriores. El orden recortado queda en el
     JSON (sesion.orden_escenas). */
  const desde = new URLSearchParams(location.search).get('desde');
  if (desde && window.GUION.orden.includes(desde)) {
    window.GUION.orden = window.GUION.orden.slice(window.GUION.orden.indexOf(desde));
  }

  /* Sin textos de revisión, en pantalla quedan solo los dibujos y la voz, como
     en la versión final. Es lo que corresponde si juega un niño (DN-31). */
  document.body.classList.toggle('sin-textos', !textosRevision);

  I18n.usar(idioma);
  I18n.aplicar();

  /* El audio se inicia acá y no antes: los navegadores no dejan sonar nada
     hasta que la persona toca algo. Este click es ese toque. */
  Sonido.iniciar(idioma, perfilSonido);
  Sonido.ambiente(true);

  /* Pantalla completa y pantalla-siempre-encendida son MEJORAS, no requisitos.
     Se piden sin esperarlas.

     Antes esto era `await requestFullscreen(...)`, y ahí estaba el problema: si
     el navegador no concede el permiso al instante (o no lo concede nunca, que
     es lo que pasa en algunos navegadores y en vistas incrustadas), esa promesa
     no se resuelve nunca y la sesión no arranca jamás, sin ningún mensaje de
     error. El botón parecía no hacer nada.

     Nada de lo que viene después puede depender de que esto funcione. */
  // En la grabación del video no se pide pantalla completa: al salir de ella,
  // la ventana de grabación cambia de tamaño.
  const grabando = new URLSearchParams(location.search).get('auto') === '1';
  if (!grabando) pedirSinEsperar(() => document.documentElement.requestFullscreen({ navigationUI: 'hide' }));
  pedirSinEsperar(() => ('wakeLock' in navigator) ? navigator.wakeLock.request('screen') : null);

  reloj = new Reloj();
  registro = new Registro(reloj, {
    id_participante, grupo, idioma, modo_media: modoMedia,
    orden_escenas: window.GUION.orden,
    pulsos_sync: pulsosSync, perfil_sonido: perfilSonido, velocidad,
    textos_revision: textosRevision
  });

  const demo = perfilDemo();
  if (demo) {
    registro.sesion.demo = demo.nombre;
    mostrarRegistroDemo(registro);
  }

  const detectorToques = new DetectorToquesOciosos(registro, dom.escenario);

  // Eventos de estado: si la tablet se bloquea o se gira a mitad de sesión,
  // queda registrado. Sin esto, un hueco en los datos sería inexplicable.
  document.addEventListener('visibilitychange', () => {
    registro.emitir('estado',
      document.hidden ? 'visibilidad_oculta' : 'visibilidad_visible',
      motor && motor.escenaActual ? motor.escenaActual.id : null, 'sistema', {});
  });
  window.addEventListener('orientationchange', () => {
    registro.emitir('estado', 'orientacion_cambio',
      motor && motor.escenaActual ? motor.escenaActual.id : null, 'sistema', {
        viewport: [window.innerWidth, window.innerHeight]
      });
  });

  motor = new Motor({
    guion: window.GUION,
    registro, reloj, detectorToques,
    modoMedia, dom, pulsosSync, velocidad,
    demo: demo ? demo.perfil : null,
    alTerminar: mostrarFin
  });

  mostrarPantalla('juego');

  if (modoMedia === 'placeholder') {
    const aviso = $('#avisoPlaceholder');
    aviso.classList.add('visible');
    setTimeout(() => aviso.classList.remove('visible'), 4000);
  }

  /* Botón de velocidad, solo si se activó en la pantalla de inicio (para
     mostrar el prototipo). Cada toque pasa a la velocidad siguiente. */
  const btnVel = $('#btnVelocidad');
  btnVel.hidden = !$('#chkVelocidad').checked;
  const pasos = [1, 2, 3, 4];
  const rotular = () => { btnVel.textContent = '⏩ ×' + motor.v; };
  rotular();
  btnVel.onclick = () => {
    const i = pasos.indexOf(motor.v);
    motor.cambiarVelocidad(pasos[(i + 1) % pasos.length]);
    rotular();
  };

  motor.correr();
}


/* ---- Salida anticipada -------------------------------------------------- */

function confirmarSalida() {
  const capa = $('#confirmar');
  capa.classList.add('visible');

  const cerrar = () => capa.classList.remove('visible');

  $('#btnConfirmarSi').onclick = () => { cerrar(); motor.pedirSalida(); };
  $('#btnConfirmarNo').onclick = cerrar;
}


/* ---- Final ---------------------------------------------------------------- */

/* Primero el cierre para el niño: Puki despidiéndose, sin datos. */
function mostrarFin() {
  Sonido.musica(false);
  Sonido.ambiente(false);
  Sonido.callar();
  document.body.classList.remove('sin-textos');
  mostrarPantalla('cierre');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  // Grabación del video: resultados y recorrido del resumen, sin manos.
  if (perfilDemo() && new URLSearchParams(location.search).get('auto') === '1') {
    setTimeout(() => {
      mostrarResultados();
      registro.emitir('sistema', 'grabacion_resultados', null, 'sistema', {});
      const fin = $('#fin');
      const t0 = performance.now();
      const dur = 26000;
      setTimeout(function bajar() {
        const k = Math.min(1, (performance.now() - t0 - 2000) / dur);
        fin.scrollTop = Math.max(0, k) * (fin.scrollHeight - fin.clientHeight);
        if (k < 1) setTimeout(bajar, 40);
        else window.__grabacionLista = true;
      }, 2000);
    }, 4000);
  }
}

function copiarCodigo() {
  const btn = $('#btnCopiar');
  const listo = () => {
    btn.textContent = I18n.t('ui.copiado');
    setTimeout(() => { btn.textContent = I18n.t('ui.copiar'); }, 2000);
  };
  try {
    navigator.clipboard.writeText(codigoSesion).then(listo, () => {});
  } catch (e) { /* sin portapapeles: el código igual queda a la vista */ }
}

/* Después, con un toque, los resultados para el adulto. */
function mostrarResultados() {
  const datos = registro.exportar();
  mostrarPantalla('fin');

  $('#codigoFin').textContent = codigoSesion;

  /* El cuestionario aparece solo si hay un link en guion.js. Lleva el
     código, para que la persona no tenga que copiarlo a mano si el
     formulario lo acepta (ej. ?codigo=...). */
  const url = (window.GUION && window.GUION.formulario_url) || '';
  const btnC = $('#btnCuestionario');
  btnC.hidden = !url;
  if (url) btnC.href = url.replace('{codigo}', encodeURIComponent(codigoSesion));

  const seg = Math.round(datos.sesion.duracion_ms / 1000);
  $('#resumen').innerHTML =
    `<div class="dato"><b>${datos.eventos.length}</b> ${I18n.t('ui.eventos_registrados')}</div>` +
    `<div class="dato"><b>${datos.ventanas_analisis.length}</b> ${I18n.t('ui.ventanas')}</div>` +
    `<div class="dato"><b>${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}</b> ${I18n.t('ui.duracion')}</div>` +
    `<div class="dato archivo">${registro.nombreArchivo()}</div>`;

  // Tabla rápida de ventanas, para revisar de un vistazo que salió bien.
  const filas = datos.ventanas_analisis.map((v) => {
    const t = v.t_climax_ms !== undefined
      ? (v.t_climax_ms / 1000).toFixed(1) + ' s'
      : (v.t_ventana_ms[0] / 1000).toFixed(1) + '–' + (v.t_ventana_ms[1] / 1000).toFixed(1) + ' s';
    return `<tr><td>${v.id}</td><td>${v.emocion_esperada}</td>` +
           `<td>${(v.aus_esperadas || []).join(' ') || '—'}</td><td>${t}</td></tr>`;
  }).join('');
  $('#tablaVentanas').innerHTML =
    '<tr><th>id</th><th>emoción</th><th>AU esperadas</th><th>t</th></tr>' + filas;

  // Lo principal: el resumen por subescala para el profesional.
  Resumen.pintar($('#resumenProfesional'), datos, window.GUION);

  // La sesión dibujada escena por escena, para revisarla de un vistazo.
  Revision.pintar($('#revision'), datos);
}

function verJson() {
  const w = window.open('', '_blank');
  if (!w) return;
  const txt = JSON.stringify(registro.exportar(), null, 2);
  w.document.write('<pre style="font:12px monospace;padding:16px;white-space:pre-wrap">' +
    txt.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</pre>');
  w.document.close();
}


/* ---- Modo demo: lo que se va registrando ---------------------------------- */

/* Muestra en una esquina, mientras el juego se juega solo, los eventos que
   un profesional entendería: qué eligió, cuánto tardó, cuándo hubo un
   momento de medición. No cambia el registro: solo lo mira pasar. */
function mostrarRegistroDemo(reg) {
  const panel = $('#demoPanel');
  const lista = $('#demoLista');
  panel.hidden = false;
  document.body.classList.add('modo-demo');
  const seg = (ms) => (ms / 1000).toFixed(1) + ' s';
  const opcionTexto = (escena_id, decision_id, opcion_id) => {
    const esc = window.GUION.escenas[escena_id];
    const dec = esc && esc.decisiones && esc.decisiones[decision_id];
    const op = dec && dec.opciones.find((o) => o.id === opcion_id);
    return op ? I18n.t(op.texto) : opcion_id;
  };
  const agregar = (txt, clase) => {
    const li = document.createElement('li');
    li.textContent = txt;
    if (clase) li.className = clase;
    lista.appendChild(li);
    while (lista.children.length > 5) lista.firstChild.remove();
  };
  const original = reg.emitir.bind(reg);
  reg.emitir = (tipo, nombre, escena_id, canal, datos) => {
    const ev = original(tipo, nombre, escena_id, canal, datos);
    const d = ev.datos || {};
    if (nombre === 'opcion_elegida') {
      agregar(`${I18n.t('demo.eligio')}: «${opcionTexto(escena_id, d.decision_id, d.opcion_id)}» · ${seg(d.latencia_ms)}`, 'eleccion');
    } else if (nombre === 'opcion_por_defecto') {
      agregar(I18n.t('demo.defecto'));
    } else if (nombre === 'toque_objeto') {
      agregar(`${I18n.t('demo.toque')} ${d.n}/${d.de} · ${seg(d.latencia_ms)}`);
    } else if (nombre === 'bloque_colocado') {
      agregar(`${I18n.t('demo.bloque')} ${d.bloque} · ${seg(d.latencia_ms)}`);
    } else if (nombre === 'moneda_dada') {
      agregar(`${I18n.t('demo.moneda')} ${d.destino === 'tobi' ? 'Tobi' : 'Lira'}`);
    } else if (nombre === 'reparto_guardar') {
      agregar(I18n.t('demo.guardar'));
    } else if (nombre === 'repregunta_inactividad') {
      agregar(I18n.t('demo.repregunta'), 'aviso-demo');
    } else if (nombre === 'climax_emocional') {
      agregar(`${I18n.t('demo.ventana')} · ${I18n.t('rv.emo.' + d.emocion_esperada, d.emocion_esperada)}`, 'ventana-demo');
    }
    return ev;
  };
}
