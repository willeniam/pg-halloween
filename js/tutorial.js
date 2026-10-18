// チュートリアルの内容

const TUTORIAL_CHAPTERS = ['親指シフトって何？', '文字キーだけを押す', '親指キーと一緒に押す', '左右の親指を使い分ける', '実際に打つ'];

const TUTORIAL_STEPS = [
  // ---- 1. 親指シフトって何？ ----
  {
    ch: 0, title: '親指シフトって何？', target: ['#keyboard'], place: 'above',
    text: '日本語を<b>かなで直接</b>打つ入力方法です。<br>'
      + 'ローマ字だと「か」は <kbd>K</kbd><kbd>A</kbd> の2打。親指シフトなら<b>1打で1文字</b>。',
  },
  {
    ch: 0, title: '1つのキーに3つの文字', target: ['.key[data-code="KeyW"]'],
    text: '<div class="tut-key-demo">'
      + '<div class="key"><span class="kl">え</span><span class="kr">が</span><span class="kn">か</span><span class="kc">W</span></div>'
      + '<ul><li><b class="c-n">か</b> まんなか … そのまま押す</li>'
      + '<li><b class="c-l">え</b> 左上（紫）… 左親指と同時</li>'
      + '<li><b class="c-r">が</b> 右上（オレンジ）… 右親指と同時</li></ul></div>',
  },
  {
    ch: 0, title: '親指キー', target: ['#thumb-left', '#thumb-right'],
    text: 'いちばん下の2つが<b>親指キー</b>。シフトキーのように文字キーと組み合わせます。<br>'
      + 'いまの設定：<span class="c-l">左＝{L}</span> ／ <span class="c-r">右＝{R}</span>'
      + '<small>（タイトル画面の <kbd>T</kbd> で変更）</small>',
  },

  // ---- 2. 文字キーだけを押す ----
  {
    ch: 1, title: 'まんなかの字はそのまま', target: ['.key[data-code="KeyW"]', '.next-box'],
    words: [{ d: 'か', k: 'か' }],
    text: 'まんなかの大きな字は、そのキーを<b>押すだけ</b>。「か」なら <kbd>W</kbd> だけです。',
  },
  {
    ch: 1, title: 'やってみよう', practice: true, target: ['#prompt-box', '.key.target'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '素敵', k: 'すてき' }],
    text: '光っているキーを押して打ってみよう。',
  },

  // ---- 3. 親指キーと一緒に押す ----
  {
    ch: 2, title: '親指キーと「同時に」押す', target: ['.key[data-code="KeyJ"]', '#thumb-right', '.next-box'],
    words: [{ d: 'お', k: 'お' }],
    text: '上のすみの小さな字は、文字キーと親指キーを<b>同時に</b>押します。<br>'
      + '「お」は <kbd>J</kbd> ＋ <span class="c-r">右親指</span>。和音のように「トン」。',
  },
  {
    ch: 2, title: '同時押しのコツ', target: ['.key[data-code="KeyJ"]', '#thumb-right'],
    words: [{ d: 'お', k: 'お' }],
    text: '<ul>'
      + '<li><b>どちらが先でもOK</b>（0.1秒以内なら同時）。</li>'
      + '<li>親指キーを<b>押したまま</b>でもOK。</li>'
      + '<li>親指がおくれると、まんなかの字（と）になります。</li>'
      + '</ul>',
  },
  {
    ch: 2, title: 'やってみよう', practice: true, target: ['#prompt-box', '.key.target', '.key.thumb.target'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '夜', k: 'よる' }],
    text: '右親指といっしょに押して打ってみよう。',
  },

  // ---- 4. 左右の親指を使い分ける ----
  {
    ch: 3, title: '左上は左、右上は右', target: ['.key[data-code="KeyS"]', '#thumb-left', '.kb-legend'],
    words: [{ d: 'あ', k: 'あ' }],
    text: '<span class="c-l">左上の紫の字 → 左親指</span>　<span class="c-r">右上のオレンジの字 → 右親指</span><br>'
      + '「あ」は <kbd>S</kbd> の左上なので <kbd>S</kbd> ＋ <span class="c-l">左親指</span>。',
  },
  {
    ch: 3, title: 'やってみよう（左親指）', practice: true, target: ['#prompt-box', '.key.target', '.key.thumb.target'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '森', k: 'もり' }],
    text: 'こんどは左親指。紫の字に注意して打ってみよう。',
  },
  {
    ch: 3, title: '濁音は反対側の親指', target: ['.key[data-code="KeyW"]', '.key[data-code="KeyH"]', '#thumb-left', '#thumb-right'],
    text: '濁音は、もとの字と同じキー＋<b>反対側の親指</b>。<br>'
      + '<kbd>W</kbd>（左手）か → が は <span class="c-r">右親指</span>　'
      + '<kbd>H</kbd>（右手）は → ば は <span class="c-l">左親指</span>',
  },
  {
    ch: 3, title: 'やってみよう（左右まぜて）', practice: true, target: ['#prompt-box', '.next-box', '.key.target', '.key.thumb.target'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: 'お化け', k: 'おばけ' }],
    text: '左右がまざるよ。「つぎの文字」の色を見ながら打ってみよう。',
  },

  // ---- 5. 実際に打つ ----
  {
    ch: 4, title: '本番の画面', target: ['.ph-stats', '#prompt-box', '.next-box'],
    words: [{ d: 'かぼちゃ', k: 'かぼちゃ' }],
    text: 'まんなかにお題、右につぎの文字と押し方、上に成績が出ます。<br>'
      + 'スコアは<b>速度 × 正確率²</b>。あせらず正確に！',
  },
  {
    ch: 4, title: 'やってみよう（総まとめ）', practice: true, target: ['#prompt-box', '.next-box'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '吸血鬼', k: 'きゅうけつき' }],
    text: 'さいごに1つ打ってみよう。',
  },
  {
    ch: 4, title: 'おつかれさま！', target: [],
    text: 'これで基本はばっちり！ 最初はゆっくりでOK。<br>'
      + '<small><kbd>Enter</kbd> で本番スタート ／ <kbd>Esc</kbd> でタイトルへ</small>',
  },
];
