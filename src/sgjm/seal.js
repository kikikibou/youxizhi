/**
 * How answers are checked without the answers being in the page (the repo is
 * public). Shared by the page and by scripts/build-sgjm.mjs, so it uses only
 * Web APIs that Node has too (crypto.subtle, TextEncoder, btoa / atob).
 *
 * For each slot and each accepted answer a (after normalizeAnswer):
 *   check(a)  = SHA-256("check|salt|slot|a") — what the page looks up
 *   wrap(a)   = SHA-256("wrap|salt|slot|a")  — unlocks the slot's key K
 *   K         = SHA-256("content|salt|slot|first accepted answer")
 * The note shown once a slot is solved is sealed with K (AES-GCM), and the
 * dictionary with SHA-256 of every slot's K in order. K only depends on the
 * first accepted answer, so editing the notes and rebuilding keeps players'
 * saved progress. This keeps answers out of plain sight; it does not stop
 * someone from trying names against the hashes on purpose.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = 'sgjm·2026-11';

/**
 * Answers are compared after this: case, full / half width, spaces and
 * punctuation don't count, and traditional (or Japanese) forms of the
 * characters that occur in the answers read as simplified.
 */
const VARIANTS = {
  馬: '马', 張: '张', 遼: '辽', 諸: '诸', 關: '关', 関: '关', 雲: '云', 長: '长', 橋: '桥', 紹: '绍',
  孫: '孙', 權: '权', 権: '权', 謀: '谋', 預: '预', 凱: '凯', 鍾: '钟', 锺: '钟', 會: '会', 劉: '刘',
  項: '项', 龐: '庞', 統: '统', 達: '达', 遠: '远', 穎: '颖', 鳳: '凤', 雛: '雏', 聖: '圣', 偉: '伟',
  瞞: '瞒', 吳: '吴', 呉: '吴', 兒: '儿', 爺: '爷', 晉: '晋',
};
export function normalizeAnswer(s) {
  return [...String(s).normalize('NFKC').toLowerCase()]
    .map((c) => VARIANTS[c] ?? c)
    .join('')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

const sha = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const checkOf = async (slot, norm) => hex(await sha(`check|${SALT}|${slot}|${norm}`));
export const wrapKeyOf = (slot, norm) => sha(`wrap|${SALT}|${slot}|${norm}`);
export const contentKeyOf = (slot, norm) => sha(`content|${SALT}|${slot}|${norm}`);

/** The dictionary's key: every slot's K, in SLOT_IDS order. */
export function dictionaryKeyOf(keys) {
  const all = new Uint8Array(keys.length * 32);
  keys.forEach((k, i) => all.set(k, i * 32));
  return sha(all);
}

const aesKey = (bytes) => crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);

/**
 * AES-GCM; returns base64 of IV + ciphertext. The IV comes from a hash of the
 * key and the text, so rebuilding unchanged content gives the same output
 * (clean diffs), and different texts under one key never share an IV.
 */
export async function seal(key, data) {
  const body = typeof data === 'string' ? enc.encode(data) : data;
  const both = new Uint8Array(key.length + body.length);
  both.set(key);
  both.set(body, key.length);
  const iv = (await sha(both)).subarray(0, 12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), body));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return toB64(out);
}

/** Opens what seal() made; throws when the key is wrong. */
export async function open(key, b64) {
  const all = fromB64(b64);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, await aesKey(key), all.subarray(12)));
}
export const openText = async (key, b64) => dec.decode(await open(key, b64));
