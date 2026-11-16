/* Chat del asistente: la caja para escribir queda siempre abajo y visible, y los mensajes se recorren hacia arriba
   (como en WhatsApp), asi el usuario no tiene que volver a subir para escribir otra pregunta.
   Es un archivo independiente: no cambia app.js. Funciona con el asistente original y con el de la IA mientras
   la pagina tenga un contenedor de mensajes #chat (o .chat) y una caja de texto con su boton para enviar. */
(() => {
  const ENVIAR = /consultar|enviar|preguntar|mandar/i;

  /* Lo que se baja: la caja de texto con sus botones (Foto...) y el boton para enviar (Consultar) */
  function cajaDe(chat) {
    const scope = chat.parentElement;
    const input = [...scope.querySelectorAll('textarea, input:not([type]), input[type="text"], input[type="search"]')]
      .find(i => !chat.contains(i) && i.offsetParent !== null);
    if (!input) return null;
    const form = input.closest('form');
    if (form && !form.contains(chat)) return [form];                 // con <form>: se baja el formulario completo
    const fila = input.parentElement, partes = [fila];
    const esEnviar = b => b.getAttribute('type') === 'submit' || ENVIAR.test(b.textContent || b.value || '');
    if ([...fila.querySelectorAll('button, input[type="submit"]')].some(esEnviar)) return partes;
    let el = fila.parentElement;                                       // sin <form>: busca el boton de enviar cerca de la caja
    while (el && !el.contains(chat)) {
      const btn = [...el.querySelectorAll('button, input[type="submit"]')].find(b => !fila.contains(b) && esEnviar(b));
      if (btn) { partes.push(btn); break; }
      if (el === scope) break;
      el = el.parentElement;
    }
    return partes;
  }

  /* Altura del menu inferior del celular, para que la caja quede justo encima */
  function ajustar(dock) {
    const side = document.querySelector('.side');
    const abajo = side && getComputedStyle(side).position === 'fixed' ? side.offsetHeight : 0;
    document.documentElement.style.setProperty('--dock-b', abajo + 'px');
    document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  }

  function montar() {
    if (!/^#\/asistente/.test(location.hash)) return;
    const chat = document.querySelector('#chat, .chat');
    if (!chat || chat.dataset.dock) return;
    const caja = cajaDe(chat);
    if (!caja) return;
    chat.dataset.dock = '1';
    const dock = document.createElement('div');
    dock.className = 'chat-dock';
    chat.after(dock);
    dock.append(...caja);   // se mueven los mismos elementos: sus botones siguen funcionando igual
    ajustar(dock);
    if (window.ResizeObserver) new ResizeObserver(() => ajustar(dock)).observe(dock);
    /* cada mensaje nuevo se muestra completo, justo encima de la caja */
    new MutationObserver(ms => {
      if (!ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) return;
      requestAnimationFrame(() => {
        const ult = chat.lastElementChild; if (!ult) return;
        const libre = innerHeight - dock.offsetHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-b')) || 0);
        ult.scrollIntoView({ block: ult.offsetHeight > libre - 90 ? 'start' : 'end', behavior: 'smooth' });   // si es muy largo, se ve desde el inicio
      });
    }).observe(chat, { childList: true });
  }

  /* La seccion se dibuja de nuevo al cambiar de pagina: se revisa cada vez que cambia el contenido */
  let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; montar(); }); })
    .observe(document.body, { childList: true, subtree: true });
  addEventListener('hashchange', () => setTimeout(montar, 0));
  addEventListener('resize', () => { const d = document.querySelector('.chat-dock'); if (d) ajustar(d); });
})();
