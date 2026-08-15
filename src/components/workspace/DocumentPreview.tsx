import type { FinalDocument } from "@/lib/document-model";
import type { InstitutionConfig } from "@/lib/institutions";

export function DocumentPreview({
  final,
  config,
  assetUrls = {},
}: {
  final: FinalDocument;
  config: InstitutionConfig;
  assetUrls?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col items-center gap-8">
      {final.pages.map((page) => (
        <article
          key={page.index}
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
          <div className={`doc-page-body ${page.hasPageBorder ? 'border-2 border-black p-8 h-full flex flex-col justify-start' : ''}`}>
            {page.blocks.map((block, index) => {
              if (block.type === "spacer") return <div key={index} className="h-6" />;
              if (block.type === "logos")
                return (
                  <div key={index} className="mb-4 flex items-center justify-center gap-8">
                    {(block.imageIds ?? [])
                      .filter((id) => assetUrls[id])
                      .map((id) => (
                        <img key={id} src={assetUrls[id]} alt="Institution logo" className="h-20 w-auto" />
                      ))}
                  </div>
                );
              if (block.type === "image") {
                const url = block.imageId ? assetUrls[block.imageId] : undefined;
                if (!url) return null;
                return (
                  <img
                    key={index}
                    src={url}
                    alt={block.text || "Figure"}
                    className="mx-auto my-3 max-h-80 w-auto max-w-full"
                  />
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
                      {(block.left || []).map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                    {block.imageIds && block.imageIds.length > 0 && (
                      <div className="flex justify-center items-center gap-4 px-4">
                        {block.imageIds.filter(id => assetUrls[id]).map(id => (
                          <img key={id} src={assetUrls[id]} alt="Logo" className="h-20 w-auto" />
                        ))}
                      </div>
                    )}
                    <div className="text-right flex-1">
                      {(block.right || []).map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  </div>
                );
              if (block.type === "ubaHeader") {
                const ubaLogo = assetUrls["logo-uba"];
                const secondaryLogoId = block.imageIds?.find(id => id !== "logo-uba");
                const secondaryLogo = secondaryLogoId ? assetUrls[secondaryLogoId] : undefined;

                return (
                  <div key={index} className="w-full border-b-2 border-black pb-3 mb-6 font-serif text-black">
                    <div className="flex justify-between items-start gap-4">
                      {/* Left Logo */}
                      <div className="w-20 flex-shrink-0 flex justify-start">
                        {ubaLogo && <img src={ubaLogo} alt="UBa Logo" className="h-16 w-auto" />}
                      </div>

                      {/* Center Content */}
                      <div className="flex-1 text-center leading-tight space-y-0.5">
                        {(block.left || []).map((line, idx) => {
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
                const [left, right] = block.text.split("\t");
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
                const rows =
                  block.tableRows && block.tableRows.length > 0
                    ? block.tableRows
                    : (block.text || "")
                        .split("\n")
                        .map((line) => line.split("|").map((c) => c.trim()).filter(Boolean))
                        .filter((r) => r.length > 0);

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
                        {rows.slice(0, 1).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-black bg-neutral-100">
                            {row.map((cell, cIdx) => (
                              <th key={cIdx} className="p-2 font-bold text-black align-middle border-r border-black last:border-r-0">
                                {cell}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {rows.slice(1).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-black last:border-b-0">
                            {row.map((cell, cIdx) => (
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
              return (
                <p key={index} className="doc-para">
                  {block.text}
                </p>
              );
            })}
          </div>
          <div className="doc-page-number">{page.numberLabel}</div>
        </article>
      ))}
    </div>
  );
}