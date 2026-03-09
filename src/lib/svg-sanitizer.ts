/**
 * svg-sanitizer.ts
 * Cleans up raw SVG strings from Iconfont and other sources.
 */

export interface SanitizeOptions {
    removeColors?: boolean;
}

export function sanitizeSvg(rawSvg: string, options: SanitizeOptions = {}): string {
    if (typeof window === 'undefined' || !window.DOMParser) {
        throw new Error('sanitizeSvg must be run in a browser environment');
    }

    const { removeColors = true } = options;

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid SVG string');
    }

    const svgElement = doc.documentElement;

    if (svgElement.tagName.toLowerCase() !== 'svg') {
        throw new Error('Root element must be <svg>');
    }

    // 1. Remove width and height from root <svg>
    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');

    // Redundant attributes to remove
    const redundantAttrs = ['t', 'class', 'p-id', 'data-spm-anchor-id', 'version', 'xmlns:xlink'];

    // 2. Traverse all elements to clean them
    const elements = svgElement.getElementsByTagName('*');
    const allElements = [svgElement, ...Array.from(elements)];

    allElements.forEach((el) => {
        // Remove redundant attributes
        redundantAttrs.forEach(attr => {
            el.removeAttribute(attr);
        });

        if (removeColors) {
            // Remove hardcoded fill colors (keep 'none')
            if (el.hasAttribute('fill')) {
                const fill = el.getAttribute('fill');
                if (fill && fill.toLowerCase() !== 'none') {
                    el.removeAttribute('fill');
                }
            }

            // Remove hardcoded stroke colors (keep 'none')
            if (el.hasAttribute('stroke')) {
                const stroke = el.getAttribute('stroke');
                if (stroke && stroke.toLowerCase() !== 'none') {
                    el.removeAttribute('stroke');
                }
            }

            // Clean inline style attribute colors
            if (el.hasAttribute('style')) {
                const styleStr = el.getAttribute('style') || '';

                let newStyle = styleStr
                    .replace(/fill\s*:\s*([^;]+);?/gi, (match, val) => val.trim().toLowerCase() === 'none' ? match : '')
                    .replace(/stroke\s*:\s*([^;]+);?/gi, (match, val) => val.trim().toLowerCase() === 'none' ? match : '')
                    .trim();

                newStyle = newStyle.replace(/;+/g, ';').replace(/^;+/, '');

                if (newStyle === '') {
                    el.removeAttribute('style');
                } else {
                    el.setAttribute('style', newStyle);
                }
            }
        }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
}
