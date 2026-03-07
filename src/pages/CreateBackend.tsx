import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt describing your backend.');
      return;
    }

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

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Create New Backend</h1>
        <p className="text-muted-foreground text-sm mb-8">Describe what you need and let AI generate the infrastructure.</p>

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

          <div>
            <label className="text-sm font-medium mb-2 block">Describe Your Backend</label>
            <Textarea
              placeholder="Describe the backend you want to build..."
              className="min-h-[160px] font-mono text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button
            className="w-full h-11"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Generate Backend</>
            )}
          </Button>

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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateBackend;
