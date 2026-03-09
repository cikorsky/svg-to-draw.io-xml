import { describe, it, expect } from 'vitest';
import { packDrawioLibrary, compressStencilXml } from '../packager';
import pako from 'pako';

describe('compressStencilXml', () => {
    it('should compress and decompress to original XML', () => {
        const xml = '<shape name="test"><foreground><path><move x="0" y="0"/><line x="100" y="100"/></path><stroke/></foreground></shape>';
        const compressed = compressStencilXml(xml);

        // 反向验证：base64 -> deflateRaw -> decodeURIComponent
        const binary = atob(compressed);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const inflated = pako.inflateRaw(bytes, { to: 'string' });
        const original = decodeURIComponent(inflated);

        expect(original).toBe(xml);
    });
});

describe('packDrawioLibrary', () => {
    it('should create valid mxlibrary with stencil() style', () => {
        const shapeXml = '<shape name="test" w="100" h="100"><foreground><path><move x="0" y="0"/><line x="100" y="100"/></path><stroke/></foreground></shape>';
        const input = [
            {
                xml: shapeXml,
                w: 100,
                h: 100,
                title: 'test icon'
            }
        ];

        const result = packDrawioLibrary(input);

        // 1. 整体结构验证
        expect(result.startsWith('<mxlibrary>')).toBe(true);
        expect(result.endsWith('</mxlibrary>')).toBe(true);

        // 2. 提取 JSON
        const jsonStr = result.replace('<mxlibrary>', '').replace('</mxlibrary>', '');
        const parsed = JSON.parse(jsonStr);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(1);
        expect(parsed[0].title).toBe('test icon');
        expect(parsed[0].w).toBe(100);
        expect(parsed[0].h).toBe(100);
        expect(parsed[0].aspect).toBe('variable');

        // 3. 现在的 xml 属性是被二次压缩的 Base64 字符串
        const xmlProp: string = parsed[0].xml;
        expect(xmlProp).not.toContain('<mxGraphModel>'); // 应该已经是压缩代码了

        // 提取解压原始的 mxGraphModel
        const getDecoded = (base64Str: string) => {
            const binary = atob(base64Str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const inflated = pako.inflateRaw(bytes, { to: 'string' });
            return decodeURIComponent(inflated);
        };

        const decodedMxGraph = getDecoded(xmlProp);

        expect(decodedMxGraph).toContain('<mxGraphModel>');
        expect(decodedMxGraph).toContain('</mxGraphModel>');

        // 4. style 中应包含 shape=stencil(...)
        expect(decodedMxGraph).toContain('shape=stencil(');
        expect(decodedMxGraph).toContain(');');

        // 5. 从 style 中提取 stencil 压缩值并再次解压验证
        const stencilMatch = decodedMxGraph.match(/shape=stencil\(([^)]+)\)/);
        expect(stencilMatch).not.toBeNull();

        const decodedShapeXml = getDecoded(stencilMatch![1]);

        // 解压出来应该是原始的 <shape> XML
        expect(decodedShapeXml).toBe(shapeXml);
    });

    it('should handle multiple shapes', () => {
        const shapes = [
            { xml: '<shape name="a"><foreground><ellipse x="0" y="0" w="100" h="100"/><fillstroke/></foreground></shape>', w: 48, h: 48, title: 'shape-a' },
            { xml: '<shape name="b"><foreground><rect x="0" y="0" w="100" h="100"/><fillstroke/></foreground></shape>', w: 64, h: 64, title: 'shape-b' },
        ];

        const result = packDrawioLibrary(shapes);
        const jsonStr = result.replace('<mxlibrary>', '').replace('</mxlibrary>', '');
        const parsed = JSON.parse(jsonStr);

        expect(parsed.length).toBe(2);
        expect(parsed[0].title).toBe('shape-a');
        expect(parsed[1].title).toBe('shape-b');

        // 每个条目解压后都应含有 stencil() 压缩样式
        for (const entry of parsed) {
            const binary = atob(entry.xml);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const inflated = pako.inflateRaw(bytes, { to: 'string' });
            const decodedGraph = decodeURIComponent(inflated);

            expect(decodedGraph).toContain('shape=stencil(');
        }
    });
});
