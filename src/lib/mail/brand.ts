// Shared logo header for transactional emails. Email clients need an absolute
// image URL, so this points at the deployed app's public/ folder.
export function emailBrandHeader() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `<p style="margin:0 0 24px;"><img src="${base}/logo-full.png" alt="OwnReach" width="160" style="display:block;height:auto;border:0;" /></p>`;
}
