import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Database, Check, ExternalLink, LogOut, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'backendforge_supabase_oauth';
const OAUTH_CLIENT_ID_KEY = 'backendforge_sb_client_id';

interface OAuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
  created_at: string;
}

interface SelectedProject {
  ref: string;
  name: string;
  url: string;
  anonKey: string;
}

const getStoredAuth = (): OAuthState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

const storeAuth = (auth: OAuthState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
};

const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getSelectedSupabaseProject = (): SelectedProject | null => {
  try {
    const raw = localStorage.getItem('backendforge_sb_selected_project');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const storeSelectedProject = (project: SelectedProject) => {
  localStorage.setItem('backendforge_sb_selected_project', JSON.stringify(project));
};

const ConnectSupabase = () => {
  const [auth, setAuth] = useState<OAuthState | null>(getStoredAuth);
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(getSelectedSupabaseProject);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectingRef, setSelectingRef] = useState<string | null>(null);

  const redirectUri = `${window.location.origin}/connect-supabase`;

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !auth) {
      handleCodeExchange(code);
      window.history.replaceState({}, '', '/connect-supabase');
    }
  }, []);

  // Load projects when authenticated
  useEffect(() => {
    if (auth) {
      loadProjects();
    }
  }, [auth]);

  const handleCodeExchange = async (code: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('supabase-oauth', {
        body: { code, redirectUri },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const oauthState: OAuthState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      storeAuth(oauthState);
      setAuth(oauthState);
      toast.success('Supabase account connected!');
    } catch (err: any) {
      toast.error(err.message || 'OAuth failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // The client ID should be configured — we use VITE env or a known value
    const clientId = import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID;
    if (!clientId) {
      toast.error('Supabase OAuth Client ID not configured. Add VITE_SUPABASE_OAUTH_CLIENT_ID to your .env');
      return;
    }
    const authUrl = `https://api.supabase.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=all`;
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    clearAuth();
    setAuth(null);
    setProjects([]);
    setSelectedProject(null);
    localStorage.removeItem('backendforge_sb_selected_project');
    toast.success('Disconnected from Supabase');
  };

  const loadProjects = async () => {
    if (!auth) return;
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase.functions.invoke('supabase-manage', {
        body: { action: 'list-projects', accessToken: auth.accessToken },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setProjects(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSelectProject = async (proj: SupabaseProject) => {
    if (!auth) return;
    setSelectingRef(proj.id);
    try {
      // Get API keys for the project
      const { data: keys, error } = await supabase.functions.invoke('supabase-manage', {
        body: { action: 'get-api-keys', accessToken: auth.accessToken, projectRef: proj.id },
      });
      if (error) throw error;
      if (keys.error) throw new Error(keys.error);

      const anonKey = Array.isArray(keys) 
        ? keys.find((k: any) => k.name === 'anon')?.api_key || ''
        : '';

      const selected: SelectedProject = {
        ref: proj.id,
        name: proj.name,
        url: `https://${proj.id}.supabase.co`,
        anonKey,
      };
      storeSelectedProject(selected);
      setSelectedProject(selected);
      toast.success(`Connected to "${proj.name}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to select project');
    } finally {
      setSelectingRef(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Connect Supabase</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Link your Supabase account to directly create and manage databases from BackendForge.
        </p>

        {/* Step 1: OAuth Connection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Supabase Account
              {auth && <Badge variant="default" className="text-xs">Connected</Badge>}
            </CardTitle>
            <CardDescription>
              {auth
                ? 'Your Supabase account is connected. You can manage your projects below.'
                : 'Connect your Supabase account to enable direct database management.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </div>
            ) : auth ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadProjects} disabled={loadingProjects}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingProjects ? 'animate-spin' : ''}`} />
                  Refresh Projects
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={handleConnect} size="sm">
                <Database className="h-3.5 w-3.5 mr-1.5" />
                Connect Supabase Account
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Project Selection */}
        {auth && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Your Supabase Projects</CardTitle>
              <CardDescription>
                Select a project to use with BackendForge. Schema will be applied directly via the Management API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects found. Create one at supabase.com first.</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        selectedProject?.ref === proj.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{proj.name}</span>
                          <Badge variant="outline" className="text-xs">{proj.region}</Badge>
                          {proj.status !== 'ACTIVE_HEALTHY' && (
                            <Badge variant="secondary" className="text-xs">{proj.status}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{proj.id}</p>
                      </div>
                      {selectedProject?.ref === proj.id ? (
                        <Badge variant="default" className="shrink-0">
                          <Check className="h-3 w-3 mr-1" /> Selected
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectProject(proj)}
                          disabled={selectingRef === proj.id}
                        >
                          {selectingRef === proj.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Select'
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Selected Project Info */}
        {selectedProject && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Active Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Project</span>
                  <p className="font-medium">{selectedProject.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Reference</span>
                  <p className="font-mono text-xs">{selectedProject.ref}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">URL</span>
                  <p className="font-mono text-xs">{selectedProject.url}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Go to any project's Deploy tab — you can now apply schemas with one click, no database URL needed.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://supabase.com/dashboard/project/${selectedProject.ref}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in Supabase Dashboard
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ConnectSupabase;
