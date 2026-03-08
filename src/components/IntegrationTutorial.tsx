import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Terminal } from 'lucide-react';
import { TutorialStep } from '@/types/project';

interface IntegrationTutorialProps {
  steps: TutorialStep[];
  backendType: string;
  envTemplate?: string;
}

const IntegrationTutorial = ({ steps, backendType, envTemplate }: IntegrationTutorialProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const envBlock = envTemplate || getDefaultEnv(backendType);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium">Connect Your Frontend</h3>
        <Badge variant="outline" className="text-xs">{backendType}</Badge>
      </div>

      {/* Environment Variables */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Environment Variables
          </CardTitle>
          <p className="text-xs text-muted-foreground">Add these to your frontend project's .env file</p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
              <code>{envBlock}</code>
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => handleCopy(envBlock, -1)}
            >
              {copiedIndex === -1 ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tutorial Steps */}
      {steps.map((step, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono">
                {i + 1}
              </span>
              {step.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto">
                <code>{step.code}</code>
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleCopy(step.code, i)}
              >
                {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

function getDefaultEnv(backendType: string): string {
  switch (backendType) {
    case 'supabase':
      return `VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key`;
    case 'firebase':
      return `VITE_FIREBASE_API_KEY=your-api-key\nVITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com\nVITE_FIREBASE_PROJECT_ID=your-project-id`;
    case 'cloud':
      return `VITE_API_BASE_URL=https://your-app.fly.dev`;
    case 'local':
      return `VITE_API_BASE_URL=http://localhost:3000`;
    default:
      return `VITE_API_BASE_URL=http://localhost:3000`;
  }
}

export default IntegrationTutorial;
