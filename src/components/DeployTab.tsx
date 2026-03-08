import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Check, Database, Flame, Copy, Download, ExternalLink, CheckCircle2, XCircle, AlertCircle, Train } from 'lucide-react';
import { DatabaseTable, Project } from '@/types/project';

interface DeployTabProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

interface MigrationResult {
  label: string;
  success: boolean;
  error?: string;
}

const DeployTab = ({ project, onUpdateProject }: DeployTabProps) => {
  const result = project.result;

  // Supabase connection
  const [dbUrl, setDbUrl] = useState('');
  const [applyingSupabase, setApplyingSupabase] = useState(false);
  const [supabaseSQL, setSupabaseSQL] = useState('');
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);
  const [migrationError, setMigrationError] = useState('');

  // Firebase connection
  const [fbProjectId, setFbProjectId] = useState(project.firebaseConfig?.projectId || '');
  const [applyingFirebase, setApplyingFirebase] = useState(false);
  const [firebaseOutput, setFirebaseOutput] = useState<{ rules?: string; indexes?: string } | null>(null);

  // Railway deployment
  const [deployingRailway, setDeployingRailway] = useState(false);

  const handleApplySupabase = async () => {
    if (!dbUrl) { toast.error('Please enter your database connection URL'); return; }
    if (!result?.tables) { toast.error('No tables to apply'); return; }
    if (dbUrl.includes(':6543')) { toast.error('Use port 5432 (direct connection) instead of 6543 (pooler) for schema migrations'); return; }

    setApplyingSupabase(true);
    setMigrationResults([]);
    setMigrationError('');

    try {
      const { data, error } = await supabase.functions.invoke('apply-supabase', {
        body: { tables: result.tables, dbUrl },
      });
      if (error) throw error;

      setSupabaseSQL(data.sql || '');
      setMigrationResults(data.results || []);

      if (data.success) {
        onUpdateProject({ supabaseConfig: { url: '', anonKey: '', serviceRoleKey: '', connected: true } });
        toast.success(data.message || 'Schema applied successfully!');
      } else {
        setMigrationError(data.error || 'Migration failed');
        toast.error('Migration failed — check results below');
      }
    } catch (err: any) {
      setMigrationError(err.message || 'Failed to apply schema');
      toast.error(err.message || 'Failed to apply schema');
    } finally {
      setApplyingSupabase(false);
    }
  };

  const handleApplyFirebase = async () => {
    if (!fbProjectId) { toast.error('Please enter your Firebase Project ID'); return; }
    if (!result?.tables) { toast.error('No tables to generate rules for'); return; }

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
      toast.error(err.message || 'Failed to generate Firebase config');
    } finally {
      setApplyingFirebase(false);
    }
  };

  const handleDeployRailway = async () => {
    setDeployingRailway(true);
    try {
      // Step 1: Create project
      toast.info('Creating Railway project...');
      const { data: createData, error: createErr } = await supabase.functions.invoke('deploy-railway', {
        body: { action: 'create-project', projectName: project.name },
      });
      if (createErr) throw createErr;
      if (createData.error) throw new Error(createData.error);

      const railwayProjectId = createData.projectId;
      onUpdateProject({
        railwayDeployment: {
          projectId: railwayProjectId,
          projectName: createData.projectName,
          url: createData.url,
          status: 'creating',
        },
      });

      // Step 2: Deploy a service
      toast.info('Deploying service...');
      const { data: deployData, error: deployErr } = await supabase.functions.invoke('deploy-railway', {
        body: { action: 'deploy-service', projectId: railwayProjectId, serviceName: 'api' },
      });
      if (deployErr) throw deployErr;
      if (deployData.error) throw new Error(deployData.error);

      onUpdateProject({
        railwayDeployment: {
          projectId: railwayProjectId,
          projectName: createData.projectName,
          url: createData.url,
          status: 'running',
        },
        status: 'deployed',
      });
      toast.success(`Deployed to Railway! Project: ${createData.projectName}`);
    } catch (err: any) {
      toast.error(err.message || 'Railway deployment failed');
      if (project.railwayDeployment) {
        onUpdateProject({
          railwayDeployment: { ...project.railwayDeployment, status: 'failed' },
        });
      }
    } finally {
      setDeployingRailway(false);
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
              <Database className="h-4 w-4" /> Apply Schema to Supabase
              {project.supabaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              type="password"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use the <strong>direct connection string</strong> (port 5432) from your Supabase project → Settings → Database.
            </p>
            <Button onClick={handleApplySupabase} disabled={applyingSupabase} size="sm">
              {applyingSupabase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
              Apply Schema
            </Button>

            {/* Migration Progress */}
            {migrationResults.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <h4 className="text-xs font-medium mb-2">Migration Results</h4>
                {migrationResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className={r.success ? 'text-foreground' : 'text-destructive'}>{r.label}</span>
                    {r.error && <span className="text-muted-foreground truncate ml-1">— {r.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {migrationError && !migrationResults.length && (
              <div className="mt-3 flex items-start gap-2 bg-destructive/10 text-destructive rounded-md p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{migrationError}</span>
              </div>
            )}

            {supabaseSQL && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium">Generated SQL</h4>
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

      {/* Railway Deployment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Train className="h-4 w-4" /> Deploy to Railway
            {project.railwayDeployment && (
              <Badge variant={project.railwayDeployment.status === 'running' ? 'default' : 'outline'} className="text-xs">
                {project.railwayDeployment.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.railwayDeployment?.url && project.railwayDeployment.status === 'running' && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono truncate">{project.railwayDeployment.url}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto shrink-0" asChild>
                <a href={project.railwayDeployment.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          )}
          <Button
            onClick={handleDeployRailway}
            disabled={deployingRailway || project.railwayDeployment?.status === 'running'}
            size="sm"
          >
            {deployingRailway ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Deploying...</>
            ) : project.railwayDeployment?.status === 'running' ? (
              <><Check className="h-3.5 w-3.5 mr-1.5" /> Deployed</>
            ) : (
              <><Train className="h-3.5 w-3.5 mr-1.5" /> Deploy to Railway</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Creates a new Railway project and deploys your backend service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeployTab;
