import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Project } from '@/types/project';
import StepConnectRepo from '@/components/ImportWizard/StepConnectRepo';
import StepAnalysis from '@/components/ImportWizard/StepAnalysis';
import StepChooseBackend from '@/components/ImportWizard/StepChooseBackend';
import { Badge } from '@/components/ui/badge';

type WizardStep = 'connect' | 'analysis' | 'choose' | 'generating';

const ImportProject = () => {
  const navigate = useNavigate();
  const { addProject, updateProject } = useProjects();
  const [step, setStep] = useState<WizardStep>('connect');

  // Data passed between steps
  const [repoData, setRepoData] = useState<{
    githubUrl: string;
    uploadedFiles: Record<string, string>;
    githubToken?: string;
  } | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const steps = [
    { key: 'connect', label: '1. Connect' },
    { key: 'analysis', label: '2. Analysis' },
    { key: 'choose', label: '3. Backend' },
    { key: 'generating', label: '4. Generate' },
  ];

  const handleRepoNext = (data: typeof repoData) => {
    setRepoData(data);
    setStep('analysis');
  };

  const handleAnalysisNext = (analysisData: any) => {
    setAnalysis(analysisData);
    setStep('choose');
  };

  const handleGenerate = async (backendType: 'supabase' | 'firebase' | 'local' | 'cloud') => {
    setStep('generating');

    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: analysis?.prompt?.slice(0, 50) || 'Imported Project',
      backendType,
      prompt: analysis?.prompt || '',
      result: null,
      createdAt: new Date().toISOString(),
      status: 'generating',
      repoSource: {
        type: repoData?.githubUrl ? 'github' : 'upload',
        url: repoData?.githubUrl || undefined,
        analyzedAt: new Date().toISOString(),
      },
    };

    addProject(project);

    try {
      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt: analysis?.prompt, backendType },
      });
      if (error) throw error;

      updateProject(projectId, {
        result: data.result,
        status: 'ready',
        name: data.projectName || project.name,
      });

      toast.success('Backend generated!');
      navigate(`/project/${projectId}`);
    } catch (err: any) {
      updateProject(projectId, { status: 'error' });
      toast.error(err.message || 'Generation failed');
      setStep('choose');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import Project</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Analyze an existing project and generate a matching backend.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <Badge
                variant={step === s.key ? 'default' : 'outline'}
                className={`text-xs ${steps.findIndex(x => x.key === step) > i ? 'bg-primary/20 text-primary border-primary/30' : ''}`}
              >
                {s.label}
              </Badge>
              {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === 'connect' && <StepConnectRepo onNext={handleRepoNext} />}

        {step === 'analysis' && repoData && (
          <StepAnalysis
            githubUrl={repoData.githubUrl}
            uploadedFiles={repoData.uploadedFiles}
            githubToken={repoData.githubToken}
            onNext={handleAnalysisNext}
            onBack={() => setStep('connect')}
          />
        )}

        {step === 'choose' && (
          <StepChooseBackend
            suggestedType={analysis?.suggestedBackendType}
            onNext={handleGenerate}
            onBack={() => setStep('analysis')}
          />
        )}

        {step === 'generating' && (
          <div className="text-center py-16">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Generating your backend...</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportProject;
