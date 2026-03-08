import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Download } from 'lucide-react';

interface DockerTabProps {
  dockerfile?: string;
  dockerCompose?: string;
  envTemplate?: string;
}

const DockerTab = ({ dockerfile, dockerCompose, envTemplate }: DockerTabProps) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(name);
    toast.success(`${name} copied to clipboard`);
    setTimeout(() => setCopiedFile(null), 2000);
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

  const files = [
    { name: 'Dockerfile', content: dockerfile, filename: 'Dockerfile' },
    { name: 'docker-compose.yml', content: dockerCompose, filename: 'docker-compose.yml' },
    { name: '.env.example', content: envTemplate, filename: '.env.example' },
  ].filter(f => f.content);

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">No Docker files were generated for this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <Card key={file.name}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              {file.name}
              <Badge variant="outline" className="text-xs font-normal">file</Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleCopy(file.content!, file.name)}
              >
                {copiedFile === file.name ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(file.content!, file.filename)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[400px]">
              <code>{file.content}</code>
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DockerTab;
