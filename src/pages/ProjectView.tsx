import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/context/ProjectContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil } from 'lucide-react';
import DockerTab from '@/components/DockerTab';
import DeployTab from '@/components/DeployTab';
import IntegrationTutorial from '@/components/IntegrationTutorial';

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject } = useProjects();
  const project = getProject(id!);

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4">Project not found.</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const result = project.result;

  const handleUpdateProject = (updates: Partial<typeof project>) => {
    updateProject(project.id, updates);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">
              {project.backendType} · {new Date(project.createdAt).toLocaleDateString()}
              {project.repoSource && <> · Imported from {project.repoSource.type}</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/create')}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Prompt
          </Button>
        </div>

        {!result ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                {project.status === 'generating' ? 'Generating your backend...' : 'No generation result available.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="schema">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="schema">Schema</TabsTrigger>
              <TabsTrigger value="routes">API Routes</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="docker">Docker</TabsTrigger>
              <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
            </TabsList>

            <TabsContent value="schema">
              <div className="grid gap-4">
                {result.tables.map((table) => (
                  <Card key={table.name}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-mono flex items-center gap-2">
                        {table.name}
                        <Badge variant="outline" className="text-xs font-normal">
                          {table.columns.length} columns
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md bg-muted/50 overflow-hidden">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left p-2 text-muted-foreground font-medium">Column</th>
                              <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
                              <th className="text-left p-2 text-muted-foreground font-medium">Nullable</th>
                              <th className="text-left p-2 text-muted-foreground font-medium">Default</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns.map((col) => (
                              <tr key={col.name} className="border-b border-border/50 last:border-0">
                                <td className="p-2">
                                  {col.name}
                                  {col.primary_key && <Badge className="ml-2 text-[10px] h-4" variant="outline">PK</Badge>}
                                </td>
                                <td className="p-2 text-primary">{col.type}</td>
                                <td className="p-2 text-muted-foreground">{col.nullable ? 'yes' : 'no'}</td>
                                <td className="p-2 text-muted-foreground">{col.default || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="routes">
              <div className="space-y-2">
                {result.routes.map((route, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Badge variant="outline" className="font-mono text-xs min-w-[60px] justify-center">
                        {route.method}
                      </Badge>
                      <code className="text-sm font-mono flex-1">{route.path}</code>
                      <span className="text-xs text-muted-foreground">{route.description}</span>
                      {route.auth_required && <Badge variant="secondary" className="text-xs">Auth</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="features">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Authentication</h3>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={result.auth.enabled ? 'default' : 'secondary'}>
                          {result.auth.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {result.auth.providers.map(p => (
                          <Badge key={p} variant="outline">{p}</Badge>
                        ))}
                        {result.auth.roles.map(r => (
                          <Badge key={r} variant="outline">{r}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-2">Detected Features</h3>
                      <div className="flex gap-2 flex-wrap">
                        {result.features.map(f => (
                          <Badge key={f} variant="outline">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docker">
              <DockerTab
                dockerfile={result.dockerfile}
                dockerCompose={result.dockerCompose}
                envTemplate={result.envTemplate}
              />
            </TabsContent>

            <TabsContent value="tutorial">
              {result.integrationGuide && result.integrationGuide.length > 0 ? (
                <IntegrationTutorial steps={result.integrationGuide} backendType={project.backendType} />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <p className="text-muted-foreground">No integration tutorial available for this project. Re-generate to include tutorial steps.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardContent className="p-6">
                  <div className="bg-muted/50 rounded-md p-4 font-mono text-xs text-muted-foreground space-y-1">
                    <p>[{new Date(project.createdAt).toISOString()}] Project created</p>
                    <p>[{new Date(project.createdAt).toISOString()}] Generation started for {project.backendType}</p>
                    {project.status === 'ready' && <p>[{new Date().toISOString()}] Generation complete — {result.tables.length} tables, {result.routes.length} routes</p>}
                    {project.supabaseConfig?.connected && <p>[{new Date().toISOString()}] Connected to Supabase: {project.supabaseConfig.url}</p>}
                    {project.firebaseConfig?.connected && <p>[{new Date().toISOString()}] Firebase config generated for: {project.firebaseConfig.projectId}</p>}
                    {project.railwayDeployment && <p>[{new Date().toISOString()}] Railway: {project.railwayDeployment.projectName} — {project.railwayDeployment.status}</p>}
                    {project.status === 'deployed' && <p>[{new Date().toISOString()}] Deployment complete</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deploy">
              <DeployTab project={project} onUpdateProject={handleUpdateProject} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProjectView;
