// Keyboard and mouse state, read fresh each frame by the game loop. Keys are tracked by
// code (KeyW, ArrowUp, …) so layouts do not matter; the mouse is kept in screen pixels and
// turned into a world aim point by the camera in main.js.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.clicked = true;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys,
    mouse,
    /** True only on the frame the key went down. */
    justPressed: (code) => pressed.has(code),
    down: (...codes) => codes.some((code) => keys.has(code)),
    /** Movement axes from WASD and the arrow keys: { x: -1..1, y: -1..1 }. */
    axes() {
      const x = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Call at the end of each frame so justPressed and clicked live for exactly one frame. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
