/**
 * Pre-launch passphrase gate.
 *
 * This is a *soft* gate for a static site: it keeps casual visitors out while
 * the site is unfinished, but anyone reading the page source can get past it.
 * Only a salted hash is stored here, so the passphrase is not written in plain
 * text. To change it, run:
 *   node -e "console.log(require('crypto').createHash('sha256').update('youxizhi:NEW').digest('hex'))"
 * and paste the result below. Set GATE_HASH to '' to remove the gate entirely.
 */
const GATE_HASH = 'a654a3f837da5de82fad3782e998c3bb4c73ec02550234f9ff7d83f828ee95af';
const STORAGE_KEY = 'youxizhi-gate';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function remembered() {
  try {
    return localStorage.getItem(STORAGE_KEY) === GATE_HASH;
  } catch {
    return false;
  }
}

/** Resolves once the visitor has entered the passphrase (or it was remembered). */
export function gate() {
  if (!GATE_HASH || remembered()) return Promise.resolve();

  const loader = document.getElementById('loader');
  const form = loader?.querySelector('.gate');
  if (!form) return Promise.resolve();
  loader.classList.add('is-gated');
  const input = form.querySelector('input');
  const msg = form.querySelector('.gate-msg');
  setTimeout(() => input.focus(), 50);

  return new Promise((resolve) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = input.value.trim().toLowerCase();
      if (!value) return;
      const ok = (await sha256(`youxizhi:${value}`)) === GATE_HASH;
      if (!ok) {
        msg.textContent = '口令不对，再试一次';
        form.classList.remove('is-wrong');
        void form.offsetWidth; // restart the shake animation
        form.classList.add('is-wrong');
        input.select();
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, GATE_HASH);
      } catch {
        /* storage unavailable: they will be asked again next visit */
      }
      input.blur();
      loader.classList.remove('is-gated');
      resolve();
    });
  });
}
