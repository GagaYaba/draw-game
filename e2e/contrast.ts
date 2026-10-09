import type { Page } from "@playwright/test";

interface TextItem {
  label: string;
  rects: { x: number; y: number; width: number; height: number }[];
  color: [number, number, number, number];
  large: boolean;
  /** Élément fixe ou collant : mesuré dans la fenêtre, sans tenir compte du défilement. */
  fixed: boolean;
}

interface Measure {
  label: string;
  ratio: number;
  required: number;
}

/**
 * Contraste réellement affiché, mesuré par échantillonnage.
 *
 * axe-core ne peut pas décider du contraste sur les fonds en dégradé, images ou pseudo-éléments
 * (résultats « incomplets »). On masque donc le texte, on capture la page, puis on mesure, pour
 * chaque texte visible, le rapport entre sa couleur et les pixels du fond sous ses lettres
 * (bande centrale de la ligne ; 5 % des pixels les plus défavorables écartés : antialiasing).
 * Seuils WCAG 2.1 : 4,5 pour un texte normal, 3 pour un grand texte (24 px, ou 18,66 px en gras).
 * Les ombres portées du texte ne sont pas prises en compte.
 */
export async function collectContrastFindings(page: Page, screen: string): Promise<string[]> {
  // Les apparitions animées (fondu d'une boîte de dialogue) doivent être terminées avant la mesure.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

  const items = await page.evaluate((): TextItem[] => {
    const parse = (value: string): [number, number, number, number] => {
      const match = value.match(/rgba?\(([^)]+)\)/u);
      const parts = (match?.[1] ?? "0,0,0")
        .split(/[ ,/]+/u)
        .filter(Boolean)
        .map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const selectorOf = (element: Element): string => {
      const name = element.tagName.toLowerCase();
      const cls = (element.getAttribute("class") ?? "").split(/\s+/u)[0];
      return cls ? `${name}.${cls}` : name;
    };

    const found: TextItem[] = [];
    // Quand une boîte de dialogue modale est ouverte, le reste de la page est inerte et atténué.
    const modal = document.querySelector("dialog[open], [role='dialog'][aria-modal='true']");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || (node.textContent ?? "").trim().length < 2) continue;
      if (element.closest("[hidden], .visually-hidden, script, style, noscript")) continue;
      if (element.closest("details:not([open])") && element.tagName !== "SUMMARY") continue;
      if (element.closest("button:disabled, [aria-disabled='true']")) continue;
      if (modal && !modal.contains(element)) continue;
      // Le logotype est exempté d'exigence de contraste (WCAG 1.4.3, RGAA 3.2).
      if (element.closest(".game-logo")) continue;

      const style = getComputedStyle(element);
      if (style.visibility === "hidden") continue;

      // Seules les zones occupées par les lettres sont mesurées : bordures et marges sont exclues.
      const range = document.createRange();
      range.selectNodeContents(node);
      // Les parties rognées par un conteneur à défilement ne sont pas visibles dans cet état.
      const clips: DOMRect[] = [];
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const overflow = getComputedStyle(ancestor);
        if (overflow.overflowX !== "visible" || overflow.overflowY !== "visible") {
          clips.push(ancestor.getBoundingClientRect());
        }
      }
      let fixed = false;
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const position = getComputedStyle(ancestor).position;
        if (position === "fixed" || position === "sticky") fixed = true;
      }
      const offsetX = fixed ? 0 : window.scrollX;
      const offsetY = fixed ? 0 : window.scrollY;
      const rects = [...range.getClientRects()]
        .map((rect) => {
          let left = rect.left;
          let top = rect.top;
          let right = rect.right;
          let bottom = rect.bottom;
          for (const clip of clips) {
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
          }
          return {
            x: left + offsetX,
            y: top + offsetY,
            width: right - left,
            height: bottom - top,
          };
        })
        .filter((rect) => rect.width >= 1 && rect.height >= 1);
      if (rects.length === 0) continue;

      let opacity = 1;
      for (let current: Element | null = element; current; current = current.parentElement) {
        opacity *= Number(getComputedStyle(current).opacity);
      }
      const color = parse(style.color);
      color[3] *= opacity;
      const size = Number.parseFloat(style.fontSize);
      const bold = Number.parseInt(style.fontWeight, 10) >= 700;
      found.push({
        label: `${selectorOf(element)} « ${(node.textContent ?? "").trim().slice(0, 30)} »`,
        rects,
        color,
        large: size >= 24 || (bold && size >= 18.66),
        fixed,
      });
    }
    return found;
  });

  // Le texte est rendu transparent pour mesurer le fond seul, puis la page est parcourue
  // fenêtre par fenêtre : les positions restent celles de la mise en page réelle.
  const hideText = await page.addStyleTag({
    content:
      "*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; }",
  });
  const worst = new Map<string, Measure>();
  try {
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let scrollY = 0; scrollY < pageHeight; scrollY += viewportHeight) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      const screenshot = await page.screenshot({ animations: "disabled" });
      const measures = await page.evaluate(
        async ({ base64, list }): Promise<Measure[]> => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const scale = image.naturalWidth / window.innerWidth;
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return [];
          context.drawImage(image, 0, 0);

          const channel = (value: number) => {
            const v = value / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          const luminance = (r: number, g: number, b: number) =>
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

          const results: Measure[] = [];
          for (const item of list) {
            // Un élément fixe ne se mesure que dans la première fenêtre.
            if (item.fixed && window.scrollY !== 0) continue;
            const offsetX = item.fixed ? 0 : window.scrollX;
            const offsetY = item.fixed ? 0 : window.scrollY;
            const ratios: number[] = [];
            const alpha = item.color[3];
            for (const rect of item.rects) {
              // Bande centrale du texte : les bords de la ligne débordent sur les contours voisins.
              const insetX = rect.width * 0.1;
              const insetY = rect.height * 0.2;
              const left = Math.max(0, rect.x - offsetX + insetX);
              const top = Math.max(0, rect.y - offsetY + insetY);
              const right = Math.min(window.innerWidth, rect.x - offsetX + rect.width - insetX);
              const bottom = Math.min(window.innerHeight, rect.y - offsetY + rect.height - insetY);
              if (right - left < 2 || bottom - top < 2) continue;

              const x = Math.floor(left * scale);
              const y = Math.floor(top * scale);
              const width = Math.max(
                1,
                Math.min(canvas.width - x, Math.ceil((right - left) * scale)),
              );
              const height = Math.max(
                1,
                Math.min(canvas.height - y, Math.ceil((bottom - top) * scale)),
              );
              const pixels = context.getImageData(x, y, width, height).data;
              for (let index = 0; index < pixels.length; index += 12) {
                const r = pixels[index] ?? 0;
                const g = pixels[index + 1] ?? 0;
                const b = pixels[index + 2] ?? 0;
                const fgLuminance = luminance(
                  alpha * item.color[0] + (1 - alpha) * r,
                  alpha * item.color[1] + (1 - alpha) * g,
                  alpha * item.color[2] + (1 - alpha) * b,
                );
                const bgLuminance = luminance(r, g, b);
                ratios.push(
                  (Math.max(fgLuminance, bgLuminance) + 0.05) /
                    (Math.min(fgLuminance, bgLuminance) + 0.05),
                );
              }
            }
            if (ratios.length === 0) continue;
            ratios.sort((a, b) => a - b);
            const ratio = ratios[Math.floor(ratios.length * 0.05)] ?? ratios[0] ?? 21;
            results.push({ label: item.label, ratio, required: item.large ? 3 : 4.5 });
          }
          return results;
        },
        { base64: screenshot.toString("base64"), list: items },
      );
      for (const measure of measures) {
        const previous = worst.get(measure.label);
        if (previous === undefined || measure.ratio < previous.ratio) {
          worst.set(measure.label, measure);
        }
      }
    }
  } finally {
    await hideText.evaluate((node) => node.remove());
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  return [...worst.values()]
    .filter((measure) => measure.ratio < measure.required)
    .map(
      (measure) =>
        `${screen} : contraste ${measure.ratio.toFixed(2)}:1 < ${measure.required}:1 pour ${measure.label}`,
    );
}
