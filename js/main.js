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
    return actx;
  };
  const SE_FILES = { correct: 'assets/se_correct.mp3', miss: 'assets/se_miss.mp3', clear: 'assets/se_clear.mp3', result: 'assets/se_result.mp3' };
  const seAudio = {};
  for (const [name, src] of Object.entries(SE_FILES)) {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('canplaythrough', () => { seAudio[name] = a; }, { once: true });
    a.src = src;
  }
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
    if (seAudio[name]) {
      const a = seAudio[name].cloneNode();
      a.volume = 0.6;
      a.play().catch(() => {});
      return;
    }
    if (name === 'correct') tone(880 + Math.random() * 220, 0.08, 'triangle', 0.05);
    else if (name === 'miss') { tone(160, 0.18, 'sawtooth', 0.05); tone(120, 0.2, 'sawtooth', 0.04, 0.05); }
    else if (name === 'clear') [660, 880, 1320].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.07));
    else if (name === 'result') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.12));
    else if (name === 'jump') { tone(520, 0.1, 'square', 0.025); tone(780, 0.08, 'square', 0.02, 0.04); }
    else if (name === 'crash') { tone(220, 0.25, 'sawtooth', 0.06); tone(110, 0.35, 'sawtooth', 0.05, 0.08); }
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
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  }

  // ===== タイトル =====
  function renderTitle() {
    const best = store.get('nh-best-words', null);
    $('#title-best').textContent = best ? `ベスト：${best.rank}ランク（${best.score}点）` : '';
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
    if (CatRun.active()) { CatRun.abort(); syncBgm(); }
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
    document.querySelectorAll('.key.target').forEach((k) => k.classList.remove('target'));
    document.querySelectorAll('.key .hit').forEach((k) => k.classList.remove('hit'));
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
  }
  function onPlayKeyDown(e) {
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
  function onPlayKeyUp(e) {
    const side = thumbSideOf(e.code);
    if (side) {
      e.preventDefault();
      thumbs[side].down = false;
      $('#thumb-' + side).classList.remove('down');
      return;
    }
    if (pending && pending.code === e.code) flushPending();
  }

  // ===== ゲーム =====
  let game = null;

  function buildQuestions() {
    return shuffle([...WORDS]).slice(0, QUESTION_COUNT).map((o) => ({ display: o.d, kana: o.k }));
  }

  function startGame() {
    audioCtx();
    syncBgm();
    game = {
      questions: buildQuestions(), qi: 0, pos: 0,
      correct: 0, miss: 0, combo: 0, maxCombo: 0,
      startTime: null, endTime: null, missed: new Set(), finished: false,
      catLock: false, catCool: CAT_COOLDOWN, catPlays: 0, result: null,
    };
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
      s.className = 'ch';
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
    const k = KANA_TO_KEY[target];
    const nc = $('#next-char');
    nc.textContent = target;
    nc.className = 'next-char' + (k && k.shift !== 'none' ? ' sh-' + k.shift : '');
    $('#next-hint').innerHTML = hintHtml(target);
    const after = q.kana[game.pos + 1];
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
      if (game.combo % 20 === 0) comboCelebrate(game.combo);
      game.pos++;
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
        if (game.qi >= game.questions.length) { finish(); return; }
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

  // ===== 黒猫ダッシュ（ノーミスで単語を打つと、次の単語の前に割り込む） =====
  const CAT_CHANCE = 1;     // ノーミスのとき割り込む確率（1 = 必ず）
  const CAT_COOLDOWN = 0;   // 一度割り込んだら、次の判定まで最低この語数あける（開始直後も同様）

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
      const p = preset();
      CatRun.start({
        music: catBgm.error ? null : catBgm,
        muted: !bgmOn,  // BGM OFF でも曲の長さで終わるよう、無音で再生する
        sound: se,
        jumpCodes: [...p.left, ...p.right],
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
          ghostSay(r.cleared ? `逃げきった！ ${r.meters}m` : 'おかえり！');
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
    const rank = RANKS.find((r) => score >= r.min && acc >= r.acc) || RANKS[RANKS.length - 1];
    const prev = store.get('nh-best-words', null);
    const isBest = !prev || score > prev.score;
    if (isBest) store.set('nh-best-words', { rank: rank.rank, score });

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
    store.set('nh-stats', st);
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
  const CAT_MAX = QUESTION_COUNT - 1;
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
  function loadStats() {
    return {
      catPlays: 0, catClears: 0, catMeters: 0, catMaxInGame: 0, games: 0, perfectGames: 0, sRanks: 0,
      ...store.get('nh-stats', {}),
    };
  }
  function recordCat(r, playsThisGame) {
    const st = loadStats();
    st.catPlays++;
    if (r.cleared) st.catClears++;
    st.catMeters += r.meters;
    st.catMaxInGame = Math.max(st.catMaxInGame, playsThisGame);
    store.set('nh-stats', st);
  }
  function renderBadges(st) {
    const had = new Set(store.get('nh-badges', []));
    const got = BADGES.filter((b) => b.ok(st)).map((b) => b.id);
    store.set('nh-badges', got);
    const ul = $('#res-badges');
    ul.innerHTML = '';
    for (const b of BADGES) {
      const on = got.includes(b.id);
      const li = document.createElement('li');
      li.className = 'badge' + (on ? '' : ' locked') + (on && !had.has(b.id) ? ' new' : '');
      li.innerHTML = `<span class="bd-icon">${b.icon}</span>`
        + `<span class="bd-tip"><b>${b.name}</b>${b.cond}<i>${on ? '獲得ずみ' : '未獲得'}</i></span>`;
      ul.append(li);
    }
    $('#res-badge-count').textContent = `${got.length} / ${BADGES.length}`;
  }

  // ===== 結果の共有 =====
  function resultText() {
    const g = game, r = g.result;
    const lines = [
      `ハロウィン親指シフトで ${r.rank.rank}ランク「${r.rank.title}」になった！`,
      `スコア ${r.score} ／ 正確率 ${(r.acc * 100).toFixed(1)}% ／ ${Math.round(r.cpm)}字/分`,
    ];
    if (g.catPlays) lines.push(`🐈 黒猫ダッシュ ${g.catPlays}回`);
    lines.push(`🏅 バッジ ${store.get('nh-badges', []).length} / ${BADGES.length}`);
    lines.push('#ハロウィン親指シフト');
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
  function comboCelebrate(n) {
    const b = document.createElement('div');
    b.className = 'combo-banner';
    b.innerHTML = `${n} COMBO!<small>おばけも大よろこび！</small>`;
    b.addEventListener('animationend', () => b.remove());
    fx.append(b);
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
      case 'KeyT': cyclePreset(); break;
      case 'KeyM': toggleBgm(); break;
    }
  }
  function playKey(e) {
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
    if (CatRun.active()) {
      if (e.code === 'Escape') goTitle();
      else CatRun.keyDown(e);
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
    if (CatRun.active()) { CatRun.keyUp(e); return; }
    if (screen === 'play') onPlayKeyUp(e);
  });
  window.addEventListener('blur', resetInput);

  $('#thumb-btn').addEventListener('click', (e) => { cyclePreset(); e.currentTarget.blur(); });
  $('#bgm-btn').addEventListener('click', (e) => { audioCtx(); toggleBgm(); e.currentTarget.blur(); });
  $('#start-btn').addEventListener('click', startGame);
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
  buildKeyboard();
  applyKb();
  renderThumbLabels();
  renderBgmState();
  renderTitle();
})();
