/** Typen fuer werkzeuge/browser.mjs — es bleibt bewusst reines JavaScript,
 *  weil es auch von Node-Skripten ohne Build-Schritt benutzt wird. */
export declare function chromiumPfad(): string | undefined;
export declare const FLAGS_WEBGL2: string[];
export declare const FLAGS_WEBGPU: string[];
export declare function startOptionen(modus?: 'webgl2' | 'webgpu'): {
  headless: boolean;
  args: string[];
  executablePath?: string;
};
