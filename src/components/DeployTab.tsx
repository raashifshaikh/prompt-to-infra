import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Check, Database, Flame, Copy, Download, ExternalLink, X, CheckCircle2, XCircle, AlertCircle, Zap } from 'lucide-react';
import { DatabaseTable, Project } from '@/types/project';
import { getSelectedSupabaseProject } from '@/pages/ConnectSupabase';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const connectedProject = getSelectedSupabaseProject();

  // Supabase connection
  const [dbUrl, setDbUrl] = useState('');
  const [applyingSupabase, setApplyingSupabase] = useState(false);
  const [applyingViaApi, setApplyingViaApi] = useState(false);
  const [supabaseSQL, setSupabaseSQL] = useState('');
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);
  const [migrationError, setMigrationError] = useState('');

  // Firebase connection
  const [fbProjectId, setFbProjectId] = useState(project.firebaseConfig?.projectId || '');
  const [applyingFirebase, setApplyingFirebase] = useState(false);
  const [firebaseOutput, setFirebaseOutput] = useState<{ rules?: string; indexes?: string } | null>(null);

  // Fly.io deployment
  const [deployingFly, setDeployingFly] = useState(false);

  const handleApplySupabase = async () => {
    if (!dbUrl) {
      toast.error('Please enter your database connection URL');
      return;
    }
    if (!result?.tables) {
      toast.error('No tables to apply');
      return;
    }

    // Validate port guidance
    if (dbUrl.includes(':6543')) {
      toast.error('Use port 5432 (direct connection) instead of 6543 (pooler) for schema migrations');
      return;
    }

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
        onUpdateProject({
          supabaseConfig: { url: '', anonKey: '', serviceRoleKey: '', connected: true },
        });
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

  // One-click apply via Management API
  const handleApplyViaApi = async () => {
    if (!connectedProject) {
      toast.error('No Supabase project connected');
      return;
    }
    if (!result?.tables) {
      toast.error('No tables to apply');
      return;
    }

    const authData = localStorage.getItem('backendforge_supabase_oauth');
    if (!authData) {
      toast.error('Supabase OAuth session expired. Please reconnect.');
      return;
    }

    const { accessToken } = JSON.parse(authData);
    setApplyingViaApi(true);
    setMigrationResults([]);
    setMigrationError('');

    try {
      // Generate SQL from tables
      const sqlStatements = result.tables.map((table) => {
        const cols = table.columns.map((col) => {
          let def = `"${col.name}" ${col.type}`;
          if (col.primary_key) def += ' PRIMARY KEY';
          if (!col.nullable && !col.primary_key) def += ' NOT NULL';
          if (col.default) def += ` DEFAULT ${col.default}`;
          return def;
        }).join(',\n  ');
        return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n  ${cols}\n);`;
      }).join('\n\n');

      // Apply via Management API
      const { data, error } = await supabase.functions.invoke('supabase-manage', {
        body: {
          action: 'run-sql',
          accessToken,
          projectRef: connectedProject.ref,
          sql: sqlStatements,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSupabaseSQL(sqlStatements);
      onUpdateProject({
        supabaseConfig: {
          url: connectedProject.url,
          anonKey: connectedProject.anonKey,
          serviceRoleKey: '',
          connected: true,
        },
      });
      toast.success(`Schema applied to "${connectedProject.name}" via Management API!`);
    } catch (err: any) {
      setMigrationError(err.message || 'Failed to apply schema via API');
      toast.error(err.message || 'Failed to apply schema');
    } finally {
      setApplyingViaApi(false);
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
      const { data: createData, error: createErr } = await supabase.functions.invoke('deploy-flyio', {
        body: { action: 'create-app', projectName: project.name },
      });
      if (createErr) throw createErr;

      const appName = createData.appName;
      onUpdateProject({
        flyDeployment: { appName, url: createData.url, status: 'creating' },
      });
      toast.success(`App "${appName}" created on Fly.io!`);

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
              <Database className="h-4 w-4" /> Apply Schema to Supabase
              {project.supabaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* One-click apply via OAuth */}
            {connectedProject ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Connected: {connectedProject.name}</span>
                  <Badge variant="outline" className="text-xs font-mono">{connectedProject.ref}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Apply schema directly via Supabase Management API — no database URL needed.
                </p>
                <Button onClick={handleApplyViaApi} disabled={applyingViaApi} size="sm">
                  {applyingViaApi ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Applying...</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 mr-1.5" /> One-Click Apply</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect your Supabase account for one-click schema deployment — no database URL needed.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/connect-supabase')}>
                  <Database className="h-3.5 w-3.5 mr-1.5" /> Connect Supabase Account
                </Button>
              </div>
            )}

            {/* Manual fallback */}
            <div className="border-t pt-4">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Or apply manually with a database URL:</p>
              <Input
                placeholder="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                type="password"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Use the <strong>direct connection string</strong> (port 5432) from your Supabase project → Settings → Database.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button onClick={handleApplySupabase} disabled={applyingSupabase} size="sm" variant="outline">
                  {applyingSupabase ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
                  Apply Schema
                </Button>
                {connectedProject && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`https://supabase.com/dashboard/project/${connectedProject.ref}/sql/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Open SQL Editor
                    </a>
                  </Button>
                )}
              </div>
            </div>

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
                    <span className={r.success ? 'text-foreground' : 'text-destructive'}>
                      {r.label}
                    </span>
                    {r.error && (
                      <span className="text-muted-foreground truncate ml-1">— {r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Migration Error */}
            {migrationError && !migrationResults.length && (
              <div className="mt-3 flex items-start gap-2 bg-destructive/10 text-destructive rounded-md p-3 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{migrationError}</span>
              </div>
            )}

            {/* Generated SQL */}
            {supabaseSQL && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium">Generated SQL (manual fallback)</h4>
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
