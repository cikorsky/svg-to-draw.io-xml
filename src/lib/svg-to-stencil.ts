import { parseSVG, makeAbsolute } from 'svg-path-parser';

export interface StencilOptions {
    name: string;
}

export interface StencilResult {
    xml: string;
    w: number;
    h: number;
}

export function convertSvgToStencil(svgString: string, options: StencilOptions): StencilResult {
    if (typeof window === 'undefined' || !window.DOMParser) {
        throw new Error('convertSvgToStencil must be run in a browser environment');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;

    if (svg.tagName.toLowerCase() !== 'svg') {
        throw new Error('Root element must be <svg>');
    }

    // Draw.io 需要精确的基准 w, h 以维持宽高比例
    let w = 100, h = 100;

    // Try to get viewBox
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number).filter(Part => !isNaN(Part));
        if (parts.length >= 4) {
            // We use the width and height from viewBox as canonical dimensions
            w = parts[2];
            h = parts[3];
        }
    } else {
        // Fallback to width/height attributes if viewBox is missing
        // Remove px or Em strings
        const wStr = svg.getAttribute('width')?.replace(/[^0-9.]/g, '') || '100';
        const hStr = svg.getAttribute('height')?.replace(/[^0-9.]/g, '') || '100';
        const attrW = parseFloat(wStr);
        const attrH = parseFloat(hStr);
        if (!isNaN(attrW) && attrW > 0) w = attrW;
        if (!isNaN(attrH) && attrH > 0) h = attrH;
    }

    // 如果提取出的宽高过小（如 < 1），进行等比例放大以防止渲染精度丢失
    if (w < 1 || h < 1) {
        const scale = 100 / Math.max(w, h);
        w *= scale;
        h *= scale;
    }

    // 四舍五入到 2 位小数，供 draw.io 作为 viewBox/包围盒
    w = Number(w.toFixed(2));
    h = Number(h.toFixed(2));

    const foregroundCommands: string[] = [];

    const getStyleCommand = (el: Element): string => {
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');

        // svg-sanitizer 仅会移除带具体颜色的属性，如果原本定义为 'none' 它会保留下来
        const isFillNone = fill === 'none';
        const isStrokeNone = stroke === 'none';

        const hasActualFill = fill && !isFillNone;
        const hasActualStroke = stroke && !isStrokeNone;

        let commands = '';

        if (hasActualFill) {
            commands += `  <fillcolor color="${fill}"/>\n`;
        }
        if (hasActualStroke) {
            commands += `  <strokecolor color="${stroke}"/>\n`;
        }

        // 智能推理：在经过外部去色处理或未标明指令时，当前路径最有可能需要怎样的基础图元类型
        if (isFillNone && (hasActualStroke || !stroke)) {
            // 它明确指定了不填充。这证明它本来就是一段轮廓线。
            commands += '  <stroke/>';
        } else if (isStrokeNone && hasActualFill) {
            commands += '  <fill/>';
        } else if (hasActualFill && hasActualStroke) {
            commands += '  <fillstroke/>';
        } else if (hasActualFill) {
            commands += '  <fill/>';
        } else if (hasActualStroke) {
            commands += '  <stroke/>';
        } else {
            // 兜底：如果它是一个既没有原装颜色且也没有指明线条类型的空壳（例如绝大多数去色后的图标实体）
            // 我们给它 `<fill/>` —— 其颜色将继承我们在 packager 中指定的 #282828 深色配置
            commands += '  <fill/>';
        }

        return commands;
    };

    const processElement = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        const styleCmd = getStyleCommand(el);

        switch (tag) {
            case 'path': {
                const d = el.getAttribute('d');
                if (d) {
                    foregroundCommands.push('  <path>');
                    const commands = makeAbsolute(parseSVG(d));

                    let prevControlX = 0;
                    let prevControlY = 0;
                    let lastCode = '';

                    for (const cmd of commands) {
                        const x0 = Number((cmd as any).x0 || 0);
                        const y0 = Number((cmd as any).y0 || 0);

                        switch (cmd.code) {
                            case 'M':
                                foregroundCommands.push(`    <move x="${Number(cmd.x).toFixed(2)}" y="${Number(cmd.y).toFixed(2)}"/>`);
                                break;
                            case 'L':
                            case 'H':
                            case 'V':
                                foregroundCommands.push(`    <line x="${Number(cmd.x).toFixed(2)}" y="${Number(cmd.y).toFixed(2)}"/>`);
                                break;
                            case 'C': {
                                const cCmd = cmd as any;
                                foregroundCommands.push(`    <curve x1="${Number(cCmd.x1).toFixed(2)}" y1="${Number(cCmd.y1).toFixed(2)}" x2="${Number(cCmd.x2).toFixed(2)}" y2="${Number(cCmd.y2).toFixed(2)}" x3="${Number(cCmd.x).toFixed(2)}" y3="${Number(cCmd.y).toFixed(2)}"/>`);
                                prevControlX = Number(cCmd.x2);
                                prevControlY = Number(cCmd.y2);
                                break;
                            }
                            case 'S': {
                                const sCmd = cmd as any;
                                let x1 = x0;
                                let y1 = y0;
                                if (lastCode === 'C' || lastCode === 'S') {
                                    x1 = x0 + (x0 - prevControlX);
                                    y1 = y0 + (y0 - prevControlY);
                                }
                                foregroundCommands.push(`    <curve x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${Number(sCmd.x2).toFixed(2)}" y2="${Number(sCmd.y2).toFixed(2)}" x3="${Number(sCmd.x).toFixed(2)}" y3="${Number(sCmd.y).toFixed(2)}"/>`);
                                prevControlX = Number(sCmd.x2);
                                prevControlY = Number(sCmd.y2);
                                break;
                            }
                            case 'Q': {
                                const qCmd = cmd as any;
                                foregroundCommands.push(`    <quad x1="${Number(qCmd.x1).toFixed(2)}" y1="${Number(qCmd.y1).toFixed(2)}" x2="${Number(qCmd.x).toFixed(2)}" y2="${Number(qCmd.y).toFixed(2)}"/>`);
                                prevControlX = Number(qCmd.x1);
                                prevControlY = Number(qCmd.y1);
                                break;
                            }
                            case 'T': {
                                const tCmd = cmd as any;
                                let x1 = x0;
                                let y1 = y0;
                                if (lastCode === 'Q' || lastCode === 'T') {
                                    x1 = x0 + (x0 - prevControlX);
                                    y1 = y0 + (y0 - prevControlY);
                                }
                                foregroundCommands.push(`    <quad x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${Number(tCmd.x).toFixed(2)}" y2="${Number(tCmd.y).toFixed(2)}"/>`);
                                prevControlX = x1;
                                prevControlY = y1;
                                break;
                            }
                            case 'A': {
                                const aCmd = cmd as any;
                                foregroundCommands.push(`    <arc rx="${Number(aCmd.rx).toFixed(2)}" ry="${Number(aCmd.ry).toFixed(2)}" x-axis-rotation="${Number(aCmd.xAxisRotation).toFixed(2)}" large-arc-flag="${aCmd.largeArc ? 1 : 0}" sweep-flag="${aCmd.sweep ? 1 : 0}" x="${Number(aCmd.x).toFixed(2)}" y="${Number(aCmd.y).toFixed(2)}"/>`);
                                break;
                            }
                            case 'Z':
                                foregroundCommands.push('    <close/>');
                                break;
                        }

                        lastCode = cmd.code;
                    }
                    foregroundCommands.push('  </path>');
                    foregroundCommands.push(styleCmd);
                }
                break;
            }
            case 'rect': {
                const x = Number(el.getAttribute('x')) || 0;
                const y = Number(el.getAttribute('y')) || 0;
                const width = Number(el.getAttribute('width')) || 0;
                const height = Number(el.getAttribute('height')) || 0;
                foregroundCommands.push(`  <rect x="${x}" y="${y}" w="${width}" h="${height}"/>`);
                foregroundCommands.push(styleCmd);
                break;
            }
            case 'circle': {
                const cx = Number(el.getAttribute('cx')) || 0;
                const cy = Number(el.getAttribute('cy')) || 0;
                const r = Number(el.getAttribute('r')) || 0;
                foregroundCommands.push(`  <ellipse x="${cx - r}" y="${cy - r}" w="${r * 2}" h="${r * 2}"/>`);
                foregroundCommands.push(styleCmd);
                break;
            }
            case 'ellipse': {
                const cx = Number(el.getAttribute('cx')) || 0;
                const cy = Number(el.getAttribute('cy')) || 0;
                const rx = Number(el.getAttribute('rx')) || 0;
                const ry = Number(el.getAttribute('ry')) || 0;
                foregroundCommands.push(`  <ellipse x="${cx - rx}" y="${cy - ry}" w="${rx * 2}" h="${ry * 2}"/>`);
                foregroundCommands.push(styleCmd);
                break;
            }
            case 'polygon':
            case 'polyline': {
                const points = el.getAttribute('points');
                if (points) {
                    const coords = points.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
                    if (coords.length >= 2) {
                        foregroundCommands.push('  <path>');
                        foregroundCommands.push(`    <move x="${coords[0]}" y="${coords[1]}"/>`);
                        for (let i = 2; i < coords.length; i += 2) {
                            foregroundCommands.push(`    <line x="${coords[i]}" y="${coords[i + 1]}"/>`);
                        }
                        if (tag === 'polygon') {
                            foregroundCommands.push('    <close/>');
                        }
                        foregroundCommands.push('  </path>');
                        foregroundCommands.push(styleCmd);
                    }
                }
                break;
            }
        }
    };

    const traverse = (node: Element) => {
        processElement(node);
        for (const child of Array.from(node.children)) {
            traverse(child);
        }
    };

    for (const child of Array.from(svg.children)) {
        traverse(child);
    }

    const connections = `
  <connections>
    <constraint x="0.5" y="0" perimeter="0" name="N"/>
    <constraint x="0.5" y="1" perimeter="0" name="S"/>
    <constraint x="0" y="0.5" perimeter="0" name="W"/>
    <constraint x="1" y="0.5" perimeter="0" name="E"/>
    <constraint x="0" y="0" perimeter="0" name="NW"/>
    <constraint x="1" y="0" perimeter="0" name="NE"/>
    <constraint x="0" y="1" perimeter="0" name="SW"/>
    <constraint x="1" y="1" perimeter="0" name="SE"/>
    <constraint x="0.5" y="0.5" perimeter="0" name="Center"/>
  </connections>`.trim();

    const xml = `<shape name="${options.name}" aspect="variable" w="${w}" h="${h}">
  ${connections}
  <foreground>
    ${foregroundCommands.join('\n    ')}
  </foreground>
</shape>`;

    return { xml, w, h };
}
