import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { config } from '../config.js';

/** A one-page placeholder PDF, clearly marked as fake demo data. */
export function demoPdf(title: string, lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fillColor('#a1251b').font('Helvetica-Bold').fontSize(11).text('DEMO DOCUMENT: NOT A REAL CERTIFICATE');
    doc.moveDown(1.5).fillColor('#1c2830').fontSize(20).text(title);
    doc.moveDown().font('Helvetica').fontSize(11);
    for (const l of lines) doc.text(l).moveDown(0.3);
    doc.end();
  });
}

/** Writes a file into STORAGE_DIR the same way uploads are stored (random name, private). */
export async function storeDemoFile(buffer: Buffer) {
  const now = new Date();
  const key = `files/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
  const full = path.join(path.resolve(config().STORAGE_DIR), key);
  await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  await writeFile(full, buffer, { mode: 0o600 });
  return { key, size: buffer.length };
}
