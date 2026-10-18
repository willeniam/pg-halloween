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

// 1回のプレイで MORSE_WORDS から MORSE_QUESTION_COUNT 文を出題（d: 意味, k: 打つ英文）
const MORSE_QUESTION_COUNT = 4;

const MORSE_WORDS = [
  { d: 'お菓子くれなきゃいたずらするぞ', k: 'TRICK OR TREAT' },
  { d: 'ハッピーハロウィン', k: 'HAPPY HALLOWEEN' },
  { d: 'ほうきに乗った魔女', k: 'WITCH ON A BROOM' },
  { d: '夜の黒猫', k: 'BLACK CAT AT NIGHT' },
  { d: '満月がのぼる', k: 'FULL MOON RISES' },
  { d: 'おばけはお菓子が大好き', k: 'GHOSTS LOVE CANDY' },
  { d: 'かぼちゃパーティー', k: 'PUMPKIN PARTY' },
  { d: 'こわい夜', k: 'SPOOKY NIGHT' },
  { d: 'こうもりが高く飛ぶ', k: 'BATS FLY HIGH' },
  { d: '魔法の呪文', k: 'MAGIC SPELL' },
  { d: 'ゾンビのパレード', k: 'ZOMBIE PARADE' },
  { d: '不気味な蜘蛛', k: 'CREEPY SPIDER' },
  { d: '骸骨と骨', k: 'SKULL AND BONES' },
  { d: '吸血鬼のきば', k: 'VAMPIRE FANGS' },
  { d: 'お菓子をちょうだい', k: 'GIVE ME CANDY' },
  { d: 'お墓のミイラ', k: 'MUMMY IN A GRAVE' },
];

// score = 速度(字/分) × 正確率²（モールスは1字に時間がかかるので親指シフトより基準を下げる）
const MORSE_RANKS = [
  { rank: 'S', min: 60, acc: 0.95, title: '大魔女', comment: 'おばけたちがひれ伏した！ 完璧な電鍵さばきだ。' },
  { rank: 'A', min: 40, acc: 0.9, title: '月夜の魔法使い', comment: 'トンツーが夜空にひびきわたる！' },
  { rank: 'B', min: 25, acc: 0, title: 'かぼちゃの騎士', comment: 'なかなかの腕前。リズムがつかめてきた。' },
  { rank: 'C', min: 12, acc: 0, title: '見習いおばけ', comment: 'まだトンとツーがふわふわしてる。くり返そう！' },
  { rank: 'D', min: 0, acc: 0, title: '迷子のこうもり', comment: 'まずはゆっくり、正確に。' },
];
