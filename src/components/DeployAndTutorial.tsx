import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Database, Flame, Copy, Download, CheckCircle2, XCircle, AlertCircle, Server, Cloud, Terminal, FileDown, HelpCircle, Link } from 'lucide-react';
import { Project, TutorialStep } from '@/types/project';

interface DeployAndTutorialProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

interface MigrationResult {
  label: string;
  success: boolean;
  error?: string;
}

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

const FileBlock = ({ name, content, filename }: { name: string; content: string; filename: string }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <h4 className="text-xs font-medium font-mono">{name}</h4>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(content)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(content, filename)}>
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
    <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[200px]">
      <code>{content}</code>
    </pre>
  </div>
);

const TutorialSteps = ({ steps, title }: { steps: TutorialStep[]; title: string }) => (
  <div className="space-y-3 mt-4">
    <h3 className="text-sm font-medium">{title}</h3>
    {steps.map((step, i) => (
      <div key={i} className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono">{i + 1}</span>
          <h4 className="text-sm font-medium">{step.title}</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-2 ml-7">{step.description}</p>
        <div className="ml-7 relative">
          <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
            <code>{step.code}</code>
          </pre>
          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleCopy(step.code)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    ))}
  </div>
);

// ─── Supabase Deploy ───
const SupabaseDeploy = ({ project, onUpdateProject }: DeployAndTutorialProps) => {
  const result = project.result;
  const [connectionMode, setConnectionMode] = useState<'easy' | 'advanced'>('easy');
  const [projectUrl, setProjectUrl] = useState(project.supabaseProjectUrl || '');
  const [dbPassword, setDbPassword] = useState(project.supabaseDbPassword || '');
  const [credsSaved, setCredsSaved] = useState(!!(project.supabaseProjectUrl && project.supabaseDbPassword));
  const [rawDbUrl, setRawDbUrl] = useState('');
  const [applying, setApplying] = useState(false);
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [error, setError] = useState('');

  // Auto-construct the direct connection string from project URL + password
  const constructedDbUrl = useMemo(() => {
    if (connectionMode === 'advanced') return rawDbUrl;
    if (!projectUrl || !dbPassword) return '';

    // Extract project ref from various URL formats
    let projectRef = '';
    
    // Format: https://abcdef.supabase.co or https://supabase.com/dashboard/project/abcdef
    const dashboardMatch = projectUrl.match(/\/project\/([a-z0-9]+)/);
    const directMatch = projectUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/);
    const rawRef = projectUrl.match(/^([a-z0-9]{20,})$/);

    if (dashboardMatch) {
      projectRef = dashboardMatch[1];
    } else if (directMatch) {
      projectRef = directMatch[1];
    } else if (rawRef) {
      projectRef = rawRef[1];
    }

    if (!projectRef) return '';
    return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
  }, [connectionMode, projectUrl, dbPassword, rawDbUrl]);

  const handleApply = async () => {
    const dbUrl = constructedDbUrl;
    if (!dbUrl) {
      toast.error(connectionMode === 'easy'
        ? 'Please enter your Supabase project URL and database password'
        : 'Please enter your database connection URL');
      return;
    }
    if (!result?.tables) { toast.error('No tables to apply'); return; }
    if (dbUrl.includes(':6543')) { toast.error('Use port 5432 (direct connection) instead of 6543'); return; }

    setApplying(true);
    setResults([]);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('apply-supabase', {
        body: { tables: result.tables, enums: result.enums, indexes: result.indexes, storageBuckets: result.storageBuckets, dbUrl },
      });
      if (err) throw err;
      setSql(data.sql || '');
      setResults(data.results || []);
      if (data.success) {
        onUpdateProject({ supabaseConfig: { url: '', anonKey: '', serviceRoleKey: '', connected: true } });
        toast.success(data.message || 'Schema applied!');
      } else {
        setError(data.error || 'Migration failed');
        toast.error('Migration failed — check results below');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to apply schema');
      toast.error(e.message || 'Failed to apply schema');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Apply Schema to Supabase
            {project.supabaseConfig?.connected && <Badge variant="default" className="text-xs">Connected</Badge>}
          </CardTitle>
          <CardDescription className="text-xs">
            Connect your Supabase project to automatically create all tables, enums, indexes, and storage buckets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
            <button
              onClick={() => setConnectionMode('easy')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                connectionMode === 'easy' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Easy Setup
            </button>
            <button
              onClick={() => setConnectionMode('advanced')}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                connectionMode === 'advanced' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connection String
            </button>
          </div>

          {connectionMode === 'easy' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Project URL or Reference ID</label>
                <Input
                  placeholder="https://yourproject.supabase.co or abcdefghijklmnopqrst"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Find this in Supabase → Settings → General → Reference ID, or copy your project URL
                </p>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Database Password</label>
                <Input
                  placeholder="Your database password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  type="password"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The password you set when creating your Supabase project. Reset it in Settings → Database if forgotten.
                </p>
              </div>
              {constructedDbUrl && (
                <div className="bg-muted/50 rounded-md p-2 flex items-center gap-2">
                  <Link className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    postgresql://postgres:***@db.{projectUrl.match(/([a-z0-9]{10,})/)?.[1] || '...'}.supabase.co:5432/postgres
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">Auto-built</Badge>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Input
                placeholder="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
                value={rawDbUrl}
                onChange={(e) => setRawDbUrl(e.target.value)}
                type="password"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Use the <strong>direct connection string</strong> (port 5432) from Supabase → Settings → Database.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => {
              if (projectUrl || dbPassword) {
                onUpdateProject({ supabaseProjectUrl: projectUrl, supabaseDbPassword: dbPassword });
                setCredsSaved(true);
                toast.success('Credentials saved');
              }
            }} variant="outline" size="sm" disabled={!projectUrl && !dbPassword}>
              {credsSaved ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" /> Saved</> : 'Save Credentials'}
            </Button>
            <Button onClick={handleApply} disabled={applying || !constructedDbUrl} size="sm">
              {applying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
              Apply Schema
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {r.success ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className={r.success ? 'text-foreground' : 'text-destructive'}>{r.label}</span>
                  {r.error && <span className="text-muted-foreground truncate ml-1">— {r.error}</span>}
                </div>
              ))}
            </div>
          )}

          {error && !results.length && (
            <div className="mt-3 flex items-start gap-2 bg-destructive/10 text-destructive rounded-md p-3 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {sql && <FileBlock name="Generated SQL" content={sql} filename="migration.sql" />}
        </CardContent>
      </Card>

      {result?.integrationGuide && result.integrationGuide.length > 0 && (
        <TutorialSteps steps={result.integrationGuide} title="Connect Your Frontend to Supabase" />
      )}
    </div>
  );
};

// ─── Firebase Deploy ───
const FirebaseDeploy = ({ project, onUpdateProject }: DeployAndTutorialProps) => {
  const result = project.result;
  const [fbProjectId, setFbProjectId] = useState(project.firebaseConfig?.projectId || '');
  const [applying, setApplying] = useState(false);
  const [output, setOutput] = useState<{ rules?: string; indexes?: string } | null>(null);

  const handleApply = async () => {
    if (!fbProjectId) { toast.error('Enter Firebase Project ID'); return; }
    if (!result?.tables) { toast.error('No tables'); return; }
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-firebase', {
        body: { tables: result.tables, firebaseProjectId: fbProjectId },
      });
      if (error) throw error;
      setOutput({ rules: data.firestoreRules, indexes: JSON.stringify(data.firestoreIndexes, null, 2) });
      onUpdateProject({ firebaseConfig: { projectId: fbProjectId, serviceAccountJson: '', connected: true } });
      toast.success('Firebase configs generated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate Firebase config');
    } finally {
      setApplying(false);
    }
  };

  const firebaseTutorial: TutorialStep[] = [
    { title: 'Install Firebase CLI', description: 'Install the Firebase CLI globally.', code: 'npm install -g firebase-tools', language: 'bash' },
    { title: 'Login to Firebase', description: 'Authenticate with your Firebase account.', code: 'firebase login', language: 'bash' },
    { title: 'Initialize Firestore', description: 'Set up Firestore in your project directory.', code: `firebase init firestore --project ${fbProjectId || 'your-project-id'}`, language: 'bash' },
    { title: 'Deploy Rules & Indexes', description: 'Copy the generated files above, then deploy.', code: 'firebase deploy --only firestore:rules,firestore:indexes', language: 'bash' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4" /> Firebase Setup
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
          <Button onClick={handleApply} disabled={applying} size="sm">
            {applying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Flame className="h-3.5 w-3.5 mr-1.5" />}
            Generate Firebase Config
          </Button>

          {output && (
            <div className="space-y-3 mt-3">
              {output.rules && <FileBlock name="firestore.rules" content={output.rules} filename="firestore.rules" />}
              {output.indexes && <FileBlock name="firestore.indexes.json" content={output.indexes} filename="firestore.indexes.json" />}
            </div>
          )}
        </CardContent>
      </Card>

      <TutorialSteps steps={firebaseTutorial} title="Deploy to Firebase" />

      {result?.integrationGuide && result.integrationGuide.length > 0 && (
        <TutorialSteps steps={result.integrationGuide} title="Connect Your Frontend" />
      )}
    </div>
  );
};

// ─── Local Deploy ───
const LocalDeploy = ({ project }: DeployAndTutorialProps) => {
  const result = project.result;

  const dockerFiles = [
    { name: 'Dockerfile', content: result?.dockerfile, filename: 'Dockerfile' },
    { name: 'docker-compose.yml', content: result?.dockerCompose, filename: 'docker-compose.yml' },
    { name: '.env.example', content: result?.envTemplate, filename: '.env.example' },
  ].filter(f => f.content);

  const localTutorial: TutorialStep[] = [
    { title: 'Install Docker', description: 'Make sure Docker and Docker Compose are installed on your machine.', code: '# macOS\nbrew install --cask docker\n\n# Ubuntu\nsudo apt install docker.io docker-compose', language: 'bash' },
    { title: 'Download the files', description: 'Download the Dockerfile, docker-compose.yml, and .env.example above into a project folder.', code: 'mkdir my-backend && cd my-backend\n# Place downloaded files here', language: 'bash' },
    { title: 'Configure environment', description: 'Copy .env.example to .env and fill in your values.', code: 'cp .env.example .env\n# Edit .env with your database credentials, API keys, etc.', language: 'bash' },
    { title: 'Start your backend', description: 'Run Docker Compose to start all services.', code: 'docker-compose up -d', language: 'bash' },
    { title: 'Verify it\'s running', description: 'Check that your containers are up and healthy.', code: 'docker-compose ps\ncurl http://localhost:3000/health', language: 'bash' },
  ];

  return (
    <div className="space-y-4">
      {dockerFiles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Download Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dockerFiles.map((f) => (
              <FileBlock key={f.name} name={f.name} content={f.content!} filename={f.filename} />
            ))}
          </CardContent>
        </Card>
      )}

      <TutorialSteps steps={localTutorial} title="How to Self-Host Your Backend" />

      {result?.integrationGuide && result.integrationGuide.length > 0 && (
        <TutorialSteps steps={result.integrationGuide} title="Connect Your Frontend" />
      )}
    </div>
  );
};

// ─── Cloud Deploy ───
const CloudDeploy = () => (
  <Card>
    <CardContent className="py-16 text-center">
      <Cloud className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-sm font-medium mb-1">Cloud Hosting — Coming Soon</h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        One-click deployment to the cloud is under development. In the meantime, use the Local option to self-host with Docker.
      </p>
    </CardContent>
  </Card>
);

// ─── Main Component ───
const DeployAndTutorial = (props: DeployAndTutorialProps) => {
  const { project } = props;

  switch (project.backendType) {
    case 'supabase':
      return <SupabaseDeploy {...props} />;
    case 'firebase':
      return <FirebaseDeploy {...props} />;
    case 'local':
      return <LocalDeploy {...props} />;
    case 'cloud':
      return <CloudDeploy />;
    default:
      return <SupabaseDeploy {...props} />;
  }
};

export default DeployAndTutorial;
