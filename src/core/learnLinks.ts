/**
 * Microsoft Learn articles for each rule (all checked on learn.microsoft.com, 17/11/2026).
 * Shown as "Microsoft articles" on the website, in the VS Code FAQ and in docs/faq/*.md.
 */
export interface LearnLink { title: string; url: string }

const SP = 'https://learn.microsoft.com/sharepoint/dev/spfx/';
const A = {
  packaging: { title: 'SharePoint solution packaging (package-solution.json)', url: SP + 'web-parts/basics/notes-on-solution-packaging' },
  checklist: { title: 'Prepare your SPFx app for publishing (naming, descriptions, metadata)', url: SP + 'publish-to-marketplace-checklist' },
  validation: { title: 'Common validation errors when publishing an SPFx app', url: SP + 'publish-to-marketplace-common-validation-errors' },
  teamDev: { title: 'Team-based development on the SharePoint Framework (versions)', url: SP + 'team-based-development-on-sharepoint-framework' },
  preconfigured: { title: 'Simplify adding web parts with preconfigured entries (title, description, icon, group)', url: SP + 'web-parts/guidance/simplify-adding-web-parts-with-preconfigured-entries' },
  webPartIcon: { title: 'Configure web part icon', url: SP + 'web-parts/basics/configure-web-part-icon' },
  extensionIcon: { title: 'Configure extension icon (command sets)', url: SP + 'extensions/basics/configure-extension-icon' },
  commandSet: { title: 'Build your first ListView Command Set extension', url: SP + 'extensions/get-started/building-simple-cmdset-with-dialog-api' },
  extension: { title: 'Build your first SharePoint Framework extension', url: SP + 'extensions/get-started/build-a-hello-world-extension' },
  tenantWide: { title: 'Tenant-wide deployment of SPFx extensions', url: SP + 'extensions/basics/tenant-wide-deployment-extensions' },
  teamsTab: { title: 'Build a Microsoft Teams tab using SPFx (Teams icons)', url: SP + 'web-parts/get-started/using-web-part-as-ms-teams-tab' },
  teamsDeploy: { title: 'Deployment options for SPFx solutions in Microsoft Teams', url: SP + 'deployment-spfx-teams-solutions' },
  teamsIcons: { title: 'Teams app package - app icons (192px colour, 32px outline)', url: 'https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/apps-package' },
  propertyPane: { title: 'Make your web part configurable (property pane)', url: SP + 'web-parts/basics/integrate-with-property-pane' },
  localize: { title: 'Localize SharePoint Framework web parts', url: SP + 'web-parts/guidance/localize-web-parts' },
  compat: { title: 'SPFx compatibility reference (Node, React, TypeScript)', url: SP + 'compatibility' },
  setup: { title: 'Set up your SharePoint Framework development environment', url: SP + 'set-up-your-development-environment' },
  react18: { title: 'Upgrade to React 18 (SPFx 1.24)', url: SP + 'react-18-upgrade' },
  heft: { title: 'Migrate from the Gulp toolchain to Heft', url: SP + 'toolchain/migrate-gulptoolchain-hefttoolchain' },
  debugToolbar: { title: 'SharePoint Framework Debug Toolbar (replaces the hosted workbench)', url: SP + 'debug-toolbar' },
  debugPages: { title: 'Debug SPFx solutions on modern SharePoint pages', url: SP + 'debug-modern-pages' },
  fluent: { title: 'Using Fluent UI in SharePoint Framework', url: SP + 'fluent-ui-integration' },
  sectionBackgrounds: { title: 'Supporting section backgrounds (theme variants)', url: SP + 'web-parts/guidance/supporting-section-backgrounds' },
  themeColors: { title: 'Use theme colours in your SPFx customizations', url: SP + 'use-theme-colors-in-your-customizations' },
  semanticSlots: { title: 'Designing for section backgrounds using semantic slots', url: 'https://learn.microsoft.com/sharepoint/dev/design/semantic_slots' },
  brandFonts: { title: 'Use SharePoint Brand Center fonts in SPFx solutions', url: 'https://learn.microsoft.com/sharepoint/dev/design/use-brand-center-fonts-in-spfx-components' },
  brandCenter: { title: 'SharePoint Brand Center overview', url: 'https://learn.microsoft.com/sharepoint/brand-center-overview' },
} satisfies Record<string, LearnLink>;

const BY_RULE: Record<string, LearnLink[]> = {
  SOL001: [A.packaging, A.checklist], SOL002: [A.packaging, A.checklist], SOL003: [A.packaging],
  SOL004: [A.checklist, A.validation], SOL005: [A.checklist, A.validation], SOL006: [A.checklist, A.validation],
  SOL007: [A.checklist], SOL008: [A.validation, A.checklist],
  SOL010: [A.packaging, A.checklist], SOL011: [A.packaging], SOL012: [A.packaging], SOL015: [A.packaging, A.checklist],
  SOL013: [A.teamDev, A.packaging], SOL014: [A.checklist, A.packaging],
  CMP001: [A.preconfigured, A.localize], CMP002: [A.preconfigured, A.localize],
  CMP003: [A.webPartIcon, A.preconfigured], CMP004: [A.webPartIcon, A.preconfigured], CMP005: [A.webPartIcon],
  CMP006: [A.preconfigured],
  CMD001: [A.commandSet, A.localize], CMD002: [A.extensionIcon, A.commandSet],
  TMS001: [A.teamsTab, A.teamsIcons, A.teamsDeploy], TMS002: [A.teamsIcons, A.teamsTab],
  DEF001: [A.preconfigured, A.propertyPane], DEF002: [A.propertyPane, A.localize], DEF003: [A.packaging],
  DEF004: [A.packaging], DEF005: [A.extension, A.tenantWide], DEF006: [A.propertyPane, A.preconfigured],
  PRP001: [A.propertyPane, A.preconfigured], PRP002: [A.preconfigured, A.propertyPane], PRP003: [A.propertyPane], PRP004: [A.localize],
  VER001: [A.compat, A.setup], VER002: [A.compat, A.teamDev], VER003: [A.compat, A.react18], VER004: [A.compat],
  VER005: [A.setup, A.compat], VER006: [A.heft], VER007: [A.debugToolbar, A.debugPages], VER008: [A.compat, A.teamDev],
  VER009: [A.fluent], VER010: [A.react18, A.compat], VER011: [A.react18],
  ABT001: [A.propertyPane], ABT002: [A.propertyPane],
  BRD001: [A.sectionBackgrounds, A.semanticSlots], BRD002: [A.sectionBackgrounds, A.themeColors], BRD003: [A.themeColors],
  BRD004: [A.brandFonts, A.brandCenter], BRD005: [A.brandFonts, A.brandCenter], BRD006: [A.themeColors, A.sectionBackgrounds],
  BRD007: [A.fluent, A.themeColors],
};

/** Microsoft articles for a rule; `extra` (the rule's own learnMore) goes first, no duplicates. */
export function learnLinks(ruleId: string, extra?: string): LearnLink[] {
  const list = [...(BY_RULE[ruleId] ?? [])];
  if (extra && !list.some(l => l.url === extra)) {
    const known = Object.values(A).find(l => l.url === extra);
    list.unshift(known ?? { title: 'Microsoft Learn', url: extra });
  }
  return list;
}
