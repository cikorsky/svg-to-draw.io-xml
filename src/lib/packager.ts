import pako from 'pako';

export interface LibraryShape {
    xml: string;
    w: number;
    h: number;
    title: string;
}

/**
 * 将字符串按 draw.io Graph.compress 的算法压缩：
 * 1. encodeURIComponent(data) —— 处理 Unicode
 * 2. pako.deflateRaw() —— 原始 DEFLATE 压缩
 * 3. btoa() —— Base64 编码
 *
 * 参考 drawio-src/js/grapheditor/Graph.js L2110
 */
function compressStencilXml(xml: string): string {
    const encoded = encodeURIComponent(xml);
    const deflated = pako.deflateRaw(encoded);

    // Web 端安全可靠的 Uint8Array 转 Base64 方案
    // (避免大字符串使用 String.fromCharCode.apply 导致的栈溢出或 btoa 失效)
    let binary = '';
    const len = deflated.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(deflated[i]);
    }
    return btoa(binary);
}

/**
 * 打包为 draw.io 可导入的 mxlibrary 格式。
 *
 * 核心发现 (来自 drawio-src/js/diagramly/Dialogs.js EditShapeDialog L12141):
 *   graph.setCellStyles(mxConstants.STYLE_SHAPE, 'stencil(' + newValue + ')', [targetCell]);
 * 其中 newValue = Graph.compress(shapeXml)
 *
 * 所以每个 mxCell 的 style 里要写成：
 *   shape=stencil(<compressed>);whiteSpace=wrap;
 *
 * 而 mxlibrary 的 JSON 条目的 xml 属性则是包含这个 mxCell 的完整 mxGraphModel XML。
 */
export function packDrawioLibrary(shapes: LibraryShape[]): string {
    const jsonArr = shapes.map(shape => {
        // 1. 压缩 <shape> XML
        const compressed = compressStencilXml(shape.xml);

        // 2. 将图元作为 stencil() 函数引用塞入 shape 属性
        // 赋予基础的深色前景色，防止它在去色模式下受 draw.io 默认纯白背景色干扰而变得隐形
        const styleText = `shape=stencil(${compressed});fillColor=#282828;strokeColor=#282828;`;

        // 3. 构建对应的 mxGraphModel
        // 根据官方规范及竞品生成的 mxlibrary 来看，json.xml 存放的就是 mxGraphModel
        const fullXml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="" style="${styleText}" vertex="1" parent="1"><mxGeometry width="${shape.w}" height="${shape.h}" as="geometry"/></mxCell></root></mxGraphModel>`;

        // 重点修复: mxlibrary 的 XML 字段本身其实还需要进行一次同样的压缩编码 (deflate -> base64)
        // 这个压缩后的串才是存在 xml 键下的真实数据！
        return {
            xml: compressStencilXml(fullXml),
            w: shape.w,
            h: shape.h,
            title: shape.title,
            aspect: 'variable'
        };
    });

    // 导出的 JSON 必须是一行格式的文本
    const jsonStr = JSON.stringify(jsonArr);
    return `<mxlibrary>${jsonStr}</mxlibrary>`;
}

// 导出供测试使用
export { compressStencilXml };
