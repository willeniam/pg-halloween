// ほうきフライト：モールス練習中に割り込むミニゲーム（ヘリコプターゲーム風）
// Space 長押しで上昇、離すと落ちる。障害物か地面に当たるとアウト。
// WitchFly.start(opts) で開始し、アウトか音楽が終わったら opts.onEnd({ cleared, meters }) を呼ぶ。
const WitchFly = (() => {
  'use strict';

  // 座標は「高さ 300 の仮想画面」単位。y は下向き。
  const VIEW_H = 300;
  const GROUND = 262;      // 地面（ここまで落ちたらアウト）
  const CEIL = 6;          // 天井（ここより上へは行けない）
  const WX = 70;           // 魔女の左端
  const SPR_W = 120, SPR_H = 64;
  // 当たり判定（スプライト左上からの相対位置）。ほうきと帽子のつばは含めない
  const HIT = { x: 62, y: 14, w: 34, h: 40 };
  const GRAVITY = 900;     // 離しているときの下向き加速度
  const THRUST = 1050;     // 押しているときの上向き加速度
  const VMAX = 330;
  const SPEED0 = 250;
  const ACCEL = 5;         // 1秒ごとの加速
  const SPEED_MAX = 560;
  const PK_H = 34;         // かぼちゃ1個の高さ
  const GATE_GAP = 128;    // 上下の障害物のすき間
  const INTRO_MS = 5000;   // 最初はこの間、魔女をその場に浮かせておく（障害物も出ない）
  const COUNT_FROM = 3;    // 最後の何秒をカウントダウンするか
  const GO_MS = 700;       // 「GO!」を出しておく時間
  const OUTRO_MS = 1400;
  const FALLBACK_MS = 60000; // 音楽が再生できないときの制限時間

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // コウモリの形（index.html の #bat と同じ、64×30）
  const BAT_PTS = [32, 10, 34, 5, 35, 10, 40, 9, 48, 6, 56, 6, 64, 12, 58, 13, 54, 18, 49, 16, 45, 21, 40, 18, 36, 22,
    32, 26, 28, 22, 24, 18, 19, 21, 15, 16, 10, 18, 6, 13, 0, 12, 8, 6, 16, 6, 24, 9, 29, 10, 30, 5];
  // 遠くの星（位置は固定、ゆっくり流れる）
  const STARS = Array.from({ length: 70 }, () => ({ x: Math.random() * 2400, y: rand(8, 200), r: rand(0.6, 1.6), p: Math.random() * 6 }));

  const sprite = new Image();
  let spriteOk = false;
  sprite.addEventListener('load', () => { spriteOk = true; });
  sprite.src = 'assets/witch.png';

  let el, cv, ctx, scoreEl, barEl, msgEl, titleEl, hintEl;
  let st = null;
  let scale = 1, viewW = 800;

  function init() {
    el = document.getElementById('cat-run');
    cv = document.getElementById('cr-canvas');
    ctx = cv.getContext('2d');
    scoreEl = document.getElementById('cr-score');
    barEl = document.getElementById('cr-bar');
    msgEl = document.getElementById('cr-msg');
    titleEl = document.getElementById('cr-title');
    hintEl = document.getElementById('cr-hint');
    el.addEventListener('pointerdown', (e) => { if (st) { e.preventDefault(); press(); } });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    window.addEventListener('resize', () => { if (st) resize(); });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    scale = cv.height / VIEW_H;
    viewW = cv.width / scale;
  }

  function say(text, cls) {
    msgEl.innerHTML = text;
    msgEl.className = 'cr-msg';
    void msgEl.offsetWidth;  // 同じクラスでも出現アニメーションをやり直す
    msgEl.className = 'cr-msg show ' + (cls || '');
  }

  // ===== 開始・終了 =====
  function start(opts) {
    if (!el) init();
    const y0 = GROUND / 2 - SPR_H / 2;
    st = {
      opts,
      phase: 'intro',
      t0: performance.now(),
      last: performance.now(),
      phaseAt: performance.now(),
      clock: 0,
      speed: SPEED0,
      scroll: 0,
      dist: 0,
      w: { y: y0, base: y0, vy: 0, rot: 0, spin: 0, holding: false },
      obs: [],
      sparks: [],
      nextGap: 0,
      count: 0,
      goAt: 0,
      musicOk: false,
      raf: 0,
    };
    el.hidden = false;
    document.body.classList.add('cat-active');
    resize();
    titleEl.textContent = 'ほうきフライト！';
    hintEl.innerHTML = '<kbd>Space</kbd> / クリック長押しで上昇・はなすと下降 ・ 曲が終わるまで飛びきれ！';
    scoreEl.textContent = '0';
    barEl.style.width = '0%';
    say('魔女があらわれた！<span class="cr-key">Space</span><small>長押しで上昇・はなすと下降</small>', 'intro');

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
    if (st.phase !== 'run') return;
    st.phase = 'crash';
    st.phaseAt = performance.now();
    st.w.vy = Math.min(st.w.vy, -120);
    stopMusic();
    st.opts.sound && st.opts.sound('crash');
    say(`きゃっ！？<small>${meters()} m</small>`, 'crash');
  }

  function clear() {
    if (st.phase === 'crash' || st.phase === 'clear') return;
    st.phase = 'clear';
    st.phaseAt = performance.now();
    st.w.base = st.w.y;
    stopMusic();
    st.opts.sound && st.opts.sound('clear');
    say(`飛びきった！<small>${meters()} m</small>`, 'clear');
  }

  function end() {
    const s = st;
    const result = { cleared: s.phase === 'clear', meters: meters() };
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
    document.body.classList.remove('cat-active');
  }

  const meters = () => Math.floor(st.dist / 40);

  // ===== 入力 =====
  function press() {
    if (!st || st.w.holding) return;
    st.w.holding = true;
    if (st.phase === 'run') st.opts.sound && st.opts.sound('fly');
  }
  function release() {
    if (!st) return;
    st.w.holding = false;
  }
  function isFlyKey(e) {
    return e.code === 'Space' || e.code === 'ArrowUp' || (st && st.opts.jumpCodes || []).includes(e.code);
  }
  function keyDown(e) {
    if (!isFlyKey(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    press();
  }
  function keyUp(e) {
    if (!isFlyKey(e)) return;
    e.preventDefault();
    release();
  }

  // ===== 障害物 =====
  // stack: 地面から積んだかぼちゃ ／ spider: 天井から吊り下がるクモ
  // bat: 上下にゆれるコウモリ ／ ghost: 大きく上下するおばけ
  const stack = (x, n) => ({ type: 'stack', x, w: 42, n });
  const spider = (x, len) => ({ type: 'spider', x, w: 34, len });
  const bat = (x) => ({ type: 'bat', x, w: 46, y0: rand(40, GROUND - 50), amp: rand(10, 24), f: rand(2, 3.5), ph: rand(0, 6), vx: 70, y: 0 });
  const ghost = (x) => {
    const amp = rand(40, 70);
    return { type: 'ghost', x, w: 40, y0: rand(CEIL + 30 + amp, GROUND - 30 - amp), amp, f: rand(1.2, 2), ph: rand(0, 6), vx: 0, y: 0 };
  };
  function gate(x) {
    const n = randInt(1, 2);
    const gapTop = GROUND - n * PK_H - GATE_GAP;
    return [stack(x, n), spider(x + 4, gapTop - 26)];
  }

  function spawn() {
    const early = st.dist < SPEED0 * 6;
    const r = Math.random();
    const x = viewW + 30;
    let list;
    if (early) list = r < 0.5 ? [stack(x, randInt(1, 2))] : [bat(x)];
    else if (r < 0.22) list = [stack(x, randInt(1, 4))];
    else if (r < 0.42) list = [spider(x, rand(30, 140))];
    else if (r < 0.6) list = [bat(x)];
    else if (r < 0.75) list = [ghost(x)];
    else list = gate(x);
    st.obs.push(...list);
    const w = Math.max(...list.map((o) => o.w));
    st.nextGap = w + rand(170, 300) + st.speed * 0.35;
  }

  // 当たり判定の箱（画面座標）
  function boxes(o) {
    if (o.type === 'stack') return [{ x: o.x + 4, y: GROUND - o.n * PK_H + 4, w: 34, h: o.n * PK_H - 4 }];
    if (o.type === 'spider') return [{ x: o.x + 15, y: 0, w: 4, h: o.len }, { x: o.x + 5, y: o.len + 2, w: 24, h: 22 }];
    if (o.type === 'bat') return [{ x: o.x + 9, y: o.y - 6, w: 28, h: 13 }];
    return [{ x: o.x + 6, y: o.y - 16, w: 28, h: 34 }];
  }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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

  function update(dt, t) {
    const s = st, w = s.w;

    if (s.phase === 'intro') {
      const n = Math.ceil((INTRO_MS - (t - s.phaseAt)) / 1000);
      if (n <= COUNT_FROM && n > 0 && n !== s.count) {
        s.count = n;
        say(`${n}<small><b class="cr-key-s">Space</b> 長押しで上昇</small>`, 'count');
      }
      if (t - s.phaseAt > INTRO_MS) {
        s.phase = 'run';
        s.phaseAt = t;
        s.nextGap = 0;
        s.goAt = t;
        say('GO!', 'count');
      }
    }
    if (s.goAt && t - s.goAt > GO_MS) {
      s.goAt = 0;
      if (s.phase === 'run') msgEl.className = 'cr-msg';
    }
    if ((s.phase === 'crash' || s.phase === 'clear') && t - s.phaseAt > OUTRO_MS) { end(); return; }

    if (s.phase !== 'crash') {
      s.clock += dt;
      if (s.phase === 'run') s.speed = Math.min(SPEED_MAX, s.speed + ACCEL * dt);
      const dx = s.speed * dt;
      s.scroll += dx;
      if (s.phase === 'run') s.dist += dx;
      for (const o of s.obs) {
        o.x -= dx + (o.vx || 0) * dt;
        if (o.y0 !== undefined) o.y = o.y0 + Math.sin(s.clock * o.f + o.ph) * o.amp;
      }
      s.obs = s.obs.filter((o) => o.x + o.w > -60);
      if (s.phase === 'run') {
        s.nextGap -= dx;
        if (s.nextGap <= 0) spawn();
      }
      // ほうきから出る星くず
      if (Math.random() < 0.6) s.sparks.push({ x: WX + 18, y: w.y + SPR_H * 0.72 + rand(-6, 6), life: 1, r: rand(1.5, 3.2) });
      for (const p of s.sparks) { p.x -= dx * 0.9; p.life -= dt * 1.6; }
      s.sparks = s.sparks.filter((p) => p.life > 0);
    }

    if (s.phase === 'intro' || s.phase === 'clear') {
      // ふわふわ浮かぶ
      w.vy = 0;
      w.y += (w.base + Math.sin(s.clock * 3) * 6 - w.y) * Math.min(1, dt * 6);
    } else if (s.phase === 'run') {
      w.vy = clamp(w.vy + (w.holding ? -THRUST : GRAVITY) * dt, -VMAX, VMAX);
      w.y += w.vy * dt;
      if (w.y + HIT.y < CEIL) { w.y = CEIL - HIT.y; w.vy = Math.max(0, w.vy); }
      const hb = { x: WX + HIT.x, y: w.y + HIT.y, w: HIT.w, h: HIT.h };
      if (hb.y + hb.h >= GROUND) crash();
      else {
        outer: for (const o of s.obs) {
          for (const b of boxes(o)) if (overlap(hb, b)) { crash(); break outer; }
        }
      }
      scoreEl.textContent = meters();
    } else {
      // くるくる回りながら落ちる
      w.vy += GRAVITY * 1.2 * dt;
      w.y = Math.min(GROUND - SPR_H * 0.75, w.y + w.vy * dt);
      w.spin += dt * 9;
    }
    const tilt = s.phase === 'run' ? clamp(w.vy / 1100, -0.28, 0.3) : 0;
    w.rot += (tilt - w.rot) * Math.min(1, dt * 10);

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
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    drawSky(s);
    drawFarLayer(s.scroll * 0.25);
    drawGround(s.scroll);
    for (const o of s.obs) drawObstacle(o, s.clock);
    drawSparks(s);
    drawWitch(s);
  }

  function drawSky(s) {
    // 星
    const off = s.scroll * 0.06;
    for (const p of STARS) {
      const x = ((p.x - off) % 2400 + 2400) % 2400;
      if (x > viewW) continue;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.35 * Math.sin(s.clock * 2 + p.p)})`;
      ctx.fillRect(x, p.y, p.r, p.r);
    }
    // 月
    const mx = viewW - 110, my = 64;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 214, 120, .6)';
    ctx.shadowBlur = 40;
    const g = ctx.createRadialGradient(mx - 10, my - 10, 4, mx, my, 38);
    g.addColorStop(0, '#fffbe6');
    g.addColorStop(0.5, '#ffe9a8');
    g.addColorStop(1, '#f5c065');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 遠景：丘とお城のシルエット
  function drawFarLayer(off) {
    const step = 320;
    const first = Math.floor(off / step) - 1;
    ctx.fillStyle = 'rgba(42, 29, 64, .55)';
    for (let i = first; i * step - off < viewW + step; i++) {
      const x = i * step - off;
      const k = ((i * 7919) % 4 + 4) % 4;
      ctx.beginPath();
      ctx.moveTo(x, GROUND);
      ctx.quadraticCurveTo(x + step / 2, GROUND - 46 - k * 8, x + step, GROUND);
      ctx.fill();
      if (k === 1) {
        // お城
        const cx = x + 140, b = GROUND - 30;
        ctx.fillRect(cx, b - 60, 46, 60);
        ctx.fillRect(cx - 14, b - 86, 16, 86);
        ctx.fillRect(cx + 44, b - 76, 16, 76);
        ctx.beginPath();
        ctx.moveTo(cx - 18, b - 86); ctx.lineTo(cx - 6, b - 112); ctx.lineTo(cx + 6, b - 86);
        ctx.moveTo(cx + 40, b - 76); ctx.lineTo(cx + 52, b - 100); ctx.lineTo(cx + 64, b - 76);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 207, 74, .35)';
        ctx.fillRect(cx + 12, b - 44, 6, 9);
        ctx.fillRect(cx + 28, b - 44, 6, 9);
        ctx.fillStyle = 'rgba(42, 29, 64, .55)';
      } else if (k === 3) {
        // 枯れ木
        ctx.strokeStyle = 'rgba(42, 29, 64, .7)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 200, GROUND - 20);
        ctx.quadraticCurveTo(x + 198, GROUND - 70, x + 184, GROUND - 102);
        ctx.moveTo(x + 197, GROUND - 66);
        ctx.quadraticCurveTo(x + 214, GROUND - 78, x + 224, GROUND - 96);
        ctx.stroke();
      }
    }
  }

  function drawGround(off) {
    const g = ctx.createLinearGradient(0, GROUND, 0, VIEW_H);
    g.addColorStop(0, '#1b0f30');
    g.addColorStop(1, 'rgba(11, 6, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND, viewW, VIEW_H - GROUND);
    // 落ちたらアウトの線
    ctx.save();
    ctx.fillStyle = '#7b3fe4';
    ctx.shadowColor = 'rgba(180, 139, 255, .9)';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, GROUND, viewW, 2);
    ctx.restore();
    const step = 37;
    const first = Math.floor(off / step);
    for (let i = first; i * step - off < viewW; i++) {
      const x = i * step - off;
      const k = ((i * 2654435761) >>> 0) % 7;
      ctx.fillStyle = k < 3 ? 'rgba(180, 139, 255, .25)' : 'rgba(255, 123, 28, .15)';
      ctx.fillRect(x, GROUND + 6 + k * 4, 3 + (k % 3) * 3, 2);
    }
  }

  function drawPumpkin(x, bottom, w, h) {
    const cx = x + w / 2, cy = bottom - h / 2, rx = w / 2, ry = h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 140, 30, .55)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#d9560a';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.4, cy, rx * 0.55, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + rx * 0.4, cy, rx * 0.55, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff7b1c';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.55, ry * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    // 顔
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.55, cy - ry * 0.1);
    ctx.lineTo(cx - rx * 0.3, cy - ry * 0.45);
    ctx.lineTo(cx - rx * 0.18, cy - ry * 0.02);
    ctx.moveTo(cx + rx * 0.55, cy - ry * 0.1);
    ctx.lineTo(cx + rx * 0.3, cy - ry * 0.45);
    ctx.lineTo(cx + rx * 0.18, cy - ry * 0.02);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.6, cy + ry * 0.2);
    ctx.quadraticCurveTo(cx, cy + ry * 0.85, cx + rx * 0.6, cy + ry * 0.2);
    ctx.lineTo(cx + rx * 0.3, cy + ry * 0.35);
    ctx.lineTo(cx + rx * 0.15, cy + ry * 0.22);
    ctx.lineTo(cx, cy + ry * 0.4);
    ctx.lineTo(cx - rx * 0.15, cy + ry * 0.22);
    ctx.lineTo(cx - rx * 0.3, cy + ry * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  function drawStack(o) {
    for (let i = 0; i < o.n; i++) drawPumpkin(o.x, GROUND - i * PK_H, o.w, PK_H);
    // いちばん上にへた
    const top = GROUND - o.n * PK_H;
    ctx.strokeStyle = '#2f4a17';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2 - 1, top + 1);
    ctx.quadraticCurveTo(o.x + o.w / 2, top - 5, o.x + o.w / 2 + 5, top - 7);
    ctx.stroke();
  }

  function drawSpider(o, clock) {
    const cx = o.x + 17, cy = o.len + 13;
    ctx.strokeStyle = 'rgba(220, 210, 255, .55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = 'rgba(190, 140, 255, .9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#0a0612';
    ctx.fillStyle = '#0a0612';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    const wig = Math.sin(clock * 8) * 0.15;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = -0.7 + i * 0.45 + wig * (i % 2 ? 1 : -1);
        const kx = cx + side * 12, ky = cy + Math.sin(a) * 9;
        ctx.moveTo(cx, cy);
        ctx.lineTo(kx, ky - 4);
        ctx.lineTo(cx + side * 17, ky + 6);
      }
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff3d6a';
    ctx.beginPath();
    ctx.arc(cx - 3.5, cy + 3, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 3.5, cy + 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBat(o, clock) {
    const flap = 0.45 + 0.55 * Math.abs(Math.sin(clock * 14 + o.ph));
    const sx = o.w / 64;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(sx, sx * flap);
    ctx.translate(0, -15);
    ctx.shadowColor = 'rgba(190, 140, 255, .95)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0a0612';
    ctx.beginPath();
    ctx.moveTo(BAT_PTS[0], BAT_PTS[1]);
    for (let i = 2; i < BAT_PTS.length; i += 2) ctx.lineTo(BAT_PTS[i], BAT_PTS[i + 1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(o.x + o.w / 2 - 3, o.y - 4, 1.6, 1.6);
    ctx.fillRect(o.x + o.w / 2 + 1.4, o.y - 4, 1.6, 1.6);
  }

  function drawGhost(o, clock) {
    const x = o.x + 20, y = o.y;
    ctx.save();
    ctx.shadowColor = 'rgba(200, 180, 255, .8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(244, 239, 255, .95)';
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 18);
    ctx.lineTo(x - 16, y - 4);
    ctx.arc(x, y - 4, 16, Math.PI, 0);
    ctx.lineTo(x + 16, y + 18);
    const wv = Math.sin(clock * 6) * 2;
    for (let i = 3; i >= 0; i--) {
      const bx = x - 16 + i * 8;
      ctx.quadraticCurveTo(bx + 8 - 4, y + 12 + wv * (i % 2 ? 1 : -1), bx, y + 18);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#1b1030';
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 4, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 6, y - 4, 2.6, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x, y + 5, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacle(o, clock) {
    if (o.type === 'stack') drawStack(o);
    else if (o.type === 'spider') drawSpider(o, clock);
    else if (o.type === 'bat') drawBat(o, clock);
    else drawGhost(o, clock);
  }

  function drawSparks(s) {
    for (const p of s.sparks) {
      ctx.fillStyle = `rgba(255, 190, 80, ${p.life * 0.9})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWitch(s) {
    const w = s.w;
    const crashed = s.phase === 'crash';
    // 影
    const sh = clamp(1 - (GROUND - (w.y + SPR_H)) / 220, 0.2, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * sh})`;
    ctx.beginPath();
    ctx.ellipse(WX + SPR_W * 0.55, GROUND + 4, 34 * sh, 4 * sh, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    const px = WX + SPR_W * 0.6, py = w.y + SPR_H * 0.5;
    ctx.translate(px, py);
    ctx.rotate(crashed ? w.spin : w.rot);
    ctx.translate(-px, -py);
    ctx.shadowColor = 'rgba(190, 140, 255, .9)';
    ctx.shadowBlur = 12;
    if (spriteOk) ctx.drawImage(sprite, WX, w.y, SPR_W, SPR_H);
    else drawWitchShape(WX, w.y);
    ctx.restore();
  }

  // 画像がないときの簡易シルエット
  function drawWitchShape(x, y) {
    ctx.fillStyle = '#0a0612';
    ctx.strokeStyle = '#0a0612';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 46);
    ctx.lineTo(x + 116, y + 40);
    ctx.stroke();
    ctx.fillStyle = '#ff7b1c';
    ctx.beginPath();
    ctx.moveTo(x + 34, y + 44); ctx.lineTo(x + 8, y + 36); ctx.lineTo(x + 6, y + 58); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0a0612';
    ctx.beginPath();
    ctx.ellipse(x + 78, y + 34, 12, 16, 0, 0, Math.PI * 2);
    ctx.arc(x + 84, y + 16, 8, 0, Math.PI * 2);
    ctx.moveTo(x + 64, y + 10); ctx.lineTo(x + 104, y + 10); ctx.lineTo(x + 76, y - 14); ctx.closePath();
    ctx.fill();
  }

  return {
    start,
    abort,
    keyDown,
    keyUp,
    active: () => !!st,
  };
})();
