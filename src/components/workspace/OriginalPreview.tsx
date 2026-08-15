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
          if (block.type === "table") {
            const rows =
              block.tableRows && block.tableRows.length > 0
                ? block.tableRows
                : (block.text || "")
                    .split("\n")
                    .map((line) => line.split("|").map((c) => c.trim()).filter(Boolean))
                    .filter((r) => r.length > 0);

            if (rows.length === 0) return null;

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
    </article>
  );
}