export interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  primary_key?: boolean;
  references?: string;
  on_delete?: string;
  unique?: boolean;
}

export interface DatabaseTable {
  name: string;
  columns: TableColumn[];
}

export interface EnumType {
  name: string;
  values: string[];
}

export interface IndexDef {
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface ApiRoute {
  method: string;
  path: string;
  description: string;
  auth_required?: boolean;
}

export interface TutorialStep {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface GenerationResult {
  tables: DatabaseTable[];
  enums?: EnumType[];
  indexes?: IndexDef[];
  routes: ApiRoute[];
  auth: {
    enabled: boolean;
    providers: string[];
    roles: string[];
  };
  features: string[];
  dockerfile?: string;
  dockerCompose?: string;
  envTemplate?: string;
  integrationGuide?: TutorialStep[];
}

export interface RailwayDeployment {
  projectId: string;
  projectName: string;
  url: string;
  status: 'creating' | 'deploying' | 'running' | 'failed';
}

export interface Project {
  id: string;
  name: string;
  backendType: 'supabase' | 'firebase' | 'local' | 'cloud';
  prompt: string;
  result: GenerationResult | null;
  createdAt: string;
  status: 'generating' | 'ready' | 'deployed' | 'error';
  supabaseConfig?: { url: string; anonKey: string; serviceRoleKey: string; connected: boolean };
  firebaseConfig?: { projectId: string; serviceAccountJson: string; connected: boolean };
  railwayDeployment?: RailwayDeployment;
  repoSource?: { type: 'github' | 'upload'; url?: string; analyzedAt?: string };
}
