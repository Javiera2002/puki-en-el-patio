/* ---------------------------------------------------------------------------
   guion.js — El guion de Puki, como datos.

   Este archivo es la "partitura". El motor (js/motor.js) no sabe nada de Puki:
   solo lee esta estructura y la ejecuta. Para cambiar la historia, los tiempos
   o el orden de las escenas NO hay que tocar el código, se edita este archivo.

   Corresponde al guion v2.4 (04_reuniones/Guion_Puki_en_el_patio_v2.4_final.docx
   y su versión en inglés). Si cambia uno, hay que cambiar el otro.

   Es un .js y no un .json a propósito: así el prototipo funciona haciendo
   doble clic en index.html, sin necesidad de levantar un servidor local.

   POBLACIÓN: 4 a 7 años. Todos los tiempos están calibrados para el piso del
   rango (los de 4), que es el caso más exigente. Ver DN-07.

   TIEMPOS: en milisegundos, relativos al inicio de la escena, medidos sobre el
   "reloj de escena", que se DETIENE mientras el niño decide, toca un objeto o
   juega la minitarea.

   TIPOS DE MARCA que entiende el motor:
     beat          Cambia lo que se ve y se oye (texto, emoji, gesto, voz).
     sync          Pulso de sincronía (solo si está activado al empezar).
     base_inicio / base_fin       Ventana neutra de la línea base (E0).
     neutra_inicio / neutra_fin   Ventana neutra de los tiempos de calma.
     climax        Abre la ventana de análisis de la emoción de la escena.
     resolucion    Segunda ventana de la escena (ej. alivio en el túnel).
     decision      Muestra opciones. Repregunta y opción por defecto si no hay
                   toque (parámetro `inactividad`).
     toque_objeto  Un objeto que el niño toca una o varias veces (la caja del
                   arenero, la caja de Tobi). Puede abrir el clímax al
                   completarse.
     escucha       Ventana en que Puki espera que el niño hable o sople. Hoy
                   solo se marca en el JSON: no se graba audio (DN-26).
     minitarea     La torre. `rondas` dice qué rondas se juegan en esa marca.
     reparto       El reparto de monedas de la cajita. Se configura en
                   `reparto` de la escena.

   Un `toque_objeto` con `voluntario: true` aparece sin que nadie invite a
   tocarlo y sin repregunta; a los `espera_ms` la historia sigue sola. La
   rama siguiente es `rama_si` si lo tocó y `rama_no` si no.

   Cualquier marca puede llevar además: `emoji` (lo que se ve en el
   placeholder), `vineta` (true/false, oscurece los bordes), `ambiente`
   (volumen relativo del fondo sonoro, 1 = normal) y `musica` (true/false;
   con `corte_seco: true` se corta de golpe).

   VIDEO: si una escena tiene `video` y al empezar se elige "Videos reales",
   se reproduce ese archivo; si no existe, queda el placeholder. Opcionales:
   `video_bucle: true` (se repite si es más corto que la escena) y
   `video_silenciado: true` (se reproduce sin su audio).

   IMÁGENES: una escena puede llevar `imagen` (la que se ve al empezar) y
   cualquier marca o clímax puede traer otra `imagen`, que reemplaza a la
   anterior con un fundido. Las imágenes se mueven muy despacio (fondo vivo),
   salvo durante los momentos de medición, en que quedan quietas. Si una
   escena tiene video y el video existe, el video va encima. Si la imagen no
   existe, queda el placeholder. Queda registrado qué imagen se mostró.

   VOZ DENTRO DEL VIDEO: un beat con `solo_sin_video: true` solo habla si
   la escena no está mostrando su video. Una marca `voz_video` (con `t`,
   `hasta` y `texto`) no suena: anota en el JSON el tramo en que habla un
   personaje dentro del video, para que Brasil sepa cuándo había voz.

   Una escena con más de una ventana usa `climaxes: { nombre: {...} }` y
   marcas `{ tipo: "climax", cual: "nombre" }`.

   REGLA DE ROSTRO (DN-22): en cada clímax, `referencia_facial` dice si algún
   personaje muestra la emoción objetivo durante la ventana. Por defecto no
   (regla A). Solo E2 (pena de Lira) y E5 (risa compartida) lo hacen, como
   excepción declarada (regla B). Va al JSON para que Brasil lo sepa.

   HIPÓTESIS DE MAPEO SDQ (DN-23): cada opción puede llevar `sdq`, una lista de
   { item, subescala, nivel }. Nivel: "analogo_directo" o "indirecto". Es una
   hipótesis exploratoria, no un puntaje. En los ítems internalizantes se
   agrega `confianza` (alta, media-alta, media, baja: cuánto respaldo tiene
   la relación) y `rol`: "senal" (la elección se marca "para mirar" en el
   resumen) o "acompana" (se muestra, pero no basta por sí sola). La
   justificación de cada relación está en 03_prototipo/resumen_por_area_v1.md.

   DIBUJOS (DN-33): cada opción, la caja y la torre llevan `dibujo`, el nombre
   de una imagen PNG en media/botones/<dibujo>.png (las hace Javiera). El
   `emoji` queda de respaldo mientras la imagen no exista.
--------------------------------------------------------------------------- */

window.GUION = {
  version: "2.4.0",

  /* Idioma con que abre la pantalla de inicio. Inglés: el video y el link son
     para la red de expertos. */
  idioma_inicial: "en",

  /* Link del cuestionario para quien probó la actividad. Si está vacío, el
     botón no aparece. {codigo} se reemplaza por el código de la sesión. */
  formulario_url: "",

  /* Todas las escenas están en la v2.4. Los textos en inglés están
     completos; español y portugués siguen con la v2.3 y se actualizan
     después. */

  /* Orden de ejecución. Cambiar esta lista contrabalancea el experimento.
     Las negativas van de menor a mayor activación: tristeza (baja) → asco
     (media) → miedo (media-alta) → ira (alta). Fundamento en DN-01. */
  orden: [
    "E0_base",        "W0",
    "E1_sorpresa",    "W1",
    "E2_tristeza",    "W2",
    "EX_asco",        "W3",
    "E3_miedo",       "W4",
    "E4_frustracion", "W5",
    "E5_alegria"
  ],

  /* Imagen de Puki mirando al niño, tranquilo, esperando su respuesta. Se
     muestra en cada pregunta y en el reparto; las opciones van abajo
     (12-10). Si no existe, se queda la imagen de la escena. */
  imagen_pregunta: "media/img/puki_pregunta.jpg",

  /* Cuántas opciones se muestran por decisión como máximo. Ver DN-08. */
  max_opciones: 3,

  /* Recorte alrededor de cada clímax. `antes_ms` es cuánto antes del clímax
     empieza el recorte. El largo después del clímax lo define cada escena con
     `ventana_ms`; `despues_ms` es solo el respaldo si una escena no lo trae. */
  ventana: { antes_ms: 500, despues_ms: 5000 },

  /* Si el niño no toca nada: a los `repregunta_ms` Puki repite la pregunta, y
     a los `auto_ms` la historia sigue con la opción por defecto. Se cuenta
     desde que Puki termina de leer las opciones. */
  inactividad: { repregunta_ms: 11000, auto_ms: 24000 },

  /* Voces del andamio (la voz sintética del navegador). Cuando existan las
     grabaciones, esto deja de usarse. */
  voces: {
    puki:         { pitch: 1.5, rate: 0.88, volumen: 0.9 },
    puki_susurro: { pitch: 1.4, rate: 0.78, volumen: 0.45 },
    lira:         { pitch: 1.8, rate: 0.80, volumen: 0.75 },
    tobi:         { pitch: 1.15, rate: 1.05, volumen: 0.95 },
    todos:        { pitch: 1.4, rate: 0.95, volumen: 1.0 }
  },

  escenas: {

    /* ===================================================================== */
    E0_base: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E0.titulo",
      /* Puki ya está saludando en la pantalla de inicio. Al tocar play, la
         escena sigue desde ese mismo cuadro: Puki saluda y presenta a Tobi y
         Lira. La cara en reposo se mide en la calma que viene justo después
         (W0), antes de la primera emoción. El video de septiembre
         (media/E0_base.mp4) es de la versión anterior: no se usa. */
      duracion_ms: 31000,
      placeholder: { fondo: "#dfeee0", emoji: "👋", acento: "#7fb08a" },
      /* Puki en primer plano para el saludo (12-10). */
      imagen: "media/img/E0_saluda_cerca.jpg",
      marcas: [
        { t: 0,     tipo: "sync",  n: 1 },
        { t: 200,   tipo: "beat",  texto: "escena.E0.b1", emoji: "👋", voz: "voz.E0.oh_hola" },
        { t: 2000,  tipo: "beat",  voz: "voz.E0.soy_puki" },
        /* Pausa de 3 s: Puki espera que el niño conteste en voz alta. */
        { t: 6500,  tipo: "escucha", modo: "habla", duracion_ms: 3000, texto: "escena.E0.escucha" },
        { t: 9500,  tipo: "beat",  texto: "escena.E0.b5", gesto: "uhm" },
        { t: 11000, tipo: "beat",  texto: "escena.E0.b6", emoji: "🐾", voz: "voz.E0.amigos",
          imagen: "media/img/E0_amigos.jpg" },
        { t: 15000, tipo: "beat",  texto: "escena.E0.b7", emoji: "🧢", voz: "voz.E0.tobi_hola", hablante: "tobi",
          imagen: "media/img/E0_tobi.jpg" },
        { t: 17000, tipo: "beat",  voz: "voz.E0.es_tobi", gesto: "risita" },
        { t: 21000, tipo: "beat",  texto: "escena.E0.b8", emoji: "🐰", imagen: "media/img/E0_lira.jpg" },
        { t: 22000, tipo: "beat",  voz: "voz.E0.es_lira" },
        /* Momo aparece desde el principio para que el niño conozca a todos
           los personajes (decidido por Javiera el 09-10). */
        { t: 27000, tipo: "beat",  texto: "escena.E0.b9", emoji: "🐾", voz: "voz.E0.es_momo",
          imagen: "media/img/E0_momo.jpg" }
      ]
    },

    /* ===================================================================== */
    E1_sorpresa: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E1.titulo",
      /* Guion v2.4: la cajita en la tierra. Se observa cuánto se demora el
         niño en tocar algo nuevo (ítem 16, latencia del primer toque) y
         cuántas monedas reparte (ítem 4). duracion_ms no incluye el tiempo
         de los toques ni del reparto: el reloj se detiene. */
      duracion_ms: 42000,
      placeholder: { fondo: "#fff3d6", emoji: "🐾", acento: "#e8a33d" },
      video: "media/E1_sorpresa.mp4",
      imagen: "media/img/E1_puki_camina.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.E1.b1", emoji: "🐾", gesto: "alegria" },
        { t: 3000,  tipo: "beat", texto: "escena.E1.b2", emoji: "👀", gesto: "ooh" },  /* sin tropiezo: ve algo en la tierra (12-10) */
        { t: 4200,  tipo: "beat", voz: "voz.E1.oops" },
        { t: 7000,  tipo: "beat", texto: "escena.E1.b3", emoji: "📦", imagen: "media/img/E1_puki_caja.jpg" },
        { t: 10000, tipo: "beat", texto: "escena.E1.b4", gesto: "clac" },
        { t: 11500, tipo: "beat", voz: "voz.E1.algo_suena", hablante: "puki_susurro" },
        { t: 15000, tipo: "beat", texto: "escena.E1.b5", gesto: "crujido" },
        { t: 17500, tipo: "beat", texto: "escena.E1.b6", voz: "voz.E1.ayudas" },
        /* La caja tiembla y cruje con cada toque (el iPad no vibra). */
        { t: 23000, tipo: "toque_objeto",
          objeto: "caja_tierra", emoji: "📦", dibujo: "caja", texto: "objeto.caja", toques: 3,
          /* La caja vista desde arriba, entre las patitas de Puki (11-10). */
          pantalla: "media/img/E1_caja_fondo.jpg",
          pantalla_capa: "media/img/E1_caja_sola.png",
          voz_repregunta: "voz.E1.toca_caja",
          sdq: [ { item: 16, subescala: "emocional", nivel: "indirecto",
                   medida: "latencia del primer toque", confianza: "media-alta", rol: "senal" } ],
          por_toque: [
            { gesto: "crujido", texto: "escena.E1.t1", voz: "voz.E1.otra_vez" },
            { gesto: "ooh",     texto: "escena.E1.t2" },
            { }
          ],
          climax_al_completar: true, gesto_climax: "pop" },
        /* Recién cuando cierra la ventana (2,5 s) se ve la cara de Puki. */
        { t: 25800, tipo: "beat", texto: "escena.E1.b7", emoji: "😮" },
        { t: 27500, tipo: "beat", texto: "escena.E1.b8", emoji: "🟡", gesto: "sniff", imagen: "media/img/E1_chocolate.jpg" },
        { t: 29000, tipo: "beat", texto: "escena.E1.b9", emoji: "🍫", voz: "voz.E1.chocolate", gesto: "risita" },
        { t: 33500, tipo: "beat", texto: "escena.E1.b10", emoji: "👫" },
        { t: 35000, tipo: "beat", voz: "voz.E1.que_encontraste", hablante: "tobi" },
        { t: 37500, tipo: "reparto" },
        { t: 38000, tipo: "beat", texto: "escena.E1.b11", emoji: "📦" },
        { t: 40000, tipo: "beat", texto: "escena.E1.b12", emoji: "🛝" }
      ],
      /* Seis monedas al centro. Todos los toques suenan igual. */
      reparto: {
        monedas: 6,
        pregunta: "escena.E1.pregunta",
        dibujo_moneda: "moneda",
        pausa_fin_ms: 8000,
        voz_listo: "voz.E1.listo",
        destinos: [
          { id: "tobi", texto: "escena.E1.tobi", voz: "escena.E1.tobi_voz", emoji: "🧢", dibujo: "reparto_tobi" },
          { id: "lira", texto: "escena.E1.lira", voz: "escena.E1.lira_voz", emoji: "🐰", dibujo: "reparto_lira" }
        ],
        guardar: { id: "caja", texto: "escena.E1.caja", voz: "escena.E1.caja_voz", emoji: "📦", dibujo: "reparto_caja" },
        sdq: [ { item: 4, subescala: "prosocial", nivel: "analogo_directo",
                 medida: "monedas dadas a Tobi y Lira" } ]
      },
      climax: {
        id: "E1_climax",
        emocion: "sorpresa",
        aus: ["AU1", "AU2", "AU5", "AU26"],
        intensidad: "alta",
        valencia: 1,
        activacion: "alta",
        duracion_ms: 2500,
        ventana_ms: 2500,
        referencia_facial: false,
        emoji: "✨📦✨",
        /* La caja abierta vista desde arriba. Solo se ven las patitas de
           Puki, sin su cara (11-10). */
        imagen: "media/img/E1_caja_abierta.jpg",
        texto: "escena.E1.climax",
        descripcion: "Se abre la caja: monedas doradas apiladas y luz cálida. Primer plano del interior, Puki no aparece y nadie habla."
      }
    },

    /* ===================================================================== */
    E2_tristeza: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E2.titulo",
      /* Guion v2.4: Lira queda sola. Se observa si el niño ayuda y cómo
         (ítem 9). */
      duracion_ms: 48000,
      placeholder: { fondo: "#e3e8f0", emoji: "🏃", acento: "#7d8fb3" },
      video: "media/E2_tristeza.mp4",
      imagen: "media/img/E2_fondo.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.E2.b1", emoji: "🏃" },
        { t: 3000,  tipo: "beat", texto: "escena.E2.b2", emoji: "🐰", voz: "voz.E2.lira_puedo", hablante: "lira",
          imagen: "media/img/E2_lira_pide.jpg" },
        { t: 7500,  tipo: "beat", texto: "escena.E2.b3", emoji: "💨", imagen: "media/img/E2_lira_sola.jpg" },
        { t: 10000, tipo: "beat", texto: "escena.E2.b4", emoji: "🐰", gesto: "melancolia", ambiente: 0.5 },
        { t: 16000, tipo: "climax", gesto: "sniff" },
        { t: 19300, tipo: "beat", texto: "escena.E2.b5", emoji: "🐾", ambiente: 1 },
        { t: 21500, tipo: "beat", voz: "voz.E2.que_pasa" },
        /* Pausa de 6 s: Puki espera que el niño hable. La escucha no detiene
           el reloj: lo que sigue va 6 s después (DN-32). */
        { t: 24500, tipo: "escucha", modo: "habla", duracion_ms: 6000, texto: "escena.E2.escucha" },
        /* Puki asiente sin palabras: sirve igual si el niño habló o no. */
        { t: 30500, tipo: "beat", texto: "escena.E2.b6", gesto: "uhm" },
        { t: 32000, tipo: "decision", decision_id: "B" },
        { t: 33000, tipo: "beat", por_rama: {
            B1: { texto: "escena.E2.rB1a", emoji: "🧢", voz: "voz.E2.rB1_puki" },
            B2: { texto: "escena.E2.rB2a", emoji: "🐰", gesto: "risita" },
            B3: { texto: "escena.E2.rB3a", emoji: "🧢" } } },
        { t: 37500, tipo: "beat", por_rama: {
            B1: { texto: "escena.E2.rB1b", emoji: "🌼" },
            B2: { voz: "voz.E2.rB2_puki" },
            B3: { texto: "escena.E2.rB3b", emoji: "🌼" } } },
        { t: 41000, tipo: "beat", por_rama: {
            B2: { texto: "escena.E2.rB2c", emoji: "🐰", voz: "voz.E2.rB2_lira", hablante: "lira" } } },
        { t: 44500, tipo: "beat", por_rama: {
            B2: { texto: "escena.E2.rB2d", emoji: "😊" } } }
      ],
      decisiones: {
        B: {
          pregunta: "escena.E2.pregunta",
          defecto: "B2",
          opciones: [
            { id: "B1", texto: "escena.E2.B1", voz: "escena.E2.B1_voz", emoji: "🧢", dibujo: "pedir_tobi",
              sdq: [ { item: 9, subescala: "prosocial", nivel: "analogo_directo" } ] },
            { id: "B2", texto: "escena.E2.B2", voz: "escena.E2.B2_voz", emoji: "🤝", dibujo: "ir_con_lira",
              sdq: [ { item: 9, subescala: "prosocial", nivel: "analogo_directo" } ] },
            { id: "B3", texto: "escena.E2.B3", voz: "escena.E2.B3_voz", emoji: "⚽", dibujo: "jugar_tobi",
              sdq: [] }
          ]
        }
      },
      climax: {
        id: "E2_climax",
        emocion: "tristeza",
        aus: ["AU1", "AU4", "AU15"],
        intensidad: "baja",
        valencia: -1,
        activacion: "baja",
        duracion_ms: 3000,
        ventana_ms: 3000,
        referencia_facial: true,
        nota_rostro: "Excepción DN-22 (regla B): la tristeza de Lira es lo que despierta la empatía.",
        emoji: "😢🐰",
        imagen: "media/img/E2_hold.jpg",
        texto: "escena.E2.climax",
        descripcion: "Primer plano de Lira abrazando su conejito, con una lagrimita. Música triste, nadie habla."
      }
    },

    /* ===================================================================== */
    EX_asco: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.EX.titulo",
      /* Guion v2.4: primero una pregunta sobre Lira en el columpio (si
         imagina que algo malo va a pasar, ítem 8); después el sándwich y qué
         decirle a Tobi (ítem 1). */
      duracion_ms: 34000,
      placeholder: { fondo: "#e6ecd4", emoji: "🪑", acento: "#8a9a4b" },
      video: "media/EX_asco.mp4",
      imagen: "media/img/EX_lira_columpio.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.EX.b1", emoji: "🪑" },
        { t: 2500,  tipo: "beat", texto: "escena.EX.b2", emoji: "🛝", voz: "voz.EX.mira_lira" },
        /* Pase lo que pase, ocurre lo mismo: Lira se divierte. */
        { t: 6000,  tipo: "decision", decision_id: "P" },
        { t: 6500,  tipo: "beat", texto: "escena.EX.b3", emoji: "🛝", gesto: "alegria" },
        { t: 9000,  tipo: "beat", texto: "escena.EX.b4", emoji: "🧢", imagen: "media/img/EX_tobi_caja.jpg" },
        { t: 11000, tipo: "beat", voz: "voz.EX.tobi_sandwich", hablante: "tobi" },
        { t: 16000, tipo: "beat", texto: "escena.EX.b5", emoji: "📦", voz: "voz.EX.veamos" },
        { t: 19000, tipo: "toque_objeto",
          objeto: "caja_tobi", emoji: "📦", dibujo: "caja_tobi", texto: "objeto.caja", toques: 1, grande: true,
          voz_repregunta: "voz.EX.toca_caja",
          por_toque: [ { gesto: "carton" } ],
          climax_al_completar: true, gesto_climax: "viscoso" },
        /* Puki no habla ni pone cara de asco: solo mira al niño. */
        { t: 23300, tipo: "beat", texto: "escena.EX.b6", emoji: "😳", imagen: "media/img/EX_tobi_caja.jpg" },
        { t: 25500, tipo: "beat", texto: "escena.EX.b7", emoji: "🧢" },
        { t: 27000, tipo: "decision", decision_id: "X" },
        { t: 28000, tipo: "beat", por_rama: {
            X1: { texto: "escena.EX.rX1", emoji: "😂", voz: "voz.EX.rX1_tobi", hablante: "tobi" },
            X2: { texto: "escena.EX.rX2", emoji: "😂", voz: "voz.EX.rX2_tobi", hablante: "tobi" },
            X3: { texto: "escena.EX.rX3", emoji: "🧢", voz: "voz.EX.rX3_tobi", hablante: "tobi" } } },
      ],
      decisiones: {
        P: {
          pregunta: "escena.EX.preguntaP",
          defecto: "P1",
          opciones: [
            { id: "P1", texto: "escena.EX.P1", voz: "escena.EX.P1_voz", emoji: "😄", dibujo: "lira_divierte",
              sdq: [] },
            { id: "P2", texto: "escena.EX.P2", voz: "escena.EX.P2_voz", emoji: "😟", dibujo: "lira_asusta",
              sdq: [ { item: 8, subescala: "emocional", nivel: "indirecto", confianza: "media", rol: "senal" } ] },
            { id: "P3", texto: "escena.EX.P3", voz: "escena.EX.P3_voz", emoji: "🤕", dibujo: "lira_cae",
              sdq: [ { item: 8, subescala: "emocional", nivel: "indirecto", confianza: "media", rol: "senal" } ] }
          ]
        },
        X: {
          pregunta: "escena.EX.pregunta",
          defecto: "X2",
          opciones: [
            { id: "X1", texto: "escena.EX.X1", voz: "escena.EX.X1_voz", emoji: "🤢", dibujo: "que_asco",
              sdq: [] },
            { id: "X2", texto: "escena.EX.X2", voz: "escena.EX.X2_voz", emoji: "✋", dibujo: "no_comer",
              sdq: [ { item: 1, subescala: "prosocial", nivel: "indirecto" } ] },
            { id: "X3", texto: "escena.EX.X3", voz: "escena.EX.X3_voz", emoji: "😂", dibujo: "chistoso",
              sdq: [ { item: 1, subescala: "prosocial", nivel: "indirecto" } ] }
          ]
        }
      },
      climax: {
        id: "EX_climax",
        emocion: "asco",
        aus: ["AU9", "AU10", "AU15", "AU16", "AU26"],
        intensidad: "media",
        valencia: -1,
        activacion: "media",
        duracion_ms: 4000,
        ventana_ms: 4000,
        referencia_facial: false,
        emoji: "🥪🐛🦟",
        imagen: "media/img/EX_hold.jpg",
        texto: "escena.EX.climax",
        descripcion: "El sándwich llena la pantalla: pan remojado, moho verde peludo, gusanitos, un calcetín y una mosca. Sonido pegajoso y zumbido. Sin personajes."
      }
    },

    /* ===================================================================== */
    E3_miedo: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E3.titulo",
      /* Guion v2.4: la pelota perdida en la bodega. Tres decisiones: qué
         hay adentro (antes de la ventana de miedo), qué hacer, y si convidarle
         chocolate a Momo. */
      duracion_ms: 49500,
      placeholder: { fondo: "#d8d4e4", emoji: "🏚️", acento: "#6b5f8c" },
      video: "media/E3_miedo.mp4",
      imagen: "media/img/E3_fondo.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.E3.b1", emoji: "🏚️", gesto: "crujido" },
        { t: 2500,  tipo: "beat", texto: "escena.E3.b2", emoji: "⚽", gesto: "rebote" },
        { t: 5000,  tipo: "beat", texto: "escena.E3.b3", gesto: "rebote", ambiente: 0.25 },
        { t: 8000,  tipo: "beat", texto: "escena.E3.b4", gesto: "grunido" },
        { t: 10500, tipo: "beat", texto: "escena.E3.b5", emoji: "🐾", voz: "voz.E3.escuchaste", hablante: "puki_susurro" },
        /* Qué imagina el niño ante lo desconocido (ítem 24). Puki reacciona
           igual a cualquier opción. */
        { t: 13000, tipo: "decision", decision_id: "M" },
        { t: 13500, tipo: "beat", texto: "escena.E3.b6", emoji: "🐾" },
        { t: 15000, tipo: "beat", texto: "escena.E3.b7", emoji: "🚪", vineta: true },
        /* Vista desde la puerta. Puki no aparece (regla A). */
        { t: 17500, tipo: "climax", gesto: "grunido" },
        /* El susurro va justo DESPUÉS de la ventana, no adentro (DN-09). */
        { t: 20800, tipo: "beat", texto: "escena.E3.b8", emoji: "🐾", voz: "voz.E3.shh", hablante: "puki_susurro",
          imagen: "media/img/E3_puki_pared.jpg" },
        { t: 22500, tipo: "decision", decision_id: "C" },
        { t: 23500, tipo: "beat", por_rama: {
            C1: { texto: "escena.E3.rC1a", emoji: "🐾", voz: "voz.E3.rC1", hablante: "puki_susurro" },
            C2: { texto: "escena.E3.rC2a", emoji: "🐾", voz: "voz.E3.rC2", hablante: "puki_susurro" },
            C3: { texto: "escena.E3.rC3a", emoji: "🐾", gesto: "gulp" } } },
        { t: 27500, tipo: "beat", por_rama: {
            C1: { texto: "escena.E3.rC1b", emoji: "⚽", gesto: "rebote" },
            C2: { texto: "escena.E3.rC2b", emoji: "👫" },
            C3: { texto: "escena.E3.rC3b", voz: "voz.E3.rC3", hablante: "puki_susurro" } } },
        { t: 31500, tipo: "beat", texto: "escena.E3.b9", emoji: "🌤️" },
        /* La ventana de alivio muestra solo a Momo. Puki reacciona después. */
        { t: 33000, tipo: "resolucion", gesto: "piip" },
        { t: 36300, tipo: "beat", texto: "escena.E3.b10", emoji: "😄", voz: "voz.E3.eras_tu", gesto: "risita",
          ambiente: 1, vineta: false, imagen: "media/img/E3_eras_tu.jpg" },
        { t: 39500, tipo: "beat", texto: "escena.E3.b11", emoji: "🟡" },
        { t: 41000, tipo: "decision", decision_id: "K" },
        { t: 42000, tipo: "beat", por_rama: {
            K1: { texto: "escena.E3.rK1", emoji: "🟡" },
            K2: { texto: "escena.E3.rK2", emoji: "🟡", gesto: "risita" },
            K3: { texto: "escena.E3.rK3", emoji: "📦" } } },
        { t: 45500, tipo: "beat", texto: "escena.E3.b12", emoji: "🐾", gesto: "piip" }
      ],
      decisiones: {
        M: {
          pregunta: "escena.E3.preguntaM",
          hablante: "puki_susurro",
          defecto: "M2",
          opciones: [
            { id: "M1", texto: "escena.E3.M1", voz: "escena.E3.M1_voz", emoji: "🤗", dibujo: "un_amigo",
              sdq: [] },
            { id: "M2", texto: "escena.E3.M2", voz: "escena.E3.M2_voz", emoji: "📦", dibujo: "algo_cayo",
              sdq: [] },
            { id: "M3", texto: "escena.E3.M3", voz: "escena.E3.M3_voz", emoji: "👹", dibujo: "monstruo",
              sdq: [ { item: 24, subescala: "emocional", nivel: "indirecto", confianza: "media", rol: "acompana" } ] }
          ]
        },
        C: {
          pregunta: "escena.E3.pregunta",
          hablante: "puki_susurro",
          defecto: "C2",
          opciones: [
            { id: "C1", texto: "escena.E3.C1", voz: "escena.E3.C1_voz", emoji: "🏃", dibujo: "dejar_pelota_bodega",
              sdq: [ { item: 24, subescala: "emocional", nivel: "indirecto", confianza: "alta", rol: "senal" } ] },
            /* Pedir compañía es enfrentar el susto acompañado, no evitarlo:
               no cuenta para el ítem 24 (decidido por Javiera el 07-10). */
            { id: "C2", texto: "escena.E3.C2", voz: "escena.E3.C2_voz", emoji: "🤝", dibujo: "llamar_amigos",
              sdq: [] },
            { id: "C3", texto: "escena.E3.C3", voz: "escena.E3.C3_voz", emoji: "🔦", dibujo: "mirar_bodega",
              sdq: [] }
          ]
        },
        K: {
          pregunta: "escena.E3.preguntaK",
          defecto: "K3",
          opciones: [
            { id: "K1", texto: "escena.E3.K1", voz: "escena.E3.K1_voz", emoji: "🟡", dibujo: "dar_una",
              sdq: [ { item: 17, subescala: "prosocial", nivel: "analogo_directo" } ] },
            { id: "K2", texto: "escena.E3.K2", voz: "escena.E3.K2_voz", emoji: "💰", dibujo: "dar_todas",
              sdq: [ { item: 17, subescala: "prosocial", nivel: "analogo_directo" } ] },
            { id: "K3", texto: "escena.E3.K3", voz: "escena.E3.K3_voz", emoji: "📦", dibujo: "guardar_caja",
              sdq: [] }
          ]
        }
      },
      climax: {
        id: "E3_climax",
        emocion: "miedo",
        aus: ["AU1", "AU2", "AU4", "AU5", "AU20"],
        intensidad: "media",
        valencia: -1,
        activacion: "alta",
        duracion_ms: 3000,
        ventana_ms: 3000,
        referencia_facial: false,
        emoji: "👀",
        imagen: "media/img/E3_sombra.jpg",
        texto: "escena.E3.climax",
        descripcion: "Vista desde la puerta hacia la bodega oscura: sombra gigante con garras y dos ojos brillantes; gruñido con eco a volumen controlado. Puki no aparece."
      },
      resolucion: {
        id: "E3_resolucion",
        emocion: "alegria",
        aus: ["AU6", "AU12"],
        intensidad: "media",
        valencia: 1,
        activacion: "media",
        duracion_ms: 3000,
        ventana_ms: 3000,
        referencia_facial: false,
        emoji: "✨🐾✨",
        imagen: "media/img/E3_momo.jpg",
        texto: "escena.E3.resolucion",
        descripcion: "La sombra se achica: es Momo, del tamaño de una manzana, abrazando la pelota, un poco avergonzado. Solo Momo en pantalla."
      }
    },

    /* ===================================================================== */
    E4_frustracion: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E4.titulo",
      /* Guion v2.4: la gran torre (ira). Se observa si ayuda sin que se lo
         pidan (ítem 20, pelota de Tobi), si cree que Tobi lo hizo a propósito
         (ítem 19), si prefiere seguir solo o con alguien (ítem 6) y si sigue
         poniendo bloques después de la caída (ítem 16, latencias de la ronda
         3). duracion_ms NO incluye la minitarea ni las decisiones. */
      duracion_ms: 44000,
      placeholder: { fondo: "#f6ddd8", emoji: "🐾", acento: "#c4644f" },
      video: "media/E4_frustracion.mp4",
      imagen: "media/img/E4_tobi_pelota.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.E4.b1", emoji: "🧱" },
        { t: 2000,  tipo: "beat", texto: "escena.E4.b2", emoji: "⚽", gesto: "rebote" },
        { t: 3500,  tipo: "beat", texto: "escena.E4.b3", emoji: "🧢", voz: "voz.E4.mi_pelota", hablante: "tobi" },
        /* Puki no mira la pelota ni la nombra. Nadie le pide ayuda al niño. */
        { t: 6000,  tipo: "toque_objeto", voluntario: true, espera_ms: 8000,
          objeto: "pelota_tobi", emoji: "⚽", dibujo: "pelota_tobi", toques: 1,
          rama_si: "V1", rama_no: "V2",
          sdq: [ { item: 20, subescala: "prosocial", nivel: "analogo_directo",
                   medida: "toca la pelota sin que se lo pidan" } ],
          por_toque: [ { gesto: "rebote" } ] },
        { t: 6500,  tipo: "beat", por_rama: {
            V1: { texto: "escena.E4.rV1", emoji: "⚽", voz: "voz.E4.gracias", hablante: "tobi" },
            V2: { texto: "escena.E4.rV2", emoji: "⚽", voz: "voz.E4.ahi_esta", hablante: "tobi" } } },
        { t: 9500,  tipo: "beat", texto: "escena.E4.b4", emoji: "🧢", imagen: "media/img/E4_fondo.jpg" },
        { t: 11500, tipo: "beat", texto: "escena.E4.b5", emoji: "🐾", voz: "voz.E4.torre" },
        /* Intentos 1 y 2: el viento y el choque de Tobi. Solo la torre y las
           patitas de Puki. */
        { t: 16000, tipo: "minitarea", rondas: [0, 1] },
        { t: 16100, tipo: "beat", texto: "escena.E4.b6", emoji: "🧢", ambiente: 1 },
        /* La pregunta va ANTES de que Tobi pida perdón: si no, su disculpa ya
           le daría la respuesta al niño. */
        { t: 17500, tipo: "decision", decision_id: "I" },
        { t: 18500, tipo: "beat", texto: "escena.E4.b8", emoji: "🐾", imagen: "media/img/E4_fondo.jpg" },
        { t: 20000, tipo: "beat", texto: "escena.E4.b7", emoji: "🧢", voz: "voz.E4.perdon", hablante: "tobi" },
        { t: 25000, tipo: "beat", texto: "escena.E4.b9", voz: "voz.E4.respira", imagen: "media/img/E4_respira.jpg" },
        { t: 29000, tipo: "beat", texto: "escena.E4.b10", emoji: "😮‍💨", gesto: "inhala" },
        { t: 31000, tipo: "beat", voz: "voz.E4.sopla", gesto: "soplido" },
        { t: 33500, tipo: "escucha", modo: "soplido", duracion_ms: 3000, texto: "escena.E4.escucha" },
        { t: 36500, tipo: "beat", texto: "escena.E4.b11", emoji: "🧢", voz: "voz.E4.ayuda", hablante: "tobi",
          imagen: "media/img/E4_fondo.jpg" },
        { t: 38500, tipo: "decision", decision_id: "S" },
        { t: 39500, tipo: "beat", por_rama: {
            S2: { texto: "escena.E4.rS2", emoji: "🤝" } } },
        /* Intento 3: la torre queda en pie, igual para las dos ramas (DN-05). */
        { t: 40000, tipo: "minitarea", rondas: [2] },
        { t: 40100, tipo: "beat", texto: "escena.E4.b12", emoji: "🙌", voz: "voz.E4.logramos", gesto: "alegria",
          imagen: "media/img/E4_torre_lograda.jpg" }
      ],
      minitarea: {
        tipo: "torre",
        dibujo: "bloque",
        /* Un bloque distinto por piso, de abajo hacia arriba (10-10). */
        dibujos: ["bloque_arco", "bloque_azul", "bloque_verde", "bloque_amarillo", "bloque_techo"],
        bloques: 5,
        /* En qué bloque se cae la torre. La tercera NO se cae: el éxito en el
           tercer intento es obligatorio y está fijo acá (DN-05). */
        rondas: [
          { cae_en: 4, causa: "viento",    climax: false,
            voz_despues: "voz.E4.viento", espera_ms: 3500 },
          { cae_en: 5, causa: "accidente", climax: true,
            gesto_antes: "pasos", espera_ms: 3000 },
          { cae_en: 0, causa: null,        climax: false }
        ],
        timeout_ayuda_ms: 12000
      },
      decisiones: {
        I: {
          pregunta: "escena.E4.preguntaI",
          defecto: "I3",
          opciones: [
            /* "A propósito" (atribución hostil) se asocia más a lo
               externalizante que al ítem 19: se registra, pero no se vincula
               (07-10). */
            { id: "I1", texto: "escena.E4.I1", voz: "escena.E4.I1_voz", emoji: "😠", dibujo: "a_proposito",
              sdq: [] },
            { id: "I2", texto: "escena.E4.I2", voz: "escena.E4.I2_voz", emoji: "🙊", dibujo: "sin_querer",
              sdq: [] },
            { id: "I3", texto: "escena.E4.I3", voz: "escena.E4.I3_voz", emoji: "🤷", dibujo: "no_sabemos",
              sdq: [] }
          ]
        },
        S: {
          pregunta: "escena.E4.preguntaS",
          defecto: "S2",
          opciones: [
            { id: "S1", texto: "escena.E4.S1", voz: "escena.E4.S1_voz", emoji: "🐾", dibujo: "solos",
              sdq: [ { item: 6, subescala: "pares", nivel: "indirecto", confianza: "baja", rol: "senal" } ] },
            { id: "S2", texto: "escena.E4.S2", voz: "escena.E4.S2_voz", emoji: "🤝", dibujo: "con_tobi",
              sdq: [] }
          ]
        }
      },
      climax: {
        id: "E4_climax",
        emocion: "ira",
        aus: ["AU4", "AU7", "AU23"],
        intensidad: "media",
        valencia: -1,
        activacion: "alta",
        duracion_ms: 3000,
        ventana_ms: 3000,
        referencia_facial: false,
        emoji: "🧱💥",
        imagen: "media/img/E4_hold.jpg",
        texto: "escena.E4.climax",
        descripcion: "Tobi choca la torre en el bloque 5 (fuera de cuadro). Plano fijo de los bloques desparramados, sin personajes; la música se corta."
      }
    },

    /* ===================================================================== */
    E5_alegria: {
      activa: true,
      tipo: "narrativa",
      titulo: "escena.E5.titulo",
      /* Guion v2.4: el baile y la despedida. El niño solo mira: no hay
         toques. Escena no vinculada al SDQ. Viene de los videos de alegría de
         Rashidan et al. (2023): la caída con peo y el baile. Ver DN-28. */
      duracion_ms: 54000,
      placeholder: { fondo: "#ffe9c9", emoji: "🌼", acento: "#e07a3f" },
      video: "media/E5_alegria.mp4",
      imagen: "media/img/E5_fondo.jpg",
      marcas: [
        { t: 0,     tipo: "beat", texto: "escena.E5.b1", emoji: "🌼" },
        { t: 2000,  tipo: "beat", texto: "escena.E5.b2", emoji: "🎶", musica: true },
        { t: 3500,  tipo: "beat", voz: "voz.E5.bailemos" },
        { t: 5500,  tipo: "beat", voz: "voz.E5.siii", hablante: "tobi" },
        { t: 7000,  tipo: "beat", texto: "escena.E5.b3", emoji: "🐰", gesto: "piip", imagen: "media/img/E5_baile.jpg" },
        { t: 9000,  tipo: "beat", texto: "escena.E5.b4", emoji: "🧢" },
        { t: 11500, tipo: "beat", texto: "escena.E5.b5", emoji: "🐰" },
        { t: 14000, tipo: "beat", texto: "escena.E5.b6", emoji: "🌀", gesto: "piip" },
        { t: 16500, tipo: "beat", texto: "escena.E5.b7", emoji: "🐾" },
        { t: 19000, tipo: "beat", texto: "escena.E5.b8", emoji: "🌪️", gesto: "boing" },
        /* Ventana 1: la caída. La música se corta en seco en el peo y nadie en
           pantalla se ríe todavía (regla A). */
        { t: 20500, tipo: "climax", cual: "caida", gesto: "peo", musica: false, corte_seco: true },
        { t: 23800, tipo: "beat", texto: "escena.E5.b9", emoji: "🐾", gesto: "piip" },
        /* Ventana 2: la risa compartida. Puki se ríe primero (regla B). */
        { t: 25500, tipo: "climax", cual: "risa_compartida", gesto: "risas", musica: true },
        { t: 30500, tipo: "beat", texto: "escena.E5.b10", emoji: "💨", gesto: "pfit" },
        { t: 31100, tipo: "beat", gesto: "risas_cortas" },
        { t: 33500, tipo: "beat", texto: "escena.E5.b11", emoji: "👋", voz: "voz.E5.divertido", musica: false,
          imagen: "media/img/cierre.jpg" },
        /* Pausa de 6 s: Puki espera que el niño conteste. */
        { t: 38500, tipo: "escucha", modo: "habla", duracion_ms: 6000, texto: "escena.E5.escucha" },
        { t: 44500, tipo: "beat", texto: "escena.E5.b12", gesto: "uhm" },
        { t: 46000, tipo: "beat", emoji: "🥰", voz: "voz.E5.gracias" },
        { t: 49500, tipo: "beat", texto: "escena.E5.b13", emoji: "☁️" },
        { t: 53000, tipo: "sync", n: 4 }
      ],
      /* Dos ventanas (DN-28): la caída mide la risa que da el chiste; la risa
         compartida mide la risa por contagio. */
      climaxes: {
        caida: {
          id: "E5_caida",
          emocion: "alegria",
          aus: ["AU6", "AU12", "AU25", "AU26"],
          intensidad: "media",
          valencia: 1,
          activacion: "alta",
          duracion_ms: 3000,
          ventana_ms: 3000,
          referencia_facial: false,
          nota_rostro: "Puki aparece con cara de \"¿qué pasó?\", no de alegría. Nadie se ríe todavía.",
          emoji: "🙃💨",
          imagen: "media/img/E5_hold_caida.jpg",
          texto: "escena.E5.climax_caida",
          descripcion: "Puki cae de poto con un boing y un peo; la música se corta; queda con las patitas al aire, sin hacerse daño."
        },
        risa_compartida: {
          id: "E5_risa_compartida",
          emocion: "alegria",
          aus: ["AU6", "AU12", "AU25", "AU26"],
          intensidad: "alta",
          valencia: 1,
          activacion: "alta",
          duracion_ms: 4000,
          ventana_ms: 4000,
          referencia_facial: true,
          nota_rostro: "Excepción DN-22 (regla B): se busca la risa compartida. Puki se ríe primero, para que sea reírse con él y no de él.",
          emoji: "😆😂🤣",
          imagen: "media/img/E5_hold_risa.jpg",
          texto: "escena.E5.climax_risa",
          descripcion: "Puki se ríe primero, rodando por el pasto; se suman Tobi y Lira y vuelve la música."
        }
      }
    },

    /* ===================================================================== */
    /* Tiempos de calma (washouts). Las cinco repeticiones usan la misma
       plantilla; solo cambia el id y si llevan pulso de sincronía. */
    /* W0 es la línea base: la cara en reposo antes de la primera emoción. */
    W0: { activa: true,  tipo: "washout", base: true, sync: null, titulo: "escena.W.titulo" },
    W1: { activa: true,  tipo: "washout", sync: null, titulo: "escena.W.titulo" },
    W2: { activa: true,  tipo: "washout", sync: 2,    titulo: "escena.W.titulo" },
    W3: { activa: true,  tipo: "washout", sync: null, titulo: "escena.W.titulo" },
    W4: { activa: true, tipo: "washout", sync: 3,    titulo: "escena.W.titulo" },
    W5: { activa: true,  tipo: "washout", sync: null, titulo: "escena.W.titulo" }
  },

  /* Resumen para el profesional (pantalla final y revision.html). Agrupa lo
     que hizo el niño por subescala internalizante del SDQ. Describe, no
     diagnostica: sin puntajes ni conteos. Los ítems sin situación en el
     juego se muestran como "sin dato", con su motivo. */
  resumen: {
    subescalas: [
      { id: "emocional", titulo: "res.sub.emocional", items: [16, 24, 8, 13, 3] },
      { id: "pares",     titulo: "res.sub.pares",     items: [6, 11, 14, 19, 23] }
    ],
    sin_dato: { 3: "res.motivo.fuera", 13: "res.motivo.cara", 11: "res.motivo.tiempo",
                14: "res.motivo.tiempo", 19: "res.motivo.sacado", 23: "res.motivo.adultos" },
    /* Un tiempo se marca si es mayor que este factor por el ritmo propio del
       niño (la mediana de sus toques de bloques en la torre). Regla tentativa
       de la v1. */
    factor_tiempo: 2
  },

  /* Modo demo (index.html?demo=tipico): el juego se juega solo, para grabar
     el video. Cada perfil dice qué elige el "niño simulado" y cuánto tarda
     (ms desde que Puki termina de leer). Esas sesiones quedan marcadas como
     demo en el JSON y no son datos de ningún niño. */
  demo: {
    perfiles: {
      tipico: {
        decisiones: { B: "B2", P: "P1", X: "X3", M: "M2", C: "C2", K: "K1", I: "I2", S: "S2" },
        demora_ms: 2600,
        objetos: { caja_tierra: { primer_toque_ms: 2500 }, caja_tobi: { primer_toque_ms: 2000 },
                   pelota_tobi: { tocar: true, primer_toque_ms: 2500 } },
        reparto: ["tobi", "lira", "lira", "tobi", "caja"],
        bloque_ms: 1500
      },
      emocional: {
        decisiones: { B: "B2", P: "P3", X: "X2", M: "M3", C: "C1", K: "K3", I: "I3", S: "S2" },
        demora_ms: 5200,
        objetos: { caja_tierra: { primer_toque_ms: 12500 }, caja_tobi: { primer_toque_ms: 6000 },
                   pelota_tobi: { tocar: false } },
        reparto: ["lira", "caja"],
        bloque_ms: 2200
      },
      pares: {
        decisiones: { B: "B3", P: "P1", X: "X1", M: "M1", C: "C3", K: "K3", I: "I1", S: "S1" },
        demora_ms: 3000,
        objetos: { caja_tierra: { primer_toque_ms: 2200 }, caja_tobi: { primer_toque_ms: 2000 },
                   pelota_tobi: { tocar: false } },
        reparto: ["caja"],
        bloque_ms: 1400
      }
    }
  },

  /* Plantilla común de los tiempos de calma. Siempre idéntica: es el ancla
     neutra repetida contra la que se compara cada clímax. Ver DN-10. */
  washout: {
    /* 10 s (antes 15; DN-36). El video dura 15 s y se corta a los 10. */
    duracion_ms: 10000,
    /* Instante del pulso de sincronía en los que lo llevan. Va después de que
       cerró el tramo neutro, para que el destello no lo contamine. */
    sync_t: 9900,
    placeholder: { fondo: "#dbeaf5", emoji: "☁️", acento: "#8fb4cc" },
    /* Video de Puki bajo el árbol (10 s, 10-10), sin su audio: el ambiente
       lo pone la app. Si no carga, queda la imagen. El video de nubes de la
       versión anterior (W_nubes.mp4) no se usa. */
    video: "media/W_calma.mp4",
    video_silenciado: true,
    imagen: "media/img/W_calma.jpg",
    marcas: [
      { t: 0,     tipo: "beat", texto: "escena.W.b1", gesto: "suspiro" },
      /* Los primeros 4 s se descartan: la emoción anterior se está apagando. */
      { t: 4000,  tipo: "neutra_inicio" },
      { t: 9800,  tipo: "neutra_fin" }
    ]
  }
};
