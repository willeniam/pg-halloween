// モールス信号（欧文）の定義と出題データ
// 「.」＝短点（トン）、「-」＝長点（ツー）
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

// Space をこれより長く押したら長点
const MORSE_DOT_MAX_MS = 200;

// 符号を「・」「－」の図形で表す HTML（lit 個目までを光らせる）
const morseHtml = (code, lit = 0) =>
  '<span class="mcode">'
  + [...code].map((c, i) => `<i class="${c === '.' ? 'dot' : 'dash'}${i < lit ? ' on' : ''}"></i>`).join('')
  + '</span>';
const morseText = (code) => code.replace(/\./g, '・').replace(/-/g, '－');

// 1回のプレイで MORSE_WORDS から MORSE_QUESTION_COUNT 語を出題（d: 意味, k: 打つ英単語）
const MORSE_QUESTION_COUNT = 8;

const MORSE_WORDS = [
  { d: 'こうもり', k: 'BAT' },
  { d: '黒猫', k: 'CAT' },
  { d: 'ばあ！', k: 'BOO' },
  { d: 'ふくろう', k: 'OWL' },
  { d: '満月', k: 'MOON' },
  { d: '魔女', k: 'WITCH' },
  { d: 'おばけ', k: 'GHOST' },
  { d: 'ほうき', k: 'BROOM' },
  { d: 'お菓子', k: 'CANDY' },
  { d: '骸骨', k: 'SKULL' },
  { d: '呪文', k: 'SPELL' },
  { d: '魔法', k: 'MAGIC' },
  { d: '真夜中', k: 'NIGHT' },
  { d: 'お墓', k: 'GRAVE' },
  { d: 'ミイラ', k: 'MUMMY' },
  { d: 'マント', k: 'CAPE' },
  { d: 'ごほうび', k: 'TREAT' },
  { d: 'いたずら', k: 'TRICK' },
  { d: '骨', k: 'BONES' },
  { d: '蜘蛛', k: 'SPIDER' },
  { d: 'かぼちゃ', k: 'PUMPKIN' },
  { d: 'ゾンビ', k: 'ZOMBIE' },
  { d: 'ポーション', k: 'POTION' },
  { d: 'きば', k: 'FANG' },
  { d: 'カラス', k: 'CROW' },
  { d: 'こわい', k: 'SCARY' },
];

// score = 速度(字/分) × 正確率²（モールスは1字に時間がかかるので親指シフトより基準を下げる）
const MORSE_RANKS = [
  { rank: 'S', min: 60, acc: 0.95, title: '大魔女', comment: 'おばけたちがひれ伏した！ 完璧な電鍵さばきだ。' },
  { rank: 'A', min: 40, acc: 0.9, title: '月夜の魔法使い', comment: 'トンツーが夜空にひびきわたる！' },
  { rank: 'B', min: 25, acc: 0, title: 'かぼちゃの騎士', comment: 'なかなかの腕前。リズムがつかめてきた。' },
  { rank: 'C', min: 12, acc: 0, title: '見習いおばけ', comment: 'まだトンとツーがふわふわしてる。くり返そう！' },
  { rank: 'D', min: 0, acc: 0, title: '迷子のこうもり', comment: 'まずはゆっくり、正確に。' },
];
