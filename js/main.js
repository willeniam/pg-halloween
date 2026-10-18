(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const now = () => performance.now();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const retrigger = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ }
    },
  };

  // ===== 入力方式（親指シフト ／ モールス信号） =====
  // MODES は下のバッジ定義のあとで作る
  const NICOLA_ENABLED = false;
  let mode = NICOLA_ENABLED ? store.get('nh-mode', 'nicola') : 'morse';
  const M = () => MODES[mode];
  const isMorse = () => mode === 'morse';

  // ===== 親指キー設定 =====
  const THUMB_PRESETS = [
    { name: '無変換 ／ 変換・スペース', left: ['NonConvert'], right: ['Convert', 'Space'], lLabel: '無変換', rLabel: '変換 / スペース' },
    { name: 'スペース ／ 変換', left: ['Space'], right: ['Convert'], lLabel: 'スペース', rLabel: '変換' },
    { name: '左Alt ／ 右Alt（USキーボード）', left: ['AltLeft'], right: ['AltRight'], lLabel: '左Alt', rLabel: '右Alt' },
  ];
  let presetIdx = store.get('nh-thumb', 0);
  if (!THUMB_PRESETS[presetIdx]) presetIdx = 0;
  const preset = () => THUMB_PRESETS[presetIdx];

  // ===== サウンド（assets に音源があれば使い、なければ合成音） =====
  let actx = null;
  const audioCtx = () => {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  };
  function tone(freq, dur, type = 'sine', vol = 0.08, delay = 0) {
    const ctx = audioCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
  function se(name) {
    if (name === 'correct') tone(880 + Math.random() * 220, 0.08, 'triangle', 0.05);
    else if (name === 'miss') { tone(160, 0.18, 'sawtooth', 0.05); tone(120, 0.2, 'sawtooth', 0.04, 0.05); }
    else if (name === 'clear') [660, 880, 1320].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.07));
    else if (name === 'result') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.12));
    else if (name === 'jump') { tone(520, 0.1, 'square', 0.025); tone(780, 0.08, 'square', 0.02, 0.04); }
    else if (name === 'crash') { tone(220, 0.25, 'sawtooth', 0.06); tone(110, 0.35, 'sawtooth', 0.05, 0.08); }
    else if (name === 'fly') { tone(330, 0.12, 'triangle', 0.025); tone(495, 0.1, 'triangle', 0.02, 0.03); }
  }
  // モールスの電鍵音：押している間だけ鳴らす
  let beepNode = null;
  function beepStart() {
    const ctx = audioCtx();
    if (!ctx) return;
    beepStop();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 700;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.006);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    beepNode = { o, g };
  }
  function beepStop() {
    if (!beepNode) return;
    const { o, g } = beepNode;
    const t = actx.currentTime;
    beepNode = null;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.008);
    o.stop(t + 0.02);
  }

  const bgm = $('#bgm');
  let bgmOn = store.get('nh-bgm', true);
  let bgmReady = false;
  bgm.volume = 0.35;
  bgm.addEventListener('canplay', () => { bgmReady = true; renderBgmState(); syncBgm(); }, { once: true });
  bgm.addEventListener('error', () => { bgmReady = false; renderBgmState(); });
  if (bgm.readyState >= 2) bgmReady = true;
  function syncBgm() {
    if (!bgmReady) return;
    if (bgmOn) bgm.play().catch(() => {});
    else bgm.pause();
  }
  function renderBgmState() {
    $('#bgm-state').textContent = !bgmReady ? 'なし' : bgmOn ? 'ON' : 'OFF';
  }
  const catBgm = $('#cat-bgm');
  catBgm.volume = 0.35;
  function toggleBgm() {
    bgmOn = !bgmOn;
    store.set('nh-bgm', bgmOn);
    renderBgmState();
    syncBgm();
  }

  // ===== 任意の画像素材（あれば差し替え） =====
  const ghostEl = $('#ghost');
  let ghostImgs = false;
  {
    const names = ['normal', 'happy', 'scared'];
    let loaded = 0;
    names.forEach((n) => {
      const img = ghostEl.querySelector('.gi-' + n);
      img.addEventListener('load', () => {
        if (++loaded === names.length) { ghostImgs = true; ghostEl.classList.add('use-img'); }
      });
      img.src = `assets/ghost_${n}.png`;
    });
  }
  {
    const img = new Image();
    img.addEventListener('load', () => document.body.classList.add('has-bg'));
    img.src = 'assets/bg.png';
  }

  // ===== 画面 =====
  let screen = 'title';
  function show(name) {
    screen = name;
    document.body.dataset.screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  }

  // ===== タイトル =====
  function renderTitle() {
    const best = store.get(M().bestKey, null);
    $('#title-best').textContent = best ? `ベスト：${best.rank}ランク（${best.score}点）` : '';
  }
  function applyMode() {
    const m = M();
    $('#mode-btn').hidden = !NICOLA_ENABLED;
    document.body.classList.toggle('mode-morse', isMorse());
    document.title = m.appTitle;
    $('#mode-label').textContent = isMorse() ? '親指シフト入力に変更する' : 'モールス信号入力に変更する';
    $('#ph-stage-name').textContent = m.stageName;
    renderTitle();
  }
  function toggleMode() {
    if (!NICOLA_ENABLED || screen !== 'title') return;
    mode = isMorse() ? 'nicola' : 'morse';
    store.set('nh-mode', mode);
    applyMode();
    toast(`${M().name}モードにしました`);
  }
  function renderThumbLabels() {
    const p = preset();
    $('#thumb-name').textContent = p.name;
    $('#thumb-left').textContent = p.lLabel;
    $('#thumb-right').textContent = p.rLabel;
  }
  function cyclePreset() {
    presetIdx = (presetIdx + 1) % THUMB_PRESETS.length;
    store.set('nh-thumb', presetIdx);
    renderThumbLabels();
  }
  function goTitle() {
    const mg = activeMini();
    if (mg) { mg.abort(); syncBgm(); }
    endTutorial();
    game = null;
    resetInput();
    renderTitle();
    show('title');
  }

  // ===== キーボード表示 =====
  const keyEls = {};
  function buildKeyboard() {
    const kb = $('#keyboard');
    NICOLA_ROWS.forEach((row, ri) => {
      const r = document.createElement('div');
      r.className = 'kb-row row' + ri;
      row.forEach((code) => {
        const [n, l, rr] = NICOLA[code];
        const k = document.createElement('div');
        k.className = 'key';
        k.dataset.code = code;
        if (code === 'KeyF' || code === 'KeyJ') k.classList.add('homing');
        k.innerHTML = `<span class="kl">${l}</span><span class="kr">${rr}</span><span class="kn">${n}</span><span class="kc">${KEY_LABEL(code)}</span>`;
        keyEls[code] = k;
        r.append(k);
      });
      kb.append(r);
    });
    const t = document.createElement('div');
    t.className = 'kb-row thumbs';
    t.innerHTML = '<div class="key thumb tl" id="thumb-left"></div><div class="key thumb tr" id="thumb-right"></div>';
    kb.append(t);
  }
  function highlightKey(ch) {
    document.querySelectorAll('.key.target, .mc-cell.target').forEach((k) => k.classList.remove('target'));
    document.querySelectorAll('.key .hit').forEach((k) => k.classList.remove('hit'));
    if (ch && isMorse()) {
      if (chartEls[ch]) chartEls[ch].classList.add('target');
      return;
    }
    const k = ch && KANA_TO_KEY[ch];
    if (!k) return;
    const el = keyEls[k.code];
    el.classList.add('target');
    el.querySelector({ none: '.kn', left: '.kl', right: '.kr' }[k.shift]).classList.add('hit');
    if (k.shift !== 'none') $('#thumb-' + k.shift).classList.add('target');
  }
  function flashKey(code) {
    const el = keyEls[code];
    if (!el) return;
    retrigger(el, 'pressed');
    setTimeout(() => el.classList.remove('pressed'), 110);
  }
  // モールス符号表と電鍵
  const chartEls = {};
  function buildMorsePad() {
    const chart = $('#morse-chart');
    for (const [ch, code] of Object.entries(MORSE)) {
      const c = document.createElement('div');
      c.className = 'mc-cell';
      c.dataset.ch = ch;
      c.innerHTML = `<b>${ch}</b>${morseHtml(code)}`;
      chartEls[ch] = c;
      chart.append(c);
    }
    const key = $('#morse-key');
    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (screen === 'play') morsePress();
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) key.addEventListener(ev, morseRelease);
    key.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  let showKb = store.get('nh-kb', true);
  function applyKb() { $('#kb-wrap').classList.toggle('hide', !showKb); }

  // ===== 親指シフト入力エンジン =====
  // 文字キーと親指キーが SIM_MS 以内に押されたら同時打鍵とみなす。
  // 親指キーを押しっぱなしの間に押した文字キーもシフト扱い。
  const SIM_MS = 100;
  let pending = null;
  const thumbs = { left: { down: false, t: 0 }, right: { down: false, t: 0 } };

  function thumbSideOf(code) {
    const p = preset();
    if (p.left.includes(code)) return 'left';
    if (p.right.includes(code)) return 'right';
    return null;
  }
  function heldThumb() {
    const l = thumbs.left.down, r = thumbs.right.down;
    if (l && r) return thumbs.left.t > thumbs.right.t ? 'left' : 'right';
    return l ? 'left' : r ? 'right' : null;
  }
  function emit(code, shift) {
    const chars = NICOLA[code];
    handleKana(chars[{ none: 0, left: 1, right: 2 }[shift]], code);
  }
  function flushPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    const code = pending.code;
    pending = null;
    emit(code, 'none');
  }
  function resetInput() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
    for (const side of ['left', 'right']) {
      thumbs[side].down = false;
      const el = $('#thumb-' + side);
      if (el) el.classList.remove('down');
    }
    resetMorse();
  }
  function onPlayKeyDown(e) {
    if (isMorse()) morseKeyDown(e);
    else nicolaKeyDown(e);
  }
  function onPlayKeyUp(e) {
    if (isMorse()) morseKeyUp(e);
    else nicolaKeyUp(e);
  }
  function nicolaKeyDown(e) {
    const side = thumbSideOf(e.code);
    if (side) {
      e.preventDefault();
      if (e.repeat) return;
      thumbs[side].down = true;
      thumbs[side].t = now();
      $('#thumb-' + side).classList.add('down');
      if (pending) {
        const code = pending.code;
        clearTimeout(pending.timer);
        pending = null;
        emit(code, side);
      }
      return;
    }
    if (!(e.code in NICOLA)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (pending) flushPending();
    const held = heldThumb();
    if (held) { emit(e.code, held); return; }
    pending = { code: e.code, timer: setTimeout(flushPending, SIM_MS) };
  }
  function nicolaKeyUp(e) {
    const side = thumbSideOf(e.code);
    if (side) {
      e.preventDefault();
      thumbs[side].down = false;
      $('#thumb-' + side).classList.remove('down');
      return;
    }
    if (pending && pending.code === e.code) flushPending();
  }

  // ===== モールス入力エンジン =====
  // Space を押していた長さで短点・長点を決める。お題の文字は分かっているので、
  // 符号がそろった時点で確定し、食い違った時点でミスにする（文字間の「間」は見ない）。
  const GAUGE_MS = MORSE_DOT_MAX_MS * 3;  // ゲージの端（短点ゾーンが左 1/3）
  const morse = { down: false, at: 0, buf: '', raf: 0 };
  const morseKeyEl = $('#morse-key');
  const gaugeEl = $('#morse-gauge');

  function morsePress() {
    if (morse.down) return;
    if (game && (game.catLock || game.finished)) return;
    morse.down = true;
    morse.at = now();
    beepStart();
    morseKeyEl.classList.add('down');
    morseKeyEl.classList.remove('dash');
    cancelAnimationFrame(morse.raf);
    morseGauge();
  }
  function morseGauge() {
    const ms = now() - morse.at;
    gaugeEl.style.width = Math.min(100, (ms / GAUGE_MS) * 100) + '%';
    morseKeyEl.classList.toggle('dash', ms >= MORSE_DOT_MAX_MS);
    if (morse.down) morse.raf = requestAnimationFrame(morseGauge);
  }
  function morseRelease() {
    if (!morse.down) return;
    morseGauge();
    morse.down = false;
    cancelAnimationFrame(morse.raf);
    beepStop();
    morseKeyEl.classList.remove('down');
    morseSymbol(now() - morse.at < MORSE_DOT_MAX_MS ? '.' : '-');
  }
  function morseSymbol(sym) {
    if (screen !== 'play' || !game || game.finished || game.catLock) return;
    if (game.tutorial && !tutPracticing()) return;
    if (game.startTime === null) game.startTime = morse.at;
    const target = curQ().kana[game.pos];
    const code = MORSE[target];
    morse.buf += sym;
    if (morse.buf === code) {
      morse.buf = '';
      handleKana(target, null);
    } else if (!code.startsWith(morse.buf)) {
      const typed = morse.buf;
      morse.buf = '';
      handleKana(morseText(typed), null);
    } else {
      renderMorseHint();
    }
  }
  function renderMorseHint() {
    const q = game && curQ();
    const target = q && q.kana[game.pos];
    $('#next-hint').innerHTML = target ? morseHtml(MORSE[target], morse.buf.length) : '';
  }
  function resetMorse() {
    if (morse.down) beepStop();
    cancelAnimationFrame(morse.raf);
    morse.down = false;
    morse.buf = '';
    morseKeyEl.classList.remove('down', 'dash');
    gaugeEl.style.width = '0%';
  }
  function morseKeyDown(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;
    morsePress();
  }
  function morseKeyUp(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    morseRelease();
  }

  // ===== ゲーム =====
  let game = null;

  function buildQuestions() {
    const m = M();
    return shuffle([...m.words]).slice(0, m.count).map((o) => ({ display: o.d, kana: o.k }));
  }

  function newGame(questions) {
    return {
      questions, qi: 0, pos: 0,
      correct: 0, miss: 0, combo: 0, maxCombo: 0,
      startTime: null, endTime: null, missed: new Set(), finished: false,
      catLock: false, catCool: CAT_COOLDOWN, catPlays: 0, result: null, tutorial: false,
    };
  }

  // スマホで後から再生できるよう、タップ時に一度鳴らしておく
  let catBgmUnlocked = false;
  function unlockCatBgm() {
    if (catBgmUnlocked || catBgm.error) return;
    catBgmUnlocked = true;
    catBgm.muted = true;
    catBgm.play().then(() => { catBgm.pause(); catBgm.currentTime = 0; }).catch(() => {});
  }

  function startGame() {
    endTutorial();
    audioCtx();
    unlockCatBgm();
    syncBgm();
    game = newGame(buildQuestions());
    resetInput();
    show('play');
    renderQuestion();
    updateStats();
    ghostSay('はじめよう！');
  }

  const curQ = () => game.questions[game.qi];

  function renderQuestion() {
    const q = curQ();
    $('#prompt-display').textContent = q.display;
    const box = $('#prompt-kana');
    box.innerHTML = '';
    for (const c of q.kana) {
      const s = document.createElement('span');
      s.className = c === ' ' ? 'ch sp' : 'ch';
      s.textContent = c;
      box.append(s);
    }
    updateCursor();
  }

  function hintHtml(ch) {
    const k = KANA_TO_KEY[ch];
    if (!k) return '';
    const key = `<span class="k">${KEY_LABEL(k.code)}</span>`;
    if (k.shift === 'none') return `${key} だけ`;
    const p = preset();
    const label = k.shift === 'left' ? p.lLabel : p.rLabel.split(' / ')[0];
    return `<span class="t-${k.shift}">${k.shift === 'left' ? '左' : '右'}親指(${label})</span> ＋ ${key}`;
  }

  function updateCursor() {
    const q = curQ();
    const spans = $('#prompt-kana').children;
    for (let i = 0; i < spans.length; i++) {
      spans[i].classList.toggle('done', i < game.pos);
      spans[i].classList.toggle('current', i === game.pos);
      spans[i].classList.toggle('missed', game.missed.has(i));
    }
    const target = q.kana[game.pos];
    const nc = $('#next-char');
    nc.textContent = target;
    if (isMorse()) {
      nc.className = 'next-char';
      renderMorseHint();
    } else {
      const k = KANA_TO_KEY[target];
      nc.className = 'next-char' + (k && k.shift !== 'none' ? ' sh-' + k.shift : '');
      $('#next-hint').innerHTML = hintHtml(target);
    }
    const after = q.kana.slice(game.pos + 1).replace(/^ +/, '')[0];
    $('#next-after').textContent = after ? `そのつぎ：${after}` : game.qi + 1 < game.questions.length ? 'つぎのお題へ' : 'ラスト！';
    highlightKey(target);
    $('#play-count').textContent = `${game.qi + 1} / ${game.questions.length}`;
    $('#play-bar').style.width = (game.qi / game.questions.length) * 100 + '%';
  }

  function calc() {
    const g = game;
    const total = g.correct + g.miss;
    const acc = total ? g.correct / total : 1;
    const end = g.endTime ?? now();
    const min = g.startTime === null ? 0 : (end - g.startTime) / 60000;
    const cpm = min > 0.001 ? g.correct / min : 0;
    return { acc, cpm, min };
  }
  function updateStats() {
    if (!game) return;
    const { acc, cpm } = calc();
    $('#stat-acc').textContent = (acc * 100).toFixed(1) + '%';
    $('#stat-speed').textContent = Math.round(cpm);
    $('#stat-combo').textContent = game.combo;
  }
  setInterval(() => { if (screen === 'play' && game && !game.finished && !game.catLock) updateStats(); }, 300);

  function handleKana(ch, code) {
    flashKey(code);
    if (screen !== 'play' || !game || game.finished || game.catLock) return;
    if (game.tutorial && !tutPracticing()) return;
    const q = curQ();
    const target = q.kana[game.pos];
    if (game.startTime === null) game.startTime = now();
    const curEl = $('#prompt-kana').children[game.pos];

    if (ch && ch === target) {
      game.correct++;
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      se('correct');
      burstAt(curEl, 7);
      ghostReact('happy');
      if (game.combo % 10 === 0) comboCelebrate();
      game.pos++;
      while (q.kana[game.pos] === ' ') game.pos++;
      if (game.pos >= q.kana.length) {
        const perfect = game.missed.size === 0;
        const catGo = perfect && game.catCool <= 0 && Math.random() < CAT_CHANCE;
        if (game.catCool > 0) game.catCool--;
        const box = $('#prompt-kana');
        const r = box.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 26, true);
        popText(r.left + r.width / 2, r.top, game.missed.size === 0 ? 'パーフェクト！' : 'クリア！', 'clear');
        se('clear');
        ghostSay(pick(CLEAR_LINES));
        game.qi++;
        game.pos = 0;
        game.missed = new Set();
        if (game.qi >= game.questions.length) {
          if (game.tutorial) tutPracticeDone();
          else finish();
          return;
        }
        if (catGo) startCat();
        else renderQuestion();
      } else {
        updateCursor();
      }
    } else {
      game.miss++;
      game.combo = 0;
      game.missed.add(game.pos);
      se('miss');
      if (keyEls[code]) retrigger(keyEls[code], 'wrong');
      const r = curEl.getBoundingClientRect();
      popText(r.left + r.width / 2, r.top - 4, ch ? `✕ ${ch}` : '✕', 'miss');
      retrigger($('#prompt-box'), 'shake');
      retrigger($('#flash'), 'on');
      ghostReact('scared');
      if (Math.random() < 0.35) ghostSay(pick(MISS_LINES));
      updateCursor();
    }
    updateStats();
  }

  // ===== ミニゲーム（ノーミスで単語を打つと、次の単語の前に割り込む） =====
  // 親指シフトは黒猫ダッシュ（CatRun）、モールスはほうきフライト（WitchFly）
  const CAT_CHANCE = 1;     // ノーミスのとき割り込む確率
  const CAT_COOLDOWN = 0;   // 一度割り込んだら、次の判定まで最低この語数あける
  const activeMini = () => [CatRun, WitchFly].find((m) => m.active());

  function startCat() {
    const g = game;
    g.catLock = true;
    g.catCool = CAT_COOLDOWN;
    resetInput();
    highlightKey(null);
    const t0 = now();
    // 「パーフェクト！」を一瞬見せてから切り替える
    setTimeout(() => {
      if (game !== g || screen !== 'play') return;
      bgm.pause();
      resetInput();  // 待っている間に押し始めた電鍵の音を止める
      const p = preset();
      const m = M();
      const mini = pick(m.minis);
      const clearLine = mini === WitchFly ? '飛びきった！' : '逃げきった！';
      mini.start({
        music: catBgm.error ? null : catBgm,
        muted: !bgmOn,  // BGM OFF でも曲の長さで終わるよう、無音で再生する
        sound: se,
        jumpCodes: isMorse() ? [] : [...p.left, ...p.right],
        onEnd(r) {
          if (game !== g) return;
          g.catPlays++;
          recordCat(r, g.catPlays);
          // ミニゲーム中の時間は入力速度に含めない
          if (g.startTime !== null) g.startTime += now() - t0;
          g.catLock = false;
          resetInput();
          syncBgm();
          renderQuestion();
          updateStats();
          ghostSay(r.cleared ? `${clearLine} ${r.meters}m` : 'おかえり！');
        },
      });
    }, 450);
  }

  function finish() {
    game.finished = true;
    game.endTime = now();
    resetInput();
    highlightKey(null);
    $('#play-bar').style.width = '100%';
    updateStats();

    const { acc, cpm, min } = calc();
    const score = Math.round(cpm * acc * acc);
    const m = M();
    const rank = m.ranks.find((r) => score >= r.min && acc >= r.acc) || m.ranks[m.ranks.length - 1];
    const prev = store.get(m.bestKey, null);
    const isBest = !prev || score > prev.score;
    if (isBest) store.set(m.bestKey, { rank: rank.rank, score });

    const rk = $('#res-rank');
    rk.textContent = rank.rank;
    rk.className = 'res-rank r-' + rank.rank;
    $('#res-title').textContent = rank.title;
    $('#res-comment').textContent = rank.comment;
    $('#res-best').hidden = !isBest;
    const rg = $('#res-ghost');
    rg.hidden = !ghostImgs;
    rg.src = `assets/ghost_${{ S: 'happy', A: 'happy', B: 'happy', C: 'normal', D: 'scared' }[rank.rank]}.png`;
    $('#res-score').textContent = score;
    $('#res-acc').textContent = (acc * 100).toFixed(1) + '%';
    $('#res-speed').textContent = Math.round(cpm) + ' 字/分';
    $('#res-combo').textContent = game.maxCombo;
    $('#res-miss').textContent = game.miss;
    const sec = Math.round(min * 60);
    const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#res-time').textContent = time;
    game.result = { rank, score, acc, cpm, time };

    const st = loadStats();
    st.games++;
    if (game.miss === 0) st.perfectGames++;
    if (rank.rank === 'S') st.sRanks++;
    store.set(m.statsKey, st);
    renderBadges(st);

    const g = game;
    setTimeout(() => {
      if (game !== g || screen !== 'play') return;
      show('result');
      se('result');
      if (rank.rank === 'S' || rank.rank === 'A') {
        const r = rk.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 40, true);
      }
    }, 750);
  }

  // ===== バッジ =====
  // ミニゲームの記録は、どちらのモードも catPlays などの同じ名前で、モードごとに別の場所へ保存する
  const CAT_MAX = QUESTION_COUNT - 1;
  const FLY_MAX = MORSE_QUESTION_COUNT - 1;
  const BADGES = [
    { id: 'cat1', icon: '🐈', name: 'ハロウィンの新人', cond: '黒猫ダッシュを初めてプレイ', ok: (s) => s.catPlays >= 1 },
    { id: 'cat5', icon: '🐾', name: '黒猫となかよし', cond: '黒猫ダッシュを合計5回プレイ', ok: (s) => s.catPlays >= 5 },
    { id: 'cat9', icon: '🎃', name: '黒猫まみれ', cond: `1回のゲームで黒猫ダッシュを${CAT_MAX}回（最大）プレイ`, ok: (s) => s.catMaxInGame >= CAT_MAX },
    { id: 'clear1', icon: '🌙', name: '奇跡の生還', cond: '黒猫ダッシュを初めてクリア', ok: (s) => s.catClears >= 1 },
    { id: 'clear5', icon: '🦇', name: '逃げ足名人', cond: '黒猫ダッシュを合計5回クリア', ok: (s) => s.catClears >= 5 },
    { id: 'm1000', icon: '👣', name: '真夜中のおさんぽ', cond: '黒猫ダッシュで合計1000m走る', ok: (s) => s.catMeters >= 1000 },
    { id: 'm10000', icon: '🧹', name: '真夜中のマラソン', cond: '黒猫ダッシュで合計10000m走る', ok: (s) => s.catMeters >= 10000 },
    { id: 'game1', icon: '👻', name: 'はじめの一歩', cond: 'ゲームを最後までプレイ', ok: (s) => s.games >= 1 },
    { id: 'nomiss', icon: '✨', name: '天才魔女', cond: 'ノーミスで最後までプレイ', ok: (s) => s.perfectGames >= 1 },
    { id: 'rankS', icon: '👑', name: '大魔女', cond: 'Sランクをとる', ok: (s) => s.sRanks >= 1 },
  ];
  const MORSE_BADGES = [
    { id: 'fly1', icon: '🧹', name: '見習い魔女', cond: 'ミニゲームを初めてプレイ', ok: (s) => s.catPlays >= 1 },
    { id: 'fly5', icon: '🐾', name: '夜のなかまたち', cond: 'ミニゲームを合計5回プレイ', ok: (s) => s.catPlays >= 5 },
    { id: 'fly7', icon: '🎃', name: 'ほうきまみれ', cond: `1回のゲームでミニゲームを${FLY_MAX}回（最大）プレイ`, ok: (s) => s.catMaxInGame >= FLY_MAX },
    { id: 'clear1', icon: '🌟', name: '奇跡の生還', cond: 'ミニゲームを初めてクリア', ok: (s) => s.catClears >= 1 },
    { id: 'clear5', icon: '🦇', name: '逃げ足名人', cond: 'ミニゲームを合計5回クリア', ok: (s) => s.catClears >= 5 },
    { id: 'm1000', icon: '☁️', name: '真夜中のおさんぽ', cond: 'ミニゲームで合計1000m進む', ok: (s) => s.catMeters >= 1000 },
    { id: 'm10000', icon: '🌕', name: '月まで一直線', cond: 'ミニゲームで合計10000m進む', ok: (s) => s.catMeters >= 10000 },
    { id: 'game1', icon: '👻', name: 'はじめの一歩', cond: 'ゲームを最後までプレイ', ok: (s) => s.games >= 1 },
    { id: 'nomiss', icon: '📡', name: '天才通信士', cond: 'ノーミスで最後までプレイ', ok: (s) => s.perfectGames >= 1 },
    { id: 'rankS', icon: '👑', name: '大魔女', cond: 'Sランクをとる', ok: (s) => s.sRanks >= 1 },
  ];

  const MODES = {
    nicola: {
      name: '親指シフト', appTitle: 'ハロウィン親指シフト', stageName: 'ハロウィン単語',
      words: WORDS, count: QUESTION_COUNT, ranks: RANKS,
      bestKey: 'nh-best-words', statsKey: 'nh-stats', badgesKey: 'nh-badges', badges: BADGES,
      minis: [CatRun], miniName: '黒猫ダッシュ', miniIcon: '🐈',
      chapters: TUTORIAL_CHAPTERS, steps: TUTORIAL_STEPS,
    },
    morse: {
      name: 'モールス信号', appTitle: 'ハロウィンモールス信号', stageName: 'ハロウィン英文',
      words: MORSE_WORDS, count: MORSE_QUESTION_COUNT, ranks: MORSE_RANKS,
      bestKey: 'nh-best-morse', statsKey: 'nh-stats-morse', badgesKey: 'nh-badges-morse', badges: MORSE_BADGES,
      minis: [CatRun], miniName: '黒猫ダッシュ', miniIcon: '🐈',
      chapters: MORSE_TUTORIAL_CHAPTERS, steps: MORSE_TUTORIAL_STEPS,
    },
  };
  if (!MODES[mode]) mode = 'nicola';

  function loadStats() {
    return {
      catPlays: 0, catClears: 0, catMeters: 0, catMaxInGame: 0, games: 0, perfectGames: 0, sRanks: 0,
      ...store.get(M().statsKey, {}),
    };
  }
  function recordCat(r, playsThisGame) {
    const st = loadStats();
    st.catPlays++;
    if (r.cleared) st.catClears++;
    st.catMeters += r.meters;
    st.catMaxInGame = Math.max(st.catMaxInGame, playsThisGame);
    store.set(M().statsKey, st);
  }
  function renderBadges(st) {
    const m = M();
    const had = new Set(store.get(m.badgesKey, []));
    const got = m.badges.filter((b) => b.ok(st)).map((b) => b.id);
    store.set(m.badgesKey, got);
    const ul = $('#res-badges');
    ul.innerHTML = '';
    for (const b of m.badges) {
      const on = got.includes(b.id);
      const li = document.createElement('li');
      li.className = 'badge' + (on ? '' : ' locked') + (on && !had.has(b.id) ? ' new' : '');
      li.innerHTML = `<span class="bd-icon">${b.icon}</span>`
        + `<span class="bd-tip"><b>${b.name}</b>${b.cond}<i>${on ? '獲得ずみ' : '未獲得'}</i></span>`;
      ul.append(li);
    }
    $('#res-badge-count').textContent = `${got.length} / ${m.badges.length}`;
  }

  // ===== チュートリアル =====
  let tut = null;   // { i: ステップ番号, done: 練習を打ち終えたか, raf, placed }
  const tutCard = $('#tut-card');
  const tutHoles = $('#tut-holes');
  const tutRings = $('#tut-rings');
  const TUT_PAD = 6;

  const tutSteps = () => M().steps;
  const tutPracticing = () => !!tut && !!tutSteps()[tut.i].practice;

  function startTutorial() {
    audioCtx();
    syncBgm();
    buildTutChapters();
    tut = { i: 0, done: false, raf: 0, placed: false };
    $('#ph-stage-name').textContent = 'チュートリアル';
    $('#kb-wrap').classList.remove('hide');
    show('play');
    $('#tut').hidden = false;
    document.body.classList.add('tut-on');
    tutStep(0);
    tutLoop();
  }
  function endTutorial() {
    if (!tut) return;
    cancelAnimationFrame(tut.raf);
    tut = null;
    game = null;
    $('#tut').hidden = true;
    document.body.classList.remove('tut-on');
    document.body.classList.remove('tut-explain');
    $('#ph-stage-name').textContent = M().stageName;
    applyKb();
  }

  function renderBlank() {
    $('#prompt-display').textContent = '';
    $('#prompt-kana').textContent = '';
    $('#next-char').textContent = '';
    $('#next-char').className = 'next-char';
    $('#next-hint').textContent = '';
    $('#next-after').textContent = '';
    $('#play-count').textContent = '';
    $('#play-bar').style.width = '0%';
    highlightKey(null);
  }

  function tutStep(i) {
    const s = tutSteps()[i];
    tut.i = i;
    tut.done = false;
    resetInput();
    if (s.words) {
      game = newGame(s.words.map((w) => ({ display: w.d, kana: w.k })));
      game.tutorial = true;
      game.catCool = Infinity;  // チュートリアル中は黒猫ダッシュなし
      renderQuestion();
      updateStats();
      if (!s.practice) highlightKey(null);
    } else {
      game = null;
      renderBlank();
    }
    document.body.classList.toggle('tut-explain', !s.practice);
    [...$('#tut-chapters').children].forEach((li, ci) => {
      li.className = ci === s.ch ? 'cur' : ci < s.ch ? 'done' : '';
      li.firstChild.textContent = ci === s.ch ? `${ci + 1}. ${M().chapters[ci]}` : ci + 1;
    });
    $('#tut-count').textContent = `${i + 1} / ${tutSteps().length}`;
    $('#tut-title').textContent = s.title;
    const p = preset();
    $('#tut-text').innerHTML = s.text.replace(/\{L\}/g, p.lLabel).replace(/\{R\}/g, p.rLabel);
    $('#tut-prev').disabled = i === 0;
    renderTutStatus();
    retrigger(tutCard, 'in');
  }
  function renderTutStatus() {
    const s = tutSteps()[tut.i];
    const last = tut.i === tutSteps().length - 1;
    const st = $('#tut-status');
    const next = $('#tut-next');
    if (s.practice && !tut.done) {
      st.textContent = '⌨ 実際に打ってみよう';
      st.className = 'tut-status wait';
      next.textContent = 'とばす';
      next.classList.remove('ready');
    } else {
      st.textContent = s.practice ? 'できた！' : '';
      st.className = 'tut-status' + (s.practice ? ' ok' : '');
      next.innerHTML = `${last ? '本番スタート' : 'つぎへ'} <kbd>Enter</kbd>`;
      // 進めるときは「つぎへ」を点滅させて、押すのはこっちだと分かるようにする
      next.classList.add('ready');
    }
  }
  function tutPracticeDone() {
    game.finished = true;
    highlightKey(null);
    $('#play-bar').style.width = '100%';
    tut.done = true;
    renderTutStatus();
    ghostSay('できた！');
  }
  // skip
  function tutNext(skip) {
    if (tutPracticing() && !tut.done && !skip) return;
    if (tut.i === tutSteps().length - 1) { startGame(); return; }
    tutStep(tut.i + 1);
  }
  function tutPrev() {
    if (tut.i > 0) tutStep(tut.i - 1);
  }

  function tutRects(sels) {
    const out = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) out.push(r);
      });
    }
    return out;
  }
  function syncChildren(parent, n, make) {
    while (parent.children.length < n) parent.append(make());
    while (parent.children.length > n) parent.lastElementChild.remove();
  }
  function tutLayout() {
    const s = tutSteps()[tut.i];
    const rects = tutRects(s.target);
    syncChildren(tutHoles, rects.length, () => document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    syncChildren(tutRings, rects.length, () => {
      const d = document.createElement('div');
      d.className = 'tut-ring';
      return d;
    });
    rects.forEach((r, k) => {
      const x = r.left - TUT_PAD, y = r.top - TUT_PAD, w = r.width + TUT_PAD * 2, h = r.height + TUT_PAD * 2;
      const hole = tutHoles.children[k];
      hole.setAttribute('x', x);
      hole.setAttribute('y', y);
      hole.setAttribute('width', w);
      hole.setAttribute('height', h);
      hole.setAttribute('rx', 12);
      tutRings.children[k].style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    });
    placeTutCard(s.anchor ? tutRects([s.anchor]) : rects, s.place || 'below');
  }
  function placeTutCard(rects, place) {
    const vw = innerWidth, vh = innerHeight, M = 12, G = 16;
    const w = tutCard.offsetWidth, h = tutCard.offsetHeight;
    let x = (vw - w) / 2, y = (vh - h) / 2;
    if (rects.length) {
      const top = Math.min(...rects.map((r) => r.top)) - TUT_PAD;
      const bottom = Math.max(...rects.map((r) => r.bottom)) + TUT_PAD;
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      x = (left + right) / 2 - w / 2;
      const fitsBelow = h <= vh - bottom - G - M;
      const fitsAbove = h <= top - G - M;
      if (place === 'above') y = fitsAbove ? top - G - h : fitsBelow ? bottom + G : M;
      else y = fitsBelow ? bottom + G : fitsAbove ? top - G - h : vh - M - h;
    }
    x = Math.max(M, Math.min(x, vw - w - M));
    y = Math.max(M, Math.min(y, vh - h - M));

    tutCard.style.transition = tut.placed ? '' : 'none';
    tut.placed = true;
    tutCard.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function tutLoop() {
    if (!tut) return;
    tutLayout();
    tut.raf = requestAnimationFrame(tutLoop);
  }

  function tutKey(e) {
    if (e.code === 'Escape') { goTitle(); return; }
    if (e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) tutNext(false); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); if (!e.repeat) tutPrev(); return; }
    if (e.code === 'Tab') { e.preventDefault(); return; }
    // モールスは説明だけのステップでも電鍵を押して音とゲージを試せる（打った記号は判定しない）
    if (tutPracticing() || isMorse()) onPlayKeyDown(e);
  }

  function buildTutChapters() {
    const ol = $('#tut-chapters');
    ol.innerHTML = '';
    M().chapters.forEach((name, ci) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.title = name;
      b.addEventListener('click', (e) => {
        tutStep(tutSteps().findIndex((s) => s.ch === ci));
        e.currentTarget.blur();
      });
      li.append(b);
      ol.append(li);
    });
  }
  $('#tut-next').addEventListener('click', (e) => { tutNext(true); e.currentTarget.blur(); });
  $('#tut-prev').addEventListener('click', (e) => { tutPrev(); e.currentTarget.blur(); });
  $('#tut-exit').addEventListener('click', (e) => { goTitle(); e.currentTarget.blur(); });

  // ===== 結果の共有 =====
  function resultText() {
    const g = game, r = g.result, m = M();
    const lines = [
      `${m.appTitle}で ${r.rank.rank}ランク「${r.rank.title}」になった！`,
      `スコア ${r.score} ／ 正確率 ${(r.acc * 100).toFixed(1)}% ／ ${Math.round(r.cpm)}字/分`,
    ];
    if (g.catPlays) lines.push(`${m.miniIcon} ${m.miniName} ${g.catPlays}回`);
    lines.push(`🏅 バッジ ${store.get(m.badgesKey, []).length} / ${m.badges.length}`);
    lines.push('#' + m.appTitle);
    if (/^https?:/.test(location.href)) lines.push(location.href);
    return lines.join('\n');
  }
  function shareX() {
    if (!game || !game.result) return;
    window.open('https://x.com/intent/post?text=' + encodeURIComponent(resultText()), '_blank', 'noopener');
  }
  async function copyResult() {
    if (!game || !game.result) return;
    const text = resultText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // file:// などで Clipboard API が使えないとき
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('結果をコピーしました');
  }

  // ===== 演出 =====
  const fx = $('#fx-layer');
  function burst(x, y, n, big) {
    const glyphs = ['✦', '✧', '★', '✶', '✷'];
    const colors = ['#ffcf4a', '#ff8a2a', '#c58bff', '#7ef0ff', '#fff3c4'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = pick(glyphs);
      const ang = Math.random() * Math.PI * 2;
      const dist = (big ? 80 : 36) + Math.random() * (big ? 120 : 40);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 360 - 180) + 'deg');
      p.style.color = pick(colors);
      p.style.fontSize = (big ? 16 : 11) + Math.random() * 12 + 'px';
      p.addEventListener('animationend', () => p.remove());
      fx.append(p);
    }
  }
  function burstAt(el, n, big) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, n, big);
  }
  function popText(x, y, text, cls) {
    const p = document.createElement('div');
    p.className = 'pop ' + (cls || '');
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.addEventListener('animationend', () => p.remove());
    fx.append(p);
  }
  function comboCelebrate() {
    retrigger($('#stat-combo'), 'pop');
  }
  let ghostTimer = 0;
  function ghostReact(kind) {
    ghostEl.classList.remove('happy', 'scared');
    void ghostEl.offsetWidth;
    ghostEl.classList.add(kind);
    clearTimeout(ghostTimer);
    ghostTimer = setTimeout(() => ghostEl.classList.remove(kind), kind === 'scared' ? 600 : 380);
  }
  let bubbleTimer = 0;
  function ghostSay(msg) {
    const b = $('#ghost-bubble');
    b.textContent = msg;
    b.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove('show'), 1400);
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ===== キー操作 =====
  function titleKey(e) {
    switch (e.code) {
      case 'Enter': case 'Space': e.preventDefault(); startGame(); break;
      case 'KeyH': startTutorial(); break;
      case 'KeyT': if (!isMorse()) cyclePreset(); break;
      case 'KeyM': toggleBgm(); break;
    }
  }
  function playKey(e) {
    if (tut) { tutKey(e); return; }
    if (e.code === 'Escape') { goTitle(); return; }
    if (e.code === 'Tab') {
      e.preventDefault();
      showKb = !showKb;
      store.set('nh-kb', showKb);
      applyKb();
      return;
    }
    onPlayKeyDown(e);
  }
  function resultKey(e) {
    if (e.repeat) return;
    if (e.code === 'Enter') { e.preventDefault(); startGame(); }
    else if (e.code === 'Escape') goTitle();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Process' || e.isComposing) toast('IMEがオンになっています。半角英数に切り替えてね');
    if (e.ctrlKey || e.metaKey) return;
    const mg = activeMini();
    if (mg) {
      if (e.code === 'Escape') goTitle();
      else mg.keyDown(e);
      return;
    }
    // ブラウザの自動再生制限のため、最初のキー入力で BGM を開始する
    if (bgmOn && bgmReady && bgm.paused) syncBgm();
    if (e.key === 'Alt' || e.code === 'Space') e.preventDefault();
    if (screen === 'title') titleKey(e);
    else if (screen === 'play') playKey(e);
    else resultKey(e);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') e.preventDefault();
    const mg = activeMini();
    if (mg) { mg.keyUp(e); return; }
    if (screen === 'play') onPlayKeyUp(e);
  });
  window.addEventListener('blur', resetInput);

  $('#quit-btn').addEventListener('click', (e) => { goTitle(); e.currentTarget.blur(); });
  $('#mode-btn').addEventListener('click', (e) => { toggleMode(); e.currentTarget.blur(); });
  $('#thumb-btn').addEventListener('click', (e) => { cyclePreset(); e.currentTarget.blur(); });
  $('#bgm-btn').addEventListener('click', (e) => { audioCtx(); toggleBgm(); e.currentTarget.blur(); });
  $('#start-btn').addEventListener('click', startGame);
  $('#tut-btn').addEventListener('click', (e) => { startTutorial(); e.currentTarget.blur(); });
  $('#btn-retry').addEventListener('click', startGame);
  $('#btn-title').addEventListener('click', goTitle);
  // フォーカスが残ると Enter で再度押されてしまうので外す
  $('#btn-share-x').addEventListener('click', (e) => { shareX(); e.currentTarget.blur(); });
  $('#btn-copy').addEventListener('click', (e) => { copyResult(); e.currentTarget.blur(); });

  // ===== 初期化 =====
  {
    const stars = $('#stars');
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 65 + '%';
      s.style.animationDelay = -Math.random() * 3 + 's';
      s.style.animationDuration = 2 + Math.random() * 3 + 's';
      stars.append(s);
    }
  }
  // 出題データに配列外の文字が混ざっていないか確認
  for (const o of WORDS) {
    for (const c of o.k) if (!KANA_TO_KEY[c]) console.warn('配列にない文字:', c, o.k);
  }
  for (const o of MORSE_WORDS) {
    for (const c of o.k) if (c !== ' ' && !MORSE[c]) console.warn('モールス符号にない文字:', c, o.k);
  }
  buildKeyboard();
  buildMorsePad();
  applyKb();
  renderThumbLabels();
  renderBgmState();
  applyMode();
})();
