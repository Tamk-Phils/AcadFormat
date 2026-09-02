import { SemanticASTEngine } from "../src/lib/ast/engine";
import { ASTCompiler } from "../src/lib/ast/compiler";

const sampleMarkdown = `
# Chapter 1
—This is a paragraph with an OCR artifact dash.
It also spans multiple lines but should be one paragraph.

- Reference 1, U. (2023).
. This is a broken fragment of reference 1.

| Header 1 | Header 2 |
|---|---|
| A | B |
`;

const engine = new SemanticASTEngine(sampleMarkdown);

console.log("--- AST BEFORE FIXES ---");
console.log(JSON.stringify(engine.getTree().children.map((c: any) => c.type)));

engine.unifyReferences();
engine.sanitizeParagraphs();

const compiler = new ASTCompiler(engine);
const blocks = compiler.compile();

console.log("\n--- AST BLOCKS AFTER COMPILATION ---");
console.log(JSON.stringify(blocks, null, 2));
