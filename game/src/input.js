// Keyboard + mouse input with pointer lock for the third-person camera.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last poll
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (!this.locked && this.enabled) canvas.requestPointerLock();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }

  axis(neg, pos) {
    return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
  }

  get forward() { return this.axis('KeyS', 'KeyW') || this.axis('ArrowDown', 'ArrowUp'); }
  get strafe() { return this.axis('KeyA', 'KeyD') || this.axis('ArrowLeft', 'ArrowRight'); }
  get run() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get jump() { return this.keys.has('Space'); }

  wasPressed(code) { return this.pressed.has(code); }

  consumeMouse() {
    const dx = this.mouseDX; const dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() { this.pressed.clear(); }
}
