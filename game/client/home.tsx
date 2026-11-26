/** 首页（转动的地球 + 行李牌写名字 + 两张票：建房间、加入）、扫码进房（航路图 + 登岛牌）、找不到房间、已离开。 */

import { useState } from 'preact/hooks';
import { NAME_MAX, ROOM_CODE } from '../shared/protocol.ts';
import { MAX_PLAYERS } from '../engine/rules.ts';
import { createRoom, store, type RoomConnection, type RoomInfo, type Snapshot } from './net.ts';
import { HOW_TO } from './text.ts';
import { JOIN_ART } from './art.ts';
import { Art, Stage } from './board.tsx';
import globeUrl from './globe.svg';

const TICKET = 'M8 0 H240 A8 8 0 0 0 256 0 H330 Q338 0 338 8 V104 Q338 112 330 112 H256 A8 8 0 0 0 240 112 H8 Q0 112 0 104 V8 Q0 0 8 0 Z';

function Footer({ back, href }: { back: string; href: string }) {
  return (
    <div class="b-foot">
      <a href={href}>{back}</a>
      <span class="b-mono">yxzzxy.com/dgxg</span>
    </div>
  );
}

export function Home() {
  const [name, setName] = useState(store.get('name') ?? '');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const nameLen = Array.from(name.trim()).length;
  const nameOk = nameLen >= 1 && nameLen <= NAME_MAX;

  const create = async () => {
    if (!nameOk) return setErr('先在行李牌上写你的名字');
    setBusy(true);
    setErr(null);
    try {
      const c = await createRoom(pw.trim() || null);
      store.set('name', name.trim());
      sessionStorage.setItem(`dgxg:create:${c}`, JSON.stringify({ name: name.trim(), password: pw.trim() || undefined }));
      location.hash = `#/${c}`;
    } catch (e) {
      setErr(e instanceof TypeError ? '连不上游戏服务器，请检查网络或稍后再试' : e instanceof Error ? e.message : '建房失败');
    } finally {
      setBusy(false);
    }
  };
  const join = () => {
    if (!ROOM_CODE.test(code)) return setErr('房间号是 4 位数字');
    if (nameOk) store.set('name', name.trim());
    location.hash = `#/${code}`;
  };

  return (
    <Stage bg="paper" label="大国小国 · 首页">
      <img class="b-globe" src={globeUrl} alt="大国小国的标志：一个慢慢转动的地球，正面是「大」「小」两块国土，中间一条国界，背面是一块「白」" />
      <div class="b-brand">
        <h1>大国小国</h1>
        <i />
        <p>基于微妙联系的猜词类身份推理游戏</p>
      </div>

      <div class="b-tag">
        <svg width="310" height="82" viewBox="0 0 310 82" aria-hidden="true">
          <path d="M20 41 C4 33 -16 40 -28 58 C-34 67 -32 80 -24 90" fill="none" stroke="#7a5a2e" stroke-width="1.5" stroke-linecap="round" />
          <path d="M24 0 H302 Q310 0 310 8 V74 Q310 82 302 82 H24 L0 60 V22 Z" fill="#e9d6ab" stroke="#1e1b17" stroke-width="1" />
          <path d="M27 5 H301 Q305 5 305 9 V73 Q305 77 301 77 H27 L5 57.6 V24.4 Z" fill="none" stroke="#a88b55" stroke-width="0.9" stroke-dasharray="3 2.4" />
          <circle cx="20" cy="41" r="9.5" fill="#f3e6c6" stroke="#a88b55" stroke-width="1.2" />
          <circle cx="20" cy="41" r="5" fill="#f4ecda" stroke="#1e1b17" stroke-width="0.9" />
        </svg>
        <label for="b-name">你的名字</label>
        <input id="b-name" class="b-uline" value={name} maxLength={NAME_MAX} placeholder="例：阿乐" onInput={(e) => setName(e.currentTarget.value)} />
        <span class="b-tag-max">最多 {NAME_MAX} 个字</span>
      </div>

      <div class="b-ticket" style={{ top: '452px', transform: 'rotate(1.2deg)' }}>
        <svg width="338" height="112" viewBox="0 0 338 112" aria-hidden="true">
          <defs>
            <clipPath id="b-t1">
              <path d={TICKET} />
            </clipPath>
          </defs>
          <path d={TICKET} fill="#fffaf0" />
          <rect x="248" y="0" width="90" height="112" fill="var(--acc)" clip-path="url(#b-t1)" />
          <path d={TICKET} fill="none" stroke="#1e1b17" stroke-width="1" />
          <path d="M248 11 V101" stroke="#1e1b17" stroke-width="1" stroke-dasharray="3 3" />
          <rect x="6" y="6" width="236" height="100" fill="none" stroke="#1e1b17" stroke-width="0.5" opacity="0.5" />
        </svg>
        <p class="b-ticket-h">
          <b>建一个房间</b>
          <span>NEW ROOM</span>
        </p>
        <label for="b-pw" class="b-ticket-l">
          口令
        </label>
        <input id="b-pw" class="b-uline b-ticket-pw" value={pw} maxLength={32} placeholder="可选，不填就不设" onInput={(e) => setPw(e.currentTarget.value)} />
        <span class="b-ticket-n">建好后把房间号发给朋友</span>
        <button type="button" class="b-stub b-stub--acc" disabled={busy} onClick={create}>
          <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 3 L17 10 L5 17 Z" fill="#ffffff" />
          </svg>
          <span>{busy ? '正在建' : '建房间'}</span>
        </button>
      </div>

      <form
        class="b-ticket"
        style={{ top: '586px', transform: 'rotate(-1deg)' }}
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <svg width="338" height="112" viewBox="0 0 338 112" aria-hidden="true">
          <path d={TICKET} fill="#fffaf0" stroke="#1e1b17" stroke-width="1" />
          <path d="M248 11 V101" stroke="#1e1b17" stroke-width="1" stroke-dasharray="3 3" />
          <rect x="6" y="6" width="236" height="100" fill="none" stroke="#1e1b17" stroke-width="0.5" opacity="0.5" />
          <rect x="256" y="20" width="70" height="72" fill="none" stroke="#1e1b17" stroke-width="1.2" />
        </svg>
        <p class="b-ticket-h">
          <b>加入房间</b>
          <span>JOIN</span>
        </p>
        <span class="b-digits" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span class={`b-digit ${i === Math.min(code.length, 3) ? 'is-next' : ''}`} key={i}>
              {code[i] ?? '·'}
            </span>
          ))}
        </span>
        <input
          class="b-digits-input"
          value={code}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          aria-label="4 位房间号"
          onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
        />
        <button type="submit" class="b-stub b-stub--join" disabled={code.length !== 4}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 10 H15 M10 5 L15 10 L10 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>加入</span>
        </button>
      </form>

      {err ? (
        <p class="b-home-err" role="alert">
          {err}
        </p>
      ) : null}

      <p class="b-howto">
        <button type="button" class="b-link" onClick={() => setRules(true)}>
          怎么玩？看一分钟规则
        </button>
        <span>6–12 人，面对面坐成一圈，各用各的手机。</span>
      </p>
      <Footer back="← 回到 游戏之致西柚" href="../#/games" />
      {rules ? <Rules onClose={() => setRules(false)} /> : null}
    </Stage>
  );
}

/** 规则速览：一张钉在图上的说明。 */
function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div class="b-rules" role="dialog" aria-modal="true" aria-label="规则速览">
      <div class="b-rules-sheet">
        <p class="b-rules-h">
          <b>一分钟规则</b>
          <button type="button" class="b-x" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </p>
        {HOW_TO.map(([t, d]) => (
          <p class="b-rules-row" key={t}>
            <b>{t}</b>
            <span>{d}</span>
          </p>
        ))}
        <p class="b-rules-foot">6–12 人，面对面坐成一圈，各用各的手机。裁判由系统担任。</p>
      </div>
    </div>
  );
}

export function JoinForm({ conn, code, info, snap }: { conn: RoomConnection; code: string; info: RoomInfo; snap: Snapshot }) {
  const [name, setName] = useState(store.get('name') ?? '');
  const [pw, setPw] = useState('');
  const ok = Array.from(name.trim()).length >= 1 && (!info.hasPassword || pw.trim().length > 0);
  const submit = () => {
    if (!ok) return;
    store.set('name', name.trim());
    conn.join(name.trim(), pw.trim() || undefined);
  };
  return (
    <Stage bg="day" label={`扫码进房：房间 ${code}`}>
      <Art svg={JOIN_ART.replaceAll('{{accent}}', 'var(--acc)')} />
      <svg width="390" height="844" viewBox="0 0 390 844" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0 }}>
        <g transform="translate(218 268)">
          <rect x="0" y="0" width="56" height="20" fill="#f6efde" stroke="#1e1b17" stroke-width="0.8" />
          <text x="28" y="15" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 14px; letter-spacing: 2px; fill: #1e1b17">
            {code}
          </text>
        </g>
      </svg>
      <div class="b-join-head">
        <p class="b-join-k">你被邀请到</p>
        <p class="b-join-code">
          <span>房间</span>
          <b>{code}</b>
        </p>
        <p class="b-join-chips">
          <span>{info.members} 人在房间里</span>
          <span>{info.hasPassword ? '有口令' : '没有口令'}</span>
        </p>
      </div>
      <form
        class="b-pass"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <svg width="338" height="226" viewBox="0 0 338 226" aria-hidden="true">
          <defs>
            <clipPath id="b-bp">
              <path d="M8 0 H246 A8 8 0 0 0 262 0 H330 Q338 0 338 8 V218 Q338 226 330 226 H262 A8 8 0 0 0 246 226 H8 Q0 226 0 218 V8 Q0 0 8 0 Z" />
            </clipPath>
          </defs>
          <g clip-path="url(#b-bp)">
            <rect width="338" height="226" fill="#fffaf0" />
            <rect width="254" height="34" fill="#1e1b17" />
            <rect x="254" width="84" height="226" fill="var(--acc)" />
            <g opacity="0.08" fill="none" stroke="#1e1b17" stroke-width="0.7">
              {Array.from({ length: 15 }, (_, i) => (
                <path key={i} d={`M-20 ${52 + i * 9} Q60 ${42 + i * 9} 130 ${52 + i * 9} T280 ${52 + i * 9}`} />
              ))}
            </g>
          </g>
          <path d="M8 0 H246 A8 8 0 0 0 262 0 H330 Q338 0 338 8 V218 Q338 226 330 226 H262 A8 8 0 0 0 246 226 H8 Q0 226 0 218 V8 Q0 0 8 0 Z" fill="none" stroke="#1e1b17" stroke-width="1" />
          <path d="M254 12 V214" stroke="#fffaf0" stroke-width="1.2" stroke-dasharray="3 3" />
          <g transform="translate(0 192)">
            {Array.from({ length: 52 }, (_, i) => (
              <rect key={i} x={18 + i * 3.1} y="0" width={[1.2, 2, 0.8, 1.6, 2.4, 1][i % 6]} height="22" fill="#1e1b17" />
            ))}
          </g>
          <g transform="translate(150 54)">
            <path d="M0 8 H70" stroke="#1e1b17" stroke-width="1.2" stroke-dasharray="0.1 5" stroke-linecap="round" />
            <circle cx="0" cy="8" r="3.2" fill="#1e1b17" />
            <circle cx="76" cy="8" r="4.5" fill="var(--acc)" stroke="#1e1b17" stroke-width="0.8" />
            <circle cx="76" cy="8" r="9" fill="none" stroke="var(--acc)" stroke-width="0.9" stroke-dasharray="2 2" />
          </g>
        </svg>
        <div class="b-pass-band">
          <span>登岛牌</span>
          <span class="b-cond">→ {code}</span>
        </div>
        <p class="b-pass-from">从你这里 · 到圆桌岛</p>
        <label class="b-pass-l" style={{ top: '76px' }} for="b-jname">
          乘客（你的名字）
        </label>
        <input id="b-jname" class="b-pass-in" style={{ top: '92px' }} value={name} maxLength={NAME_MAX} placeholder="大家在桌上看到的名字" autoFocus onInput={(e) => setName(e.currentTarget.value)} />
        {info.hasPassword ? (
          <>
            <label class="b-pass-l" style={{ top: '134px' }} for="b-jpw">
              口令（问邀请你的人）
            </label>
            <input id="b-jpw" class="b-pass-in b-pass-pw" style={{ top: '150px' }} value={pw} maxLength={32} onInput={(e) => setPw(e.currentTarget.value)} />
          </>
        ) : (
          <p class="b-pass-l" style={{ top: '140px' }}>
            这个房间没有口令，写好名字就能进
          </p>
        )}
        <button type="submit" class="b-pass-go" disabled={!ok}>
          <svg width="26" height="26" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10 H15 M10 5 L15 10 L10 15" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="b-vert">进入房间</span>
          <small class="b-cond">
            {info.members} / {MAX_PLAYERS}
          </small>
        </button>
      </form>
      {info.inGame ? <p class="b-join-warn">这个房间正在对局，这一局结束后才能加入。</p> : null}
      {snap.error ? (
        <p class="b-join-warn" role="alert">
          {snap.error.message}
        </p>
      ) : null}
      <Footer back="← 不是这个房间？回首页" href="#/" />
    </Stage>
  );
}

export function NotFound({ code }: { code: string }) {
  return (
    <Stage bg="day" label="找不到房间">
      <Art svg={JOIN_ART.replaceAll('{{accent}}', 'var(--acc)')} style={{ opacity: 0.45 }} />
      <div class="b-notice">
        <p class="b-notice-h">找不到房间 {code}</p>
        <p class="b-note">房间不存在，或者已经关闭了。问问邀请你的人房间号对不对。</p>
        <a class="b-btn" href="#/" style={{ marginTop: '14px', textDecoration: 'none' }}>
          <span>回到首页</span>
        </a>
      </div>
    </Stage>
  );
}

export function Bye({ text }: { text: string }) {
  return (
    <Stage bg="day" label="已离开房间">
      <div class="b-notice">
        <p class="b-notice-h">已离开房间</p>
        <p class="b-note">{text}</p>
        <a class="b-btn" href="#/" style={{ marginTop: '14px', textDecoration: 'none' }}>
          <span>回到首页</span>
        </a>
      </div>
    </Stage>
  );
}

export function Connecting({ text }: { text: string }) {
  return (
    <Stage bg="day" label={text}>
      <p class="b-center-msg">
        <span class="b-wait" style={{ justifyContent: 'center' }}>
          {text}
        </span>
      </p>
    </Stage>
  );
}

