import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Github, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Project } from '@/types/project';

const examplePrompts = [
  'Create a blog platform with user auth, posts, comments, and likes. Include role-based access for admin and editor.',
  'Build an e-commerce backend with products, categories, orders, cart, and Stripe payment integration.',
  'Design a project management tool with teams, projects, tasks, and real-time notifications.',
];

const CreateBackend = () => {
  const navigate = useNavigate();
  const { addProject, updateProject } = useProjects();
  const [backendType, setBackendType] = useState<string>('supabase');
  const [prompt, setPrompt] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [inputMode, setInputMode] = useState<'prompt' | 'repo'>('prompt');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (inputMode === 'repo') {
      if (!repoUrl.trim()) {
        toast.error('Please enter a GitHub repository URL.');
        return;
      }
      // Analyze repo then generate
      await handleRepoGenerate();
    } else {
      if (!prompt.trim()) {
        toast.error('Please enter a prompt describing your backend.');
        return;
      }
      await handlePromptGenerate();
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

      updateProject(projectId, {
        result: data.result,
        status: 'ready',
        name: data.projectName || project.name,
      });

      toast.success('Backend generated successfully!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      console.error('Generation error:', err);
      updateProject(projectId, { status: 'error' });
      toast.error(err.message || 'Failed to generate backend. Please try again.');
      setLoading(false);
    }
  };

  const handleRepoGenerate = async () => {
    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: repoUrl.split('/').slice(-1)[0] || 'GitHub Project',
      backendType: backendType as Project['backendType'],
      prompt: `Generate backend for: ${repoUrl}`,
      result: null,
      createdAt: new Date().toISOString(),
      status: 'generating',
    };

    addProject(project);
    setLoading(true);

    try {
      // Step 1: Analyze the repo
      toast.info('Analyzing repository...');
      const githubToken = localStorage.getItem('github_access_token') || undefined;
      const { data: analysis, error: analysisError } = await supabase.functions.invoke('analyze-repo', {
        body: { repoUrl, githubToken },
      });
      if (analysisError) throw analysisError;

      // Step 2: Generate backend from analysis
      toast.info('Generating backend from analysis...');
      const analysisPrompt = `Based on this frontend analysis, generate a complete ${backendType} backend:\n\n${
        typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2)
      }`;

      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt: analysisPrompt, backendType },
      });
      if (error) throw error;

      updateProject(projectId, {
        result: data.result,
        status: 'ready',
        name: data.projectName || project.name,
      });

      toast.success('Backend generated from repository!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      console.error('Repo generation error:', err);
      updateProject(projectId, { status: 'error' });
      toast.error(err.message || 'Failed to generate backend from repo.');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Create New Backend</h1>
        <p className="text-muted-foreground text-sm mb-8">Describe what you need or provide a GitHub repo and let AI generate the infrastructure.</p>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Backend Type</label>
            <Select value={backendType} onValueChange={setBackendType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supabase">Supabase</SelectItem>
                <SelectItem value="firebase">Firebase</SelectItem>
                <SelectItem value="local">Local Database</SelectItem>
                <SelectItem value="cloud">Cloud Database</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'prompt' | 'repo')}>
            <TabsList className="w-full">
              <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Describe with Prompt
              </TabsTrigger>
              <TabsTrigger value="repo" className="flex-1 gap-1.5">
                <Github className="h-3.5 w-3.5" />
                From GitHub Repo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="mt-4">
              <label className="text-sm font-medium mb-2 block">Describe Your Backend</label>
              <Textarea
                placeholder="Describe the backend you want to build..."
                className="min-h-[160px] font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </TabsContent>

            <TabsContent value="repo" className="mt-4 space-y-3">
              <label className="text-sm font-medium mb-2 block">GitHub Repository URL</label>
              <Input
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                We'll analyze your frontend code and auto-generate a matching backend. For private repos, connect GitHub first on the{' '}
                <a href="/import" className="text-primary underline underline-offset-2">Import page</a>.
              </p>
            </TabsContent>
          </Tabs>

          <Button
            className="w-full h-11"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {inputMode === 'repo' ? 'Analyzing & Generating...' : 'Generating...'}</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> {inputMode === 'repo' ? 'Analyze Repo & Generate' : 'Generate Backend'}</>
            )}
          </Button>

          {inputMode === 'prompt' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Example prompts:</p>
              <div className="space-y-2">
                {examplePrompts.map((ex, i) => (
                  <Card
                    key={i}
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => setPrompt(ex)}
                  >
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{ex}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateBackend;
