/* ---------------------------------------------------------------------------
   i18n.js — Traducción por diccionario.

   Regla del proyecto: ningún texto visible se escribe dentro del código ni del
   HTML. Todo se pide con una clave, y el diccionario decide qué mostrar.

   Si una clave no existe en el idioma elegido, cae a español en vez de romperse
   o mostrar la clave cruda. Eso permite traducir de a poco.
--------------------------------------------------------------------------- */

const I18n = {
  idioma: 'es',
  base: 'es',

  disponibles() {
    return Object.keys(window.I18N || {});
  },

  usar(idioma) {
    if (window.I18N && window.I18N[idioma]) this.idioma = idioma;
    else console.warn('Idioma no disponible, se usa ' + this.base + ':', idioma);
    return this.idioma;
  },

  /* t = "translate". La función que se usa en todos lados. */
  t(clave, respaldo) {
    const dicc = window.I18N || {};
    const actual = dicc[this.idioma] || {};
    if (clave in actual) return actual[clave];
    const base = dicc[this.base] || {};
    if (clave in base) return base[clave];
    return respaldo !== undefined ? respaldo : clave;
  },

  /* Rellena todos los elementos del DOM con atributo data-i18n. */
  aplicar(raiz) {
    (raiz || document).querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = I18n.t(el.getAttribute('data-i18n'));
    });
    (raiz || document).querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', I18n.t(el.getAttribute('data-i18n-ph')));
    });
    (raiz || document).querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', I18n.t(el.getAttribute('data-i18n-aria')));
    });
  }
};
