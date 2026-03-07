import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/context/ProjectContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Database, Server, Cloud, HardDrive, Trash2 } from 'lucide-react';

const typeIcons: Record<string, React.ElementType> = {
  supabase: Database,
  firebase: Server,
  local: HardDrive,
  cloud: Cloud,
};

const statusColors: Record<string, string> = {
  generating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ready: 'bg-primary/20 text-primary border-primary/30',
  deployed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  error: 'bg-destructive/20 text-destructive border-destructive/30',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { projects, deleteProject } = useProjects();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your generated backends</p>
          </div>
          <Button onClick={() => navigate('/create')}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create New Backend
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Database className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground mb-4">No projects yet. Create your first backend!</p>
              <Button variant="outline" onClick={() => navigate('/create')}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Backend
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => {
              const Icon = typeIcons[project.backendType] || Database;
              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors group"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {new Date(project.createdAt).toLocaleDateString()} · {project.backendType}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[project.status]}>
                        {project.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.prompt}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
