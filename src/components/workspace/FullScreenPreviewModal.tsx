import React, { useState, useEffect, useRef } from "react";
import type { FinalDocument } from "@/lib/document-model";
import type { InstitutionConfig } from "@/lib/institutions";
import { DocumentPreview } from "./DocumentPreview";
import { Button } from "@/components/ui/button";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
  Sliders,
} from "lucide-react";

interface FullScreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  final: FinalDocument;
  config: InstitutionConfig;
  assetUrls?: Record<string, string>;
  fileName?: string;
}

export function FullScreenPreviewModal({
  isOpen,
  onClose,
  final,
  config,
  assetUrls = {},
  fileName = "Document Preview",
}: FullScreenPreviewModalProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = final?.pages?.length ?? 1;

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setCurrentPage(1);
      // On small screens default zoom level to 90% or fit
      if (window.innerWidth < 640) {
        setZoomLevel(90);
      } else {
        setZoomLevel(100);
      }
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Update page indicator on scroll
  const handleScroll = () => {
    if (!containerRef.current || totalPages <= 1) return;
    const container = containerRef.current;
    const pageElements = container.querySelectorAll(".doc-page");
    
    let current = 1;
    pageElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      // If the top of page is above center of viewport
      if (rect.top <= window.innerHeight / 2) {
        current = index + 1;
      }
    });
    setCurrentPage(current);
  };

  const scrollToPage = (pageIndex: number) => {
    if (pageIndex < 1 || pageIndex > totalPages) return;
    const targetEl = document.getElementById(`fullscreen-page-${pageIndex}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentPage(pageIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-white animate-in fade-in duration-200">
      {/* Header Controls Bar */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 shadow-lg">
        {/* Left: Title & Info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-slate-100 line-clamp-1 max-w-[180px] sm:max-w-xs">
              {fileName}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400">
              {config.label} · {totalPages} Page{totalPages > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Center: Page Navigation Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30"
            disabled={currentPage <= 1}
            onClick={() => scrollToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-mono px-2 text-slate-200 min-w-[70px] text-center">
            Page {currentPage} / {totalPages}
          </span>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30"
            disabled={currentPage >= totalPages}
            onClick={() => scrollToPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Zoom & Close Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden xs:flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono px-1 text-slate-300 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] px-2 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => setZoomLevel(100)}
              title="Reset Zoom"
            >
              Reset
            </Button>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={onClose}
            className="gap-1.5 text-xs h-8 font-medium shadow-md"
          >
            <X className="h-4 w-4" /> <span className="hidden sm:inline">Close</span>
          </Button>
        </div>
      </header>

      {/* Main Document Pages Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-8 flex flex-col items-center gap-8 scrollbar-thin scrollbar-thumb-slate-700"
      >
        <div
          className="transition-transform duration-200 ease-out origin-top flex flex-col items-center gap-8 max-w-full"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
          }}
        >
          {final.pages.map((page, pIdx) => (
            <div
              key={page.index}
              id={`fullscreen-page-${pIdx + 1}`}
              className="relative group transition-shadow duration-200"
            >
              {/* Page Number Label */}
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Page {pIdx + 1} of {totalPages}</span>
                <span className="opacity-60">{config.label}</span>
              </div>

              {/* Render Page Card */}
              <div className="rounded-sm shadow-2xl overflow-hidden bg-white">
                <article
                  className="doc-page"
                  style={{
                    fontFamily: `"${config.font}", "Source Serif 4", serif`,
                    fontSize: `${config.fontSizePt}pt`,
                    lineHeight: config.lineSpacing,
                    paddingTop: `${config.marginsIn.top}in`,
                    paddingBottom: `${config.marginsIn.bottom}in`,
                    paddingLeft: `${config.marginsIn.left}in`,
                    paddingRight: `${config.marginsIn.right}in`,
                  }}
                >
                  <DocumentPreviewSinglePage page={page} config={config} final={final} assetUrls={assetUrls} />
                </article>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Floating Quick Page Thumbnails Bar on Mobile */}
      {totalPages > 1 && (
        <footer className="sticky bottom-0 z-40 border-t border-slate-800 bg-slate-900/95 py-2 px-4 flex items-center justify-center gap-2 overflow-x-auto scrollbar-none">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => scrollToPage(num)}
              className={`h-7 min-w-[32px] px-2 rounded text-xs font-mono transition-all ${
                currentPage === num
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              p.{num}
            </button>
          ))}
        </footer>
      )}
    </div>
  );
}

// Single Page Renderer helper for full screen viewer
function DocumentPreviewSinglePage({
  page,
  config,
  final,
  assetUrls = {},
}: {
  page: any;
  config: InstitutionConfig;
  final: FinalDocument;
  assetUrls?: Record<string, string>;
}) {
  return (
    <>
      <div className={`doc-page-body ${page.hasPageBorder ? 'border-2 border-black p-8 h-full flex flex-col justify-start' : ''}`}>
        {page.blocks.map((block: any, index: number) => {
          if (block.type === "spacer") return <div key={index} className="h-6" />;
          if (block.type === "logos")
            return (
              <div key={index} className="mb-4 flex items-center justify-center gap-8">
                {(block.imageIds ?? []).map((id: string) => {
                  const url = assetUrls[id] || (id === "logo-coltech" || id === "coltech.jpg" ? "/logo-coltech.jpg" : id === "logo-uba" || id === "uba.jpg" ? "/logo-uba.png" : undefined);
                  return url ? <img key={id} src={url} alt="Logo" className="h-20 w-auto" /> : null;
                })}
              </div>
            );
          if (block.type === "image") {
            let url = block.imageId ? assetUrls[block.imageId] : undefined;
            if (!url && block.imageId && final.images) {
              const imgObj = final.images.find((i) => i.id === block.imageId);
              if (imgObj?.base64) {
                url = `data:${imgObj.contentType || "image/png"};base64,${imgObj.base64}`;
              }
            }
            if (!url) {
              return (
                <div key={index} className="my-4 p-5 border-2 border-dashed border-neutral-400 bg-neutral-50 rounded-lg text-center font-serif text-neutral-800 max-w-lg mx-auto">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">Figure Asset</div>
                  <p className="text-xs italic text-neutral-600">{block.text || "Embedded figure preserved."}</p>
                </div>
              );
            }
            return (
              <div key={index} className="my-4 text-center">
                <img
                  key={index}
                  src={url}
                  alt={block.text || "Figure"}
                  className="mx-auto max-h-80 w-auto max-w-full rounded shadow-sm"
                />
                {block.text && <p className="mt-2 text-xs italic text-center font-serif text-black">{block.text}</p>}
              </div>
            );
          }
          if (block.type === "title") {
            if (block.borderBox) {
              return (
                <div key={index} className="my-6 border-2 border-blue-500 rounded-xl p-6 text-center font-bold text-lg leading-snug uppercase text-black max-w-[90%] mx-auto font-serif">
                  {block.text}
                </div>
              );
            }
            return (
              <p key={index} className="doc-title">
                {block.text}
              </p>
            );
          }
          if (block.type === "center")
            return (
              <p key={index} className="doc-center" style={{
                fontStyle: block.italic ? "italic" : undefined,
                fontWeight: block.bold ? "bold" : undefined,
                fontSize: block.size ? `${block.size / 12}rem` : undefined
              }}>
                {block.text}
              </p>
            );
          if (block.type === "bilingual")
            return (
              <div key={index} className="flex justify-between items-center text-[11px] font-bold leading-normal mb-6 text-black font-serif">
                <div className="text-left flex-1">
                  {(block.left || []).map((line: string, i: number) => <div key={i}>{line}</div>)}
                </div>
                {block.imageIds && block.imageIds.length > 0 && (
                  <div className="flex justify-center items-center gap-4 px-4">
                    {block.imageIds.map((id: string) => {
                      const url = assetUrls[id] || (id === "logo-coltech" || id === "coltech.jpg" ? "/logo-coltech.jpg" : id === "logo-uba" || id === "uba.jpg" ? "/logo-uba.png" : undefined);
                      return url ? <img key={id} src={url} alt="Logo" className="h-20 w-auto" /> : null;
                    })}
                  </div>
                )}
                <div className="text-right flex-1">
                  {(block.right || []).map((line: string, i: number) => <div key={i}>{line}</div>)}
                </div>
              </div>
            );
          if (block.type === "ubaHeader") {
            const ubaLogo = assetUrls["logo-uba"] || assetUrls["uba.jpg"] || "/logo-uba.png";
            const secondaryLogoId = block.imageIds && block.imageIds.length > 1 ? block.imageIds.find((id: string) => id !== "logo-uba") : undefined;
            const secondaryLogo = secondaryLogoId ? (assetUrls[secondaryLogoId] || (secondaryLogoId === "logo-coltech" ? "/logo-coltech.jpg" : undefined)) : undefined;

            return (
              <div key={index} className="w-full border-b-2 border-black pb-3 mb-6 font-serif text-black">
                <div className="flex justify-between items-start gap-4">
                  {/* Left Logo */}
                  <div className="w-20 flex-shrink-0 flex justify-start">
                    {ubaLogo && <img src={ubaLogo} alt="UBa Logo" className="h-16 w-auto" />}
                  </div>

                  {/* Center Content */}
                  <div className="flex-1 text-center leading-tight space-y-0.5">
                    {(block.left || []).map((line: string, idx: number) => {
                      const isBold = idx === 0 || idx === 2 || idx === 5 || idx === 8;
                      const isItalic = idx === 9;
                      const fontSizeClass = idx === 5 ? "text-xs font-semibold" : (idx === 6 || idx === 7 || idx === 9) ? "text-[8px]" : "text-[9px]";
                      
                      if (line === "") return <div key={idx} className="h-1" />;
                      return (
                        <div
                          key={idx}
                          className={`${fontSizeClass} ${isBold ? "font-bold" : ""} ${isItalic ? "italic" : ""}`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Logo */}
                  <div className="w-20 flex-shrink-0 flex justify-end">
                    {secondaryLogo && <img src={secondaryLogo} alt="Secondary Logo" className="h-16 w-auto" />}
                  </div>
                </div>
              </div>
            );
          }
          if (block.type === "heading1")
            return (
              <h2 key={index} className="doc-h1">
                {block.text}
              </h2>
            );
          if (block.type === "heading2")
            return (
              <h3 key={index} className="doc-h2">
                {block.text}
              </h3>
            );
          if (block.type === "caption")
            return (
              <p key={index} className="doc-caption">
                {block.text}
              </p>
            );
          if (block.type === "listline") {
            const textStr = typeof block.text === "string" ? block.text : String(block.text ?? "");
            const [left, right] = textStr.split("\t");
            return (
              <p
                key={index}
                className="doc-listline"
                style={{
                  paddingLeft: `${((block.level ?? 1) - 1) * 1.25}rem`,
                  fontWeight: block.bold ? 700 : undefined,
                }}
              >
                <span>{left}</span>
                <span className="doc-dots" />
                <span>{right}</span>
              </p>
            );
          }
          if (block.type === "table") {
            const rows = block.rows || [];
            if (rows.length === 0) {
              return (
                <div key={index} className="my-4 p-4 border border-black text-center text-xs font-serif text-black italic">
                  {block.text || "[ Table ]"}
                </div>
              );
            }

            return (
              <div key={index} className="my-4 overflow-x-auto border border-black">
                <table className="w-full border-collapse text-left text-xs font-serif text-black">
                  <thead>
                    {rows.slice(0, 1).map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-b border-black bg-neutral-100">
                        {row.map((cell: string, cIdx: number) => (
                          <th key={cIdx} className="p-2 font-bold text-black align-middle border-r border-black last:border-r-0">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {rows.slice(1).map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-b border-black last:border-b-0">
                        {row.map((cell: string, cIdx: number) => (
                          <td key={cIdx} className="p-2 align-middle text-black border-r border-black last:border-r-0">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (block.type === "code") {
            return (
              <div
                key={index}
                className="my-3 p-3.5 bg-slate-900 text-slate-100 rounded-md font-mono text-xs overflow-x-auto leading-relaxed border border-slate-700 shadow-inner"
              >
                <pre className="whitespace-pre-wrap font-mono m-0 p-0 text-[11px] font-medium tracking-normal text-slate-100">{block.text}</pre>
              </div>
            );
          }
          return (
            <p key={index} className="doc-para">
              {block.text}
            </p>
          );
        })}
      </div>
      <div className="doc-page-number">{page.numberLabel}</div>
    </>
  );
}
