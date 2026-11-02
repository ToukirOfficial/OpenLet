import PDFDocument from 'pdfkit';
import { formatDate, formatPence, type LedgerRow } from '@openlet/shared';

export interface StatementData {
  workspace: { name: string; address: string | null; contactEmail: string | null; contactPhone: string | null };
  logo: Buffer | null;
  tenantNames: string;
  address: string;
  from: string;
  to: string;
  openingPence: number;
  rows: LedgerRow[];
  closingPence: number;
  generatedOn: string;
}

const DOOR = '#135e4b';
const SLATE = '#1c2830';
const SOFT = '#5b6670';
const LINE = '#dadfd6';

const money = (p: number) => (p < 0 ? `-${formatPence(-p)}` : formatPence(p));
const balanceWords = (p: number) => (p > 0 ? `${formatPence(p)} owed` : p < 0 ? `${formatPence(-p)} in credit` : 'Nothing owed');

/** A rent statement (or receipt) for a date range, as an A4 PDF. */
export function statementPdf(d: StatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Rent statement ${d.from} to ${d.to}`, Author: d.workspace.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 48;
    const width = doc.page.width - 96;
    if (d.logo) {
      try {
        doc.image(d.logo, left, 44, { fit: [140, 44] });
      } catch {
        // An unreadable logo shouldn't stop the statement.
      }
    }
    doc.fillColor(DOOR).font('Helvetica-Bold').fontSize(13).text(d.workspace.name, left, 48, { width, align: 'right' });
    doc.fillColor(SOFT).font('Helvetica').fontSize(9);
    for (const line of [d.workspace.address, d.workspace.contactEmail, d.workspace.contactPhone].filter(Boolean) as string[]) doc.text(line, { width, align: 'right' });

    doc.moveDown(2.2);
    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(20).text('Rent statement', left);
    doc.font('Helvetica').fontSize(10).fillColor(SOFT).text(`${formatDate(d.from)} to ${formatDate(d.to)}`);
    doc.moveDown(0.8);
    doc.fillColor(SLATE).fontSize(10).text(`Tenant${d.tenantNames.includes(' and ') ? 's' : ''}: ${d.tenantNames}`);
    doc.text(`Property: ${d.address}`);
    doc.moveDown(1);

    const cols = [
      { label: 'Date', x: left, w: 96 },
      { label: 'Description', x: left + 96, w: 206 },
      { label: 'Charged', x: left + 304, w: 70, right: true },
      { label: 'Paid', x: left + 376, w: 70, right: true },
      { label: 'Balance', x: left + 448, w: width - 448, right: true },
    ];
    const header = () => {
      const y = doc.y;
      doc.rect(left, y - 4, width, 20).fill('#f1f2ee');
      doc.fillColor(SOFT).font('Helvetica-Bold').fontSize(8.5);
      for (const c of cols) doc.text(c.label, c.x + 4, y + 2, { width: c.w - 8, align: c.right ? 'right' : 'left' });
      doc.y = y + 22;
    };
    const row = (cells: string[], bold = false) => {
      if (doc.y > doc.page.height - 90) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      doc.fillColor(SLATE).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      let h = 0;
      cols.forEach((c, i) => {
        doc.text(cells[i] ?? '', c.x + 4, y, { width: c.w - 8, align: c.right ? 'right' : 'left' });
        h = Math.max(h, doc.y - y);
      });
      doc.y = y + h + 5;
      doc.moveTo(left, doc.y - 2).lineTo(left + width, doc.y - 2).strokeColor(LINE).lineWidth(0.5).stroke();
    };

    header();
    row([formatDate(d.from), 'Balance brought forward', '', '', money(d.openingPence)], true);
    let running = d.openingPence;
    for (const r of d.rows) {
      running += r.signedPence;
      row([formatDate(r.date), r.description + (r.reference ? ` (${r.reference})` : ''), r.signedPence > 0 ? formatPence(r.signedPence) : '', r.signedPence < 0 ? formatPence(-r.signedPence) : '', money(running)]);
    }
    if (!d.rows.length) row(['', 'No charges or payments in this period', '', '', '']);

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(d.closingPence > 0 ? '#a1251b' : DOOR).text(`Balance on ${formatDate(d.to)}: ${balanceWords(d.closingPence)}`, left);
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor(SOFT).text(`Produced on ${formatDate(d.generatedOn)} by ${d.workspace.name} using OpenLet. Amounts in pounds sterling.`, left, doc.page.height - 70, { width });
    doc.end();
  });
}
