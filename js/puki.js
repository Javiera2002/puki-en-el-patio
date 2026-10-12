/* ---------------------------------------------------------------------------
   puki.js — Puki, dibujado por partes.

   Es un SVG armado con piezas separadas (orejas, ojos, cejas, boca, mejillas)
   que el código mueve. No es un video ni una imagen: es la técnica de recortes
   articulados, hecha directamente en el navegador.

   Por qué así (ver DN-14):
   - Consistencia perfecta: es siempre el MISMO Puki, no se le deforma la cara
     entre escenas. Con video generado por IA eso no está garantizado, y sería
     una variable contaminante.
   - Control exacto del tiempo: "las orejas caen en el segundo 20 y tardan
     400 ms" es una instrucción que se puede cumplir.
   - Un solo archivo para todas las escenas y todas las ramas.

   Cada expresión mueve cuatro cosas: las orejas, los ojos, las cejas y la boca.
   Puki fue diseñado redondo y con orejas largas justamente porque con pocas
   piezas se expresa mucho.
--------------------------------------------------------------------------- */

const Puki = {
  raiz: null,
  expresionActual: 'neutral',

  /* ---- Definición de cada expresión ------------------------------------
     orejas:  grados de rotación. 0 = colgando. Negativo = hacia arriba.
     ojos:    'normal' | 'grande' | 'cerrado' | 'feliz' | 'triste' | 'entrecerrado'
     cejas:   null | 'enojo' | 'triste' | 'sorpresa'
     boca:    nombre de la forma
     cuerpo:  escala vertical, para el "encogerse" del miedo o la tristeza  */
  EXPRESIONES: {
    neutral:  { orejas: [-14, 14],  ojos: 'normal',       cejas: null,       boca: 'suave',    cuerpo: 1.00 },
    dormido:  { orejas: [-72, 72],  ojos: 'cerrado',      cejas: null,       boca: 'suave',    cuerpo: 0.96 },
    curioso:  { orejas: [-4, 30],   ojos: 'normal',       cejas: 'sorpresa', boca: 'o_chica',  cuerpo: 1.00 },
    sorpresa: { orejas: [-2, 2],    ojos: 'grande',       cejas: 'sorpresa', boca: 'o_grande', cuerpo: 1.03 },
    alegria:  { orejas: [-20, 20],  ojos: 'feliz',        cejas: null,       boca: 'risa',     cuerpo: 1.02 },
    triste:   { orejas: [-98, 98],  ojos: 'triste',       cejas: 'triste',   boca: 'pena',     cuerpo: 0.95 },
    miedo:    { orejas: [-8, 8],    ojos: 'grande',       cejas: 'triste',   boca: 'o_chica',  cuerpo: 0.93 },
    enojo:    { orejas: [-124, 124],ojos: 'entrecerrado', cejas: 'enojo',    boca: 'apretada', cuerpo: 1.00 },
    asco:     { orejas: [-84, 84],  ojos: 'entrecerrado', cejas: 'enojo',    boca: 'puaj',     cuerpo: 0.97 }
  },

  BOCAS: {
    suave:    'M 88 138 Q 100 145 112 138',
    o_chica:  'M 94 136 a 6 7 0 1 0 12 0 a 6 7 0 1 0 -12 0',
    o_grande: 'M 90 134 a 10 12 0 1 0 20 0 a 10 12 0 1 0 -20 0',
    risa:     'M 84 134 Q 100 152 116 134 Q 100 142 84 134',
    pena:     'M 88 144 Q 100 135 112 144',
    apretada: 'M 87 140 Q 94 136 100 140 Q 106 144 113 140',
    puaj:     'M 86 138 Q 92 132 98 138 Q 104 144 110 136'
  },

  /* ---- Construcción ----------------------------------------------------- */

  crear(contenedor) {
    contenedor.innerHTML = `
<svg class="puki-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="Puki">
  <g class="puki-todo">

    <!-- orejas, detrás del cuerpo -->
    <g class="puki-oreja-i" style="transform-origin:84px 74px">
      <ellipse cx="84" cy="38" rx="12" ry="32" fill="var(--puki-oreja)"/>
      <ellipse cx="84" cy="40" rx="5.5" ry="21" fill="var(--puki-oreja-int)"/>
    </g>
    <g class="puki-oreja-d" style="transform-origin:116px 74px">
      <ellipse cx="116" cy="38" rx="12" ry="32" fill="var(--puki-oreja)"/>
      <ellipse cx="116" cy="40" rx="5.5" ry="21" fill="var(--puki-oreja-int)"/>
    </g>

    <!-- patitas -->
    <ellipse cx="80" cy="170" rx="15" ry="9" fill="var(--puki-oreja)"/>
    <ellipse cx="120" cy="170" rx="15" ry="9" fill="var(--puki-oreja)"/>

    <!-- cuerpo -->
    <g class="puki-cuerpo" style="transform-origin:100px 168px">
      <path d="M 100 62
               C 132 62 154 88 154 118
               C 154 150 130 170 100 170
               C 70 170 46 150 46 118
               C 46 88 68 62 100 62 Z"
            fill="var(--puki-cuerpo)"/>
      <ellipse cx="100" cy="134" rx="34" ry="30" fill="var(--puki-panza)"/>

      <!-- mejillas -->
      <ellipse class="puki-mejilla" cx="70" cy="128" rx="9" ry="6" fill="var(--puki-mejilla)"/>
      <ellipse class="puki-mejilla" cx="130" cy="128" rx="9" ry="6" fill="var(--puki-mejilla)"/>

      <!-- cejas -->
      <g class="puki-cejas">
        <path class="puki-ceja-i" d="M 76 92 Q 84 89 92 92" stroke="var(--puki-linea)"
              stroke-width="3" stroke-linecap="round" fill="none"/>
        <path class="puki-ceja-d" d="M 108 92 Q 116 89 124 92" stroke="var(--puki-linea)"
              stroke-width="3" stroke-linecap="round" fill="none"/>
      </g>

      <!-- ojos -->
      <g class="puki-ojo-i">
        <circle class="puki-globo" cx="84" cy="110" r="11" fill="#fff"/>
        <circle class="puki-pupila" cx="84" cy="110" r="6" fill="var(--puki-linea)"/>
        <circle class="puki-brillo" cx="87" cy="107" r="2.4" fill="#fff"/>
        <path class="puki-parpado" d="M 73 110 Q 84 102 95 110" stroke="var(--puki-linea)"
              stroke-width="3" stroke-linecap="round" fill="none" opacity="0"/>
      </g>
      <g class="puki-ojo-d">
        <circle class="puki-globo" cx="116" cy="110" r="11" fill="#fff"/>
        <circle class="puki-pupila" cx="116" cy="110" r="6" fill="var(--puki-linea)"/>
        <circle class="puki-brillo" cx="119" cy="107" r="2.4" fill="#fff"/>
        <path class="puki-parpado" d="M 105 110 Q 116 102 127 110" stroke="var(--puki-linea)"
              stroke-width="3" stroke-linecap="round" fill="none" opacity="0"/>
      </g>

      <!-- boca -->
      <path class="puki-boca" d="M 88 138 Q 100 145 112 138" stroke="var(--puki-linea)"
            stroke-width="3.2" stroke-linecap="round" fill="none"/>
    </g>
  </g>
</svg>`;

    this.raiz = contenedor.querySelector('.puki-svg');
    this.expresion('neutral');
    return this.raiz;
  },

  /* ---- Cambio de expresión ---------------------------------------------- */

  expresion(nombre) {
    if (!this.raiz) return;
    const e = this.EXPRESIONES[nombre];
    if (!e) { console.warn('Expresión desconocida:', nombre); return; }
    this.expresionActual = nombre;

    const q = (sel) => this.raiz.querySelector(sel);
    const qa = (sel) => this.raiz.querySelectorAll(sel);

    q('.puki-oreja-i').style.transform = `rotate(${e.orejas[0]}deg)`;
    q('.puki-oreja-d').style.transform = `rotate(${e.orejas[1]}deg)`;
    q('.puki-cuerpo').style.transform = `scaleY(${e.cuerpo})`;
    q('.puki-boca').setAttribute('d', this.BOCAS[e.boca]);

    // Ojos
    qa('.puki-globo').forEach((g) => {
      const r = e.ojos === 'grande' ? 14 : e.ojos === 'entrecerrado' ? 8 : 11;
      g.setAttribute('r', r);
      g.style.opacity = (e.ojos === 'cerrado' || e.ojos === 'feliz') ? 0 : 1;
    });
    qa('.puki-pupila').forEach((p) => {
      // Ojos muy abiertos con pupila chica = sorpresa y miedo.
      const r = e.ojos === 'grande' ? 5 : e.ojos === 'entrecerrado' ? 4.5 : 6;
      p.setAttribute('r', r);
      p.style.opacity = (e.ojos === 'cerrado' || e.ojos === 'feliz') ? 0 : 1;
      // En la tristeza la mirada baja.
      p.setAttribute('cy', e.ojos === 'triste' ? 113 : 110);
    });
    qa('.puki-brillo').forEach((b) => {
      b.style.opacity = (e.ojos === 'cerrado' || e.ojos === 'feliz') ? 0 : 1;
    });
    qa('.puki-parpado').forEach((p, i) => {
      const cerrado = e.ojos === 'cerrado';
      const feliz = e.ojos === 'feliz';
      p.style.opacity = (cerrado || feliz) ? 1 : 0;
      const x = i === 0 ? 84 : 116;
      // Cerrado = línea hacia abajo. Feliz = arco hacia arriba (^ ^).
      p.setAttribute('d', feliz
        ? `M ${x - 11} 114 Q ${x} 102 ${x + 11} 114`
        : `M ${x - 11} 108 Q ${x} 116 ${x + 11} 108`);
    });

    // Cejas
    const ci = q('.puki-ceja-i'), cd = q('.puki-ceja-d');
    const visible = e.cejas !== null;
    ci.style.opacity = cd.style.opacity = visible ? 1 : 0;
    if (visible) {
      if (e.cejas === 'enojo') {
        ci.setAttribute('d', 'M 74 88 L 93 95');
        cd.setAttribute('d', 'M 126 88 L 107 95');
      } else if (e.cejas === 'triste') {
        ci.setAttribute('d', 'M 74 95 L 93 89');
        cd.setAttribute('d', 'M 126 95 L 107 89');
      } else {
        ci.setAttribute('d', 'M 74 87 Q 84 83 93 87');
        cd.setAttribute('d', 'M 126 87 Q 116 83 107 87');
      }
    }
  },

  /* Sacude a Puki. Para el pisotón de la frustración o el salto del susto. */
  sacudir(tipo) {
    if (!this.raiz) return;
    const g = this.raiz.querySelector('.puki-todo');
    g.classList.remove('sacude-susto', 'sacude-enojo', 'sacude-salto');
    void g.offsetWidth;   // fuerza el reinicio de la animación
    g.classList.add('sacude-' + (tipo || 'susto'));
  }
};
