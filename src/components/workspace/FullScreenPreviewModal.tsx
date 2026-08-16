import React, { useState, useEffect, useRef } from "react";
import type { FinalDocument } from "@/lib/document-model";
import type { InstitutionConfig } from "@/lib/institutions";
import { parseTableRows } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  Bot,
  Send,
  Sparkles,
  Maximize2,
} from "lucide-react";

interface FullScreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  final: FinalDocument;
  config: InstitutionConfig;
  assetUrls?: Record<string, string>;
  fileName?: string;
  // AI Live Chat Props
  onChatEdit?: (message: string, selectedText?: string) => Promise<void>;
  busy?: boolean;
  chatHistory?: { role: "user" | "assistant"; text: string }[];
  selectedText?: string;
}

export function FullScreenPreviewModal({
  isOpen,
  onClose,
  final,
  config,
  assetUrls = {},
  fileName = "Document Preview",
  onChatEdit,
  busy = false,
  chatHistory = [],
  selectedText = "",
}: FullScreenPreviewModalProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [localChatMessage, setLocalChatMessage] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const totalPages = final?.pages?.length ?? 1;

  // Scroll chat history to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatOpen, busy]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setCurrentPage(1);
      setZoomLevel(100);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Track page scroll position
  const handleScroll = () => {
    if (!containerRef.current || totalPages <= 1) return;
    const container = containerRef.current;
    const pageElements = container.querySelectorAll(".doc-page-container");

    let current = 1;
    pageElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
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

  const handleSendLiveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localChatMessage.trim() || !onChatEdit) return;
    const msg = localChatMessage.trim();
    setLocalChatMessage("");
    await onChatEdit(msg, selectedText);
  };

  if (!isOpen) return null;

  const activePageLabel = final?.pages?.[currentPage - 1]?.numberLabel;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-in fade-in duration-200 overflow-hidden">
      {/* 1. TOP NAVBAR — FIXED ABOVE DOCUMENT (NO OVERLAP) */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 sm:px-5 py-2.5 shadow-xl shrink-0">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs sm:text-sm text-slate-100 line-clamp-1 max-w-[150px] xs:max-w-[220px] sm:max-w-xs">
              {fileName}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400">
              {config.label} · {totalPages} Page{totalPages > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Center: Page Controls */}
        <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/60 rounded-lg p-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30"
            disabled={currentPage <= 1}
            onClick={() => scrollToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs font-mono px-2 text-slate-200 min-w-[85px] text-center">
            {currentPage} / {totalPages} {activePageLabel ? `(p. ${activePageLabel})` : ""}
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

        {/* Right: AI Editor Toggle & Close Button */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/90 border border-slate-700/60 rounded-lg p-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
              title="Zoom Out"
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
              onClick={() => setZoomLevel((z) => Math.min(180, z + 10))}
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* AI Assistant Chat Live Button */}
          {onChatEdit && (
            <Button
              size="sm"
              variant={chatOpen ? "default" : "outline"}
              onClick={() => setChatOpen(!chatOpen)}
              className={`gap-1.5 text-xs h-8 font-medium transition-all ${
                chatOpen
                  ? "bg-primary text-primary-foreground"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              <Bot className="h-3.5 w-3.5 text-amber-400" />
              <span>AI Editor</span>
              {selectedText && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </Button>
          )}

          {/* Close Button */}
          <Button
            size="sm"
            variant="destructive"
            onClick={onClose}
            className="gap-1 text-xs h-8 font-medium shadow-md"
          >
            <X className="h-4 w-4" />
            <span className="hidden xs:inline">Close</span>
          </Button>
        </div>
      </header>

      {/* 2. BODY WORKSPACE — SCROLLABLE PAGE CONTAINER */}
      <div className="relative flex-1 flex overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-6 flex flex-col items-center gap-6 scrollbar-thin scrollbar-thumb-slate-700"
        >
          <div
            className="w-full max-w-3xl flex flex-col items-center gap-6 transition-transform duration-150 origin-top"
            style={{
              transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            }}
          >
            {final.pages.map((page, pIdx) => (
              <div
                key={page.index}
                id={`fullscreen-page-${pIdx + 1}`}
                className="doc-page-container w-full max-w-2xl mx-auto flex flex-col items-center justify-center"
              >
                {/* Page Banner */}
                <div className="w-full mb-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                  <span>
                    Page {pIdx + 1} of {totalPages} {page.numberLabel ? `(Formal Page ${page.numberLabel})` : ""}
                  </span>
                  <span className="opacity-70">{config.label}</span>
                </div>

                {/* Page Paper Card */}
                <div className="w-full rounded-sm shadow-2xl bg-white overflow-hidden text-black border border-slate-200">
                  <article
                    className="doc-page-full"
                    style={{
                      fontFamily: `"${config.font}", "Source Serif 4", serif`,
                      fontSize: `${config.fontSizePt}pt`,
                      lineHeight: config.lineSpacing,
                      ['--margin-top' as any]: `${config.marginsIn.top}in`,
                      ['--margin-bottom' as any]: `${config.marginsIn.bottom}in`,
                      ['--margin-left' as any]: `${config.marginsIn.left}in`,
                      ['--margin-right' as any]: `${config.marginsIn.right}in`,
                    }}
                  >
                    <DocumentPreviewSinglePage
                      page={page}
                      config={config}
                      final={final}
                      assetUrls={assetUrls}
                    />
                  </article>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. AI LIVE EDIT DRAWER — RESPONSIVE MOBILE SHEET + DESKTOP SIDE PANEL */}
        {chatOpen && onChatEdit && (
          <div className="fixed inset-x-0 bottom-0 sm:relative sm:inset-auto h-[60vh] sm:h-auto sm:w-80 md:w-96 border-t sm:border-t-0 sm:border-l border-slate-800 bg-slate-900/98 p-3 sm:p-4 flex flex-col justify-between shadow-2xl z-50 sm:z-40 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
            <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between shrink-0">
              <h4 className="font-semibold text-xs text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Live Academic AI Editor
              </h4>
              <button
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages Container */}
            <div className="flex-1 overflow-y-auto my-2 space-y-3 pr-1 text-xs scrollbar-thin flex flex-col">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 my-auto py-4 px-2 space-y-2">
                  <p className="font-medium text-slate-200">Live Document Edits</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Highlight any text on the page or type instructions to modify content in real-time.
                  </p>
                  <div className="text-left text-[11px] bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60 space-y-1">
                    <p className="font-semibold text-slate-300">Examples:</p>
                    <p>• "Fix table column headers"</p>
                    <p>• "Make chapter titles bold uppercase"</p>
                    <p>• "Add conclusion paragraph"</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg text-xs ${
                        msg.role === "user"
                          ? "bg-primary/20 text-primary-foreground border border-primary/30 ml-4"
                          : "bg-slate-800 text-slate-200 border border-slate-700/60 mr-4"
                      }`}
                    >
                      <span className="block text-[10px] font-semibold opacity-60 uppercase mb-0.5">
                        {msg.role === "user" ? "You" : "AI Editor"}
                      </span>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {busy && (
                <div className="bg-slate-800 text-amber-300 p-2.5 rounded-lg border border-amber-500/30 animate-pulse text-xs">
                  Applying live edits to document structure...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Selected Text Context */}
            {selectedText && (
              <div className="bg-slate-800/80 border border-slate-700 p-2 rounded-lg text-[11px] mb-2 shrink-0">
                <span className="text-amber-400 font-semibold block mb-0.5">Selected Context:</span>
                <p className="italic text-slate-300 line-clamp-2">"{selectedText}"</p>
              </div>
            )}

            {/* Sticky Chat Input Form */}
            <form onSubmit={handleSendLiveEdit} className="space-y-2 shrink-0 pt-1 bg-slate-900 border-t border-slate-800">
              <Textarea
                placeholder="Type live edit instruction..."
                value={localChatMessage}
                onChange={(e) => setLocalChatMessage(e.target.value)}
                rows={2}
                disabled={busy}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 text-xs resize-none"
              />
              <Button
                type="submit"
                disabled={busy || !localChatMessage.trim()}
                className="w-full text-xs gap-1.5 h-8 bg-primary text-primary-foreground font-medium"
              >
                <Send className="h-3.5 w-3.5" />
                {busy ? "Updating Document..." : "Apply Live Edit"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* 4. FOOTER PAGE THUMBNAILS BAR */}
      {totalPages > 1 && (
        <footer className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-900 py-1.5 px-3 flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
            const pageNumLabel = final.pages[num - 1]?.numberLabel;
            return (
              <button
                key={num}
                onClick={() => scrollToPage(num)}
                className={`h-6 min-w-[32px] px-1.5 rounded text-[11px] font-mono transition-all ${
                  currentPage === num
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {pageNumLabel ? `p.${pageNumLabel}` : `p.${num}`}
              </button>
            );
          })}
        </footer>
      )}
    </div>
  );
}

// Single Page Renderer helper — correctly parses tables & figures
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
      <div className={`doc-page-body ${page.hasPageBorder ? 'border-2 border-black p-6 h-full flex flex-col justify-start' : ''}`}>
        {page.blocks.map((block: any, index: number) => {
          if (block.type === "spacer") return <div key={index} className="h-4 sm:h-6" />;
          if (block.type === "logos")
            return (
              <div key={index} className="mb-4 flex items-center justify-center gap-6">
                {(block.imageIds ?? []).map((id: string) => {
                  const url = assetUrls[id] || (id === "logo-coltech" || id === "coltech.jpg" ? "/logo-coltech.jpg" : id === "logo-uba" || id === "uba.jpg" ? "/logo-uba.png" : undefined);
                  return url ? <img key={id} src={url} alt="Logo" className="h-14 sm:h-20 w-auto" /> : null;
                })}
              </div>
            );
          if (block.type === "image") {
            let url = block.imageId ? assetUrls[block.imageId] : undefined;
            if (!url && final.images && final.images.length > 0) {
              const imgObj =
                final.images.find((i) => i.id === block.imageId || i.id === `img-${block.imageId}`) ||
                final.images.find((i) => i.role === "figure") ||
                final.images[0];

              if (imgObj?.base64) {
                url = `data:${imgObj.contentType || "image/png"};base64,${imgObj.base64}`;
              }
            }
            if (!url) {
              return (
                <div key={index} className="my-4 p-4 border-2 border-dashed border-neutral-400 bg-neutral-50 rounded-lg text-center font-serif text-neutral-800 max-w-full mx-auto">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1">Figure Asset</div>
                  <p className="text-xs italic text-neutral-600">{block.text || "Embedded figure preserved."}</p>
                </div>
              );
            }
            return (
              <div key={index} className="my-4 text-center max-w-full">
                <img
                  key={index}
                  src={url}
                  alt={block.text || "Figure"}
                  className="mx-auto max-h-72 w-auto max-w-full rounded shadow-xs object-contain"
                />
                {block.text && <p className="mt-2 text-xs italic text-center font-serif text-black">{block.text}</p>}
              </div>
            );
          }
          if (block.type === "title") {
            if (block.borderBox) {
              return (
                <div key={index} className="my-4 sm:my-6 border-2 border-blue-500 rounded-xl p-3 sm:p-6 text-center font-bold text-sm sm:text-lg leading-snug uppercase text-black max-w-full mx-auto font-serif break-words">
                  {block.text}
                </div>
              );
            }
            return (
              <p key={index} className="doc-title break-words text-base sm:text-xl font-bold my-2 sm:my-4">
                {block.text}
              </p>
            );
          }
          if (block.type === "center")
            return (
              <p key={index} className="doc-center break-words" style={{
                fontStyle: block.italic ? "italic" : undefined,
                fontWeight: block.bold ? "bold" : undefined,
                fontSize: block.size ? `${block.size / 12}rem` : undefined
              }}>
                {block.text}
              </p>
            );
          if (block.type === "bilingual")
            return (
              <div key={index} className="flex justify-between items-center text-[9px] sm:text-[11px] font-bold leading-normal mb-4 sm:mb-6 text-black font-serif min-w-0 overflow-hidden">
                <div className="text-left flex-1 min-w-0 break-words">
                  {(block.left || []).map((line: string, i: number) => <div key={i} className="break-words">{line}</div>)}
                </div>
                {block.imageIds && block.imageIds.length > 0 && (
                  <div className="flex justify-center items-center gap-2 sm:gap-4 px-1 sm:px-4 shrink-0">
                    {block.imageIds.map((id: string) => {
                      const url = assetUrls[id] || (id === "logo-coltech" || id === "coltech.jpg" ? "/logo-coltech.jpg" : id === "logo-uba" || id === "uba.jpg" ? "/logo-uba.png" : undefined);
                      return url ? <img key={id} src={url} alt="Logo" className="h-10 sm:h-20 w-auto object-contain" /> : null;
                    })}
                  </div>
                )}
                <div className="text-right flex-1 min-w-0 break-words">
                  {(block.right || []).map((line: string, i: number) => <div key={i} className="break-words">{line}</div>)}
                </div>
              </div>
            );
          if (block.type === "ubaHeader") {
            const ubaLogo = assetUrls["logo-uba"] || assetUrls["uba.jpg"] || "/logo-uba.png";
            const secondaryLogoId = block.imageIds && block.imageIds.length > 1 ? block.imageIds.find((id: string) => id !== "logo-uba") : undefined;
            const secondaryLogo = secondaryLogoId ? (assetUrls[secondaryLogoId] || (secondaryLogoId === "logo-coltech" ? "/logo-coltech.jpg" : undefined)) : undefined;

            return (
              <div key={index} className="w-full border-b-2 border-black pb-2 sm:pb-3 mb-4 sm:mb-6 font-serif text-black overflow-hidden">
                <div className="flex justify-between items-start gap-1 sm:gap-4">
                  <div className="w-10 sm:w-20 shrink-0 flex justify-start">
                    {ubaLogo && <img src={ubaLogo} alt="UBa Logo" className="h-10 sm:h-16 w-auto max-w-full object-contain" />}
                  </div>
                  <div className="flex-1 text-center leading-tight space-y-0.5 min-w-0 break-words">
                    {(block.left || []).map((line: string, idx: number) => {
                      const isBold = idx === 0 || idx === 2 || idx === 5 || idx === 8;
                      const isItalic = idx === 9;
                      const fontSizeClass = idx === 5 ? "text-[9px] sm:text-xs font-semibold" : (idx === 6 || idx === 7 || idx === 9) ? "text-[7px] sm:text-[8px]" : "text-[7.5px] sm:text-[9px]";
                      if (line === "") return <div key={idx} className="h-1" />;
                      return (
                        <div
                          key={idx}
                          className={`${fontSizeClass} ${isBold ? "font-bold" : ""} ${isItalic ? "italic" : ""} break-words leading-tight`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-10 sm:w-20 shrink-0 flex justify-end">
                    {secondaryLogo && <img src={secondaryLogo} alt="Secondary Logo" className="h-10 sm:h-16 w-auto max-w-full object-contain" />}
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
                className="doc-listline text-xs sm:text-sm"
                style={{
                  paddingLeft: `${((block.level ?? 1) - 1) * 1}rem`,
                  fontWeight: block.bold ? 700 : undefined,
                }}
              >
                <span>{left}</span>
                <span className="doc-dots" />
                <span>{right}</span>
              </p>
            );
          }
          // CRITICAL TABLE FIX: Call parseTableRows helper to render tables accurately!
          if (block.type === "table") {
            const rows = parseTableRows(block);
            if (rows.length === 0) {
              return (
                <div key={index} className="my-4 p-4 border border-black text-center text-xs font-serif text-black italic">
                  {block.text || "[ Table ]"}
                </div>
              );
            }

            return (
              <div key={index} className="my-4 overflow-x-auto border border-black max-w-full">
                <table className="w-full border-collapse text-left text-[11px] sm:text-xs font-serif text-black">
                  <thead>
                    {rows.slice(0, 1).map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-b border-black bg-neutral-100 font-bold">
                        {row.map((cell: string, cIdx: number) => (
                          <th key={cIdx} className="p-1.5 sm:p-2 font-bold text-black align-middle border-r border-black last:border-r-0">
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
                          <td key={cIdx} className="p-1.5 sm:p-2 align-middle text-black border-r border-black last:border-r-0">
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
                className="my-3 p-3 bg-slate-900 text-slate-100 rounded-md font-mono text-xs overflow-x-auto leading-relaxed border border-slate-700 max-w-full"
              >
                <pre className="whitespace-pre-wrap font-mono m-0 p-0 text-[10px] sm:text-[11px] text-slate-100">{block.text}</pre>
              </div>
            );
          }
          return (
            <p key={index} className="doc-para text-xs sm:text-sm">
              {block.text}
            </p>
          );
        })}
      </div>
      <div className="doc-page-number">{page.numberLabel}</div>
    </>
  );
}
