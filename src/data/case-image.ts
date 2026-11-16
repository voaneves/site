// Responsive set for the case-study hero: the 800 px file serves phones, the original serves wide screens.
export const CASE_IMAGE_SIZES = '(min-width: 1200px) 1100px, calc(100vw - 48px)';

export function caseImageSrcset(src: string): string {
  return `${src.replace(/\.webp$/, '-800.webp')} 800w, ${src} 1600w`;
}
