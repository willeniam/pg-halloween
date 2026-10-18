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

// ===== モールス信号のチュートリアル =====
const MORSE_TUTORIAL_CHAPTERS = ['モールス信号って何？', '短く押す「・」', '長く押す「－」', '組み合わせて打つ', '実際に打つ'];

const MORSE_TUTORIAL_STEPS = [
  // ---- 1. モールス信号って何？ ----
  {
    ch: 0, title: 'モールス信号って何？', target: ['#morse-chart'], place: 'above',
    text: '<b>短い音「・」（トン）</b>と<b>長い音「－」（ツー）</b>の並びで文字を表す信号です。<br>'
      + 'このゲームでは<b>アルファベット</b>を打ちます。下が全文字の符号表です。',
  },
  {
    ch: 0, title: '1文字＝トンとツーの並び', target: ['.mc-cell[data-ch="A"]', '.mc-cell[data-ch="N"]'], place: 'above',
    text: '<div class="tut-morse-demo">'
      + `<div><b>A</b>${morseHtml('.-')}<span>トン・ツー</span></div>`
      + `<div><b>N</b>${morseHtml('-.')}<span>ツー・トン</span></div></div>`
      + '同じ記号でも、<b>順番</b>がちがうと別の文字になります。',
  },
  {
    ch: 0, title: '電鍵（でんけん）', target: ['#morse-key'], place: 'above',
    text: '信号を打つ道具を<b>電鍵</b>といいます。このゲームでは <kbd>Space</kbd> が電鍵です'
      + '<small>（画面の電鍵をクリック長押ししてもOK）</small>。<br>'
      + '試しに押してみよう。押している間「ピー」と鳴ります。',
  },

  // ---- 2. 短く押す「・」 ----
  {
    ch: 1, title: '短く押すと「・」', target: ['#morse-key', '.next-box'], place: 'above',
    words: [{ d: '短点の練習', k: 'E' }],
    text: '<kbd>Space</kbd> を<b>「トン」と短く</b>押してすぐ離すと短点「・」。<br>'
      + '「E」は「・」1つだけの文字です。',
  },
  {
    ch: 1, title: 'やってみよう', practice: true, target: ['#prompt-box', '.next-box', '#morse-key'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '短点だけの文字', k: 'EIS' }],
    text: `E ${morseHtml('.')}　I ${morseHtml('..')}　S ${morseHtml('...')}<br>短く押す回数だけで打てます。`,
  },

  // ---- 3. 長く押す「－」 ----
  {
    ch: 2, title: '長く押すと「－」', target: ['#morse-key', '.next-box'], place: 'above',
    words: [{ d: '長点の練習', k: 'T' }],
    text: '<kbd>Space</kbd> を<b>「ツー」と長めに</b>押すと長点「－」。<br>'
      + '電鍵のゲージが<b>線をこえてオレンジ</b>になったら長点です（0.2秒）。',
  },
  {
    ch: 2, title: 'やってみよう', practice: true, target: ['#prompt-box', '.next-box', '#morse-key'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: '長点だけの文字', k: 'TMO' }],
    text: `T ${morseHtml('-')}　M ${morseHtml('--')}　O ${morseHtml('---')}<br>ゲージがオレンジになるまで押してから離そう。`,
  },

  // ---- 4. 組み合わせて打つ ----
  {
    ch: 3, title: '「つぎの文字」を見る', target: ['.next-box', '.mc-cell[data-ch="A"]'], place: 'above',
    words: [{ d: 'まぜて打つ', k: 'A' }],
    text: '「つぎの文字」に符号が出ます。打った記号は<b>金色に光る</b>ので、どこまで打ったか分かります。<br>'
      + `「A」は ${morseHtml('.-')}（短く → 長く）。`,
  },
  {
    ch: 3, title: 'まちがえたら', target: ['.next-box'], place: 'above',
    words: [{ d: 'まぜて打つ', k: 'A' }],
    text: '<ul>'
      + '<li>ちがう記号を打つと<b>その場でミス</b>。その文字は最初から打ち直し。</li>'
      + '<li>文字と文字の間は<b>ゆっくりでOK</b>。あわてずに。</li>'
      + '</ul>',
  },
  {
    ch: 3, title: 'やってみよう', practice: true, target: ['#prompt-box', '.next-box', '.mc-cell.target'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: 'こうもり', k: 'BAT' }],
    text: `B ${morseHtml('-...')}　A ${morseHtml('.-')}　T ${morseHtml('-')}<br>「つぎの文字」の符号を見ながら打とう。`,
  },

  // ---- 5. 実際に打つ ----
  {
    ch: 4, title: '本番の画面', target: ['.ph-stats', '#prompt-box', '.next-box'],
    words: [{ d: 'おばけ', k: 'GHOST' }],
    text: 'まんなかに英単語（上は日本語の意味）、右につぎの文字と符号が出ます。<br>'
      + 'スコアは<b>速度 × 正確率²</b>。<kbd>Tab</kbd> で符号表を隠せます。',
  },
  {
    ch: 4, title: 'やってみよう（総まとめ）', practice: true, target: ['#prompt-box', '.next-box'],
    anchor: '.stage-area', place: 'above',
    words: [{ d: 'ばあ！', k: 'BOO' }],
    text: 'さいごに1つ打ってみよう。',
  },
  {
    ch: 4, title: 'おつかれさま！', target: [],
    text: 'これで基本はばっちり！ 最初はゆっくりでOK。<br>'
      + 'ノーミスで単語を打つと…夜空から何かがやってくるかも？<br>'
      + '<small><kbd>Enter</kbd> で本番スタート ／ <kbd>Esc</kbd> でタイトルへ</small>',
  },
];
