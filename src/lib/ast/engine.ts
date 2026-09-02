import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { toMarkdown } from "mdast-util-to-markdown";
import type { Root, Node, Parent, Paragraph, Heading, Text, Table, List, ListItem } from "mdast";

/**
 * The Semantic AST Engine.
 * Replaces the old brittle regex line-by-line pipeline with a deterministic graph transformation pipeline.
 */
export class SemanticASTEngine {
  private tree: Root;

  constructor(markdownSource: string) {
    // Phase 1: Ingestion
    // Convert the raw markdown string into a strict AST.
    // This inherently solves the "fragmented lines" and "false table" issues because 
    // unified strictly adheres to markdown specs (e.g. lists must be lists, tables must use pipes).
    this.tree = unified().use(remarkParse).use(remarkGfm).parse(markdownSource) as Root;
  }

  /**
   * Retrieves the raw underlying tree.
   */
  public getTree(): Root {
    return this.tree;
  }

  /**
   * Serializes the modified AST back to a perfectly formatted Markdown string.
   */
  public compileToMarkdown(): string {
    return toMarkdown(this.tree);
  }

  /**
   * Finds all nodes of a specific type (e.g. "table", "paragraph")
   */
  public findNodes<T extends Node>(type: string): T[] {
    const nodes: T[] = [];
    visit(this.tree, type, (node) => {
      nodes.push(node as T);
    });
    return nodes;
  }

  /**
   * Extracts plain text from any node by recursively visiting text children.
   */
  public extractText(node: Node): string {
    let text = "";
    visit(node, "text", (textNode: Text) => {
      text += textNode.value;
    });
    return text.trim();
  }

  /**
   * Fixes fragmented citations by collapsing multiple ListItem nodes that were broken by 
   * linebreaks/periods into single coherent nodes.
   */
  public unifyReferences(): void {
    visit(this.tree, "list", (node: List) => {
      // Logic to merge adjacent fragmented list items
      const mergedChildren: ListItem[] = [];
      let currentItem: ListItem | null = null;

      for (const child of node.children) {
        const text = this.extractText(child);
        // If it starts with a lowercase or period, it's a fragment of the previous citation
        if (currentItem && (text.startsWith(".") || /^[a-z]/.test(text))) {
          // Merge text into currentItem
          visit(child, "text", (textNode: Text) => {
            const lastPara = currentItem!.children[currentItem!.children.length - 1] as Paragraph;
            if (lastPara && lastPara.type === "paragraph") {
              lastPara.children.push(textNode);
            }
          });
        } else {
          currentItem = child;
          mergedChildren.push(child);
        }
      }
      node.children = mergedChildren;
    });
  }

  /**
   * Cleans OCR artifacts like leading dashes or strange unicode blocks from paragraph nodes,
   * without destroying the semantic grouping of the paragraph.
   */
  public sanitizeParagraphs(): void {
    visit(this.tree, "paragraph", (node: Paragraph) => {
      if (node.children.length > 0) {
        const firstChild = node.children[0];
        if (firstChild.type === "text") {
          // Remove leading em-dashes or bullets from regular paragraphs
          firstChild.value = firstChild.value.replace(/^[—\-\•]\s*/, "");
        }
      }
    });
  }
}
