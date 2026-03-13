import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, EyeOff, Upload, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EnvVar {
  key: string;
  value: string;
}

interface EnvVarsManagerProps {
  envVars: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
  supabaseConfig?: { url: string; anonKey: string; serviceRoleKey: string; connected: boolean };
}

const SUGGESTED_KEYS = ['DATABASE_URL', 'JWT_SECRET', 'STRIPE_SECRET', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'REDIS_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];

const EnvVarsManager = ({ envVars, onChange, supabaseConfig }: EnvVarsManagerProps) => {
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});
  const [pushing, setPushing] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [showSupabaseForm, setShowSupabaseForm] = useState(false);

  const addVar = (key = '', value = '') => {
    if (key && envVars.some(v => v.key === key)) {
      toast.error(`${key} already exists`);
      return;
    }
    onChange([...envVars, { key, value }]);
  };

  const updateVar = (i: number, field: 'key' | 'value', val: string) => {
    const updated = [...envVars];
    updated[i] = { ...updated[i], [field]: val };
    onChange(updated);
  };

  const removeVar = (i: number) => onChange(envVars.filter((_, idx) => idx !== i));

  const toggleShow = (i: number) => setShowValues(prev => ({ ...prev, [i]: !prev[i] }));

  const pushToSupabase = async () => {
    if (!accessToken || !projectRef) {
      toast.error('Please enter your Supabase access token and project ref');
      return;
    }
    const secrets = envVars.filter(v => v.key && v.value);
    if (secrets.length === 0) {
      toast.error('No environment variables to push');
      return;
    }

    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke('supabase-manage', {
        body: {
          action: 'set-secrets',
          accessToken,
          projectRef,
          secrets: secrets.map(s => ({ name: s.key, value: s.value })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${secrets.length} secrets pushed to Supabase project`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to push secrets');
    } finally {
      setPushing(false);
    }
  };

  const unusedSuggestions = SUGGESTED_KEYS.filter(k => !envVars.some(v => v.key === k));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 py-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Environment Variables</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addVar()}>
              <Plus className="h-3 w-3 mr-1" /> Add Variable
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {envVars.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No environment variables yet. Add one or click a suggestion below.</p>
          )}
          {envVars.map((v, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input
                placeholder="KEY"
                value={v.key}
                onChange={e => updateVar(i, 'key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                className="font-mono text-xs flex-1 max-w-[200px]"
              />
              <span className="text-muted-foreground text-xs">=</span>
              <div className="flex-1 relative">
                <Input
                  type={showValues[i] ? 'text' : 'password'}
                  placeholder="value"
                  value={v.value}
                  onChange={e => updateVar(i, 'value', e.target.value)}
                  className="font-mono text-xs pr-8"
                />
                <button onClick={() => toggleShow(i)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showValues[i] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeVar(i)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}

          {/* Suggestions */}
          {unusedSuggestions.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1.5">Quick add:</p>
              <div className="flex flex-wrap gap-1">
                {unusedSuggestions.map(key => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="text-[10px] font-mono cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => addVar(key, '')}
                  >
                    + {key}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push to Supabase */}
      <Card>
        <CardHeader className="pb-3 py-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" /> Push to Supabase Secrets
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowSupabaseForm(!showSupabaseForm)}>
              {showSupabaseForm ? 'Hide' : 'Configure'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Store your secrets directly in your Supabase project's vault.</p>
        </CardHeader>
        {showSupabaseForm && (
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Ref</label>
              <Input
                placeholder="your-project-ref"
                value={projectRef}
                onChange={e => setProjectRef(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Found in your Supabase dashboard URL: supabase.com/dashboard/project/[ref]</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Personal Access Token</label>
              <Input
                type="password"
                placeholder="sbp_..."
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Generate at supabase.com/dashboard/account/tokens</p>
            </div>
            <Button onClick={pushToSupabase} disabled={pushing || envVars.filter(v => v.key && v.value).length === 0} className="w-full">
              {pushing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Pushing...</> : <><Check className="h-4 w-4 mr-2" /> Push {envVars.filter(v => v.key && v.value).length} Secrets</>}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default EnvVarsManager;
