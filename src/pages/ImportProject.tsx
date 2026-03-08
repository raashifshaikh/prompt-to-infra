import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/context/ProjectContext';
import { toast } from 'sonner';
import { Loader2, Github, Upload, ArrowRight, FolderTree, Database, Globe, CheckCircle2, LogOut } from 'lucide-react';
import { Project } from '@/types/project';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

const ImportProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addProject, updateProject } = useProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // GitHub OAuth state
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string; name?: string } | null>(null);
  const [exchangingToken, setExchangingToken] = useState(false);

  // Load GitHub user info from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('github_user');
    if (storedUser && githubToken) {
      try {
        setGithubUser(JSON.parse(storedUser));
      } catch { /* ignore */ }
    }
  }, [githubToken]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !githubToken && !exchangingToken) {
      setExchangingToken(true);
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('github-auth', {
            body: { code },
          });
          if (error) throw error;
          if (data.access_token) {
            localStorage.setItem('github_token', data.access_token);
            setGithubToken(data.access_token);
            if (data.user) {
              localStorage.setItem('github_user', JSON.stringify(data.user));
              setGithubUser(data.user);
            }
            toast.success(`Connected as ${data.user?.login || 'GitHub user'}`);
            // Clean up URL
            window.history.replaceState({}, '', '/import');
          }
        } catch (err: any) {
          toast.error(err.message || 'Failed to connect GitHub');
        } finally {
          setExchangingToken(false);
        }
      })();
    }
  }, [searchParams, githubToken, exchangingToken]);

  const handleConnectGitHub = () => {
    const redirectUri = `${window.location.origin}/import`;
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
    window.location.href = url;
  };

  const handleDisconnectGitHub = () => {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
    setGithubToken(null);
    setGithubUser(null);
    toast.success('GitHub disconnected');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileContents: Record<string, string> = {};
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 20MB limit`);
        continue;
      }
      try {
        const text = await file.text();
        fileContents[file.webkitRelativePath || file.name] = text;
      } catch {
        // Skip binary files
      }
    }
    setUploadedFiles(fileContents);
    toast.success(`${Object.keys(fileContents).length} files loaded`);
  };

  const handleAnalyze = async () => {
    if (!githubUrl && Object.keys(uploadedFiles).length === 0) {
      toast.error('Provide a GitHub URL or upload files');
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-repo', {
        body: {
          githubUrl: githubUrl || undefined,
          uploadedFiles: Object.keys(uploadedFiles).length > 0 ? uploadedFiles : undefined,
          githubToken: githubToken || undefined,
        },
      });

      if (error) throw error;
      setAnalysis(data);
      toast.success('Analysis complete!');
    } catch (err: any) {
      console.error('Analysis error:', err);
      toast.error(err.message || 'Failed to analyze project');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateFromAnalysis = async () => {
    if (!analysis) return;

    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: analysis.prompt?.slice(0, 50) || 'Imported Project',
      backendType: analysis.suggestedBackendType || 'supabase',
      prompt: analysis.prompt || '',
      result: null,
      createdAt: new Date().toISOString(),
      status: 'generating',
      repoSource: {
        type: githubUrl ? 'github' : 'upload',
        url: githubUrl || undefined,
        analyzedAt: new Date().toISOString(),
      },
    };

    addProject(project);

    try {
      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt: analysis.prompt, backendType: analysis.suggestedBackendType },
      });

      if (error) throw error;

      updateProject(projectId, {
        result: data.result,
        status: 'ready',
        name: data.projectName || project.name,
      });

      toast.success('Backend generated from your project!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      updateProject(projectId, { status: 'error' });
      toast.error(err.message || 'Generation failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import Project</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Analyze an existing frontend project and generate a matching backend.
        </p>

        <div className="space-y-6">
          {/* GitHub Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Github className="h-4 w-4" /> GitHub Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {githubToken && githubUser ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={githubUser.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {githubUser.login}
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      </p>
                      <p className="text-xs text-muted-foreground">Private repo access enabled</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleDisconnectGitHub}>
                    <LogOut className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Connect GitHub to analyze private repositories. Public repos work without connection.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnectGitHub}
                    disabled={exchangingToken || !GITHUB_CLIENT_ID}
                  >
                    {exchangingToken ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Connecting...</>
                    ) : (
                      <><Github className="h-3.5 w-3.5 mr-1.5" /> Connect GitHub</>
                    )}
                  </Button>
                  {!GITHUB_CLIENT_ID && (
                    <p className="text-xs text-muted-foreground">GitHub Client ID not configured.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* GitHub URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Github className="h-4 w-4" /> GitHub Repository
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/user/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {githubToken ? 'Public and private repositories supported.' : 'Public repositories only. Connect GitHub for private repos.'}
              </p>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept=".ts,.tsx,.js,.jsx,.json,.html,.css,.md,.yaml,.yml,.toml,.env,.txt"
              />
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Click to upload project files</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .ts, .tsx, .js, .json, .html, .css (max 20MB each)</p>
              </div>
              {Object.keys(uploadedFiles).length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline">{Object.keys(uploadedFiles).length} files loaded</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setUploadedFiles({})}>Clear</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analyze Button */}
          <Button
            className="w-full h-11"
            onClick={handleAnalyze}
            disabled={analyzing || (!githubUrl && Object.keys(uploadedFiles).length === 0)}
          >
            {analyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing project...</>
            ) : (
              <><FolderTree className="h-4 w-4 mr-2" /> Analyze & Suggest Backend</>
            )}
          </Button>

          {/* Analysis Results */}
          {analysis && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.detectedStack && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Detected Tech Stack</h3>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(analysis.detectedStack).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.tables && analysis.tables.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" /> Suggested Tables
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {analysis.tables.map((t: any) => (
                        <Badge key={t.name} variant="secondary" className="font-mono text-xs">
                          {t.name} ({t.columns?.length || 0} cols)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.routes && analysis.routes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" /> Suggested Routes
                    </h3>
                    <div className="space-y-1">
                      {analysis.routes.slice(0, 8).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <Badge variant="outline" className="min-w-[50px] justify-center">{r.method}</Badge>
                          <span className="text-muted-foreground">{r.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.features && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Detected Features</h3>
                    <div className="flex gap-2 flex-wrap">
                      {analysis.features.map((f: string) => (
                        <Badge key={f} variant="outline">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.reasoning && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground">{analysis.reasoning}</p>
                  </div>
                )}

                <Button className="w-full" onClick={handleGenerateFromAnalysis}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Generate Backend ({analysis.suggestedBackendType || 'supabase'})
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ImportProject;
