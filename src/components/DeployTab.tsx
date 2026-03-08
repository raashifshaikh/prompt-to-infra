import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Check, Database, Flame, Copy, Download } from 'lucide-react';
import { DatabaseTable, Project } from '@/types/project';

interface DeployTabProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

const DeployTab = ({ project, onUpdateProject }: DeployTabProps) => {
  const result = project.result;

  // Supabase connection
  const [sbUrl, setSbUrl] = useState(project.supabaseConfig?.url || '');
  const [sbServiceKey, setSbServiceKey] = useState(project.supabaseConfig?.serviceRoleKey || '');
  const [applyingSupabase, setApplyingSupabase] = useState(false);
  const [supabaseSQL, setSupabaseSQL] = useState('');

  // Firebase connection
  const [fbProjectId, setFbProjectId] = useState(project.firebaseConfig?.projectId || '');
  const [applyingFirebase, setApplyingFirebase] = useState(false);
  const [firebaseOutput, setFirebaseOutput] = useState<{ rules?: string; indexes?: string } | null>(null);

  // Fly.io deployment
  const [deployingFly, setDeployingFly] = useState(false);

  const handleApplySupabase = async () => {
    if (!sbUrl || !sbServiceKey) {
      toast.error('Please enter your Supabase URL and Service Role Key');
      return;
    }
    if (!result?.tables) {
      toast.error('No tables to apply');
      return;
    }

    setApplyingSupabase(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-supabase', {
        body: { tables: result.tables, supabaseUrl: sbUrl, serviceRoleKey: sbServiceKey },
      });

      if (error) throw error;

      setSupabaseSQL(data.sql || '');
      onUpdateProject({
        supabaseConfig: { url: sbUrl, anonKey: '', serviceRoleKey: sbServiceKey, connected: true },
      });
      toast.success('Schema applied! Check the SQL tab for the migration script.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply schema');
    } finally {
      setApplyingSupabase(false);
    }
  };

  const handleApplyFirebase = async () => {
    if (!fbProjectId) {
      toast.error('Please enter your Firebase Project ID');
      return;
    }
    if (!result?.tables) {
      toast.error('No tables to generate rules for');
      return;
    }

    setApplyingFirebase(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-firebase', {
        body: { tables: result.tables, firebaseProjectId: fbProjectId },
      });

      if (error) throw error;

      setFirebaseOutput({
        rules: data.firestoreRules,
        indexes: JSON.stringify(data.firestoreIndexes, null, 2),
      });
      onUpdateProject({
        firebaseConfig: { projectId: fbProjectId, serviceAccountJson: '', connected: true },
      });
      toast.success('Firebase configs generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate Firebase config');
    } finally {
      setApplyingFirebase(false);
    }
  };

  const handleDeployFlyio = async () => {
    setDeployingFly(true);
    try {
      // Step 1: Create app
      const { data: createData, error: createErr } = await supabase.functions.invoke('deploy-flyio', {
        body: { action: 'create-app', projectName: project.name },
      });
      if (createErr) throw createErr;

      const appName = createData.appName;
      onUpdateProject({
        flyDeployment: { appName, url: createData.url, status: 'creating' },
      });

      toast.success(`App "${appName}" created on Fly.io!`);

      // Step 2: Deploy
      const { data: deployData, error: deployErr } = await supabase.functions.invoke('deploy-flyio', {
        body: { action: 'deploy', appName },
      });
      if (deployErr) throw deployErr;

      onUpdateProject({
        flyDeployment: { appName, url: deployData.url, status: 'running' },
        status: 'deployed',
      });

      toast.success(`Deployed to ${deployData.url}`);
    } catch (err: any) {
      toast.error(err.message || 'Fly.io deployment failed');
      onUpdateProject({
        flyDeployment: { ...project.flyDeployment!, status: 'failed' },
      });
    } finally {
      setDeployingFly(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Supabase Integration */}
      {(project.backendType === 'supabase' || project.backendType === 'cloud') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" /> Connect to Supabase
              {project.supabaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="https://your-project.supabase.co"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              className="font-mono text-xs"
            />
            <Input
              placeholder="Your service role key (kept in memory only)"
              value={sbServiceKey}
              onChange={(e) => setSbServiceKey(e.target.value)}
              type="password"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Your service role key is used once to apply the schema and is never stored server-side.
            </p>
            <Button onClick={handleApplySupabase} disabled={applyingSupabase} size="sm">
              {applyingSupabase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
              Apply Schema to Supabase
            </Button>

            {supabaseSQL && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium">Generated SQL Migration</h4>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(supabaseSQL)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(supabaseSQL, 'migration.sql')}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[300px]">
                  <code>{supabaseSQL}</code>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Firebase Integration */}
      {project.backendType === 'firebase' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4" /> Connect to Firebase
              {project.firebaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="your-firebase-project-id"
              value={fbProjectId}
              onChange={(e) => setFbProjectId(e.target.value)}
              className="font-mono text-xs"
            />
            <Button onClick={handleApplyFirebase} disabled={applyingFirebase} size="sm">
              {applyingFirebase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Flame className="h-3.5 w-3.5 mr-1.5" />}
              Generate Firebase Config
            </Button>

            {firebaseOutput && (
              <div className="space-y-3 mt-4">
                {firebaseOutput.rules && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium font-mono">firestore.rules</h4>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(firebaseOutput.rules!)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(firebaseOutput.rules!, 'firestore.rules')}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px]">
                      <code>{firebaseOutput.rules}</code>
                    </pre>
                  </div>
                )}
                {firebaseOutput.indexes && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium font-mono">firestore.indexes.json</h4>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(firebaseOutput.indexes!)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(firebaseOutput.indexes!, 'firestore.indexes.json')}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px]">
                      <code>{firebaseOutput.indexes}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fly.io Deployment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            🚀 Deploy to Fly.io
            {project.flyDeployment && (
              <Badge variant={project.flyDeployment.status === 'running' ? 'default' : 'outline'} className="text-xs">
                {project.flyDeployment.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.flyDeployment?.url && project.flyDeployment.status === 'running' && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono">{project.flyDeployment.url}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => handleCopy(project.flyDeployment!.url)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button
            onClick={handleDeployFlyio}
            disabled={deployingFly || project.flyDeployment?.status === 'running'}
            size="sm"
          >
            {deployingFly ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Deploying...</>
            ) : project.flyDeployment?.status === 'running' ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Deployed</>
            ) : (
              <>🚀 Deploy to Fly.io</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Creates a new Fly.io app and deploys your backend with a Docker container.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployTab;
