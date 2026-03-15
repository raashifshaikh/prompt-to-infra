import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/context/ProjectContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { PlusCircle, Database, Server, Cloud, HardDrive, Trash2, Search, Sparkles, Shield } from 'lucide-react';

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
  const [search, setSearch] = useState('');

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.prompt.toLowerCase().includes(search.toLowerCase())
  );

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

        {projects.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        )}

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
                Create your first AI-generated backend in seconds. Describe your app and we'll handle the rest.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/chat')}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start with AI Chat
                </Button>
                <Button variant="outline" onClick={() => navigate('/create')}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Backend
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No projects matching "{search}"
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((project, i) => {
              const Icon = typeIcons[project.backendType] || Database;
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/30 hover:shadow-md hover:shadow-primary/[0.04] transition-all duration-200 group"
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
                        {project.securityScore !== undefined && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 ${
                              project.securityScore >= 80
                                ? 'text-green-500 border-green-500/30'
                                : project.securityScore >= 50
                                  ? 'text-yellow-500 border-yellow-500/30'
                                  : 'text-red-500 border-red-500/30'
                            }`}
                          >
                            <Shield className="h-2.5 w-2.5" /> {project.securityScore}
                          </Badge>
                        )}
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
