/**
 * Core types for SPFX-Pretty. Nothing in /core depends on the VS Code API,
 * so the same engine powers the extension and the CLI (handy for pipelines).
 */

export type Severity = 'error' | 'warning' | 'info' | 'pass';

export type Category = 'Title' | 'Icon' | 'Metadata' | 'Branding' | 'Teams';

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
}
