import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Github, FileText, Upload, Database, Flame, Server, Cloud, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Project } from '@/types/project';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

const examplePrompts = [
  'Create a blog platform with user auth, posts, comments, and likes.',
  'Build an e-commerce backend with products, orders, and Stripe payments.',
  'Design a project management tool with teams, tasks, and notifications.',
];

const deployTargets = [
  { value: 'supabase', label: 'Supabase', icon: Database, description: 'Connect your Supabase project and apply schema directly', disabled: false },
  { value: 'firebase', label: 'Firebase', icon: Flame, description: 'Download Firestore rules, indexes, and setup files', disabled: false },
  { value: 'local', label: 'Local / Self-hosted', icon: Server, description: 'Get Docker files and a step-by-step hosting tutorial', disabled: false },
  { value: 'cloud', label: 'Cloud Hosting', icon: Cloud, description: 'Coming soon', disabled: true },
];

const generationSteps = [
  { label: 'Analyzing requirements', duration: 2000 },
  { label: 'Designing database schema', duration: 3000 },
  { label: 'Generating API routes', duration: 3000 },
  { label: 'Creating deployment configs', duration: 4000 },
  { label: 'Finalizing backend', duration: 3000 },
];

const GenerationProgress = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let totalElapsed = 0;
    const totalDuration = generationSteps.reduce((s, step) => s + step.duration, 0);
    
    const interval = setInterval(() => {
      totalElapsed += 100;
      const pct = Math.min((totalElapsed / totalDuration) * 90, 90); // cap at 90% until done
      setProgress(pct);
      
      let accumulated = 0;
      for (let i = 0; i < generationSteps.length; i++) {
        accumulated += generationSteps[i].duration;
        if (totalElapsed < accumulated) {
          setCurrentStep(i);
          break;
        }
        if (i === generationSteps.length - 1) setCurrentStep(i);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Generating Your Backend</h3>
            <p className="text-sm text-muted-foreground">This usually takes 10-20 seconds</p>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="space-y-2">
            {generationSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                i < currentStep ? 'text-primary' : i === currentStep ? 'text-foreground' : 'text-muted-foreground/40'
              }`}>
                {i < currentStep ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : i === currentStep ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/20 shrink-0" />
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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

  const [githubToken, setGithubToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string; name?: string } | null>(null);
  const [exchangingToken, setExchangingToken] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('github_user');
    if (storedUser && githubToken) {
      try { setGithubUser(JSON.parse(storedUser)); } catch { /* ignore */ }
    }
  }, [githubToken]);

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
    const redirectUri = 'https://prompt-to-infra.lovable.app/create';
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
      navigate(`/project/${projectId}?tab=deploy`);
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
      navigate(`/project/${projectId}?tab=deploy`);
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || 'Failed to analyze/generate.');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {loading && <GenerationProgress />}
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Generate Backend</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Describe, import, or upload — we'll generate everything you need.
        </p>

        <div className="space-y-8">
          {/* Step 1: Input Mode */}
          <div>
            <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
              1. How do you want to generate?
            </h2>
            <Tabs value={inputMode} onValueChange={(v) => { setInputMode(v as any); setAnalysis(null); }}>
              <TabsList className="w-full">
                <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Prompt
                </TabsTrigger>
                <TabsTrigger value="repo" className="flex-1 gap-1.5">
                  <Github className="h-3.5 w-3.5" /> GitHub
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="mt-4 space-y-3">
                <Textarea
                  placeholder="Describe the backend you want to build..."
                  className="min-h-[140px] font-mono text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((ex, i) => (
                    <button
                      key={i}
                      className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md px-3 py-1.5 transition-colors text-left"
                      onClick={() => setPrompt(ex)}
                    >
                      {ex.slice(0, 60)}...
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="repo" className="mt-4 space-y-3">
                <Input
                  placeholder="https://github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {githubToken && githubUser ? (
                    <span className="flex items-center gap-1.5">
                      <img src={githubUser.avatar_url} alt="" className="h-4 w-4 rounded-full" />
                      {githubUser.login}
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      <button onClick={handleDisconnectGitHub} className="text-muted-foreground hover:text-foreground ml-1 underline">
                        Disconnect
                      </button>
                    </span>
                  ) : (
                    <span>
                      Public repos work directly.{' '}
                      <button
                        onClick={handleConnectGitHub}
                        disabled={exchangingToken || !GITHUB_CLIENT_ID}
                        className="text-primary hover:underline"
                      >
                        {exchangingToken ? 'Connecting...' : 'Connect GitHub for private repos →'}
                      </button>
                    </span>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="upload" className="mt-4 space-y-3">
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
                  <Upload className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload project files</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .ts, .js, .json, .html, .css (max 20MB each)</p>
                </div>
                {Object.keys(uploadedFiles).length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{Object.keys(uploadedFiles).length} files loaded</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setUploadedFiles({})}>Clear</Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Step 2: Deploy Target */}
          <div>
            <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
              2. Where do you want to deploy?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {deployTargets.map((target) => {
                const Icon = target.icon;
                const isSelected = backendType === target.value;
                return (
                  <button
                    key={target.value}
                    disabled={target.disabled}
                    onClick={() => setBackendType(target.value)}
                    className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                      target.disabled
                        ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                        : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30 bg-card'
                    }`}
                  >
                    {target.disabled && (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">Soon</Badge>
                    )}
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                      {target.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{target.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <Button className="w-full h-12 text-base" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {inputMode === 'prompt' ? 'Generating...' : 'Analyzing & Generating...'}</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Generate Backend</>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateBackend;
