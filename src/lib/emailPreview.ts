// Shows an email the way different mail apps would, for the Compose preview. Only used
// in the admin preview; sent emails are untouched.

export type PreviewMode = "light" | "dark" | "gmail";

/** A media query that never matches, to switch the email's own dark styles off. */
const NEVER = "(max-width: 0px)";

// Rough imitation of the Gmail app's automatic dark mode: it ignores the email's dark
// styles and darkens light backgrounds and dark text on its own. Images are untouched.
const GMAIL_DARK = `
  body, .dcw-page, [style*="background:#f7f2eb"], [style*="background:#efe3d1"] { background: #121212 !important; }
  .dcw-card, [style*="background:#ffffff"], [style*="background:#fdf8ef"], [style*="background:#fbf6ec"] { background: #1e1e1e !important; }
  .dcw-ink, .dcw-muted, [style*="color:#211a16"], [style*="color:#6f655e"], [style*="color:#958a82"] { color: #e3e3e3 !important; }
`;

export function previewInMode(html: string, mode: PreviewMode): string {
  if (mode === "dark") {
    // What Apple Mail / iPhone Mail / Outlook for Mac show: the email's own dark design,
    // or, for emails without one (the standard letter), their automatic darkening.
    if (html.includes("(prefers-color-scheme: dark)")) return html.replaceAll("(prefers-color-scheme: dark)", "all");
    return html.replace("</head>", `<style>${GMAIL_DARK}</style></head>`);
  }
  // Light preview must stay light even when the admin's own computer is in dark mode.
  const light = html.replaceAll("(prefers-color-scheme: dark)", NEVER);
  if (mode === "light") return light;
  return light.replace("</head>", `<style>${GMAIL_DARK}</style></head>`);
}
