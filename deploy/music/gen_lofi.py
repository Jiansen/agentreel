#!/usr/bin/env python3
"""Generate lofi piano loops from public domain compositions.

All compositions used are 100+ years old (public domain).
These are original synthesized renditions — no copyrighted recordings.

Usage: python3 gen_lofi.py
Output: WAV files in current directory, then use ffmpeg for MP3.
"""

import wave, struct, math, random, os, sys

SAMPLE_RATE = 44100

NOTE_MAP = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}

def note_freq(name):
    n = name[:-1]
    octave = int(name[-1])
    semi = NOTE_MAP[n[0]]
    if len(n) > 1:
        if n[1] == '#': semi += 1
        elif n[1] == 'b': semi -= 1
    return 440.0 * (2 ** ((12 * (octave + 1) + semi - 69) / 12.0))

def piano_tone(freq, duration, volume=0.3, warmth=0.002):
    n = int(SAMPLE_RATE * duration)
    attack = int(SAMPLE_RATE * 0.04)
    release = int(SAMPLE_RATE * min(0.8, duration * 0.25))
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = (n - i) / release
        else:
            env = 1.0
        env *= math.exp(-t * 1.5)
        phase = 2 * math.pi * freq * t
        sig = 0.55 * math.sin(phase)
        sig += 0.22 * math.sin(phase * 2) * math.exp(-t * 2.5)
        sig += 0.10 * math.sin(phase * 3) * math.exp(-t * 3.5)
        sig += 0.04 * math.sin(phase * 5) * math.exp(-t * 5)
        samples.append(sig * env * volume)
    return samples

def chord_tone(notes, duration, volume=0.18):
    result = [0.0] * int(SAMPLE_RATE * duration)
    for n in notes:
        tone = piano_tone(note_freq(n), duration, volume / len(notes))
        for i in range(len(tone)):
            if i < len(result):
                result[i] += tone[i]
    return result

def vinyl_noise(n, vol=0.006):
    out = []
    for i in range(n):
        s = random.gauss(0, 1) * vol * 0.3
        if random.random() < 0.0002:
            s += random.choice([-1, 1]) * vol * random.uniform(0.3, 0.8)
        out.append(s)
    return out

def lowpass(samples, window=4):
    out = samples[:]
    for i in range(window, len(out)):
        out[i] = sum(samples[i-j] for j in range(window)) / window
    return out

def render_piece(bars_lh, melody_rh, bpm, total_bars, out_name):
    beat = 60.0 / bpm
    bar = beat * 3
    total_samples = int(total_bars * bar * SAMPLE_RATE)
    audio = [0.0] * total_samples

    for bar_idx in range(total_bars):
        chord = bars_lh[bar_idx % len(bars_lh)]
        offset = int(bar_idx * bar * SAMPLE_RATE)
        tone = chord_tone(chord, bar * 0.85, volume=0.20)
        for i, s in enumerate(tone):
            idx = offset + i
            if idx < total_samples:
                audio[idx] += s

    for (bar_idx, beat_off, note, dur_beats) in melody_rh:
        if bar_idx >= total_bars:
            break
        offset = int((bar_idx * bar + beat_off * beat) * SAMPLE_RATE)
        tone = piano_tone(note_freq(note), dur_beats * beat, volume=0.28)
        for i, s in enumerate(tone):
            idx = offset + i
            if idx < total_samples:
                audio[idx] += s

    noise = vinyl_noise(total_samples)
    for i in range(total_samples):
        audio[i] += noise[i]

    audio = lowpass(audio)

    peak = max(abs(s) for s in audio) or 1.0
    fade_in = int(SAMPLE_RATE * 2)
    fade_out = int(SAMPLE_RATE * 3)
    for i in range(len(audio)):
        audio[i] = audio[i] / peak * 0.82
        if i < fade_in:
            audio[i] *= i / fade_in
        if i > len(audio) - fade_out:
            audio[i] *= (len(audio) - i) / fade_out

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), out_name)
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        for s in audio:
            wf.writeframes(struct.pack('<h', int(max(-1, min(1, s)) * 32767)))

    dur = len(audio) / SAMPLE_RATE
    print(f"  {out_name}: {dur:.1f}s, {os.path.getsize(path)/1024:.0f} KB")
    return path


# ══════════════════════════════════════════════════════════════
# Track 1: Satie — Gymnopédie No.1 (1888)
# Key: D major, 3/4 time, ~72 BPM
# ══════════════════════════════════════════════════════════════

GYMNO_LH = [
    ['G2','B2','D3'], ['F#2','A2','D3'],
    ['G2','B2','D3'], ['F#2','A2','D3'],
    ['E2','G2','B2'], ['A2','C#3','E3'],
    ['D2','F#2','A2'], ['G2','B2','D3'],
]

GYMNO_RH = [
    (2,1,'F#5',2), (3,0,'E5',1), (3,1,'D5',2),
    (4,0,'C#5',3),
    (5,0,'B4',1), (5,1,'A4',2),
    (6,0,'G4',3),
    (7,0,'F#4',1), (7,1,'E4',2),
    (8,1,'F#5',2), (9,0,'E5',1), (9,1,'D5',2),
    (10,0,'C#5',3),
    (11,0,'B4',1), (11,1,'A4',2),
    (12,0,'G4',3),
    (13,0,'F#4',1), (13,1,'D4',2),
    (14,0,'E4',3), (15,0,'D4',3),
]


# ══════════════════════════════════════════════════════════════
# Track 2: Satie — Gymnopédie No.3 (1888)
# Key: A minor feel, 3/4 time, ~66 BPM
# ══════════════════════════════════════════════════════════════

GYMNO3_LH = [
    ['A2','C3','E3'], ['G2','B2','D3'],
    ['F2','A2','C3'], ['E2','G2','B2'],
    ['A2','C3','E3'], ['D2','F2','A2'],
    ['G2','B2','D3'], ['C2','E2','G2'],
]

GYMNO3_RH = [
    (2,1,'E5',2), (3,0,'D5',1), (3,1,'C5',2),
    (4,0,'B4',3),
    (5,0,'A4',1), (5,1,'G4',2),
    (6,0,'F4',3),
    (7,0,'E4',1), (7,1,'D4',2),
    (8,1,'E5',2), (9,0,'C5',1), (9,1,'B4',2),
    (10,0,'A4',3),
    (11,0,'G4',1), (11,1,'F4',2),
    (12,0,'E4',3),
    (13,0,'D4',1), (13,1,'C4',2),
    (14,0,'B3',3), (15,0,'A3',3),
]


# ══════════════════════════════════════════════════════════════
# Track 3: Satie — Gnossienne No.1 (1890)
# Free time feel, modal/mysterious, ~60 BPM
# ══════════════════════════════════════════════════════════════

GNOSS_LH = [
    ['D2','A2','D3'], ['D2','A2','F3'],
    ['D2','Bb2','D3'], ['D2','A2','D3'],
    ['G2','Bb2','D3'], ['A2','C#3','E3'],
    ['D2','F2','A2'], ['D2','A2','D3'],
]

GNOSS_RH = [
    (1,0,'D5',1), (1,1,'F5',1), (1,2,'E5',1),
    (2,0,'D5',2), (2,2,'C5',1),
    (3,0,'Bb4',3),
    (4,0,'A4',1), (4,1,'G4',1), (4,2,'A4',1),
    (5,0,'Bb4',2), (5,2,'A4',1),
    (6,0,'G4',3),
    (7,0,'F4',1), (7,1,'E4',1), (7,2,'D4',1),
    (8,0,'D5',1), (8,1,'F5',1), (8,2,'E5',1),
    (9,0,'D5',2), (9,2,'A4',1),
    (10,0,'Bb4',3),
    (11,0,'A4',1), (11,1,'G4',2),
    (12,0,'F4',3),
    (13,0,'E4',1), (13,1,'D4',2),
    (14,0,'C#4',3), (15,0,'D4',3),
]


# ══════════════════════════════════════════════════════════════
# Track 4: Debussy — Clair de Lune (1890, pub. 1905)
# Key: Db major → simplified, 3/4, ~56 BPM
# ══════════════════════════════════════════════════════════════

CLAIR_LH = [
    ['Db2','Ab2','Db3'], ['Ab2','C3','Eb3'],
    ['Gb2','Bb2','Db3'], ['Ab2','C3','Eb3'],
    ['Db2','F2','Ab2'], ['Eb2','Gb2','Bb2'],
    ['Ab2','C3','Eb3'], ['Db2','Ab2','Db3'],
]

CLAIR_RH = [
    (2,1,'Ab4',2), (3,0,'Bb4',1), (3,1,'Ab4',2),
    (4,0,'Gb4',3),
    (5,0,'F4',1), (5,1,'Eb4',2),
    (6,0,'Db4',3),
    (7,0,'C4',1), (7,1,'Db4',2),
    (8,1,'Ab4',2), (9,0,'Gb4',1), (9,1,'Ab4',2),
    (10,0,'Bb4',3),
    (11,0,'Ab4',1), (11,1,'Gb4',2),
    (12,0,'F4',3),
    (13,0,'Eb4',1), (13,1,'Db4',2),
    (14,0,'Eb4',3), (15,0,'Db4',3),
]


if __name__ == '__main__':
    print("Generating lofi piano tracks (public domain compositions)...\n")

    tracks = [
        ("Gymnopédie No.1 (Satie, 1888)", GYMNO_LH, GYMNO_RH, 72, 16, "lofi-gymnopedie1.wav"),
        ("Gymnopédie No.3 (Satie, 1888)", GYMNO3_LH, GYMNO3_RH, 66, 16, "lofi-gymnopedie3.wav"),
        ("Gnossienne No.1 (Satie, 1890)", GNOSS_LH, GNOSS_RH, 60, 16, "lofi-gnossienne1.wav"),
        ("Clair de Lune (Debussy, 1890)", CLAIR_LH, CLAIR_RH, 56, 16, "lofi-clair-de-lune.wav"),
    ]

    wav_files = []
    for title, lh, rh, bpm, bars, fname in tracks:
        print(f"  {title}")
        path = render_piece(lh, rh, bpm, bars, fname)
        wav_files.append((fname, path))

    print(f"\nDone. {len(wav_files)} WAV files generated.")
    print("\nTo create looped MP3s for streaming:")
    for fname, path in wav_files:
        mp3 = fname.replace('.wav', '-loop.mp3')
        print(f"  ffmpeg -stream_loop 5 -i {fname} -af 'afade=t=in:d=1,afade=t=out:st=230:d=5' -b:a 128k -y {mp3}")
