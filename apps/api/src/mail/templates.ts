import { LEGAL_NOTE } from '@openlet/shared';

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * One simple, readable email layout. `from` is the workspace name (the landlord or agency), shown at the
 * top so tenants know who it's from. Paragraphs are plain text and are escaped.
 */
export function email(opts: {
  subject: string;
  from: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
  legal?: boolean;
}): EmailContent {
  const footer = [opts.footnote, opts.legal ? LEGAL_NOTE : undefined].filter(Boolean) as string[];
  const text = [
    opts.heading,
    '',
    ...opts.paragraphs.flatMap((p) => [p, '']),
    ...(opts.button ? [`${opts.button.label}: ${opts.button.url}`, ''] : []),
    ...footer.flatMap((f) => [f, '']),
    `Sent by ${opts.from} using OpenLet.`,
  ].join('\n');
  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f2a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e1d8">
<tr><td style="padding:20px 28px;border-bottom:1px solid #eee7dc;font-weight:bold;color:#0f5c4d;font-size:15px">${esc(opts.from)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1f2a2e">${esc(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n')}
${opts.button ? `<p style="margin:24px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#0f5c4d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:15px">${esc(opts.button.label)}</a></p>` : ''}
${footer.map((f) => `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7378">${esc(f)}</p>`).join('\n')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eee7dc;font-size:12px;color:#8a9196">Sent by ${esc(opts.from)} using OpenLet.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: opts.subject, text, html };
}
