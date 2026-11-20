
const PDFDocument = require("pdfkit");
const { PDFParse } = require("pdf-parse");

describe("PDFParse Real Processing and Resource Safety Suite", () => {
  // Helper to generate a PDF buffer in memory
  const createPdfBuffer = (textToAdd) => {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      if (textToAdd) {
        doc.text(textToAdd);
      } else {
        doc.addPage();
      }
      doc.end();
    });
  };

  test("Real PDFParse extracts readable text from valid PDF buffer", async () => {
    const buffer = await createPdfBuffer("W-2 Wage and Tax Statement 2024 Gross Wages: $85,000");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const cleanText = (result?.text || "").replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
    expect(cleanText).toContain("W-2 Wage and Tax Statement");
  });

  test("Real PDFParse safely catches empty 0-byte buffer and cleans resources", async () => {
    let parser = null;
    let caughtError = null;

    try {
      parser = new PDFParse({ data: Buffer.from("") });
      await parser.getText();
    } catch (err) {
      caughtError = err;
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.name).toMatch(/InvalidPDFException|FormatError/i);
  });

  test("Real PDFParse strips page markers for blank/image-only PDF", async () => {
    // Generate PDF with page but no text
    const buffer = await createPdfBuffer("");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const rawText = result?.text || "";
    const cleanText = rawText.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
    expect(cleanText.length).toBeLessThan(5);
  });

  test("Real PDFParse safely catches malformed garbage buffer", async () => {
    let parser = null;
    let caughtError = null;

    try {
      parser = new PDFParse({ data: Buffer.from("NOT_A_REAL_PDF_GARBAGE_BYTES_123456789") });
      await parser.getText();
    } catch (err) {
      caughtError = err;
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }

    expect(caughtError).toBeDefined();
  });
});
