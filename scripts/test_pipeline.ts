import fs from "fs";
import path from "path";
import { buildFinalDocument } from "../src/lib/document-build";
import { runVerificationAudit } from "../src/lib/audit.server";

async function runTest() {
  console.log("==========================================");
  console.log("   ACADFORMAT COMPREHENSIVE PIPELINE TEST  ");
  console.log("==========================================");

  const jsonPath = "/home/philding/.gemini/antigravity/brain/622f9f6c-7d04-47c4-b7df-041581d2cf83/scratch/vlan_doc.json";
  if (!fs.existsSync(jsonPath)) {
    console.error("Test JSON file not found at:", jsonPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log("Loaded document ID:", rawData.id || "N/A");
  console.log("Document Title:", rawData.model?.meta?.title || "N/A");
  console.log("Chapters Count:", rawData.model?.chapters?.length || 0);

  const model = rawData.model;
  const config = {
    name: "Standard Institutional",
    bodyOutline: ["INTRODUCTION", "LITERATURE REVIEW", "METHODOLOGY", "RESULTS AND DISCUSSION", "CONCLUSION"],
    lineSpacing: 1.5,
    fontFamily: "Times New Roman",
    fontSizePt: 12,
  };
  const selection = { institution: "Standard" };

  console.log("\n--> 1. Running buildFinalDocument()...");
  const finalDoc = buildFinalDocument({
    model,
    config,
    selection,
    documentModel: model,
  });

  console.log(`Build complete. Total rendered pages: ${finalDoc.pages.length}`);

  // Inspect page by page
  console.log("\n--> 2. Inspecting Page Breakdown:");
  let orphanedHeadings = 0;
  let emptyPages = 0;
  let listBlockCount = 0;
  let paraWithInlineRQ = 0;
  let referenceBlockCount = 0;
  let dirtyBlockCount = 0;

  finalDoc.pages.forEach((p, idx) => {
    const pNum = idx + 1;
    const blockTypes = p.blocks.map((b) => b.type);
    const textSnippets = p.blocks.map((b) => (b.text || "").substring(0, 40));

    console.log(`Page ${pNum} [Section: "${p.sectionTitle}"] - ${p.blocks.length} blocks: [${blockTypes.join(", ")}]`);

    if (p.blocks.length === 0) {
      emptyPages++;
      console.warn(`   ⚠️ WARNING: Page ${pNum} is completely empty!`);
    }

    if (p.blocks.length === 1 && (p.blocks[0]!.type === "heading1" || p.blocks[0]!.type === "heading2")) {
      orphanedHeadings++;
      console.warn(`   ⚠️ WARNING: Page ${pNum} contains ONLY an orphaned heading: "${p.blocks[0]!.text}"`);
    }

    p.blocks.forEach((b) => {
      if (b.type === "listline" || b.type === "bullet") listBlockCount++;
      if (b.type === "reference") referenceBlockCount++;

      // Check if paragraph contains merged run-in RQs or list items that were NOT split
      if (b.type === "para") {
        const text = (b.text || "").trim();
        if (text.length > 0 && text.length < 40 && !/[.!?:;,)\]"'»]$/.test(text)) {
          console.warn(`   ⚠️ SLICED PARA CANDIDATE (Page ${pNum}): "${text}"`);
        }
        if (/R?Q\s*\d+[.:)]\s+.*R?Q\s*\d+[.:)]/i.test(b.text || "")) {
          paraWithInlineRQ++;
          console.warn(`   ⚠️ WARNING: Unsplit inline RQs in paragraph: "${b.text.substring(0, 80)}..."`);
        }
      }

      // Noise check
      if (/\bREQUIRES_USER_REVIEW\b|\bundefined\b|\bnull\b|→\s|=>\s/.test(b.text || "")) {
        dirtyBlockCount++;
        console.warn(`   ⚠️ WARNING: Noise token in block (${b.type}): "${b.text.substring(0, 60)}"`);
      }
    });
  });

  console.log("\n--> 3. Checking List of Abbreviations:");
  const abbrevs = finalDoc.pages.find(p => p.sectionTitle === "List of Abbreviations");
  if (abbrevs) {
    abbrevs.blocks.forEach(b => {
      console.log(`   [Abbrev] ${b.text}`);
    });
  } else {
    console.log("   (No List of Abbreviations page rendered or present)");
  }

  console.log("\n--> 4. Running Verification Audit Engine...");
  const rawText = JSON.stringify(model);
  const auditResult = runVerificationAudit({
    documentId: rawData.id || "test-doc",
    userId: "test-user",
    final: finalDoc,
    model,
    originalText: rawText,
  });

  console.log("\n==========================================");
  console.log("            AUDIT RESULTS SUMMARY         ");
  console.log("==========================================");
  console.log("Reconstruction Status:", auditResult.reconstructionStatus);
  console.log("Verification Passed:  ", auditResult.verificationAudit.verificationPassed);
  console.log("Download Ready:       ", auditResult.downloadReady);
  console.log("Quality Gates:", JSON.stringify(auditResult.verificationAudit.gates, null, 2));

  if (auditResult.adminAlert.persistentErrors.length > 0) {
    console.log("\nPersistent Errors Detected:");
    auditResult.adminAlert.persistentErrors.forEach((e) => {
      console.log(`  ❌ [${e.gate}] ${e.description}`);
      console.log(`     Action: ${e.actionRequired}`);
    });
  } else {
    console.log("\n✅ ALL QUALITY GATES PASSED PERFECTLY!");
  }

  console.log("\nMetric Summary:");
  console.log(`  Empty Pages:           ${emptyPages}`);
  console.log(`  Orphaned Headings:     ${orphanedHeadings}`);
  console.log(`  List Blocks Count:     ${listBlockCount}`);
  console.log(`  Inline RQ Paras:       ${paraWithInlineRQ}`);
  console.log(`  Reference Blocks:      ${referenceBlockCount}`);
  console.log(`  Dirty/Noise Blocks:    ${dirtyBlockCount}`);
}

runTest().catch(console.error);
