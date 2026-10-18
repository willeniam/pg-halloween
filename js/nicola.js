// NICOLA（親指シフト）配列の定義
// 各キー: [単独, 左親指と同時, 右親指と同時]
// 一般的な親指シフトエミュレータ（やまぶきR 等）の NICOLA 配列に準拠
const NICOLA = {
  // 上段
  KeyQ: ['。', 'ぁ', ''],
  KeyW: ['か', 'え', 'が'],
  KeyE: ['た', 'り', 'だ'],
  KeyR: ['こ', 'ゃ', 'ご'],
  KeyT: ['さ', 'れ', 'ざ'],
  KeyY: ['ら', 'ぱ', 'よ'],
  KeyU: ['ち', 'ぢ', 'に'],
  KeyI: ['く', 'ぐ', 'る'],
  KeyO: ['つ', 'づ', 'ま'],
  KeyP: ['、', 'ぴ', 'ぇ'],
  // 中段
  KeyA: ['う', 'を', 'ゔ'],
  KeyS: ['し', 'あ', 'じ'],
  KeyD: ['て', 'な', 'で'],
  KeyF: ['け', 'ゅ', 'げ'],
  KeyG: ['せ', 'も', 'ぜ'],
  KeyH: ['は', 'ば', 'み'],
  KeyJ: ['と', 'ど', 'お'],
  KeyK: ['き', 'ぎ', 'の'],
  KeyL: ['い', 'ぽ', 'ょ'],
  Semicolon: ['ん', '', 'っ'],
  // 下段
  KeyZ: ['．', 'ぅ', ''],
  KeyX: ['ひ', 'ー', 'び'],
  KeyC: ['す', 'ろ', 'ず'],
  KeyV: ['ふ', 'や', 'ぶ'],
  KeyB: ['へ', 'ぃ', 'べ'],
  KeyN: ['め', 'ぷ', 'ぬ'],
  KeyM: ['そ', 'ぞ', 'ゆ'],
  Comma: ['ね', 'ぺ', 'む'],
  Period: ['ほ', 'ぼ', 'わ'],
  Slash: ['・', '', 'ぉ'],
};

const NICOLA_ROWS = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

const LEFT_HAND = new Set(NICOLA_ROWS.flatMap((row) => row.slice(0, 5)));

const KEY_LABEL = (code) =>
  ({ Semicolon: ';', Comma: ',', Period: '.', Slash: '/' })[code] || code.replace('Key', '');

// かな → { code, shift: 'none' | 'left' | 'right' }
const KANA_TO_KEY = {};
for (const [code, chars] of Object.entries(NICOLA)) {
  ['none', 'left', 'right'].forEach((shift, i) => {
    const ch = chars[i];
    if (ch && !KANA_TO_KEY[ch]) KANA_TO_KEY[ch] = { code, shift };
  });
}
