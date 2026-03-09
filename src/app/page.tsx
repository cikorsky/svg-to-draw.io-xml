"use client";

import { useState, useCallback, useEffect } from "react";
import { UploadCloud, FileDown, Trash2, Code2, Layers, SearchCode, Settings2, Copy, Check, MousePointer2, Info, ArrowRightCircle, Sparkles, AlertCircle } from "lucide-react";
import { sanitizeSvg } from "@/lib/svg-sanitizer";
import { convertSvgToStencil } from "@/lib/svg-to-stencil";
import { packDrawioLibrary } from "@/lib/packager";

interface SvgItem {
  id: string;
  name: string;
  originalSvg: string;
  sanitizedSvg: string;
  stencilXml: string;
  w: number;
  h: number;
  error?: string;
}

interface AppSettings {
  removeColors: boolean;
  fixAspect: boolean;
}

export default function Home() {
  const [items, setItems] = useState<SvgItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    removeColors: true,
    fixAspect: true
  });
  const [manualSvgName, setManualSvgName] = useState("");
  const [manualSvgCode, setManualSvgCode] = useState("");

  const handleAddManualSvg = () => {
    if (!manualSvgCode.trim()) return;

    if (!manualSvgCode.toLowerCase().includes("<svg") || !manualSvgCode.toLowerCase().includes("</svg>")) {
      alert("请输入有效的 SVG 代码 (需包含 <svg> 标签)");
      return;
    }

    const name = manualSvgName.trim() || `icon-${Math.random().toString(36).substr(2, 4)}`;
    const id = Date.now().toString() + "-manual-" + Math.random().toString(36).substr(2, 5);

    let sanitizedSvg = "";
    let stencilXml = "";
    let w = 100;
    let h = 100;
    let error = undefined;

    try {
      sanitizedSvg = sanitizeSvg(manualSvgCode, { removeColors: settings.removeColors });
      const result = convertSvgToStencil(sanitizedSvg, { name });
      stencilXml = result.xml;
      w = result.w;
      h = result.h;
    } catch (err: any) {
      error = err.message;
    }

    setItems((prev) => [
      ...prev,
      { id, name, originalSvg: manualSvgCode, sanitizedSvg, stencilXml, w, h, error }
    ]);

    setManualSvgName("");
    setManualSvgCode("");
  };

  // Re-process items when settings change
  useEffect(() => {
    if (items.length === 0) return;

    const updatedItems = items.map(item => {
      try {
        const sanitizedSvg = sanitizeSvg(item.originalSvg, { removeColors: settings.removeColors });
        const result = convertSvgToStencil(sanitizedSvg, { name: item.name });
        return {
          ...item,
          sanitizedSvg,
          stencilXml: result.xml,
          w: result.w,
          h: result.h,
          error: undefined
        };
      } catch (err: any) {
        return { ...item, error: err.message };
      }
    });

    // Simple check to avoid infinite loop if needed, but here it should be fine
    // only if text/name changed do we re-render? No, settings changed.
    setItems(updatedItems);
  }, [settings.removeColors]);

  const processFiles = async (files: FileList | File[]) => {
    const newItems: SvgItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) continue;

      const text = await file.text();
      const name = file.name.replace(/\.svg$/i, "");
      const id = Date.now().toString() + "-" + i + "-" + Math.random().toString(36).substr(2, 5);

      let sanitizedSvg = "";
      let stencilXml = "";
      let w = 100;
      let h = 100;
      let error = undefined;

      try {
        sanitizedSvg = sanitizeSvg(text, { removeColors: settings.removeColors });
        const result = convertSvgToStencil(sanitizedSvg, { name });
        stencilXml = result.xml;
        w = result.w;
        h = result.h;
      } catch (err: any) {
        error = err.message;
      }

      newItems.push({
        id,
        name,
        originalSvg: text,
        sanitizedSvg,
        stencilXml,
        w,
        h,
        error
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDownload = () => {
    if (items.length === 0) return;

    const shapes = items
      .filter((item) => !item.error)
      .map((item) => ({
        xml: item.stencilXml,
        w: item.w,
        h: item.h,
        title: item.name,
      }));

    const libraryXml = packDrawioLibrary(shapes);

    const blob = new Blob([libraryXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // VERY IMPORTANT: Target _blank prevents Next.js app router from hijacking the blob: URL and causing a 404
    a.target = "_blank";
    a.download = `drawio-library-${new Date().getTime()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Slight delay before revoke to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 font-sans selection:bg-indigo-100 flex flex-col items-center">
      <div className="w-full max-w-7xl flex-1 flex flex-col lg:flex-row gap-6 mt-4">

        {/* Left Column: Fixed controls & Upload */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">

          {/* Header */}
          <header className="space-y-2">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-2">
              <Layers className="w-8 h-8 text-indigo-600" />
              SVG to Draw.io XML
            </h1>
            <p className="text-slate-500 text-sm">
              批量、纯离线转换 SVG 为 Draw.io XML格式的可变色图库
            </p>
          </header>

          {/* Action Bar / Settings */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> 转换设置</h3>
            </div>
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">去除原生配色 (适配 Draw.io)</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.removeColors}
                  onChange={(e) => setSettings({ ...settings, removeColors: e.target.checked })}
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">锁定长宽比</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.fixAspect}
                  onChange={(e) => setSettings({ ...settings, fixAspect: e.target.checked })}
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
            </label>
          </div>

          {/* Upload & Paste Zone */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-slate-800 text-base">上传或粘贴 SVG</h3>
              <p className="text-xs text-slate-500">选择以下两种方式之一添加 SVG：</p>
            </div>

            {/* Method 1: File Upload */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`cursor-pointer flex flex-col items-center justify-center w-full py-5 border-2 border-dashed rounded-xl transition-all duration-300 ${isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"}`}
            >
              <div className="flex flex-col items-center justify-center text-center px-4">
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-indigo-500" />拖拽或 <span className="font-bold text-indigo-600">点击上传</span> 文件
                </p>
              </div>
              <input type="file" className="hidden" multiple accept=".svg" onChange={handleFileChange} />
            </label>

            {/* Method 2: Manual Paste */}
            <div className="flex flex-col gap-3 py-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="输入 SVG 名称"
                className="w-full text-sm placeholder:text-slate-400 text-slate-700 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                value={manualSvgName}
                onChange={(e) => setManualSvgName(e.target.value)}
              />

              <textarea
                placeholder="<svg>...</svg>"
                className="w-full text-sm placeholder:text-slate-400 text-slate-700 border border-slate-200 rounded-lg px-3 py-3 h-32 resize-none custom-scrollbar focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono whitespace-pre"
                value={manualSvgCode}
                onChange={(e) => setManualSvgCode(e.target.value)}
                spellCheck={false}
              />

              <button
                onClick={handleAddManualSvg}
                disabled={!manualSvgCode.trim()}
                className="w-full py-2.5 bg-[#8b5cf6] text-white hover:bg-[#7c3aed] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition flex justify-center items-center gap-2 shadow-sm"
              >
                <Code2 className="w-4 h-4" />
                添加 SVG 代码
              </button>
            </div>
          </div>

          {/* Generate Button Fixed to Left Side */}
          <button
            onClick={handleDownload}
            disabled={items.length === 0}
            className={`w-full py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] flex items-center justify-center gap-2 text-base font-bold transition-all duration-300 ${items.length > 0
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transform hover:-translate-y-0.5'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
          >
            <FileDown className="w-5 h-5" />
            生成图库 (.xml) {items.length > 0 && `(${items.length})`}
          </button>
        </div>

        {/* Right Column: Preview Grid & Instructions */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden min-h-[500px] xl:max-h-[calc(100vh-100px)]">
          {items.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <SearchCode className="w-4 h-4 text-indigo-500" />
                  已处理图标预览
                </h2>
                <button
                  onClick={() => setItems([])}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清空
                </button>
              </div>

              {/* Scrollable grid area */}
              <div className="p-5 overflow-y-auto flex-1 custom-scrollbar" style={{ maxHeight: '100%' }}>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 gap-3">
                  {items.map((item) => (
                    <div key={item.id} className="group relative bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-300 flex flex-col items-center p-2">
                      {/* Actions */}
                      <div className="absolute top-1 right-1 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 z-10">
                        <button
                          onClick={(e) => { e.preventDefault(); copyToClipboard(item.stencilXml, item.id); }}
                          className="p-1 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="复制 Stencil 代码"
                        >
                          {copiedId === item.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); removeItem(item.id); }}
                          className="p-1 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                          title="移除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="w-full flex items-center justify-center aspect-square mb-2 relative overflow-hidden">
                        {item.error ? (
                          <div className="text-[10px] text-red-500 font-semibold text-center leading-tight break-all px-1">{item.error}</div>
                        ) : (
                          <>
                            <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:6px_6px] rounded-lg"></div>
                            <div
                              className={`w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${settings.removeColors ? '[&_svg]:fill-slate-800 [&_svg]:stroke-slate-800' : ''}`}
                              dangerouslySetInnerHTML={{ __html: item.sanitizedSvg }}
                            />
                          </>
                        )}
                      </div>

                      <div className="w-full text-center border-t border-slate-100 pt-1.5">
                        <span className="text-[10px] font-medium text-slate-500 truncate block w-full px-1" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-60 pointer-events-none select-none">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <Layers className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium text-sm">左侧上传后，在此极速预览所有图标</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Instructions (Full Width below the split layout) */}
      <div className="w-full max-w-7xl mt-6 space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Info className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-700">快速上手指南</h2>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/50 flex gap-3 items-start">
            <MousePointer2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">1. 批量上传</h3>
              <p className="text-slate-500 text-xs leading-relaxed">支持多选或拖入 SVG 图标集。所有操作在本地毫秒级完成，保护隐私。</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/50 flex gap-3 items-start">
            <ArrowRightCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">2. 导出图库</h3>
              <p className="text-slate-500 text-xs leading-relaxed">获取生成的 <code>.xml</code> 文件后，直接拖入 <b>draw.io</b> 网页画布即可载入侧边栏。</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/50 flex gap-3 items-start">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">3. 控制色彩</h3>
              <p className="text-slate-500 text-xs leading-relaxed">开启"去除原生配色"即可转换出支持原生 <code>fill</code> 换色的单色纯净 SVG。</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl shadow-sm border border-indigo-100 flex gap-3 items-start">
            <Copy className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-indigo-900 text-sm mb-1">单体急救</h3>
              <p className="text-indigo-700/80 text-xs leading-relaxed">悬停预览图点 <b>复制</b>，在此后按 <code>Ctrl+E</code> 粘贴至 Draw.io 的 <b>编辑形状</b> 中即可。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
