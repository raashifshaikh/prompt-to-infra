import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRoute } from '@/types/project';
import { Play, Plus, Trash2, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ApiPlaygroundProps {
  routes: ApiRoute[];
}

interface HeaderPair {
  key: string;
  value: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  PATCH: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const ApiPlayground = ({ routes }: ApiPlaygroundProps) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('');
  const [headers, setHeaders] = useState<HeaderPair[]>([{ key: 'Content-Type', value: 'application/json' }]);
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<{ status: number; statusText: string; body: string; time: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectRoute = (index: string) => {
    const route = routes[parseInt(index)];
    if (route) {
      setMethod(route.method);
      setEndpoint(route.path);
    }
  };

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[i][field] = val;
    setHeaders(updated);
  };

  const sendRequest = async () => {
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
    if (!url || !endpoint) {
      toast.error('Please enter a base URL and endpoint');
      return;
    }

    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      const headerObj: Record<string, string> = {};
      headers.forEach(h => { if (h.key) headerObj[h.key] = h.value; });

      const options: RequestInit = { method, headers: headerObj };
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        options.body = body;
      }

      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - start);
      let responseBody: string;
      try {
        const json = await res.json();
        responseBody = JSON.stringify(json, null, 2);
      } catch {
        responseBody = await res.text();
      }

      setResponse({ status: res.status, statusText: res.statusText, body: responseBody, time: elapsed });
    } catch (err: any) {
      setResponse({ status: 0, statusText: 'Network Error', body: err.message || 'Failed to fetch', time: Math.round(performance.now() - start) });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-500';
    if (status >= 400 && status < 500) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Quick route selector */}
      {routes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Select Route</label>
            <Select onValueChange={selectRoute}>
              <SelectTrigger className="font-mono text-xs">
                <SelectValue placeholder="Choose a generated route..." />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r, i) => (
                  <SelectItem key={i} value={String(i)} className="font-mono text-xs">
                    <span className="font-semibold mr-2">{r.method}</span> {r.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Request builder */}
      <Card>
        <CardHeader className="pb-3 py-4 px-4">
          <CardTitle className="text-sm">Request</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Base URL</label>
            <Input
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <div className="w-28">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Method</label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Endpoint</label>
              <Input
                placeholder="/users"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Headers</label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addHeader}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <Input placeholder="Key" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} className="font-mono text-xs flex-1" />
                  <Input placeholder="Value" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} className="font-mono text-xs flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeHeader(i)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Body (JSON)</label>
              <Textarea
                placeholder='{"name": "John"}'
                value={body}
                onChange={e => setBody(e.target.value)}
                className="font-mono text-xs min-h-[100px]"
              />
            </div>
          )}

          <Button onClick={sendRequest} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</> : <><Play className="h-4 w-4 mr-2" /> Send Request</>}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader className="pb-2 py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Response
                <Badge variant="outline" className={`font-mono text-xs ${statusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </Badge>
                <span className="text-xs text-muted-foreground font-normal">{response.time}ms</span>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyResponse}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
              {response.body}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApiPlayground;
