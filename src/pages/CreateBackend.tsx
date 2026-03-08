import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Github, FileText, Upload, FolderTree, Database, Globe, ArrowRight, CheckCircle2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Project } from '@/types/project';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

const examplePrompts = [
  'Create a blog platform with user auth, posts, comments, and likes. Include role-based access for admin and editor.',
  'Build an e-commerce backend with products, categories, orders, cart, and Stripe payment integration.',
  'Design a project management tool with teams, projects, tasks, and real-time notifications.',
];

const CreateBackend = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addProject, updateProject } = useProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backendType, setBackendType] = useState<string>('supabase');
  const [prompt, setPrompt] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [inputMode, setInputMode] = useState<'prompt' | 'repo' | 'upload'>('prompt');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // GitHub OAuth state
  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string; name?: string } | null>(null);
  const [exchangingToken, setExchangingToken] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('github_user');
    if (storedUser && githubToken) {
      try { setGithubUser(JSON.parse(storedUser)); } catch { /* ignore */ }
    }
  }, [githubToken]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !githubToken && !exchangingToken) {
      setExchangingToken(true);
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('github-auth', { body: { code } });
          if (error) throw error;
          if (data.access_token) {
            localStorage.setItem('github_token', data.access_token);
            setGithubToken(data.access_token);
            if (data.user) {
              localStorage.setItem('github_user', JSON.stringify(data.user));
              setGithubUser(data.user);
            }
            toast.success(`Connected as ${data.user?.login || 'GitHub user'}`);
            window.history.replaceState({}, '', '/create');
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
    const redirectUri = `${window.location.origin}/create`;
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
      if (file.size > 20 * 1024 * 1024) { toast.error(`File ${file.name} exceeds 20MB limit`); continue; }
      try { fileContents[file.webkitRelativePath || file.name] = await file.text(); } catch { /* skip binary */ }
    }
    setUploadedFiles(fileContents);
    toast.success(`${Object.keys(fileContents).length} files loaded`);
  };

  const handleGenerate = async () => {
    if (inputMode === 'prompt') {
      if (!prompt.trim()) { toast.error('Please enter a prompt.'); return; }
      await handlePromptGenerate();
    } else if (inputMode === 'repo') {
      if (!repoUrl.trim()) { toast.error('Please enter a GitHub repository URL.'); return; }
      await handleAnalyzeAndGenerate('repo');
    } else {
      if (Object.keys(uploadedFiles).length === 0) { toast.error('Please upload project files.'); return; }
      await handleAnalyzeAndGenerate('upload');
    }
  };

  const handlePromptGenerate = async () => {
    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
      backendType: backendType as Project['backendType'],
      prompt,
      result: null,
      createdAt: new Date().toISOString(),
      status: 'generating',
    };
    addProject(project);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt, backendType },
      });
      if (error) throw error;
      updateProject(projectId, { result: data.result, status: 'ready', name: data.projectName || project.name });
      toast.success('Backend generated successfully!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      console.error('Generation error:', err);
      updateProject(projectId, { status: 'error' });
      toast.error(err.message || 'Failed to generate backend.');
      setLoading(false);
    }
  };

  const handleAnalyzeAndGenerate = async (source: 'repo' | 'upload') => {
    setLoading(true);
    setAnalysis(null);
    try {
      // Step 1: Analyze
      toast.info('Analyzing project...');
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-repo', {
        body: {
          ...(source === 'repo' ? { githubUrl: repoUrl, repoUrl } : {}),
          ...(source === 'upload' ? { uploadedFiles } : {}),
          githubToken: githubToken || undefined,
        },
      });
      if (analysisError) throw analysisError;
      setAnalysis(analysisData);

      // Step 2: Generate
      toast.info('Generating backend...');
      const genPrompt = analysisData.prompt || `Generate a ${backendType} backend based on: ${JSON.stringify(analysisData, null, 2)}`;
      const projectId = crypto.randomUUID();
      const project: Project = {
        id: projectId,
        name: source === 'repo' ? (repoUrl.split('/').pop() || 'GitHub Project') : 'Uploaded Project',
        backendType: (analysisData.suggestedBackendType || backendType) as Project['backendType'],
        prompt: genPrompt,
        result: null,
        createdAt: new Date().toISOString(),
        status: 'generating',
        repoSource: {
          type: source === 'repo' ? 'github' : 'upload',
          url: source === 'repo' ? repoUrl : undefined,
          analyzedAt: new Date().toISOString(),
        },
      };
      addProject(project);

      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt: genPrompt, backendType: analysisData.suggestedBackendType || backendType },
      });
      if (error) throw error;
      updateProject(projectId, { result: data.result, status: 'ready', name: data.projectName || project.name });
      toast.success('Backend generated!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || 'Failed to analyze/generate.');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Create New Backend</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Describe what you need, provide a GitHub repo, or upload files — AI generates the infrastructure.
        </p>

        <div className="space-y-6">
          {/* Backend Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Backend Type</label>
            <Select value={backendType} onValueChange={setBackendType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="supabase">Supabase</SelectItem>
                <SelectItem value="firebase">Firebase</SelectItem>
                <SelectItem value="local">Local Database</SelectItem>
                <SelectItem value="cloud">Cloud Database</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input Mode Tabs */}
          <Tabs value={inputMode} onValueChange={(v) => { setInputMode(v as any); setAnalysis(null); }}>
            <TabsList className="w-full">
              <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Prompt
              </TabsTrigger>
              <TabsTrigger value="repo" className="flex-1 gap-1.5">
                <Github className="h-3.5 w-3.5" /> GitHub Repo
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Upload Files
              </TabsTrigger>
            </TabsList>

            {/* Prompt Tab */}
            <TabsContent value="prompt" className="mt-4 space-y-4">
              <Textarea
                placeholder="Describe the backend you want to build..."
                className="min-h-[160px] font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div>
                <p className="text-xs text-muted-foreground mb-3">Example prompts:</p>
                <div className="space-y-2">
                  {examplePrompts.map((ex, i) => (
                    <Card key={i} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setPrompt(ex)}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{ex}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Repo Tab */}
            <TabsContent value="repo" className="mt-4 space-y-4">
              {/* GitHub connection */}
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
                        Connect GitHub for private repos. Public repos work without connection.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleConnectGitHub} disabled={exchangingToken || !GITHUB_CLIENT_ID}>
                        {exchangingToken ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Connecting...</>
                        ) : (
                          <><Github className="h-3.5 w-3.5 mr-1.5" /> Connect GitHub</>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Input
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                We'll analyze your frontend code and auto-generate a matching backend.
              </p>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-4 space-y-4">
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{Object.keys(uploadedFiles).length} files loaded</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setUploadedFiles({})}>Clear</Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Generate Button */}
          <Button className="w-full h-11" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {inputMode === 'prompt' ? 'Generating...' : 'Analyzing & Generating...'}</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> {inputMode === 'prompt' ? 'Generate Backend' : 'Analyze & Generate Backend'}</>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateBackend;
