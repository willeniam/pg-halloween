// お菓子キャッチ：上から見た部屋で、フランケンが投げるキャンディーをおばけがかごで受け止める
// CandyCatch.start(opts) で開始し、落とすか音楽が終わったら opts.onEnd({ cleared, meters, unit }) を呼ぶ。
const CandyCatch = (() => {
  'use strict';

  // 座標は部屋の単位。画面に収まるよう拡大して中央に置く
  const ROOM_W = 480, ROOM_H = 320;
  const WALL = 18;
  const AREA = { x1: 60, x2: 420, y1: 96, y2: 232 };      // キャンディーが落ちる範囲
  const MOVE = { x1: 40, x2: 440, y1: 84, y2: 246 };      // おばけが動ける範囲
  const FRANK_X = [120, 240, 360];
  const TOP_FOOT = 62, BOTTOM_FOOT = 298;                  // フランケンの足もとの y
  const SPEED = 300;       // おばけの移動速度
  const CATCH_R = 26;      // 落下点の円の半径
  const BODY_R = 22, BODY_DY = -4;  // おばけの当たり判定（円）。落下点の円と重なれば受け止められる
  const REACH = 0.7;       // 次の落下点は、移動速度 × 残り時間 × REACH 以内に置く
  const PIX = 3;           // ドット絵の1ドット
  const WINDUP = 0.35;     // 投げる前に構える時間（秒）
  const FIRST_THROW = 0.6;
  const INTRO_MS = 2600;
  const OUTRO_MS = 1400;
  const FALLBACK_MS = 60000;
  const CANDY_COLORS = ['#ff5a8a', '#ffcf4a', '#7ef0ff', '#b48bff', '#7dff9a', '#ff8a2a'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // 経過時間に応じた飛ぶ時間と投げる間隔（秒）
  const flightTime = (t) => Math.max(0.8, 1.6 - t * 0.012);
  const throwGap = (t) => Math.max(0.5, 1.6 - t * 0.016);

  // フランケン（10×12 ドット）。下の列は背中向き
  const FRONT = [
    '..HHHHHH..',
    '.HHHHHHHH.',
    '.HGKGKGGH.',
    'BGEGGGGEGB',
    '.GGGGGGGG.',
    '.GGMMMMGG.',
    '..GGGGGG..',
    '.CCCWWCCC.',
    'GCCCCCCCCG',
    'GCCCCCCCCG',
    '.CCC..CCC.',
    '.SS....SS.',
  ];
  const BACK = [
    '..HHHHHH..',
    '.HHHHHHHH.',
    '.HHHHHHHH.',
    'BHHHHHHHHB',
    '.GHHHHHHG.',
    '.GGGGGGGG.',
    '..GGGGGG..',
    '.CCCCCCCC.',
    'GCCCCCCCCG',
    'GCCCCCCCCG',
    '.CCC..CCC.',
    '.SS....SS.',
  ];
  // 両手を上げたポーズ
  const raise = (rows) => rows.map((r, i) => {
    if (i === 6 || i === 7) return 'G' + r.slice(1, 9) + 'G';
    if (i === 8 || i === 9) return '.' + r.slice(1, 9) + '.';
    return r;
  });
  const FRONT_UP = raise(FRONT), BACK_UP = raise(BACK);
  const PAL = {
    H: '#16101e', G: '#72c24c', K: '#2a3a20', E: '#1b1030', B: '#a8aeb6',
    M: '#2a3a20', C: '#3d2c5c', W: '#d8d0e8', S: '#0a0612',
  };

  const faces = {};
  for (const n of ['normal', 'happy', 'scared']) {
    const img = new Image();
    img.addEventListener('load', () => { faces[n] = img; });
    img.src = `assets/ghost_${n}.png`;
  }

  let el, cv, ctx, scoreEl, unitEl, barEl, msgEl, titleEl, hintEl;
  let st = null;
  let scale = 1, ox = 0, oy = 0;

  function init() {
    el = document.getElementById('cat-run');
    cv = document.getElementById('cr-canvas');
    ctx = cv.getContext('2d');
    scoreEl = document.getElementById('cr-score');
    unitEl = document.getElementById('cr-unit');
    barEl = document.getElementById('cr-bar');
    msgEl = document.getElementById('cr-msg');
    titleEl = document.getElementById('cr-title');
    hintEl = document.getElementById('cr-hint');
    // 押した場所からずらした分だけおばけを動かす（指でおばけが隠れないように）
    el.addEventListener('pointerdown', (e) => {
      if (!st) return;
      e.preventDefault();
      const p = toRoom(e);
      st.drag = { id: e.pointerId, sx: p.x, sy: p.y, px: st.player.x, py: st.player.y, tx: st.player.x, ty: st.player.y };
    });
    el.addEventListener('pointermove', (e) => {
      if (!st || !st.drag || st.drag.id !== e.pointerId) return;
      const p = toRoom(e), d = st.drag;
      d.tx = d.px + p.x - d.sx;
      d.ty = d.py + p.y - d.sy;
    });
    const up = (e) => { if (st && st.drag && st.drag.id === e.pointerId) st.drag = null; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => { if (st) resize(); });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    scale = Math.min(cv.width / ROOM_W, cv.height / ROOM_H);
    ox = (cv.width - ROOM_W * scale) / 2;
    oy = (cv.height - ROOM_H * scale) / 2;
  }

  function toRoom(e) {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return { x: ((e.clientX - r.left) * dpr - ox) / scale, y: ((e.clientY - r.top) * dpr - oy) / scale };
  }

  function say(text, cls) {
    msgEl.innerHTML = text;
    msgEl.className = 'cr-msg';
    void msgEl.offsetWidth;
    msgEl.className = 'cr-msg show ' + (cls || '');
  }

  // ===== 開始・終了 =====
  function start(opts) {
    if (!el) init();
    el.hidden = false;
    document.body.classList.add('cat-active');
    resize();
    const now = performance.now();
    st = {
      opts,
      phase: 'intro',
      t0: now,
      last: now,
      phaseAt: now,
      clock: 0,
      runT: 0,
      player: { x: ROOM_W / 2, y: (MOVE.y1 + MOVE.y2) / 2, vx: 0, face: 'normal', faceUntil: 0 },
      keys: new Set(),
      drag: null,
      franks: FRANK_X.flatMap((x) => [{ x, top: true, upUntil: 0 }, { x, top: false, upUntil: 0 }]),
      candies: [],
      splats: [],
      pops: [],
      nextThrow: FIRST_THROW,
      lastLand: null,
      score: 0,
      musicOk: false,
      raf: 0,
    };
    titleEl.textContent = 'お菓子キャッチ！';
    hintEl.innerHTML = '<span class="k-pc">矢印キー / ドラッグ</span><span class="k-touch">指をすべらせて</span>移動 ・ ○の場所でキャンディーを受け止めよう！';
    scoreEl.textContent = '0';
    unitEl.textContent = '個';
    barEl.style.width = '0%';
    say('フランケンがお菓子を投げてくる！<span class="cr-key"><span class="k-pc">← ↑ ↓ →</span><span class="k-touch">スライド</span></span><small>○の場所でキャッチ</small>', 'intro');

    const m = opts.music;
    if (m) {
      m.muted = !!opts.muted;
      m.currentTime = 0;
      m.onended = () => { if (st && st.opts === opts) clear(); };
      m.play().then(() => { if (st && st.opts === opts) st.musicOk = true; }).catch(() => {});
    }
    st.raf = requestAnimationFrame(frame);
  }

  function stopMusic() {
    const m = st && st.opts.music;
    if (!m) return;
    m.onended = null;
    m.pause();
  }

  function crash() {
    if (st.phase !== 'run' || st.opts.invincible) return;
    st.phase = 'crash';
    st.phaseAt = performance.now();
    setFace('scared', Infinity);
    stopMusic();
    st.opts.sound && st.opts.sound('crash');
    say(`落としちゃった！<small>${st.score} 個</small>`, 'crash');
  }

  function clear() {
    if (st.phase === 'crash' || st.phase === 'clear') return;
    st.phase = 'clear';
    st.phaseAt = performance.now();
    st.candies = [];
    setFace('happy', Infinity);
    stopMusic();
    st.opts.sound && st.opts.sound('clear');
    say(`取りきった！<small>${st.score} 個</small>`, 'clear');
  }

  function end() {
    const s = st;
    const result = { cleared: s.phase === 'clear', meters: s.score, unit: '個' };
    abort();
    s.opts.onEnd && s.opts.onEnd(result);
  }

  function abort() {
    if (!st) return;
    stopMusic();
    cancelAnimationFrame(st.raf);
    st = null;
    el.hidden = true;
    msgEl.className = 'cr-msg';
    unitEl.textContent = 'm';
    document.body.classList.remove('cat-active');
  }

  // ===== 入力 =====
  const DIRS = {
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  };
  function keyDown(e) {
    if (!st || !DIRS[e.code]) return;
    e.preventDefault();
    st.keys.add(e.code);
  }
  function keyUp(e) {
    if (!st || !DIRS[e.code]) return;
    e.preventDefault();
    st.keys.delete(e.code);
  }

  function setFace(face, sec) {
    st.player.face = face;
    st.player.faceUntil = st.clock + sec;
  }

  // ===== 更新 =====
  function frame(t) {
    if (!st) return;
    const dt = Math.min(0.034, (t - st.last) / 1000);
    st.last = t;
    update(dt, t);
    if (!st) return;
    draw();
    st.raf = requestAnimationFrame(frame);
  }

  function movePlayer(dt) {
    const p = st.player;
    let dx = 0, dy = 0;
    for (const k of st.keys) { dx += DIRS[k][0]; dy += DIRS[k][1]; }
    const ox0 = p.x;
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      p.x += (dx / n) * SPEED * dt;
      p.y += (dy / n) * SPEED * dt;
    } else if (st.drag) {
      const d = st.drag;
      const ddx = d.tx - p.x, ddy = d.ty - p.y, dist = Math.hypot(ddx, ddy), step = SPEED * dt;
      if (dist > step) { p.x += (ddx / dist) * step; p.y += (ddy / dist) * step; }
      else { p.x = d.tx; p.y = d.ty; }
    }
    p.x = clamp(p.x, MOVE.x1, MOVE.x2);
    p.y = clamp(p.y, MOVE.y1, MOVE.y2);
    p.vx = (p.x - ox0) / Math.max(dt, 0.001);
  }

  // 前の落下点から間に合う範囲で、次の落下点を決める
  function chooseTarget(from, avail) {
    const maxD = Math.max(30, SPEED * avail * REACH);
    const minD = Math.min(60, maxD * 0.5);
    for (let i = 0; i < 30; i++) {
      const x = rand(AREA.x1, AREA.x2), y = rand(AREA.y1, AREA.y2);
      const d = Math.hypot(x - from.x, y - from.y);
      if (d <= maxD && d >= minD) return { x, y };
    }
    const a = rand(0, Math.PI * 2), d = maxD * 0.6;
    return { x: clamp(from.x + Math.cos(a) * d, AREA.x1, AREA.x2), y: clamp(from.y + Math.sin(a) * d, AREA.y1, AREA.y2) };
  }

  const catching = (c) => Math.hypot(st.player.x - c.tx, st.player.y + BODY_DY - c.ty) <= CATCH_R + BODY_R;

  function throwCandy() {
    const s = st;
    const free = s.franks.filter((f) => f.upUntil <= s.runT);
    const f = pick(free.length ? free : s.franks);
    const launch = s.runT + WINDUP;
    const last = s.lastLand || { x: s.player.x, y: s.player.y, t: s.runT };
    const land = Math.max(launch + flightTime(s.runT), last.t + 0.3);
    const tg = chooseTarget(last, land - last.t);
    f.upUntil = launch;
    s.candies.push({
      f, fx: f.x, fy: f.top ? TOP_FOOT - 40 : BOTTOM_FOOT - 40,
      tx: tg.x, ty: tg.y, shown: s.runT, launch, land,
      color: pick(CANDY_COLORS), spin: rand(-12, 12),
    });
    s.lastLand = { x: tg.x, y: tg.y, t: land };
  }

  function update(dt, t) {
    const s = st;
    s.clock += dt;
    if (s.phase === 'intro' && t - s.phaseAt > INTRO_MS) {
      s.phase = 'run';
      s.phaseAt = t;
      msgEl.className = 'cr-msg';
    }
    if ((s.phase === 'crash' || s.phase === 'clear') && t - s.phaseAt > OUTRO_MS) { end(); return; }

    if (s.phase !== 'crash') movePlayer(dt);
    if (s.player.faceUntil <= s.clock) s.player.face = 'normal';

    if (s.phase === 'run') {
      s.runT += dt;
      s.nextThrow -= dt;
      if (s.nextThrow <= 0) {
        throwCandy();
        s.nextThrow = throwGap(s.runT);
      }
      for (const c of s.candies) {
        if (c.done || s.runT < c.land) continue;
        c.done = true;
        if (catching(c)) {
          s.score++;
          scoreEl.textContent = s.score;
          s.pops.push({ x: c.tx, y: c.ty - 30, life: 1 });
          setFace('happy', 0.35);
          s.opts.sound && s.opts.sound('correct');
        } else {
          s.splats.push({ x: c.tx, y: c.ty, color: c.color });
          crash();
          break;
        }
      }
      s.candies = s.candies.filter((c) => !c.done);
    }
    for (const p of s.pops) { p.life -= dt * 1.6; p.y -= dt * 30; }
    s.pops = s.pops.filter((p) => p.life > 0);

    // 曲の進み具合
    const m = s.opts.music;
    let prog;
    if (s.musicOk && m && m.duration > 0) prog = m.currentTime / m.duration;
    else {
      prog = (t - s.t0) / FALLBACK_MS;
      if (prog >= 1 && s.phase === 'run') clear();
    }
    if (s.phase === 'run' || s.phase === 'intro') barEl.style.width = Math.min(100, prog * 100) + '%';
    if (s.phase === 'clear') barEl.style.width = '100%';
  }

  // ===== 描画 =====
  function draw() {
    const s = st;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    drawRoom(s.clock);
    for (const sp of s.splats) drawSplat(sp);
    for (const c of s.candies) drawTarget(c, s);
    for (const f of s.franks) if (f.top) drawFrank(f, s);
    drawPlayer(s);
    for (const f of s.franks) if (!f.top) drawFrank(f, s);
    for (const c of s.candies) drawFlying(c, s);
    for (const p of s.pops) {
      ctx.fillStyle = `rgba(255, 207, 74, ${p.life})`;
      ctx.font = '400 18px "Dela Gothic One", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', p.x, p.y);
    }
    if (s.opts.debug) drawDebug(s);
  }

  // デバッグ用：おばけの当たり判定と、キャンディーが落ちる範囲
  function drawDebug(s) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#5ff4ff';
    ctx.beginPath();
    ctx.arc(s.player.x, s.player.y + BODY_DY, BODY_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff3d6a';
    ctx.strokeRect(AREA.x1, AREA.y1, AREA.x2 - AREA.x1, AREA.y2 - AREA.y1);
    ctx.fillStyle = '#fff';
    ctx.font = '700 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`t ${s.runT.toFixed(1)}  flight ${flightTime(s.runT).toFixed(2)}  gap ${throwGap(s.runT).toFixed(2)}`, 22, 30);
    ctx.restore();
  }

  function drawRoom(clock) {
    // 壁
    ctx.fillStyle = '#1b0f30';
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    ctx.strokeStyle = 'rgba(90, 71, 133, .5)';
    ctx.lineWidth = 1;
    for (let y = 0; y < ROOM_H; y += 9) {
      for (let x = (y / 9) % 2 ? 0 : 9; x < ROOM_W; x += 18) ctx.strokeRect(x + 0.5, y + 0.5, 18, 9);
    }
    // 床板
    const fw = ROOM_W - WALL * 2, fh = ROOM_H - WALL * 2;
    for (let i = 0, y = WALL; y < WALL + fh; i++, y += 20) {
      ctx.fillStyle = i % 2 ? '#3b2418' : '#43291b';
      ctx.fillRect(WALL, y, fw, Math.min(20, WALL + fh - y));
      ctx.fillStyle = 'rgba(0, 0, 0, .35)';
      ctx.fillRect(WALL, y, fw, 1);
      for (let x = WALL + (i % 3) * 37 + 20; x < WALL + fw; x += 111) ctx.fillRect(x, y, 1, 20);
    }
    // じゅうたん
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ROOM_W / 2, ROOM_H / 2, 160, 74, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a1f5c';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff7b1c';
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 207, 74, .6)';
    ctx.beginPath();
    ctx.ellipse(ROOM_W / 2, ROOM_H / 2, 146, 62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 四すみのかぼちゃ
    for (const [x, y] of [[36, 36], [444, 36], [36, 284], [444, 284]]) drawPumpkin(x, y, 13, clock);
    // 左右の壁のろうそく
    for (const x of [9, ROOM_W - 9]) drawCandle(x, ROOM_H / 2, clock);
    // 上のすみのくもの巣
    ctx.strokeStyle = 'rgba(220, 210, 255, .35)';
    ctx.lineWidth = 0.8;
    for (const [cx, sx] of [[WALL, 1], [ROOM_W - WALL, -1]]) {
      ctx.beginPath();
      for (let a = 0; a <= 4; a++) {
        const ang = (a / 4) * (Math.PI / 2);
        ctx.moveTo(cx, WALL);
        ctx.lineTo(cx + sx * Math.cos(ang) * 40, WALL + Math.sin(ang) * 40);
      }
      for (const r of [14, 26, 38]) {
        for (let a = 0; a <= 4; a++) {
          const ang = (a / 4) * (Math.PI / 2);
          const x = cx + sx * Math.cos(ang) * r, y = WALL + Math.sin(ang) * r;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    // まわりを暗く
    const g = ctx.createRadialGradient(ROOM_W / 2, ROOM_H / 2, 90, ROOM_W / 2, ROOM_H / 2, 300);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, .45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  }

  function drawPumpkin(x, y, r, clock) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 140, 30, .7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#d9560a';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.45, y, r * 0.6, r * 0.9, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.45, y, r * 0.6, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff7b1c';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.6, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 216, 74, ${0.75 + 0.25 * Math.sin(clock * 7 + x)})`;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.1); ctx.lineTo(x - r * 0.25, y - r * 0.4); ctx.lineTo(x - r * 0.12, y);
    ctx.moveTo(x + r * 0.5, y - r * 0.1); ctx.lineTo(x + r * 0.25, y - r * 0.4); ctx.lineTo(x + r * 0.12, y);
    ctx.moveTo(x - r * 0.5, y + r * 0.2); ctx.quadraticCurveTo(x, y + r * 0.75, x + r * 0.5, y + r * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  function drawCandle(x, y, clock) {
    const fl = 0.8 + 0.2 * Math.sin(clock * 11 + x);
    const g = ctx.createRadialGradient(x, y - 10, 1, x, y - 10, 40);
    g.addColorStop(0, `rgba(255, 200, 90, ${0.35 * fl})`);
    g.addColorStop(1, 'rgba(255, 200, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 50, 80, 80);
    ctx.fillStyle = '#efe6d0';
    ctx.fillRect(x - 3, y - 6, 6, 14);
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 2.2 * fl, 4 * fl, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSprite(rows, cx, footY) {
    const x0 = Math.round(cx - (rows[0].length * PIX) / 2);
    const y0 = Math.round(footY - rows.length * PIX);
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) {
        const c = rows[j][i];
        if (c === '.') continue;
        ctx.fillStyle = PAL[c];
        ctx.fillRect(x0 + i * PIX, y0 + j * PIX, PIX + 0.05, PIX + 0.05);
      }
    }
  }

  function drawFrank(f, s) {
    const foot = f.top ? TOP_FOOT : BOTTOM_FOOT;
    const up = f.upUntil > s.runT && s.phase === 'run';
    const bob = up ? -3 : Math.round(Math.sin(s.clock * 3 + f.x) * 1);
    ctx.fillStyle = 'rgba(0, 0, 0, .4)';
    ctx.beginPath();
    ctx.ellipse(f.x, foot, 14, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(190, 140, 255, .8)';
    ctx.shadowBlur = 8;
    drawSprite(f.top ? (up ? FRONT_UP : FRONT) : (up ? BACK_UP : BACK), f.x, foot + bob);
    ctx.restore();
  }

  function drawPlayer(s) {
    const p = s.player;
    const bob = Math.sin(s.clock * 4) * 2;
    const tilt = clamp(p.vx / 2000, -0.15, 0.15);
    ctx.fillStyle = 'rgba(0, 0, 0, .4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 22, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(tilt);
    const img = faces[p.face] || faces.normal;
    ctx.shadowColor = 'rgba(200, 180, 255, .7)';
    ctx.shadowBlur = 10;
    if (img) ctx.drawImage(img, -24, -34, 48, 48);
    else {
      ctx.fillStyle = '#f4efff';
      ctx.beginPath();
      ctx.arc(0, -12, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // かご
    ctx.strokeStyle = '#d08a3a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 8, 13, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#a0601e';
    ctx.beginPath();
    ctx.moveTo(-15, 8); ctx.lineTo(15, 8); ctx.lineTo(11, 22); ctx.lineTo(-11, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 30, 5, .6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const y of [12.5, 17]) { ctx.moveTo(-14, y); ctx.lineTo(14, y); }
    for (const x of [-7, 0, 7]) { ctx.moveTo(x, 8); ctx.lineTo(x * 0.8, 22); }
    ctx.stroke();
    // かごの中のキャンディー
    for (let i = 0; i < Math.min(s.score, 5); i++) {
      ctx.fillStyle = CANDY_COLORS[i % CANDY_COLORS.length];
      ctx.beginPath();
      ctx.arc(-10 + i * 5, 7, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#d08a3a';
    ctx.fillRect(-15, 7, 30, 2.5);
    ctx.restore();
  }

  function drawTarget(c, s) {
    const k = clamp((s.runT - c.shown) / (c.land - c.shown), 0, 1);
    const inside = catching(c);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(c.tx, c.ty, CATCH_R * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = inside ? 3 : 2;
    ctx.strokeStyle = inside ? '#ffffff' : c.color;
    ctx.shadowColor = c.color;
    ctx.shadowBlur = 10;
    if (!inside) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.tx, c.ty, CATCH_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlying(c, s) {
    // 構えている間はフランケンの頭の上に持っている
    if (s.runT < c.launch) {
      drawCandy(c.fx, c.fy - 4, c.color, 0);
      return;
    }
    const k = clamp((s.runT - c.launch) / (c.land - c.launch), 0, 1);
    const x = c.fx + (c.tx - c.fx) * k, y = c.fy + (c.ty - c.fy) * k;
    const h = Math.sin(Math.PI * k) * (50 + Math.hypot(c.tx - c.fx, c.ty - c.fy) * 0.25);
    ctx.fillStyle = 'rgba(0, 0, 0, .35)';
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * (0.5 + 0.5 * k), 3 * (0.5 + 0.5 * k), 0, 0, Math.PI * 2);
    ctx.fill();
    drawCandy(x, y - h, c.color, c.spin * (s.runT - c.launch), 1 + h / 120);
  }

  function drawCandy(x, y, color, rot, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size, size);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(-11, -5); ctx.lineTo(-11, 5); ctx.closePath();
    ctx.moveTo(5, 0); ctx.lineTo(11, -5); ctx.lineTo(11, 5); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, .8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, -0.4, Math.PI * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  function drawSplat(sp) {
    drawCandy(sp.x, sp.y, sp.color, 0.4);
    ctx.strokeStyle = '#ff3d6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sp.x - 9, sp.y - 9); ctx.lineTo(sp.x + 9, sp.y + 9);
    ctx.moveTo(sp.x + 9, sp.y - 9); ctx.lineTo(sp.x - 9, sp.y + 9);
    ctx.stroke();
  }

  return {
    start,
    abort,
    keyDown,
    keyUp,
    active: () => !!st,
  };
})();
