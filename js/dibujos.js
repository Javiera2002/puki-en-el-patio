/* ---------------------------------------------------------------------------
   dibujos.js — Los dibujos de los botones y de lo que el niño toca.

   Reemplazan a los emoji (DN-33). En la versión final los botones no llevan
   texto: el niño ve un dibujo y Puki lee cada opción mientras su botón se
   ilumina (DN-31).

   Criterios, por si hay que defenderlos:
   - Muestran la acción o el objeto, nunca una cara con emoción. Un botón con
     una cara feliz o triste le sugiere al niño qué sentir o cuál es la
     respuesta "buena". Por eso los personajes van sin cara.
   - Mismo trazo, mismo tamaño y la misma paleta suave en todos, para que
     ningún botón llame más la atención que otro.
   - Colores y formas de los personajes tomados de las imágenes de Javiera
     (DN-34): Puki verde salvia con orejas largas caídas y un mechón, Lira
     lila con orejas caídas y su conejito, Tobi amarillo con gorra roja.
   - Son SVG escritos a mano, de wireframe. Cuando existan los íconos finales
     (en el estilo de las imágenes), se reemplaza lo que devuelve `svg()` y
     nada más.

   El guion nombra el dibujo de cada opción (`dibujo: "convidar"`) y el motor
   lo pide por nombre. Para verlos todos juntos: dibujos_preview.html.
--------------------------------------------------------------------------- */

const Dibujos = (() => {

  const C = {
    linea:    '#37403C',
    puki:     '#AFCB94',
    puki2:    '#9CBB80',
    lira:     '#C9B6E6',
    lira2:    '#B7A0DD',
    tobi:     '#F6D77A',
    gorra:    '#D9453F',
    panza:    '#F4ECD2',
    conejito: '#F3E3C8',
    moneda:   '#F2C14E',
    pelota:   '#E8645A',
    mochila:  '#8FB4CC',
    mochila2: '#B7D0E0',
    madera:   '#D2A774',
    madera2:  '#B98A5A',
    huella:   '#96683F',
    barra:    '#4A86D8',
    patas:    '#E9B949',
    asiento:  '#4B5159',
    pan:      '#E8C48A',
    lechuga:  '#9CC77E',
    gusano:   '#E9A0B4',
    bote:     '#9DB39A',
    tunel:    '#9C8FB8',
    tunel2:   '#4E4466',
    aire:     '#8FB4CC',
    petalo:   '#F2A79E',
    bloque1:  '#F2C14E',
    bloque2:  '#8FB4CC',
    bloque3:  '#F2A79E'
  };

  /* ---- Personajes, vistos de lejos y sin cara ---------------------------- */

  /* Cuerpo, panza crema y cabeza. La cabeza está centrada en (x, y). */
  function cuerpo(x, y, color) {
    return `<path d="M ${x - 14} ${y + 38} Q ${x - 14} ${y + 13} ${x} ${y + 13} ` +
        `Q ${x + 14} ${y + 13} ${x + 14} ${y + 38} Z" fill="${color}"/>` +
      `<ellipse cx="${x}" cy="${y + 29}" rx="7.5" ry="6.5" fill="${C.panza}" stroke="none"/>` +
      `<circle cx="${x}" cy="${y}" r="10" fill="${color}"/>`;
  }

  /* Orejas largas y caídas, detrás de la cabeza (Puki y Lira). */
  function orejas(x, y, color) {
    return `<ellipse cx="${x - 11}" cy="${y + 5}" rx="4.5" ry="11" fill="${color}" ` +
        `transform="rotate(18 ${x - 11} ${y + 5})"/>` +
      `<ellipse cx="${x + 11}" cy="${y + 5}" rx="4.5" ry="11" fill="${color}" ` +
        `transform="rotate(-18 ${x + 11} ${y + 5})"/>`;
  }

  function puki(x, y) {
    return orejas(x, y, C.puki2) +
      // el mechón de la cabeza
      `<circle cx="${x - 3}" cy="${y - 10}" r="3" fill="${C.puki}"/>` +
      `<circle cx="${x + 1}" cy="${y - 12}" r="3" fill="${C.puki}"/>` +
      `<circle cx="${x + 4}" cy="${y - 9}" r="2.6" fill="${C.puki}"/>` +
      cuerpo(x, y, C.puki);
  }

  /* Lira, con su conejito de peluche en los brazos. */
  function lira(x, y) {
    return orejas(x, y, C.lira2) + cuerpo(x, y, C.lira) +
      `<ellipse cx="${x + 5}" cy="${y + 18}" rx="2" ry="4.5" fill="${C.conejito}" stroke-width="2"/>` +
      `<ellipse cx="${x + 9}" cy="${y + 18}" rx="2" ry="4.5" fill="${C.conejito}" stroke-width="2"/>` +
      `<circle cx="${x + 7}" cy="${y + 25}" r="5.5" fill="${C.conejito}" stroke-width="2.5"/>`;
  }

  /* Tobi, con la gorra roja puesta hacia atrás. `visera`: 'izq' o 'der'. */
  function tobi(x, y, visera) {
    const v = visera === 'izq' ? -1 : 1;
    return cuerpo(x, y, C.tobi) +
      `<path d="M ${x - 11} ${y - 1} A 11 11 0 0 1 ${x + 11} ${y - 1} Z" fill="${C.gorra}"/>` +
      `<path d="M ${x + 9 * v} ${y - 1} L ${x + 20 * v} ${y}" stroke="${C.gorra}" stroke-width="5"/>`;
  }

  /* Agranda un personaje alrededor de (cx, cy) sin engordar el trazo. */
  function grande(k, cx, cy, contenido) {
    return `<g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})" ` +
      `stroke-width="${(4 / k).toFixed(2)}">${contenido}</g>`;
  }

  /* ---- Objetos que se repiten -------------------------------------------- */

  function moneda(cx, cy, r) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.moneda}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" stroke-width="2" opacity=".45"/>`;
  }

  /* El sándwich de Tobi. `k` lo achica alrededor de (cx, cy). */
  function sandwich(k = 1, cx = 60, cy = 70) {
    const p = (x, y) => `${+(cx + (x - 60) * k).toFixed(1)} ${+(cy + (y - 70) * k).toFixed(1)}`;
    const t = k < 1 ? ' stroke-width="3"' : '';
    return `<path${t} d="M ${p(20, 84)} Q ${p(20, 98)} ${p(34, 98)} L ${p(86, 98)} ` +
        `Q ${p(100, 98)} ${p(100, 84)} Z" fill="${C.pan}"/>` +
      `<path${t} d="M ${p(16, 82)} Q ${p(26, 70)} ${p(36, 80)} Q ${p(46, 70)} ${p(56, 80)} ` +
        `Q ${p(66, 70)} ${p(76, 80)} Q ${p(86, 70)} ${p(96, 80)} Q ${p(102, 76)} ${p(104, 82)} Z" ` +
        `fill="${C.lechuga}"/>` +
      `<path${t} d="M ${p(18, 72)} Q ${p(18, 42)} ${p(60, 42)} Q ${p(102, 42)} ${p(102, 72)} Z" ` +
        `fill="${C.pan}"/>`;
  }

  /* La entrada del túnel del patio, con el interior oscuro. */
  function tunel(x0, x1) {
    const r = (x1 - x0) / 2, g = 14, y = 66;
    return `<path d="M ${x0} 104 L ${x0} ${y} A ${r} ${r} 0 0 1 ${x1} ${y} L ${x1} 104 Z" ` +
        `fill="${C.tunel}"/>` +
      `<path d="M ${x0 + g} 104 L ${x0 + g} ${y} A ${r - g} ${r - g} 0 0 1 ${x1 - g} ${y} ` +
        `L ${x1 - g} 104 Z" fill="${C.tunel2}"/>` +
      `<path d="M 2 104 L 118 104"/>`;
  }

  function bloque(x, y, w, h, color) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}"/>` +
      `<rect x="${x + 7}" y="${y + 6}" width="${w - 14}" height="${h - 12}" rx="3" ` +
        `stroke-width="2.5" opacity=".35"/>`;
  }

  /* Remolino de la guatita: una espiral que crece desde el centro. */
  function espiral(cx, cy, rMax, vueltas) {
    const pasos = 60;
    let d = '';
    for (let i = 0; i <= pasos; i++) {
      const a = (i / pasos) * vueltas * 2 * Math.PI;
      const r = (i / pasos) * rMax;
      d += (i ? ' L ' : 'M ') + (cx + r * Math.cos(a)).toFixed(1) + ' ' +
           (cy + r * Math.sin(a)).toFixed(1);
    }
    return `<path d="${d}" stroke-width="3.5"/>`;
  }

  /* ---- Los dibujos, por nombre ------------------------------------------ */

  const DIBUJOS = {

    /* E1 · ¿Qué hacemos con las monedas? */
    convidar:
      lira(22, 50) + tobi(98, 50, 'der') +
      `<path d="M 52 72 Q 44 58 38 48" stroke-dasharray="1 8"/>` +
      `<path d="M 68 72 Q 76 58 82 48" stroke-dasharray="1 8"/>` +
      moneda(36, 36, 7) + moneda(84, 36, 7) +
      `<ellipse cx="60" cy="100" rx="17" ry="7" fill="${C.moneda}"/>` +
      `<ellipse cx="60" cy="91" rx="17" ry="7" fill="${C.moneda}"/>` +
      `<ellipse cx="60" cy="82" rx="17" ry="7" fill="${C.moneda}"/>`,

    guardar:
      `<path d="M 46 38 Q 60 16 74 38"/>` +
      moneda(66, 30, 9) + moneda(82, 34, 9) +
      `<rect x="26" y="36" width="68" height="70" rx="20" fill="${C.mochila}"/>` +
      `<path d="M 28 56 Q 60 66 92 56"/>` +
      `<rect x="40" y="72" width="40" height="24" rx="8" fill="${C.mochila2}"/>`,

    /* E2 · ¿Qué hacemos por Lira? */
    invitar:
      lira(94, 46) +
      `<path d="M 6 72 L 18 72 M 2 83 L 16 83 M 6 94 L 18 94"/>` +
      `<circle cx="44" cy="83" r="19" fill="${C.pelota}"/>` +
      `<path d="M 26 80 Q 44 72 62 80" stroke="#fff" stroke-width="4"/>` +
      `<path d="M 40 65 Q 32 83 40 101" stroke="#fff" stroke-width="4"/>` +
      `<circle cx="44" cy="83" r="19"/>`,

    acompanar:
      puki(42, 54) + lira(78, 54) +
      `<path d="M 60 34 C 50 27 47 18 54 15 C 57 14 60 16 60 19 ` +
      `C 60 16 63 14 66 15 C 73 18 70 27 60 34 Z" fill="${C.petalo}"/>`,

    columpios:
      `<path d="M 26 24 L 12 106 M 26 24 L 38 106 M 94 24 L 82 106 M 94 24 L 108 106" stroke-width="9"/>` +
      `<path d="M 26 24 L 12 106 M 26 24 L 38 106 M 94 24 L 82 106 M 94 24 L 108 106" ` +
        `stroke="${C.patas}" stroke-width="4"/>` +
      `<rect x="16" y="18" width="88" height="11" rx="5" fill="${C.barra}"/>` +
      `<path d="M 48 29 L 48 80 M 72 29 L 72 80" stroke-width="3"/>` +
      `<rect x="40" y="78" width="40" height="10" rx="5" fill="${C.asiento}"/>`,

    /* EX · ¿Qué le decimos a Tobi? La guatita es la de Tobi: amarilla. */
    guatita:
      `<ellipse cx="42" cy="111" rx="14" ry="7" fill="${C.tobi}"/>` +
      `<ellipse cx="78" cy="111" rx="14" ry="7" fill="${C.tobi}"/>` +
      `<path d="M 16 2 L 16 66 Q 16 106 60 106 Q 104 106 104 66 L 104 2" fill="${C.tobi}"/>` +
      `<ellipse cx="60" cy="68" rx="30" ry="28" fill="${C.panza}" stroke="none"/>` +
      espiral(60, 68, 15, 2.2) +
      `<ellipse cx="27" cy="66" rx="11" ry="15" fill="${C.tobi}" transform="rotate(-25 27 66)"/>` +
      `<ellipse cx="93" cy="66" rx="11" ry="15" fill="${C.tobi}" transform="rotate(25 93 66)"/>`,

    chistoso:
      sandwich() +
      `<path d="M 82 76 Q 96 62 88 50 Q 82 40 90 32" stroke="${C.gusano}" stroke-width="9"/>` +
      `<circle cx="92" cy="30" r="2" fill="${C.linea}" stroke="none"/>` +
      `<path d="M 101 22 L 108 16 M 104 33 L 113 33 M 93 17 L 94 8" stroke-width="3"/>`,

    basurero:
      sandwich(0.36, 70, 16) +
      `<path d="M 62 34 L 62 40 M 78 34 L 78 40" stroke-width="3"/>` +
      `<path d="M 30 48 L 38 106 L 82 106 L 90 48 Z" fill="${C.bote}"/>` +
      `<path d="M 50 60 L 52 96 M 60 60 L 60 96 M 70 60 L 68 96" stroke-width="3"/>` +
      `<rect x="26" y="44" width="68" height="10" rx="4" fill="${C.bote}"/>`,

    /* E3 · Hay algo adentro... ¿Qué hacemos? */
    dejar_pelota:
      tunel(6, 78) +
      `<circle cx="42" cy="92" r="11" fill="${C.pelota}"/>` +
      `<path d="M 86 90 L 112 90 M 104 82 L 112 90 L 104 98" stroke-width="5"/>`,

    llamar_amigos:
      `<path d="M 12 50 Q 20 60 12 70 M 22 42 Q 34 60 22 78 M 32 34 Q 48 60 32 86"/>` +
      tobi(64, 48, 'izq') + lira(98, 48),

    /* Puki asomado al túnel: se le ve media cabeza, las orejas y el mechón. */
    mirar_despacito:
      orejas(92, 66, C.puki2) +
      `<circle cx="89" cy="54" r="3" fill="${C.puki}"/>` +
      `<circle cx="93" cy="52" r="3" fill="${C.puki}"/>` +
      `<circle cx="96" cy="55" r="2.6" fill="${C.puki}"/>` +
      `<ellipse cx="92" cy="68" rx="15" ry="14" fill="${C.puki}"/>` +
      tunel(4, 84) +
      `<circle cx="90" cy="66" r="3" fill="${C.linea}" stroke="none"/>` +
      `<circle cx="98" cy="66" r="3" fill="${C.linea}" stroke="none"/>`,

    /* E4 · ¿Qué hacemos ahora? "Toma aire conmigo... y sopla": Puki con el
       aire saliendo hacia arriba. */
    respirar:
      grande(1.5, 40, 64, puki(40, 46)) +
      `<path d="M 76 62 q 7 -6 0 -12 q -7 -6 0 -12 q 7 -6 0 -12" stroke="${C.aire}" stroke-width="4"/>` +
      `<path d="M 92 70 q 7 -6 0 -12 q -7 -6 0 -12 q 7 -6 0 -12 q -7 -6 0 -12" ` +
        `stroke="${C.aire}" stroke-width="4"/>`,

    intentar_solitos:
      bloque(38, 80, 44, 26, C.bloque1) + bloque(38, 54, 44, 26, C.bloque2) +
      `<g transform="rotate(-8 60 27)">${bloque(38, 14, 44, 26, C.bloque3)}</g>` +
      `<path d="M 26 20 L 32 22 M 24 32 L 32 32 M 94 22 L 88 24 M 96 34 L 88 34" stroke-width="3"/>`,

    ayuda_tobi:
      bloque(12, 80, 44, 26, C.bloque1) + bloque(12, 54, 44, 26, C.bloque2) +
      tobi(94, 50, 'der') +
      `<path d="M 82 72 Q 72 62 68 50" stroke-width="5"/>` +
      bloque(46, 24, 32, 22, C.bloque3),

    /* ---- Lo que el niño toca ---------------------------------------------- */

    /* E1: la caja del arenero, redonda, de madera, con una huella y un broche. */
    caja:
      `<path d="M 20 52 L 20 84 A 40 15 0 0 0 100 84 L 100 52 Z" fill="${C.madera2}"/>` +
      `<path d="M 20 70 A 40 15 0 0 0 100 70" stroke-width="3" opacity=".45"/>` +
      `<ellipse cx="60" cy="52" rx="40" ry="15" fill="${C.madera}"/>` +
      `<ellipse cx="60" cy="55" rx="8" ry="5.5" fill="${C.huella}" stroke="none"/>` +
      `<circle cx="48" cy="47" r="3" fill="${C.huella}" stroke="none"/>` +
      `<circle cx="55" cy="44" r="3" fill="${C.huella}" stroke="none"/>` +
      `<circle cx="65" cy="44" r="3" fill="${C.huella}" stroke="none"/>` +
      `<circle cx="72" cy="47" r="3" fill="${C.huella}" stroke="none"/>` +
      `<rect x="55" y="64" width="10" height="12" rx="2" fill="${C.moneda}" stroke-width="2.5"/>`,

    /* EX: la caja cerrada que Tobi trae "como un trofeo de chef". */
    caja_tobi:
      `<rect x="20" y="52" width="80" height="50" rx="6" fill="${C.tobi}"/>` +
      `<path d="M 50 40 Q 60 26 70 40"/>` +
      `<rect x="14" y="38" width="92" height="17" rx="6" fill="${C.gorra}"/>` +
      `<path d="M 60 55 L 60 102" stroke-width="3" opacity=".35"/>`,

    /* El color lo pone el CSS (--bloque), para que la torre alterne colores. */
    bloque:
      `<rect x="14" y="16" width="92" height="88" rx="14" fill="var(--bloque, ${C.bloque1})"/>` +
      `<rect x="30" y="32" width="60" height="56" rx="8" stroke-width="3" opacity=".35"/>`
  };

  /* Para la hoja de dibujos: qué representa cada uno. */
  const DESCRIPCION = {
    convidar:         'Monedas que se reparten entre Lira (lila) y Tobi (amarillo, gorra roja).',
    guardar:          'Monedas que entran a una mochila.',
    invitar:          'Una pelota que rueda hacia Lira.',
    acompanar:        'Puki y Lira juntos, con un corazón.',
    columpios:        'Un columpio, con los colores del patio.',
    guatita:          'La guatita de Tobi con un remolino, sujeta con las dos manos.',
    chistoso:         'El sándwich con un gusanito que se asoma.',
    basurero:         'El sándwich cayendo al basurero.',
    dejar_pelota:     'La pelota en el túnel y una flecha que se aleja.',
    llamar_amigos:    'Ondas de voz que llegan a Tobi y a Lira.',
    mirar_despacito:  'Puki (orejas largas y mechón) asomándose al túnel.',
    respirar:         'Puki tomando aire, con el aire subiendo.',
    intentar_solitos: 'Una torre y un bloque que se está poniendo.',
    ayuda_tobi:       'Tobi pasando un bloque para la torre.',
    caja:             'La caja del arenero: redonda, de madera, con una huella.',
    caja_tobi:        'La caja cerrada que trae Tobi.',
    bloque:           'Un bloque de la torre.'
  };

  return {
    /* El SVG del dibujo, o null si no existe (el motor usa entonces el emoji). */
    svg(nombre) {
      const d = DIBUJOS[nombre];
      if (!d) return null;
      return `<svg class="dib dib-${nombre}" viewBox="0 0 120 120" aria-hidden="true" ` +
        `fill="none" stroke="${C.linea}" stroke-width="4" stroke-linecap="round" ` +
        `stroke-linejoin="round">${d}</svg>`;
    },
    /* El dibujo, o el respaldo (un emoji) si ese dibujo no existe. */
    /* Los botones se ven como imágenes PNG que hace Javiera, en
       media/botones/<nombre>.png. Si el archivo todavía no existe, queda el
       emoji de respaldo. Los SVG de este archivo ya no se muestran: su
       estética no calzaba con la de los personajes. */
    html(nombre, respaldo) {
      const r = respaldo || '';
      if (!nombre) return r;
      const rAttr = r.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<img class="dib dib-png" src="media/botones/${nombre}.png" alt="" ` +
        `data-r="${rAttr}" onerror="this.replaceWith(document.createTextNode(this.dataset.r))">`;
    },
    nombres() { return Object.keys(DIBUJOS); },
    descripcion(nombre) { return DESCRIPCION[nombre] || ''; }
  };
})();
