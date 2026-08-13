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
          <div className="doc-page-body">
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
              if (block.type === "title")
                return (
                  <p key={index} className="doc-title">
                    {block.text}
                  </p>
                );
              if (block.type === "center")
                return (
                  <p key={index} className="doc-center">
                    {block.text}
                  </p>
                );
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