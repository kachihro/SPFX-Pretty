/**
 * Core types for SPFX-Pretty. Nothing in /core depends on the VS Code API,
 * so the same engine powers the extension and the CLI (handy for pipelines).
 */

export type Severity = 'error' | 'warning' | 'info' | 'pass';

export type Category = 'Title' | 'Icon' | 'Defaults' | 'Properties' | 'Versions' | 'Metadata' | 'Teams' | 'Branding';

/** Places in Microsoft 365 where people actually see the value a finding is about. */
export type Surface =
  | 'App Catalog' | 'Add an app' | 'Site Contents' | 'Site features'
  | 'Toolbox' | 'Web part on page' | 'Property pane' | 'Command bar' | 'Teams' | 'Tenant Wide Extensions';

/** A text replacement inside an existing file (offsets are 0-based character offsets). */
export interface TextEdit {
  file: string;
  offset: number;
  length: number;
  newText: string;
}

/** A new (or overwritten) file, e.g. a generated icon. */
export interface FileCreate {
  file: string;
  /** base64 for binary content, utf8 otherwise */
  content: string;
  encoding: 'base64' | 'utf8';
}

export interface Fix {
  title: string;
  /** Safe fixes are applied by "Apply All Safe Fixes". Unsafe ones need a human (e.g. wording). */
  safe: boolean;
  edits: TextEdit[];
  creates?: FileCreate[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: Category;
  message: string;
  /** Extra guidance shown in hovers / report */
  detail?: string;
  file: string;
  offset?: number;
  length?: number;
  /** Which component this relates to (web part title / alias), if any */
  component?: string;
  fixes: Fix[];
  /** Where people see this (filled in by the scanner from the rule id). */
  surfaces?: Surface[];
  /** Importance used for the niceness score (3 = big deal, 1 = polish). */
  weight?: number;
}

export type ComponentKind =
  | 'WebPart'
  | 'AdaptiveCardExtension'
  | 'ApplicationCustomizer'
  | 'ListViewCommandSet'
  | 'FieldCustomizer'
  | 'FormCustomizer'
  | 'SearchQueryModifier'
  | 'Library'
  | 'Unknown';

export interface ComponentInfo {
  kind: ComponentKind;
  id: string;
  alias: string;
  manifestFile: string;
  title?: string;
  description?: string;
  group?: string;
  groupId?: string;
  officeFabricIconFontName?: string;
  iconImageUrl?: string;
  supportedHosts: string[];
  supportsThemeVariants?: boolean;
  /** Folder containing the component's source (manifest folder) */
  folder: string;
  /** For command sets: the commands */
  commands?: { key: string; title?: string; iconImageUrl?: string }[];
}

export interface SolutionInfo {
  file: string;
  name?: string;
  id?: string;
  version?: string;
  iconPath?: string;
  /** Resolved absolute icon path if found */
  iconFile?: string;
  iconDataUri?: string;
  shortDescription?: string;
  longDescription?: string;
  developerName?: string;
  categories: string[];
}

export interface ProjectConfig {
  brandColour: string;
  toolboxGroup: string;
  /** Latest SPFx version (from npm when online, else the bundled table). */
  latestSpfxVersion?: string;
  /** Company logo (PNG) used for the App Catalog icon and About panel, relative to the project or absolute. */
  companyIcon?: string;
  /** Extra brand spellings, e.g. ["PlanB", "SharePoint"] */
  brandWords?: string[];
  /** Optional prefix so all your org's apps sort together, e.g. "Contoso - " */
  appNamePrefix: string;
  developer: {
    name: string;
    websiteUrl: string;
    privacyUrl: string;
    termsOfUseUrl: string;
    mpnId: string;
  };
  disabledRules: string[];
}

export const DEFAULT_CONFIG: ProjectConfig = {
  brandColour: '#0F6CBD',
  toolboxGroup: '',
  appNamePrefix: '',
  developer: { name: '', websiteUrl: '', privacyUrl: '', termsOfUseUrl: '', mpnId: 'Undefined-1.0.0' },
  disabledRules: [],
};

export interface ScanResult {
  root: string;
  spfxVersion?: string;
  solution?: SolutionInfo;
  components: ComponentInfo[];
  findings: Finding[];
  /** 0-100 "niceness" score */
  score: number;
  preview: PreviewData;
  upgrade?: UpgradeAssessment;
}

export interface UpgradeStep {
  title: string;
  effort: 'S' | 'M' | 'L';
  detail: string;
  link?: string;
}

export interface UpgradeAssessment {
  current: string;
  latest: string;
  toolchain: 'gulp' | 'heft';
  /** Releases between current and latest, oldest first */
  hops: string[];
  steps: UpgradeStep[];
  effort: 'None' | 'Small' | 'Medium' | 'Large';
  /** CLI for Microsoft 365 command that produces the detailed upgrade report */
  command: string;
  compat: {
    node: { current: number[]; target: number[] };
    react: { current?: string; target?: string };
    typescript: { current?: string; target?: string };
  };
}

/** Extra values used to draw the App Catalog / Site Contents / property pane previews. */
export interface PreviewData {
  /** File name shown in the App Catalog "Name" column */
  packageFile: string;
  /** true = deployed tenant-wide: hidden from "Add an app" and Site Contents */
  skipFeatureDeployment: boolean;
  propertyPanes: { component: string; header?: string; group?: string; label?: string; defaults: Record<string, string> }[];
}
