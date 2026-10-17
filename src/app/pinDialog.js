import { h } from '../core/ui/dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { unlockWithPin, lockoutSeconds } from './workshop.js';
import { PIN_PATTERN } from './workshopPin.js';

/**
 * Diálogo para ingresar el PIN. No explica qué se desbloquea: solo pide el PIN.
 * @returns {Promise<boolean>}  true si entró
 */
export function openPinDialog() {
  return new Promise((resolve) => {
    let done = false;
    let timer = null;

    // sin autocompletado ni administradores de contraseñas: es un PIN del sitio, no una cuenta
    const input = h('input', {
      type: 'password',
      inputmode: 'numeric',
      autocomplete: 'off',
      maxlength: 12,
      spellcheck: 'false',
      enterkeyhint: 'done',
      class: 'text-input pin-input',
      'aria-label': t('pin.label'),
      'aria-describedby': 'pin-msg',
      'data-1p-ignore': 'true',
      'data-lpignore': 'true',
    });
    const reveal = h('button', { class: 'icon-btn pin-reveal', type: 'button', 'aria-pressed': 'false', 'aria-label': t('pin.show'), title: t('pin.show'), onclick: () => toggleReveal() }, icon('eye', 20));
    const message = h('p', { class: 'pin-msg', id: 'pin-msg', role: 'alert' });
    const submit = h('button', { class: 'btn primary big pin-submit', type: 'submit' }, t('pin.enter'));

    const finish = (ok) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      dialog.close();
      resolve(ok);
    };
    const toggleReveal = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(show));
      reveal.setAttribute('aria-label', show ? t('pin.hide') : t('pin.show'));
      reveal.title = show ? t('pin.hide') : t('pin.show');
      reveal.replaceChildren(icon(show ? 'eyeOff' : 'eye', 20));
      input.focus();
    };
    /** Aviso debajo del campo: `invalid` lo marca como error (rojo y sacudida); si no, es un aviso de espera. */
    const say = (text, invalid = false) => {
      message.textContent = text;
      message.classList.toggle('lock', !!text && !invalid);
      input.setAttribute('aria-invalid', String(invalid));
      if (invalid) {
        input.classList.remove('shake');
        void input.offsetWidth; // reinicia la animación
        input.classList.add('shake');
      }
    };
    /** Demasiados intentos: se bloquea el campo y se muestra la cuenta regresiva. */
    const lock = (seconds) => {
      input.disabled = submit.disabled = reveal.disabled = true;
      say(t('pin.locked', { s: seconds }));
      clearInterval(timer);
      timer = setInterval(() => {
        const left = lockoutSeconds();
        if (left > 0) return say(t('pin.locked', { s: left }));
        clearInterval(timer);
        input.disabled = submit.disabled = reveal.disabled = false;
        say('');
        input.focus();
      }, 1000);
    };

    const dialog = h(
      'dialog',
      { class: 'dialog pin-dialog', 'aria-labelledby': 'pin-title' },
      h(
        'form',
        {
          class: 'pin-form',
          method: 'dialog',
          onsubmit: async (e) => {
            e.preventDefault();
            const pin = input.value.trim();
            if (!PIN_PATTERN.test(pin)) return say(t('pin.wrong'), true);
            say(''); // el aviso del intento anterior no se queda mientras se verifica el nuevo
            submit.disabled = true;
            submit.textContent = t('pin.checking');
            const r = await unlockWithPin(pin);
            submit.textContent = t('pin.enter');
            if (r.ok) return finish(true);
            input.value = '';
            if (r.lockedFor) return lock(r.lockedFor);
            submit.disabled = false;
            say(t('pin.wrong'), true);
            input.focus();
          },
        },
        h('div', { class: 'pin-lock', 'aria-hidden': 'true' }, icon('lock', 26)),
        h('h2', { class: 'pin-title', id: 'pin-title' }, t('pin.heading')),
        h('div', { class: 'pin-field' }, input, reveal),
        message,
        submit,
        h('button', { class: 'link-btn pin-cancel', type: 'button', onclick: () => finish(false) }, t('pin.cancel')),
      ),
    );
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') say('');
    });
    // clic en el fondo oscuro: cierra, como Escape
    dialog.addEventListener('mousedown', (e) => {
      if (e.target === dialog) finish(false);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      finish(false);
    });
    document.body.append(dialog);
    dialog.showModal();
    const wait = lockoutSeconds();
    if (wait) lock(wait);
    else input.focus();
  });
}
