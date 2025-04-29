import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { renderFile } from "ejs";
import os from "os";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMac = os.platform() === "darwin";

const app = express();
app.use(bodyParser.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", renderFile);

// POST /invoice
app.post("/invoice", async (req, res) => {
  const requiredFields = [
    "invoiceFrom",
    "invoiceTo",
    "items",
    "date",
    "dueDate",
  ];
  for (let field of requiredFields) {
    if (!req.body[field]) {
      return res.status(400).json({ message: `${field} is required` });
    }
  }

  try {
    const html = await renderInvoiceHTML({ invoice: req.body });
    const pdf = await generatePDF(html);

    const safeInvoiceId = (req.body.invoiceId || "unknown").replace(
      /[^\w\-]/g,
      ""
    );
    const filename = `invoice-${safeInvoiceId}.pdf`;

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "PDF generation failed" });
  }
});

async function renderInvoiceHTML(data) {
  return new Promise((resolve, reject) => {
    const viewPath = path.join(__dirname, "views", "template.ejs");
    renderFile(viewPath, data, (err, str) => {
      if (err) reject(err);
      else resolve(str);
    });
  });
}


async function generatePDF(html) {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });

  const pdf = await page.pdf({
    format: "A4",
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    printBackground: true,
  });

  await browser.close();
  return pdf;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
