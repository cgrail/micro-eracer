// The chiptune soundtrack of Electro Car Racer (github.com/cgrail/e-racer); all melodies are original compositions for it.
interface Song { name: string; bpm: number; wave?: OscillatorType; chords: string; lead: string; bass: (number | null)[]; kick: string; snare: string; hat: string }

const NOTE: Record<string, number> = { c: 0, 'c#': 1, d: 2, 'd#': 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, 'a#': 10, b: 11 };
const midi = (n: string) => { const m = /^([a-g]#?)(\d)$/.exec(n)!; return 12 * (+m[2] + 1) + NOTE[m[1]]; };
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const SONGS: Song[] = [
  {
    name: 'TURBO DRIVE', bpm: 150, chords: 'Am F C G Am F G E',
    lead: 'e5:2 a5:2 e5:2 c5:2 a4:4 c5:2 e5:2  f5:4 e5:2 c5:2 a4:4 c5:4  g5:2 e5:2 c5:2 e5:2 g5:4 c6:4  b5:4 a5:2 g5:2 d5:4 r:4 ' +
      'a5:2 c6:2 b5:2 a5:2 e5:4 a5:4  c6:4 a5:2 f5:2 c5:4 f5:4  d6:2 b5:2 g5:2 d5:2 g5:2 a5:2 b5:4  g#5:4 b5:4 e6:6 r:2',
    bass: [0, null, 12, null, 0, 0, 12, null, 0, null, 12, null, 0, 7, 12, null],
    kick: 'x---x---x---x-x-', snare: '----x-------x---', hat: '-x-x-x-x-x-x-x-x',
  },
  {
    name: 'NEON HIGHWAY', bpm: 126, chords: 'D Bm G A D Bm G A',
    lead: 'f#5:6 e5:2 d5:4 a4:4  b4:4 d5:2 f#5:2 e5:6 d5:2  d5:4 b4:4 g4:2 b4:2 d5:4  c#5:6 e5:2 a5:8 ' +
      'a5:4 f#5:2 a5:2 b5:4 a5:4  f#5:4 d5:2 f#5:2 b5:8  g5:2 f#5:2 e5:2 d5:2 b4:4 d5:4  e5:4 c#5:4 a4:8',
    bass: [0, null, 0, 12, null, 0, 12, null, 0, null, 0, 12, null, 0, 12, 7],
    kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-',
  },
  {
    name: 'FINAL LAP', bpm: 168, chords: 'Em C D B Em C D B',
    lead: 'e5:2 e5:1 r:1 b4:2 e5:2 g5:2 f#5:2 e5:2 d5:2  e5:2 e5:1 r:1 c5:2 e5:2 g5:4 a5:4  f#5:2 f#5:1 r:1 d5:2 f#5:2 a5:2 g5:2 f#5:2 e5:2  d#5:4 f#5:4 b5:4 a5:2 f#5:2 ' +
      'g5:2 b5:2 e6:4 d6:2 b5:2 g5:4  e6:2 d6:2 c6:2 b5:2 a5:4 g5:4  f#5:2 a5:2 d6:4 c6:2 a5:2 f#5:4  d#5:2 f#5:2 a5:2 b5:2 d#6:8',
    bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 12, 0],
    kick: 'x--x--x-x--x--x-', snare: '----x-------x--x', hat: 'xxxxxxxxxxxxxxxx',
  },
  { // late-Amiga title-screen style: galloping octave bass, brassy saw lead, a chorus that lifts
    name: 'HIGH VOLTAGE', bpm: 140, wave: 'sawtooth', chords: 'Am Am F G Am Am F E F G Em Am F G E E',
    lead: 'a4:4 c5:2 e5:2 a5:6 g5:2  e5:2 a5:2 c6:4 b5:2 a5:2 g5:4  a5:6 f5:2 c5:4 f5:4  g5:6 d5:2 b4:4 d5:2 g5:2 ' +
      'a5:2 g5:2 e5:2 c5:2 e5:4 a5:4  c6:4 b5:2 a5:2 e6:8  d6:2 c6:2 a5:4 f5:4 a5:4  g#5:6 e5:2 b5:8 ' +
      'c6:6 a5:2 f5:4 c6:4  d6:6 b5:2 g5:4 d6:4  e6:4 d6:2 b5:2 g5:4 b5:4  c6:2 b5:2 a5:4 e5:4 a5:4 ' +
      'a5:2 c6:2 f6:4 e6:2 c6:2 a5:4  b5:2 d6:2 g6:4 f6:2 d6:2 b5:4  g#5:4 b5:4 e6:4 d6:2 b5:2  g#5:8 e5:4 r:4',
    bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12],
    kick: 'x-----x-x-x-----', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-xx',
  },
];

/** A song unrolled into 16th-note steps: the chord of each bar and the lead note starting on each step. */
function compile(s: Song) {
  const ch = s.chords.split(' ').map((c) => {
    const m = /^([A-G]#?)(m?)$/.exec(c)!;
    return { root: NOTE[m[1].toLowerCase()], minor: !!m[2] };
  });
  const steps = ch.length * 16, lead: ({ m: number; d: number } | null)[] = new Array(steps).fill(null);
  let pos = 0;
  for (const tok of s.lead.trim().split(/\s+/)) {
    const [n, d] = tok.split(':');
    if (n !== 'r' && pos < steps) lead[pos] = { m: midi(n), d: +d };
    pos += +d;
  }
  return { ...s, ch, steps, lead };
}

export type CompiledSong = ReturnType<typeof compile>;
export const SONGS_COMPILED = SONGS.map(compile);
