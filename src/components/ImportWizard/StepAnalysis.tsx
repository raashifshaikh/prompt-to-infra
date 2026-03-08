import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Database, Globe, ArrowLeft } from 'lucide-react';

interface StepAnalysisProps {
  githubUrl: string;
  uploadedFiles: Record<string, string>;
  githubToken?: string;
  onNext: (analysis: any) => void;
  onBack: () => void;
}

const StepAnalysis = ({ githubUrl, uploadedFiles, githubToken, onNext, onBack }: StepAnalysisProps) => {
  const [analyzing, setAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('analyze-repo', {
        body: {
          githubUrl: githubUrl || undefined,
          uploadedFiles: Object.keys(uploadedFiles).length > 0 ? uploadedFiles : undefined,
          githubToken: githubToken || undefined,
        },
      });
      if (err) throw err;
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      toast.error('Failed to analyze project');
    } finally {
      setAnalyzing(false);
    }
  };

  if (analyzing) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing your project structure...</p>
          <p className="text-xs text-muted-foreground">Detecting entities, API calls, and authentication patterns</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={runAnalysis}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis?.detectedStack && (
            <div>
              <h3 className="text-sm font-medium mb-2">Detected Tech Stack</h3>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(analysis.detectedStack).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">{key}: {String(value)}</Badge>
                ))}
              </div>
            </div>
          )}

          {analysis?.tables?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Database className="h-3.5 w-3.5" /> Detected Entities
              </h3>
              <div className="flex gap-2 flex-wrap">
                {analysis.tables.map((t: any) => (
                  <Badge key={t.name} variant="secondary" className="font-mono text-xs">
                    {t.name} ({t.columns?.length || 0} cols)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis?.routes?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" /> Suggested Routes
              </h3>
              <div className="space-y-1">
                {analysis.routes.slice(0, 8).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <Badge variant="outline" className="min-w-[50px] justify-center">{r.method}</Badge>
                    <span className="text-muted-foreground">{r.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis?.features && (
            <div>
              <h3 className="text-sm font-medium mb-2">Features</h3>
              <div className="flex gap-2 flex-wrap">
                {analysis.features.map((f: string) => (
                  <Badge key={f} variant="outline">{f}</Badge>
                ))}
              </div>
            </div>
          )}

          {analysis?.reasoning && (
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-xs text-muted-foreground">{analysis.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button className="flex-1" onClick={() => onNext(analysis)}>
          Choose Backend Type →
        </Button>
      </div>
    </div>
  );
};

export default StepAnalysis;
