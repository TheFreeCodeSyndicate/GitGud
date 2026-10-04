import kernel from "~/vendor/hairline-kernel.js?raw";

/**
 * The Hairline kernel: camera, rounded solids, springs, the frame loop. The
 * copy vendored from the hairline-create skill, unchanged. It's a classic
 * script that declares `var HL`, so it is evaluated once to get that value
 * back rather than edited into a module. Every figure in the app draws with it.
 */
export const HL: any = new Function(`${kernel}\nreturn HL;`)();

let styled = false;
/** The figures' shared stylesheet, added once. */
export function hairlineStyles() {
  if (styled) return;
  HL.inject(document);
  styled = true;
}
