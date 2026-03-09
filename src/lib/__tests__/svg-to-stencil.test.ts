import { describe, it, expect } from 'vitest';
import { convertSvgToStencil } from '../svg-to-stencil';

describe('convertSvgToStencil', () => {
    it('should parse viewBox to width and height', () => {
        const input = `<svg viewBox="0 0 1024 1024"><rect width="10" height="10"/></svg>`;
        const { xml, w, h } = convertSvgToStencil(input, { name: 'test_icon' });
        expect(xml).toContain('w="1024" h="1024"');
        expect(w).toBe(1024);
        expect(h).toBe(1024);
    });

    it('should convert path with basic commands', () => {
        const input = `<svg viewBox="0 0 100 100"><path d="M 10 10 L 20 20 C 30 30 40 40 50 50 Z"/></svg>`;
        const { xml } = convertSvgToStencil(input, { name: 'test' });

        expect(xml).toContain('<path>');
        expect(xml).toContain('<move x="10.00" y="10.00"/>');
        expect(xml).toContain('<line x="20.00" y="20.00"/>');
        expect(xml).toContain('<curve x1="30.00" y1="30.00" x2="40.00" y2="40.00" x3="50.00" y3="50.00"/>');
        expect(xml).toContain('<close/>');
        expect(xml).toContain('</path>');
        // 提取的测试 SVG 没有 fill 和 stroke 属性，因此 fallbacks 到 <fill/>
        expect(xml).toContain('<fill/>');
    });

    it('should inject default connections array', () => {
        const input = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10"/></svg>`;
        const { xml } = convertSvgToStencil(input, { name: 'with_connections' });
        expect(xml).toContain('<connections>');
        expect(xml).toContain('<constraint x="0.5" y="0" perimeter="0" name="N"/>');
    });

    it('should convert native shapes to drawio primitives or paths', () => {
        const input = `
      <svg viewBox="0 0 200 200">
        <rect x="10" y="20" width="30" height="40" fill="#ff0000" stroke="none"/>
        <circle cx="50" cy="50" r="10" fill="none" stroke="#000000"/>
        <polygon points="10,10 20,20 30,10"/>
      </svg>
    `;
        const { xml } = convertSvgToStencil(input, { name: 'shapes' });
        expect(xml).toContain('<rect x="10" y="20" w="30" h="40"/>');
        expect(xml).toContain('<ellipse x="40" y="40" w="20" h="20"/>');

        expect(xml).toContain('<move x="10" y="10"/>');
        expect(xml).toContain('<line x="20" y="20"/>');
        expect(xml).toContain('<line x="30" y="10"/>');
        expect(xml).toContain('<close/>');

        // 测试是否正确识别了颜色和渲染指令
        expect(xml).toContain('<fillcolor color="#ff0000"/>');
        expect(xml).toContain('<strokecolor color="#000000"/>');
    });
});
