import type { OriginalBlock } from "@/lib/document-model";

export function OriginalPreview({
  blocks,
  urls = {},
}: {
  blocks: OriginalBlock[];
  urls?: Record<string, string>;
}) {
  if (blocks.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No original layout captured yet — run the analysis first.
      </p>
    );

  return (
    <article className="doc-page" style={{ fontFamily: '"Times New Roman", serif' }}>
      <div className="doc-page-body">
        {blocks.map((block, index) => {
          if (block.type === "image") {
            const url = block.imageId ? urls[block.imageId] : undefined;
            if (!url) return null;
            return (
              <img
                key={index}
                src={url}
                alt="Original document image"
                className="mx-auto my-3 max-h-72 w-auto max-w-full"
              />
            );
          }
          if (block.type === "heading")
            return (
              <h3 key={index} className="doc-h2">
                {block.text}
              </h3>
            );
          if (block.type === "table")
            return (
              <pre
                key={index}
                className="my-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-3 text-xs"
              >
                {block.text}
              </pre>
            );
          return (
            <p key={index} className="doc-para">
              {block.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}