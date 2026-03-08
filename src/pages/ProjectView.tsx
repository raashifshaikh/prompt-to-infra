import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/context/ProjectContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import DeployAndTutorial from '@/components/DeployAndTutorial';

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
            <TabsList className="mb-4">
              <TabsTrigger value="schema">Schema & API</TabsTrigger>
              <TabsTrigger value="deploy">Deploy & Tutorial</TabsTrigger>
            </TabsList>

            {/* Schema & API Tab */}
            <TabsContent value="schema">
              <div className="space-y-6">
                {/* Auth & Features Summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Authentication</h3>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant={result.auth.enabled ? 'default' : 'secondary'} className="text-xs">
                            {result.auth.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {result.auth.providers.map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                          {result.auth.roles.map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Features</h3>
                        <div className="flex gap-1.5 flex-wrap">
                          {result.features.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tables */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Database Tables</h3>
                  <div className="grid gap-3">
                    {result.tables.map((table) => (
                      <Card key={table.name}>
                        <CardHeader className="pb-2 py-3 px-4">
                          <CardTitle className="text-sm font-mono flex items-center gap-2">
                            {table.name}
                            <Badge variant="outline" className="text-xs font-normal">{table.columns.length} cols</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <div className="rounded-md bg-muted/50 overflow-hidden">
                            <table className="w-full text-xs font-mono">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left p-2 text-muted-foreground font-medium">Column</th>
                                  <th className="text-left p-2 text-muted-foreground font-medium">Type</th>
                                  <th className="text-left p-2 text-muted-foreground font-medium">Nullable</th>
                                </tr>
                              </thead>
                              <tbody>
                                {table.columns.map((col) => (
                                  <tr key={col.name} className="border-b border-border/50 last:border-0">
                                    <td className="p-2">
                                      {col.name}
                                      {col.primary_key && <Badge className="ml-1.5 text-[10px] h-4" variant="outline">PK</Badge>}
                                    </td>
                                    <td className="p-2 text-primary">{col.type}</td>
                                    <td className="p-2 text-muted-foreground">{col.nullable ? 'yes' : 'no'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* API Routes */}
                <div>
                  <h3 className="text-sm font-medium mb-3">API Routes</h3>
                  <div className="space-y-2">
                    {result.routes.map((route, i) => (
                      <Card key={i}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs min-w-[55px] justify-center">
                            {route.method}
                          </Badge>
                          <code className="text-sm font-mono flex-1">{route.path}</code>
                          <span className="text-xs text-muted-foreground hidden sm:inline">{route.description}</span>
                          {route.auth_required && <Badge variant="secondary" className="text-xs">Auth</Badge>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Deploy & Tutorial Tab */}
            <TabsContent value="deploy">
              <DeployAndTutorial project={project} onUpdateProject={handleUpdateProject} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProjectView;
