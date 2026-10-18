// 黒猫ダッシュ：タイピング中に割り込むミニゲーム（Chrome の恐竜ゲーム風）
// CatRun.start(opts) で開始し、障害物に当たるか音楽が終わったら opts.onEnd({ cleared, meters }) を呼ぶ。
const CatRun = (() => {
  'use strict';

  // 座標は「高さ 300 の仮想画面」単位。
  const VIEW_H = 300;
  const GROUND = 246;
  const CAT_X = 90;
  const GRAVITY = 2600;
  const JUMP_V = 800;      // ジャンプ初速
  const CUT_V = 320;       // ボタンを早く離したときに上昇速度をここまで落とす（小ジャンプ）
  const SPEED0 = 380;
  const SPEED_MID = 820;   // ここまでは ACCEL で一気に加速（開始から約50秒）
  const ACCEL = 9;         // 1秒ごとの加速
  const ACCEL_LATE = 4;    // SPEED_MID を超えてからの加速（曲が終わるまで続く）
  const SPEED_MAX = 1600;  // 上限
  const INTRO_MS = 1300;
  const OUTRO_MS = 1400;
  const FALLBACK_MS = 60000; // 音楽が再生できないときの制限時間
  const BUFFER_MS = 120;   // 着地直前の入力を覚えておく時間

  let el, cv, ctx, scoreEl, barEl, msgEl, titleEl, hintEl;
  let st = null;
  let scale = 1, viewW = 800;

  const rand = (a, b) => a + Math.random() * (b - a);

  function init() {
    el = document.getElementById('cat-run');
    cv = document.getElementById('cr-canvas');
    ctx = cv.getContext('2d');
    scoreEl = document.getElementById('cr-score');
    barEl = document.getElementById('cr-bar');
    msgEl = document.getElementById('cr-msg');
    titleEl = document.getElementById('cr-title');
    hintEl = document.getElementById('cr-hint');
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
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
    msgEl.className = 'cr-msg show ' + (cls || '');
  }

  // ===== 開始・終了 =====
  function start(opts) {
    if (!el) init();
    st = {
      opts,
      phase: 'intro',
      t0: performance.now(),
      last: performance.now(),
      phaseAt: performance.now(),
      speed: SPEED0,
      scroll: 0,
      dist: 0,
      runPhase: 0,
      cat: { y: 0, vy: 0, ground: true, holding: false, buffered: -1 },
      obs: [],
      nextGap: 0,
      musicOk: false,
      raf: 0,
    };
    el.hidden = false;
    document.body.classList.add('cat-active');
    resize();
    // 画面はほうきフライトと共用なので、見出しと説明を毎回書き直す
    titleEl.textContent = '黒猫ダッシュ！';
    hintEl.innerHTML = '<kbd>Space</kbd> / クリックでジャンプ ・ 曲が終わるまで逃げきれ！';
    scoreEl.textContent = '0';
    barEl.style.width = '0%';
    say('黒猫があらわれた！<span class="cr-key">Space</span><small>/ クリックでジャンプ</small>', 'intro');

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
    stopMusic();
    st.opts.sound && st.opts.sound('crash');
    say(`ニャッ！？<small>${meters()} m</small>`, 'crash');
  }

  function clear() {
    if (st.phase === 'crash' || st.phase === 'clear') return;
    st.phase = 'clear';
    st.phaseAt = performance.now();
    stopMusic();
    st.opts.sound && st.opts.sound('clear');
    say(`逃げきった！<small>${meters()} m</small>`, 'clear');
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
    if (!st) return;
    const c = st.cat;
    c.holding = true;
    if (st.phase === 'crash' || st.phase === 'clear') return;
    if (performance.now() - st.t0 < 300) return; // 直前のタイピングの打鍵を拾わない
    if (c.ground) jump();
    else c.buffered = performance.now();
  }
  function release() {
    if (!st) return;
    const c = st.cat;
    c.holding = false;
    if (!c.ground && c.vy > CUT_V) c.vy = CUT_V;
  }
  function jump() {
    const c = st.cat;
    c.ground = false;
    c.vy = JUMP_V;
    c.buffered = -1;
    st.opts.sound && st.opts.sound('jump');
  }
  function isJumpKey(e) {
    return e.code === 'Space' || e.code === 'ArrowUp' || (st && st.opts.jumpCodes || []).includes(e.code);
  }
  function keyDown(e) {
    if (!isJumpKey(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    press();
  }
  function keyUp(e) {
    if (!isJumpKey(e)) return;
    e.preventDefault();
    release();
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

  function spawn() {
    const early = st.dist < SPEED0 * 5;
    const r = Math.random();
    let o;
    if (early || r < 0.45) o = { type: 'pumpkin', w: 40, h: 34 };
    else if (r < 0.75) o = { type: 'grave', w: 34, h: 50 };
    else o = { type: 'pumpkin2', w: 70, h: 34 };
    o.x = viewW + 20;
    st.obs.push(o);
    const air = (2 * JUMP_V) / GRAVITY; // 滞空時間
    st.nextGap = o.w + st.speed * air + 80 + rand(0, st.speed * 1.1);
  }

  function update(dt, t) {
    const s = st, c = s.cat;
    const moving = s.phase !== 'crash';

    if (s.phase === 'intro' && t - s.phaseAt > INTRO_MS) {
      s.phase = 'run';
      s.phaseAt = t;
      s.nextGap = 0;
      msgEl.className = 'cr-msg';
    }
    if ((s.phase === 'crash' || s.phase === 'clear') && t - s.phaseAt > OUTRO_MS) { end(); return; }

    if (moving) {
      if (s.phase === 'run') s.speed = Math.min(SPEED_MAX, s.speed + (s.speed < SPEED_MID ? ACCEL : ACCEL_LATE) * dt);
      const dx = s.speed * dt;
      s.scroll += dx;
      s.runPhase += dx * 0.05;
      if (s.phase === 'run') s.dist += dx;
      for (const o of s.obs) o.x -= dx;
      s.obs = s.obs.filter((o) => o.x + o.w > -60);
      if (s.phase === 'run') {
        s.nextGap -= dx;
        if (s.nextGap <= 0) spawn();
      }

      if (!c.ground) {
        c.vy -= GRAVITY * dt;
        c.y += c.vy * dt;
        if (c.y <= 0) {
          c.y = 0;
          c.vy = 0;
          c.ground = true;
          if (c.buffered > 0 && t - c.buffered < BUFFER_MS) jump();
        }
      }
    }

    if (s.phase === 'run') {
      // 当たり判定は見た目より少し小さめ
      const cx1 = CAT_X + 14, cx2 = CAT_X + 54, cy = c.y;
      for (const o of s.obs) {
        if (cx2 > o.x + 5 && cx1 < o.x + o.w - 5 && cy < o.h - 6) { crash(); break; }
      }
      scoreEl.textContent = meters();
    }

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

    drawFarLayer(s.scroll * 0.35);
    drawGround(s.scroll);
    for (const o of s.obs) drawObstacle(o);
    drawCat(s);
  }

  // 遠景：墓標と十字架のシルエット（ゆっくり流れる）
  function drawFarLayer(off) {
    const step = 230;
    const first = Math.floor(off / step) - 1;
    ctx.fillStyle = 'rgba(42, 29, 64, .75)';
    for (let i = first; i * step - off < viewW + step; i++) {
      const x = i * step - off;
      const k = ((i * 7919) % 5 + 5) % 5;
      if (k === 0 || k === 3) {
        ctx.fillRect(x + 20, GROUND - 46, 7, 46);
        ctx.fillRect(x + 8, GROUND - 34, 31, 7);
      } else if (k === 1) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND);
        ctx.lineTo(x, GROUND - 28);
        ctx.arc(x + 16, GROUND - 28, 16, Math.PI, 0);
        ctx.lineTo(x + 32, GROUND);
        ctx.fill();
      } else if (k === 2) {
        // 枯れ木
        ctx.strokeStyle = 'rgba(42, 29, 64, .75)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 30, GROUND);
        ctx.quadraticCurveTo(x + 28, GROUND - 50, x + 14, GROUND - 82);
        ctx.moveTo(x + 27, GROUND - 46);
        ctx.quadraticCurveTo(x + 44, GROUND - 58, x + 54, GROUND - 76);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 20, GROUND - 66);
        ctx.lineTo(x + 6, GROUND - 74);
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
    ctx.fillStyle = '#45336a';
    ctx.fillRect(0, GROUND, viewW, 2);
    // 流れる小石と草
    const step = 37;
    const first = Math.floor(off / step);
    for (let i = first; i * step - off < viewW; i++) {
      const x = i * step - off;
      const k = ((i * 2654435761) >>> 0) % 7;
      ctx.fillStyle = k < 3 ? 'rgba(180, 139, 255, .25)' : 'rgba(255, 123, 28, .15)';
      ctx.fillRect(x, GROUND + 6 + k * 4, 3 + (k % 3) * 3, 2);
      if (k === 5) {
        ctx.fillStyle = '#2a1d40';
        ctx.beginPath();
        ctx.moveTo(x, GROUND);
        ctx.lineTo(x + 3, GROUND - 7);
        ctx.lineTo(x + 6, GROUND);
        ctx.lineTo(x + 8, GROUND - 5);
        ctx.lineTo(x + 10, GROUND);
        ctx.fill();
      }
    }
  }

  function drawPumpkin(x, w, h) {
    const cx = x + w / 2, cy = GROUND - h / 2, rx = w / 2, ry = h / 2;
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
    ctx.strokeStyle = '#2f4a17';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - ry);
    ctx.quadraticCurveTo(cx, cy - ry - 6, cx + 5, cy - ry - 8);
    ctx.stroke();
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

  function drawGrave(x, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND - h + r);
    ctx.arc(x + r, GROUND - h + r, r, Math.PI, 0);
    ctx.lineTo(x + w, GROUND);
    ctx.closePath();
    ctx.fillStyle = '#2a1d40';
    ctx.fill();
    // 背景の墓と見分けがつくよう、ネオン管のように枠を光らせる
    ctx.save();
    ctx.strokeStyle = '#b48bff';
    ctx.shadowColor = 'rgba(190, 140, 255, .95)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#f0e4ff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c9a8ff';
    ctx.font = '700 10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('R.I.P', x + r, GROUND - h + r + 6);
  }

  function drawObstacle(o) {
    if (o.type === 'grave') drawGrave(o.x, o.w, o.h);
    else if (o.type === 'pumpkin2') {
      drawPumpkin(o.x, 36, 30);
      drawPumpkin(o.x + 32, 38, o.h);
    } else drawPumpkin(o.x, o.w, o.h);
  }

  // 黒猫：パーツを組み合わせて脚と尻尾を動かす
  function drawCat(s) {
    const c = s.cat;
    const crashed = s.phase === 'crash';
    const air = !c.ground;
    const p = s.runPhase;
    const bob = air || crashed ? 0 : Math.abs(Math.sin(p)) * 3;
    const baseY = GROUND - c.y;

    // 影
    const sh = Math.max(0.35, 1 - c.y / 160);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * sh})`;
    ctx.beginPath();
    ctx.ellipse(CAT_X + 34, GROUND + 3, 28 * sh, 4 * sh, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(CAT_X, baseY - bob);
    if (crashed) {
      const k = Math.min(1, (performance.now() - s.phaseAt) / 250);
      ctx.translate(34, -20);
      ctx.rotate(-0.5 * k);
      ctx.translate(-34, 20);
    } else if (air) {
      ctx.translate(34, -20);
      ctx.rotate(Math.max(-0.25, Math.min(0.2, -c.vy / 3000)));
      ctx.translate(-34, 20);
    }
    // 1回目：紫のふちどり（光彩）、2回目：本体
    catShape(p, air, crashed, true);
    catShape(p, air, crashed, false);
    ctx.restore();
  }

  function catShape(p, air, crashed, glow) {
    const body = '#0a0612';
    ctx.save();
    if (glow) {
      ctx.shadowColor = 'rgba(190, 140, 255, .9)';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = body;
    ctx.strokeStyle = body;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 脚（前2本・後2本）
    ctx.lineWidth = 5;
    const legs = air || crashed
      ? [[44, 0.95], [48, 0.7], [14, -0.9], [18, -0.65]]
      : [[44, Math.sin(p) * 0.9], [48, Math.sin(p + 0.7) * 0.9], [14, Math.sin(p + Math.PI) * 0.9], [18, Math.sin(p + Math.PI + 0.7) * 0.9]];
    for (const [hx, a] of legs) {
      const hy = -18;
      const kx = hx + Math.sin(a) * 9, ky = hy + Math.cos(a) * 9;
      const b = a + (hx > 30 ? -0.5 : 0.5) * Math.abs(a);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(kx + Math.sin(b) * 9, ky + Math.cos(b) * 9);
      ctx.stroke();
    }

    // 尻尾
    ctx.lineWidth = 5;
    const sw = Math.sin(p * 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(10, -26);
    ctx.bezierCurveTo(-6, -30, -10, -44 + sw, 0, -54 + sw);
    ctx.stroke();

    // 胴体
    ctx.beginPath();
    ctx.ellipse(30, -26, 23, 11, air ? 0 : Math.sin(p * 2) * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 頭と耳
    ctx.beginPath();
    ctx.arc(55, -34, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, -40); ctx.lineTo(47, -54); ctx.lineTo(54, -44);
    ctx.moveTo(56, -45); ctx.lineTo(63, -55); ctx.lineTo(65, -39);
    ctx.fill();
    ctx.restore();

    if (glow) return;
    // 目
    if (crashed) {
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (const ex of [53, 61]) {
        ctx.moveTo(ex - 2.5, -37.5); ctx.lineTo(ex + 2.5, -32.5);
        ctx.moveTo(ex + 2.5, -37.5); ctx.lineTo(ex - 2.5, -32.5);
      }
      ctx.stroke();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 216, 74, .9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath();
      ctx.ellipse(53, -35, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(61, -35, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0a0612';
      ctx.fillRect(53.4, -37, 1, 4);
      ctx.fillRect(61.4, -37, 1, 4);
    }
    // ひげ
    ctx.strokeStyle = 'rgba(200, 180, 255, .5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(64, -30); ctx.lineTo(74, -32);
    ctx.moveTo(64, -29); ctx.lineTo(74, -27);
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
