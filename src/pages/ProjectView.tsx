import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects } from '@/context/ProjectContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, HardDrive, Globe, Lock, Image, FileText } from 'lucide-react';
import DeployAndTutorial from '@/components/DeployAndTutorial';

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getProject, updateProject } = useProjects();
  const project = getProject(id!);

  const defaultTab = searchParams.get('tab') === 'deploy' ? 'deploy' : 'schema';

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
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="schema">Schema & API</TabsTrigger>
              <TabsTrigger value="deploy">Deploy & Tutorial</TabsTrigger>
            </TabsList>

            {/* Schema & API Tab */}
            <TabsContent value="schema">
              <div className="space-y-6">
                {/* Enums */}
                {result.enums && result.enums.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Custom Types (Enums)</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.enums.map((e) => (
                        <Card key={e.name} className="inline-block">
                          <CardContent className="p-3">
                            <span className="text-xs font-mono font-medium text-primary">{e.name}</span>
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {e.values.map(v => (
                                <Badge key={v} variant="outline" className="text-[10px] font-mono">{v}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

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
                  <h3 className="text-sm font-medium mb-3">Database Tables ({result.tables.length})</h3>
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
                                  <th className="text-left p-2 text-muted-foreground font-medium">Info</th>
                                </tr>
                              </thead>
                              <tbody>
                                {table.columns.map((col) => (
                                  <tr key={col.name} className="border-b border-border/50 last:border-0">
                                    <td className="p-2">
                                      {col.name}
                                      {col.primary_key && <Badge className="ml-1.5 text-[10px] h-4" variant="outline">PK</Badge>}
                                      {col.unique && !col.primary_key && <Badge className="ml-1.5 text-[10px] h-4" variant="outline">UQ</Badge>}
                                    </td>
                                    <td className="p-2 text-primary">{col.type}</td>
                                    <td className="p-2 text-muted-foreground">
                                      {col.references && <span className="text-xs">→ {col.references}</span>}
                                      {col.on_delete && <span className="text-[10px] ml-1 text-muted-foreground/60">({col.on_delete})</span>}
                                    </td>
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

                {/* Indexes */}
                {result.indexes && result.indexes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Indexes</h3>
                    <div className="space-y-1">
                      {result.indexes.map((idx, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono bg-muted/50 rounded-md px-3 py-2">
                          {idx.unique && <Badge variant="outline" className="text-[10px]">UNIQUE</Badge>}
                          <span className="text-primary">{idx.table}</span>
                          <span className="text-muted-foreground">({idx.columns.join(', ')})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Buckets */}
                {result.storageBuckets && result.storageBuckets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Storage Buckets</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {result.storageBuckets.map((bucket) => {
                        const isImage = bucket.allowedMimeTypes?.some(m => m.startsWith('image'));
                        const isPdf = bucket.allowedMimeTypes?.some(m => m.includes('pdf'));
                        const BucketIcon = isImage ? Image : isPdf ? FileText : HardDrive;
                        return (
                          <Card key={bucket.name}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <BucketIcon className="h-4 w-4 text-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-mono font-medium">{bucket.name}</span>
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                  <Badge variant={bucket.public ? 'default' : 'secondary'} className="text-[10px]">
                                    {bucket.public ? <><Globe className="h-2.5 w-2.5 mr-0.5" /> Public</> : <><Lock className="h-2.5 w-2.5 mr-0.5" /> Private</>}
                                  </Badge>
                                  {bucket.maxFileSize && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {bucket.maxFileSize >= 1048576 ? `${Math.round(bucket.maxFileSize / 1048576)}MB` : `${Math.round(bucket.maxFileSize / 1024)}KB`}
                                    </Badge>
                                  )}
                                  {bucket.allowedMimeTypes?.slice(0, 3).map(m => (
                                    <Badge key={m} variant="outline" className="text-[10px] font-mono">{m.split('/')[1] || m}</Badge>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}


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
