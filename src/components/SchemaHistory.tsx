import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw, Database, Clock } from 'lucide-react';
import { SchemaSnapshot, GenerationResult } from '@/types/project';
import { toast } from 'sonner';

interface SchemaHistoryProps {
  history: SchemaSnapshot[];
  currentResult: GenerationResult;
  onRestore: (result: GenerationResult, label: string) => void;
}

const SchemaHistory = ({ history, currentResult, onRestore }: SchemaHistoryProps) => {
  const handleRestore = (snapshot: SchemaSnapshot) => {
    onRestore(snapshot.result, `Restored from "${snapshot.label}"`);
    toast.success(`Restored schema from "${snapshot.label}"`);
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No history yet</h3>
          <p className="text-sm text-muted-foreground">
            Schema versions will appear here as you make changes through AI auto-fix or schema refinement chat.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Schema Version History
          </CardTitle>
          <CardDescription className="text-xs">
            {history.length} version{history.length !== 1 ? 's' : ''} saved. Restore any previous version instantly.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current version */}
      <Card className="border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-sm font-medium">Current Version</span>
                <div className="flex gap-2 mt-0.5">
                  <Badge variant="default" className="text-[10px]">Active</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {currentResult.tables.length} tables · {currentResult.routes.length} routes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History entries */}
      <div className="space-y-2">
        {[...history].reverse().map((snapshot, i) => (
          <Card key={i} className="hover:border-primary/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">{snapshot.label}</span>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(snapshot.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {snapshot.result.tables.length} tables · {snapshot.result.routes.length} routes
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handleRestore(snapshot)}
                >
                  <RotateCcw className="h-3 w-3" /> Restore
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SchemaHistory;
