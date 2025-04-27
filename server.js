import express from 'express';
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderFile } from 'ejs';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.engine('ejs', renderFile);

// POST /invoice
app.post('/invoice', async (req, res) => {
  const requiredFields = ['invoiceFrom', 'invoiceTo'];
  for (let field of requiredFields) {
    if (!req.body[field]) {
      return res.status(400).json({ message: `${field} is required` });
    }
  }

  try {
    const html = await renderInvoiceHTML(req.body);
    const pdf = await generatePDF(html);

    const filename = `invoice-from-${req.body.invoiceId || 'unknown'}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'PDF generation failed' });
  }
});

async function renderInvoiceHTML(data) {
  return new Promise((resolve, reject) => {
    const viewPath = path.join(__dirname, 'views', 'template.ejs');
    renderFile(viewPath, data, (err, str) => {
      if (err) reject(err);
      else resolve(str);
    });
  });
}

async function generatePDF(html) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });

  await browser.close();
  return pdf;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
