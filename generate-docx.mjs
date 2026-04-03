import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, TabStopPosition, TabStopType } from "docx";
import { readFileSync, writeFileSync } from "fs";

const md = readFileSync("HOLO_SYNC_DOCUMENTATION.md", "utf-8");
const lines = md.split("\n");

const children = [];

function makeText(text, opts = {}) {
  return new TextRun({ text, size: opts.size || 22, font: "Calibri", ...opts });
}

function parseLine(line) {
  const runs = [];
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const p of parts) {
    if (p.startsWith("**") && p.endsWith("**")) {
      runs.push(makeText(p.slice(2, -2), { bold: true }));
    } else if (p.startsWith("`") && p.endsWith("`")) {
      runs.push(makeText(p.slice(1, -1), { font: "Consolas", size: 20, color: "2E86C1" }));
    } else if (p.length > 0) {
      runs.push(makeText(p));
    }
  }
  return runs;
}

let inCode = false;
let codeBlock = [];
let inTable = false;
let tableRows = [];

function flushTable() {
  if (tableRows.length < 2) { inTable = false; tableRows = []; return; }
  const rows = tableRows.filter(r => !r.match(/^\|[\s-|]+\|$/));
  const tRows = rows.map((row, ri) => {
    const cells = row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());
    return new TableRow({
      children: cells.map(c => new TableCell({
        children: [new Paragraph({ children: parseLine(c), spacing: { before: 40, after: 40 } })],
        width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
        shading: ri === 0 ? { fill: "1B4F72", color: "FFFFFF" } : undefined,
      })),
    });
  });
  children.push(new Table({ rows: tRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  inTable = false;
  tableRows = [];
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith("```")) {
    if (inCode) {
      children.push(new Paragraph({
        children: [makeText(codeBlock.join("\n"), { font: "Consolas", size: 18 })],
        shading: { fill: "F4F6F7" },
        spacing: { before: 80, after: 80 },
      }));
      codeBlock = [];
      inCode = false;
    } else {
      if (inTable) flushTable();
      inCode = true;
    }
    continue;
  }

  if (inCode) { codeBlock.push(line); continue; }

  if (line.startsWith("|") && line.includes("|")) {
    inTable = true;
    tableRows.push(line);
    continue;
  } else if (inTable) {
    flushTable();
  }

  if (line.startsWith("# ") && !line.startsWith("##")) {
    children.push(new Paragraph({
      children: [makeText(line.slice(2), { bold: true, size: 36, color: "1A5276" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
      alignment: AlignmentType.CENTER,
    }));
  } else if (line.startsWith("## ")) {
    children.push(new Paragraph({
      children: [makeText(line.slice(3), { bold: true, size: 30, color: "1B4F72" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E86C1" } },
    }));
  } else if (line.startsWith("### ")) {
    children.push(new Paragraph({
      children: [makeText(line.slice(4), { bold: true, size: 26, color: "2874A6" })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 60 },
    }));
  } else if (line.startsWith("- ") || line.startsWith("  - ")) {
    const indent = line.startsWith("  - ") ? 720 : 360;
    const text = line.replace(/^\s*-\s*/, "");
    children.push(new Paragraph({
      children: parseLine(text),
      bullet: { level: line.startsWith("  - ") ? 1 : 0 },
      spacing: { before: 40, after: 40 },
      indent: { left: indent },
    }));
  } else if (line.match(/^\d+\.\s/)) {
    const text = line.replace(/^\d+\.\s*/, "");
    children.push(new Paragraph({
      children: parseLine(text),
      numbering: { reference: "default-numbering", level: 0 },
      spacing: { before: 40, after: 40 },
    }));
  } else if (line.startsWith("> ")) {
    children.push(new Paragraph({
      children: [makeText(line.slice(2), { italics: true, color: "5D6D7E" })],
      indent: { left: 480 },
      shading: { fill: "EBF5FB" },
      spacing: { before: 60, after: 60 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2E86C1" } },
    }));
  } else if (line.startsWith("---")) {
    children.push(new Paragraph({
      text: "",
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "BDC3C7" } },
      spacing: { before: 120, after: 120 },
    }));
  } else if (line.trim() === "") {
    children.push(new Paragraph({ text: "", spacing: { before: 60, after: 60 } }));
  } else {
    children.push(new Paragraph({
      children: parseLine(line),
      spacing: { before: 40, after: 40 },
    }));
  }
}

if (inTable) flushTable();

const doc = new Document({
  numbering: {
    config: [{
      reference: "default-numbering",
      levels: [{
        level: 0,
        format: "decimal",
        text: "%1.",
        alignment: AlignmentType.START,
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("HOLO_SYNC_DOCUMENTATION.docx", buffer);
console.log("DOCX generated successfully!");
