import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Check, Database, Flame, Cloud, HardDrive, Copy, Download, ExternalLink } from 'lucide-react';
import { Project } from '@/types/project';
import DownloadBackend from '@/components/DownloadBackend';

interface DeployTabProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

const DeployTab = ({ project, onUpdateProject }: DeployTabProps) => {
  const result = project.result;

  // Supabase
  const [sbUrl, setSbUrl] = useState(project.supabaseConfig?.url || '');
  const [sbServiceKey, setSbServiceKey] = useState(project.supabaseConfig?.serviceRoleKey || '');
  const [applyingSupabase, setApplyingSupabase] = useState(false);
  const [supabaseSQL, setSupabaseSQL] = useState('');

  // Firebase
  const [fbProjectId, setFbProjectId] = useState(project.firebaseConfig?.projectId || '');
  const [applyingFirebase, setApplyingFirebase] = useState(false);
  const [firebaseOutput, setFirebaseOutput] = useState<{ rules?: string; indexes?: string } | null>(null);

  // Fly.io
  const [deployingFly, setDeployingFly] = useState(false);

  const handleApplySupabase = async () => {
    if (!result?.tables) { toast.error('No tables to apply'); return; }
    setApplyingSupabase(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-supabase', {
        body: { tables: result.tables, supabaseUrl: sbUrl || undefined, serviceRoleKey: sbServiceKey || undefined },
      });
      if (error) throw error;
      setSupabaseSQL(data.sql || '');
      if (sbUrl) {
        onUpdateProject({ supabaseConfig: { url: sbUrl, anonKey: '', serviceRoleKey: sbServiceKey, connected: true } });
      }
      toast.success('SQL migration generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setApplyingSupabase(false);
    }
  };

  const handleApplyFirebase = async () => {
    if (!fbProjectId || !result?.tables) { toast.error('Missing data'); return; }
    setApplyingFirebase(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-firebase', {
        body: { tables: result.tables, firebaseProjectId: fbProjectId },
      });
      if (error) throw error;
      setFirebaseOutput({ rules: data.firestoreRules, indexes: JSON.stringify(data.firestoreIndexes, null, 2) });
      onUpdateProject({ firebaseConfig: { projectId: fbProjectId, serviceAccountJson: '', connected: true } });
      toast.success('Firebase configs generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setApplyingFirebase(false);
    }
  };

  const handleDeployFlyio = async () => {
    setDeployingFly(true);
    try {
      const { data: createData, error: createErr } = await supabase.functions.invoke('deploy-flyio', {
        body: { action: 'create-app', projectName: project.name },
      });
      if (createErr) throw createErr;
      onUpdateProject({ flyDeployment: { appName: createData.appName, url: createData.url, status: 'creating' } });
      toast.success(`App "${createData.appName}" created!`);

      const { data: deployData, error: deployErr } = await supabase.functions.invoke('deploy-flyio', {
        body: { action: 'deploy', appName: createData.appName },
      });
      if (deployErr) throw deployErr;
      onUpdateProject({ flyDeployment: { appName: createData.appName, url: deployData.url, status: 'running' }, status: 'deployed' });
      toast.success(`Deployed to ${deployData.url}`);
    } catch (err: any) {
      toast.error(err.message || 'Deploy failed');
      if (project.flyDeployment) onUpdateProject({ flyDeployment: { ...project.flyDeployment, status: 'failed' } });
    } finally {
      setDeployingFly(false);
    }
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };
  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Option A — Local */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Option A — Local Backend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <DownloadBackend projectName={project.name} result={result} />
          ) : (
            <p className="text-sm text-muted-foreground">Generate a backend first to download.</p>
          )}
        </CardContent>
      </Card>

      {/* Option B — Cloud (Fly.io) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Option B — Cloud (Fly.io)
            {project.flyDeployment && (
              <Badge variant={project.flyDeployment.status === 'running' ? 'default' : 'outline'} className="text-xs">
                {project.flyDeployment.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Deploy automatically with Docker. No setup required.</p>
          {project.flyDeployment?.url && project.flyDeployment.status === 'running' && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono">{project.flyDeployment.url}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => handleCopy(project.flyDeployment!.url)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button onClick={handleDeployFlyio} disabled={deployingFly || project.flyDeployment?.status === 'running'} size="sm">
            {deployingFly ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Deploying...</> :
             project.flyDeployment?.status === 'running' ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Deployed</> :
             <><Cloud className="h-3.5 w-3.5 mr-1.5" /> Deploy to Fly.io</>}
          </Button>
        </CardContent>
      </Card>

      {/* Option C — Supabase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Option C — Supabase
            {project.supabaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="https://your-project.supabase.co" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} className="font-mono text-xs" />
          <Input placeholder="Service role key (optional, for validation)" value={sbServiceKey} onChange={(e) => setSbServiceKey(e.target.value)} type="password" className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">Generates SQL migration. Run in your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">Supabase SQL Editor</a>.</p>
          <Button onClick={handleApplySupabase} disabled={applyingSupabase} size="sm">
            {applyingSupabase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            Generate SQL
          </Button>
          {supabaseSQL && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium">SQL Migration</h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(supabaseSQL)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(supabaseSQL, 'migration.sql')}><Download className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[300px]"><code>{supabaseSQL}</code></pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Firebase (shown when relevant) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4" /> Firebase (Optional)
            {project.firebaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="your-firebase-project-id" value={fbProjectId} onChange={(e) => setFbProjectId(e.target.value)} className="font-mono text-xs" />
          <Button onClick={handleApplyFirebase} disabled={applyingFirebase} size="sm">
            {applyingFirebase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Flame className="h-3.5 w-3.5 mr-1.5" />}
            Generate Firebase Config
          </Button>
          {firebaseOutput?.rules && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium font-mono">firestore.rules</h4>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(firebaseOutput.rules!)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(firebaseOutput.rules!, 'firestore.rules')}><Download className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px]"><code>{firebaseOutput.rules}</code></pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployTab;
