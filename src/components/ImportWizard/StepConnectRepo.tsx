import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Github, Upload, Loader2, Lock, Globe, Search } from 'lucide-react';

interface GitHubRepo {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  updatedAt: string;
}

interface StepConnectRepoProps {
  onNext: (data: {
    githubUrl: string;
    uploadedFiles: Record<string, string>;
    githubToken?: string;
  }) => void;
}

const StepConnectRepo = ({ onNext }: StepConnectRepoProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<{ login: string; avatar: string; name: string } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingOAuth, setLoadingOAuth] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  // Check for OAuth callback code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      exchangeCode(code);
    }
  }, []);

  const handleConnectGitHub = async () => {
    setLoadingOAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-oauth', {
        body: { action: 'get-client-id' },
      });
      if (error) throw error;

      const redirectUri = `${window.location.origin}/import`;
      const scope = 'repo read:user';
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${data.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start GitHub OAuth');
      setLoadingOAuth(false);
    }
  };

  const exchangeCode = async (code: string) => {
    setLoadingOAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-oauth', {
        body: { action: 'exchange-code', code },
      });
      if (error) throw error;

      setGithubToken(data.accessToken);
      setGithubUser(data.user);
      setRepos(data.repos || []);
      toast.success(`Connected as ${data.user.login}`);
    } catch (err: any) {
      toast.error(err.message || 'GitHub OAuth failed');
    } finally {
      setLoadingOAuth(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setGithubUrl(repo.url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const fileContents: Record<string, string> = {};
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) continue;
      try {
        const text = await file.text();
        fileContents[file.webkitRelativePath || file.name] = text;
      } catch { /* skip binary */ }
    }
    setUploadedFiles(fileContents);
    toast.success(`${Object.keys(fileContents).length} files loaded`);
  };

  const canProceed = githubUrl || Object.keys(uploadedFiles).length > 0;

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* GitHub OAuth */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="h-4 w-4" /> Connect GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-muted/50 rounded-md p-3">
                <img src={githubUser.avatar} className="h-8 w-8 rounded-full" alt={githubUser.login} />
                <div>
                  <p className="text-sm font-medium">{githubUser.name || githubUser.login}</p>
                  <p className="text-xs text-muted-foreground">@{githubUser.login} · {repos.length} repos</p>
                </div>
                <Badge variant="default" className="ml-auto text-xs">Connected</Badge>
              </div>

              {/* Search repos */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              {/* Repo list */}
              <div className="max-h-[240px] overflow-y-auto space-y-1 rounded-md border border-border p-1">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.name}
                    onClick={() => handleSelectRepo(repo)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted/50 ${
                      githubUrl === repo.url ? 'bg-primary/10 border border-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {repo.private ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
                      <span className="font-mono text-xs">{repo.name}</span>
                      {repo.language && <Badge variant="outline" className="text-[10px] h-4 ml-auto">{repo.language}</Badge>}
                    </div>
                    {repo.description && <p className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{repo.description}</p>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button onClick={handleConnectGitHub} disabled={loadingOAuth} variant="outline" className="w-full">
                {loadingOAuth ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Github className="h-4 w-4 mr-2" />}
                {loadingOAuth ? 'Connecting...' : 'Connect GitHub Account'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Access private repos via OAuth</p>
            </div>
          )}

          {/* Or paste public URL */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR paste URL</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Input
            placeholder="https://github.com/user/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            accept=".ts,.tsx,.js,.jsx,.json,.html,.css,.md,.yaml,.yml,.toml,.env,.txt"
          />
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Click to upload project files</p>
            <p className="text-xs text-muted-foreground mt-1">Max 20MB each</p>
          </div>
          {Object.keys(uploadedFiles).length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline">{Object.keys(uploadedFiles).length} files loaded</Badge>
              <Button variant="ghost" size="sm" onClick={() => setUploadedFiles({})}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next */}
      <Button className="w-full h-11" disabled={!canProceed} onClick={() => onNext({
        githubUrl,
        uploadedFiles,
        githubToken: githubToken || undefined,
      })}>
        Analyze Project →
      </Button>
    </div>
  );
};

export default StepConnectRepo;
