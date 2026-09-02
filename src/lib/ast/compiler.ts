import type { Root, Node, Paragraph, Heading, Table, List, ListItem, Text, Image, HTML } from "mdast";
import { SemanticASTEngine } from "./engine";
import type { Block, BlockType } from "../document-model";

/**
 * Compiles a sanitized Semantic AST into deterministic UI/DOCX Document Blocks.
 */
export class ASTCompiler {
  private engine: SemanticASTEngine;
  private blocks: Block[] = [];
  private finalImages: { id: string }[];

  constructor(engine: SemanticASTEngine, finalImages: { id: string }[] = []) {
    this.engine = engine;
    this.finalImages = finalImages;
  }

  public compile(): Block[] {
    const tree = this.engine.getTree();
    this.blocks = [];
    
    for (const node of tree.children) {
      this.processNode(node);
    }
    
    return this.blocks;
  }

  private processNode(node: Node) {
    switch (node.type) {
      case "heading":
        const headingNode = node as Heading;
        const text = this.engine.extractText(headingNode);
        // Map depth to appropriate block type
        const type = `heading${Math.min(headingNode.depth, 2)}` as BlockType; // Map h1/h2, default h2 for anything deeper
        this.blocks.push({ type, text });
        break;

      case "paragraph":
        const paraText = this.engine.extractText(node);
        if (paraText) {
          // Check if paragraph is just an image marker
          const imgMatch = paraText.match(/\[IMAGE(?:\:(\d+))?\]/i);
          if (imgMatch) {
             const imgId = imgMatch[1] ? imgMatch[1] : (this.finalImages.length > 0 ? this.finalImages[0].id : "");
             this.blocks.push({ type: "image", text: "", imageId: imgId });
          } else {
             this.blocks.push({ type: "para", text: paraText });
          }
        }
        break;

      case "list":
        const listNode = node as List;
        listNode.children.forEach(item => {
           const itemText = this.engine.extractText(item);
           if (itemText) {
              this.blocks.push({ type: "bullet", text: itemText });
           }
        });
        break;

      case "table":
        const tableNode = node as Table;
        // The AST guarantees this is a structurally sound table, not a false positive
        const rows = tableNode.children.map(row => 
          row.children.map(cell => this.engine.extractText(cell))
        );
        this.blocks.push({ type: "table", text: "", tableRows: rows });
        break;
        
      case "image":
        const imgNode = node as Image;
        this.blocks.push({ type: "image", text: imgNode.alt || "", imageId: imgNode.url });
        break;
        
      case "html":
        const htmlNode = node as HTML;
        if (htmlNode.value.includes("<br")) {
            // Ignore bare breaks or process as needed
        }
        break;
    }
  }
}
