// Procedural WebAudio: engine hum, sirens, gunshots, pickups and a small
// ambient music loop. Everything is synthesised — the game ships no audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.chordStep = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    // Engine: two detuned saws through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    engineOsc2.start();
    this.engineOsc2 = engineOsc2;
    // Siren: a triangle wave wobbling between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.startMusic();
  }

  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    const f = 55 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.005, t, 0.08);
  }

  setSiren(on, near) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 * near : 0, t, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(700 + 220 * Math.sin(t * 3.2), t, 0.05);
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  noiseBurst(dur = 0.14, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot() { this.noiseBurst(0.12, 0.3); this.blip(160, 0.08, 'square', 0.1); }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.14), 80); }
  cash() { this.blip(880, 0.1); setTimeout(() => this.blip(1174, 0.1), 90); setTimeout(() => this.blip(1568, 0.18), 180); }
  fail() { this.blip(220, 0.3, 'sawtooth', 0.12); setTimeout(() => this.blip(165, 0.45, 'sawtooth', 0.12), 200); }

  // A lazy sunset chord loop: Am – F – C – G pads over a soft bass.
  startMusic() {
    const chords = [
      [220.0, 261.6, 329.6], [174.6, 220.0, 261.6],
      [130.8, 196.0, 261.6], [196.0, 246.9, 293.7],
    ];
    const playChord = () => {
      if (!this.ctx || this.muted) { this.chordStep = (this.chordStep + 1) % chords.length; return; }
      const chord = chords[this.chordStep % chords.length];
      this.chordStep = (this.chordStep + 1) % chords.length;
      const t = this.ctx.currentTime;
      chord.forEach((freq, i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.05 : 0.018, t + 0.8);
        g.gain.setValueAtTime(i === 0 ? 0.05 : 0.018, t + 2.6);
        g.gain.linearRampToValueAtTime(0, t + 3.6);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 3.8);
      });
    };
    playChord();
    this.musicTimer = setInterval(playChord, 3600);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
}
