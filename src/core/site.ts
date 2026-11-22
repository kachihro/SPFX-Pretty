/**
 * The public help website (built with `npm run site`, hosted on Azure).
 * Set this once the site is live - then the in-editor FAQ links to each rule's page, and the
 * Marketplace README uses the site's public images.
 * Leave empty until then: online links are hidden and README images are embedded.
 */
export const DOCS_SITE: string = 'https://www.spfxpretty.com';

export function ruleUrl(id: string): string | undefined {
  return DOCS_SITE ? `${DOCS_SITE.replace(/\/$/, '')}/faq/${id}.html` : undefined;
}
