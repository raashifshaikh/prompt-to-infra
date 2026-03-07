export interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  primary_key?: boolean;
  references?: string;
}

export interface DatabaseTable {
  name: string;
  columns: TableColumn[];
}

export interface ApiRoute {
  method: string;
  path: string;
  description: string;
  auth_required?: boolean;
}

export interface GenerationResult {
  tables: DatabaseTable[];
  routes: ApiRoute[];
  auth: {
    enabled: boolean;
    providers: string[];
    roles: string[];
  };
  features: string[];
}

export interface Project {
  id: string;
  name: string;
  backendType: 'supabase' | 'firebase' | 'local' | 'cloud';
  prompt: string;
  result: GenerationResult | null;
  createdAt: string;
  status: 'generating' | 'ready' | 'deployed' | 'error';
}
