/**
 * Typluecken von three.js schliessen — per Declaration Merging statt `as any`.
 *
 * `three` liefert keine eigenen Typdeklarationen; `@types/three` bildet den
 * WebGPU-Pfad noch nicht vollstaendig ab. Diese Datei ergaenzt genau die
 * Eigenschaften, die das Projekt braucht, und dokumentiert damit zugleich,
 * worauf es sich stuetzt.
 */
import 'three/webgpu';

declare module 'three/webgpu' {
  interface Backend {
    /** true, wenn der Renderer wirklich auf WebGPU laeuft (nicht auf dem WebGL2-Fallback). */
    readonly isWebGPUBackend?: boolean;
    readonly isWebGLBackend?: boolean;
  }
}
