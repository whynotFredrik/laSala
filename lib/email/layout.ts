/**
 * Shared HTML wrapper for all transactional emails. Keeps templates focused
 * on copy; the layout handles header, footer, basic styles, and the
 * "this email was sent because..." note required for transactional opt-in.
 */

import { BUSINESS } from "@/lib/constants"

export function renderEmailLayout({
  heading,
  body,
}: {
  heading: string
  body: string
}): { html: string; plainText: string } {
  const html = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:24px 28px 0;">
              <p style="margin:0;font-size:14px;font-weight:600;letter-spacing:0.04em;color:#64748b;text-transform:uppercase;">
                ${BUSINESS.name}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;">
              <h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;">
                ${escapeHtml(heading)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;font-size:15px;line-height:1.55;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;border-top:1px solid #e4e4e7;">
              <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
                ${BUSINESS.address} · ${BUSINESS.phone}<br>
                <a href="https://${BUSINESS.domain}" style="color:#64748b;">${BUSINESS.domain}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // Crude plain-text fallback. We strip tags rather than re-author copy; the
  // body is already short and skim-friendly.
  const plainText = [
    BUSINESS.name,
    "",
    heading,
    "",
    body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    "",
    `${BUSINESS.address} · ${BUSINESS.phone}`,
    `https://${BUSINESS.domain}`,
  ].join("\n")

  return { html, plainText }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function escape(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return ""
  return escapeHtml(String(s))
}
