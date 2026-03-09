import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '../svg-sanitizer';

describe('sanitizeSvg', () => {
    it('should remove width and height attributes from <svg>', () => {
        const input = `<svg width="200" height="200" viewBox="0 0 1024 1024"><path d="M10 10"/></svg>`;
        const output = sanitizeSvg(input);
        expect(output).not.toContain('width');
        expect(output).not.toContain('height');
        expect(output).toContain('viewBox="0 0 1024 1024"');
    });

    it('should remove redundant attributes', () => {
        const input = `<svg t="12345" class="icon" viewBox="0 0 1024 1024"><path p-id="42" data-spm-anchor-id="xyz" d="M10 10"/></svg>`;
        const output = sanitizeSvg(input);
        expect(output).not.toContain('t="');
        expect(output).not.toContain('class="');
        expect(output).not.toContain('p-id="');
        expect(output).not.toContain('data-spm-anchor-id="');
    });

    it('should remove colored fill and stroke but keep "none"', () => {
        const input = `<svg><path fill="#ff0000" stroke="blue" d="M10 10"/><polygon fill="none" stroke="NONE" points="0,0"/></svg>`;
        const output = sanitizeSvg(input);

        // #ff0000 and blue should be removed
        expect(output).not.toContain('#ff0000');
        expect(output).not.toContain('blue');

        // "none" and "NONE" should be kept
        expect(output).toMatch(/fill="none"/i);
        expect(output).toMatch(/stroke="NONE"/i); // DOMParser might lowercase attributes
    });

    it('should clean up inline styles', () => {
        const input = `<svg><path style="fill: #f00; stroke:red; stroke-width: 2px" d="M10 10"/></svg>`;
        const output = sanitizeSvg(input);
        // stroke-width should be kept, colors should be removed
        expect(output).toContain('stroke-width: 2px');
        expect(output).not.toContain('fill:');
        expect(output).not.toContain('#f00');
        expect(output).not.toContain('stroke:red');
    });

    it('should throw error on invalid SVG', () => {
        const input = `<svg><unclosed tag></svg>`;
        expect(() => sanitizeSvg(input)).toThrow('Invalid SVG string');
    });
});
