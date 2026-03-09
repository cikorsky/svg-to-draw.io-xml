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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans selection:bg-indigo-100">
      <div className="max-w-5xl mx-auto space-y-10 mt-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            SVG 转 Draw.io 转换器
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            将 SVG 文件完美转换为 Draw.io 的库组件。拖放文件即可开始，支持批量处理与自动去色。
          </p>
        </header>

        {/* Action Bar / Settings */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-wrap items-center justify-center gap-8">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.removeColors}
                onChange={(e) => setSettings({ ...settings, removeColors: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
            <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition">去除原生配色 (适配 Draw.io)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.fixAspect}
                onChange={(e) => setSettings({ ...settings, fixAspect: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
            <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition">锁定长宽比</span>
          </label>
        </div>

        {/* Upload Zone */}
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative cursor-pointer flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-3xl transition-all duration-300 bg-white shadow-sm hover:shadow-md ${isDragging ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
            }`}
        >
          <div className="flex flex-col items-center justify-center">
            <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-base text-slate-600 mb-1">
              <span className="font-bold text-indigo-600">点击上传文件</span> 或将 SVG 拖放到这里
            </p>
            <p className="text-xs text-slate-400">支持批量选择多个 .svg 文件</p>
          </div>
          <input type="file" className="hidden" multiple accept=".svg" onChange={handleFileChange} />
        </label>

        {/* Preview Grid */}
        {items.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold text-slate-800">已处理图标 ({items.length})</h2>
              <button
                onClick={() => setItems([])}
                className="text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors"
              >
                清空全部
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                <div key={item.id} className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-300 flex flex-col items-center p-4">
                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 z-10">
                    <button
                      onClick={(e) => { e.preventDefault(); copyToClipboard(item.stencilXml, item.id); }}
                      className="p-1.5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                      title="复制 Stencil 代码"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); removeItem(item.id); }}
                      className="p-1.5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      title="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 w-full flex items-center justify-center aspect-square mb-3 relative overflow-hidden">
                    {item.error ? (
                      <div className="text-[10px] text-red-500 font-semibold text-center leading-tight">解析失败</div>
                    ) : (
                      <>
                        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:8px_8px] rounded-xl"></div>
                        <div
                          className={`w-12 h-12 flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${settings.removeColors ? '[&_svg]:fill-slate-800 [&_svg]:stroke-slate-800' : ''}`}
                          dangerouslySetInnerHTML={{ __html: item.sanitizedSvg }}
                        />
                      </>
                    )}
                  </div>

                  <div className="w-full text-center border-t border-slate-100 pt-3">
                    <span className="text-xs font-semibold text-slate-600 truncate block w-full px-1" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Generate Button */}
            <div className="flex justify-center pt-8 pb-12">
              <button
                onClick={handleDownload}
                className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 text-lg font-bold transform hover:-translate-y-1"
              >
                <FileDown className="w-6 h-6" />
                生成 Draw.io 图库 (.xml)
              </button>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 opacity-60 pointer-events-none">
            <Layers className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-400 font-medium text-center">当前暂无图标，请上传上方区域</p>
          </div>
        )}

        {/* Instructions & Features Guide */}
        <div className="mt-16 space-y-6">
          <div className="flex items-center gap-2 px-2">
            <Info className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-800">使用指南与技巧</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
                <MousePointer2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">1. 拖入并生成</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                将任意 SVG 图标（支持批量）拖入上方虚线框中。预览无误后，点击底部大按钮下载 <b>.xml</b> 结尾的 draw.io 定制图库文件。
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                <ArrowRightCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">2. 导入 Draw.io 应用</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                打开您的 draw.io 画布，直接将下载好的 <b>.xml 库文件</b>拖入网页即可自动载入。或者通过左侧面板的 <b>文件 &gt; 导入自</b> 进行手动加载。
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">3. 色彩自由调控</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                勾选上方的 <b>“去除原生配色”</b> 生成单色黑底图标。这样当它进入 draw.io 后，您可以在右侧样式面板中像原生图形一样随心修改填充与边框颜色！
              </p>
            </div>

            {/* Notice */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-2xl border border-slate-200/60 md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <AlertCircle className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700 mb-1">小贴士</h4>
                <p className="text-slate-500 text-sm">
                  当您的单个图标特别复杂或者想临时测试单图时，可以直接将鼠标悬停在上方生成的卡片上，点击右上角的 <b>复制按钮</b> 获取单体 Stencil 代码。在 draw.io 中，使用 <b>调整形状 &gt; 编辑形状 (Ctrl+E)</b> 粘贴代码即可立即预览。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-5xl mx-auto mt-12 pt-8 border-t border-slate-200/60 text-center pb-8">
        <p className="text-slate-400 text-sm font-medium">SVG to Draw.io 转换器</p>
        <p className="text-slate-400 mt-1 text-xs">本地完全离线处理，保障您的隐私安全</p>
      </footer>
    </div>
  );
}
