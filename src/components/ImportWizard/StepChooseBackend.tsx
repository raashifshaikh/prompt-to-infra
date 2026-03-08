import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Cloud, HardDrive, ArrowLeft } from 'lucide-react';

interface StepChooseBackendProps {
  suggestedType?: string;
  onNext: (backendType: 'supabase' | 'firebase' | 'local' | 'cloud') => void;
  onBack: () => void;
}

const options = [
  {
    type: 'local' as const,
    icon: HardDrive,
    title: 'Local Backend',
    description: 'Download a Node.js project. Run with npm install && npm run dev.',
    detail: 'Generates server.js, routes, models, package.json',
  },
  {
    type: 'cloud' as const,
    icon: Cloud,
    title: 'Cloud (Fly.io)',
    description: 'Deploy automatically to Fly.io. No setup required.',
    detail: 'Generates Docker config and deploys to https://your-app.fly.dev',
  },
  {
    type: 'supabase' as const,
    icon: Database,
    title: 'Supabase',
    description: 'Serverless backend with auto-generated REST APIs.',
    detail: 'Creates tables, RLS policies, and auto-generates endpoints',
  },
];

const StepChooseBackend = ({ suggestedType, onNext, onBack }: StepChooseBackendProps) => {
  const [selected, setSelected] = useState<'supabase' | 'firebase' | 'local' | 'cloud'>(
    (suggestedType as any) || 'supabase'
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose how you want your backend delivered:</p>

      <div className="grid gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.type;
          const isSuggested = suggestedType === opt.type;
          return (
            <Card
              key={opt.type}
              className={`cursor-pointer transition-all ${
                isSelected ? 'border-primary ring-1 ring-primary/30' : 'hover:border-muted-foreground/30'
              }`}
              onClick={() => setSelected(opt.type)}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted/50'}`}>
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{opt.title}</h3>
                    {isSuggested && <Badge variant="secondary" className="text-[10px]">Suggested</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{opt.detail}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button className="flex-1" onClick={() => onNext(selected)}>
          Generate Backend →
        </Button>
      </div>
    </div>
  );
};

export default StepChooseBackend;
