import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { TutorialStep } from '@/types/project';

interface IntegrationTutorialProps {
  steps: TutorialStep[];
  backendType: string;
}

const IntegrationTutorial = ({ steps, backendType }: IntegrationTutorialProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium">Connect Your Frontend</h3>
        <Badge variant="outline" className="text-xs">{backendType}</Badge>
      </div>

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

export default IntegrationTutorial;
