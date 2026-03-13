import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiRoute, DatabaseTable } from '@/types/project';
import { ChevronDown, ChevronRight, Lock, Copy, Check } from 'lucide-react';

interface SwaggerDocsProps {
  routes: ApiRoute[];
  tables: DatabaseTable[];
  projectName: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  PATCH: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const typeToJsonType = (t: string): string => {
  const lower = t.toLowerCase();
  if (lower.includes('int') || lower.includes('serial') || lower.includes('float') || lower.includes('decimal') || lower.includes('numeric') || lower.includes('double')) return 'number';
  if (lower.includes('bool')) return 'boolean';
  if (lower.includes('json') || lower.includes('array')) return 'object';
  return 'string';
};

const SwaggerDocs = ({ routes, tables, projectName }: SwaggerDocsProps) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [copiedSpec, setCopiedSpec] = useState(false);

  const toggle = (i: number) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  // Find the table that matches a route
  const getTableForRoute = (route: ApiRoute): DatabaseTable | undefined => {
    const pathParts = route.path.split('/').filter(Boolean);
    const resource = pathParts.find(p => !p.startsWith(':'));
    if (!resource) return undefined;
    return tables.find(t => t.name.toLowerCase() === resource.toLowerCase() || t.name.toLowerCase() === resource.replace(/-/g, '_').toLowerCase());
  };

  // Generate OpenAPI spec
  const generateOpenApiSpec = () => {
    const paths: Record<string, any> = {};
    routes.forEach(route => {
      const table = getTableForRoute(route);
      const pathKey = route.path.replace(/:(\w+)/g, '{$1}');
      if (!paths[pathKey]) paths[pathKey] = {};
      
      const operation: any = {
        summary: route.description,
        responses: { '200': { description: 'Successful response' } },
      };
      if (route.auth_required) {
        operation.security = [{ bearerAuth: [] }];
      }
      if (['POST', 'PUT', 'PATCH'].includes(route.method) && table) {
        const properties: Record<string, any> = {};
        table.columns.filter(c => !c.primary_key && c.name !== 'created_at' && c.name !== 'updated_at')
          .forEach(c => { properties[c.name] = { type: typeToJsonType(c.type) }; });
        operation.requestBody = {
          content: { 'application/json': { schema: { type: 'object', properties } } },
        };
      }
      paths[pathKey][route.method.toLowerCase()] = operation;
    });

    return {
      openapi: '3.0.0',
      info: { title: `${projectName} API`, version: '1.0.0' },
      paths,
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    };
  };

  const copySpec = () => {
    navigator.clipboard.writeText(JSON.stringify(generateOpenApiSpec(), null, 2));
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  // Group routes by resource
  const grouped = routes.reduce<Record<string, { routes: (ApiRoute & { index: number })[] }>>((acc, route, i) => {
    const parts = route.path.split('/').filter(Boolean);
    const resource = parts[0] || 'root';
    if (!acc[resource]) acc[resource] = { routes: [] };
    acc[resource].routes.push({ ...route, index: i });
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">API Documentation</h3>
          <p className="text-xs text-muted-foreground">OpenAPI 3.0 · {routes.length} endpoints</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={copySpec}>
          {copiedSpec ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copiedSpec ? 'Copied' : 'Copy OpenAPI Spec'}
        </Button>
      </div>

      {Object.entries(grouped).map(([resource, { routes: groupRoutes }]) => (
        <div key={resource}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">/{resource}</h4>
          <div className="space-y-2">
            {groupRoutes.map(route => {
              const isOpen = expanded[route.index];
              const table = getTableForRoute(route);

              return (
                <Card key={route.index} className="overflow-hidden">
                  <button
                    onClick={() => toggle(route.index)}
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                  >
                    <Badge variant="outline" className={`font-mono text-xs min-w-[55px] justify-center border ${METHOD_COLORS[route.method] || ''}`}>
                      {route.method}
                    </Badge>
                    <code className="text-sm font-mono flex-1">{route.path}</code>
                    {route.auth_required && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground hidden sm:inline max-w-[200px] truncate">{route.description}</span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isOpen && (
                    <CardContent className="px-4 pb-4 pt-0 border-t border-border">
                      <div className="space-y-3 mt-3">
                        <p className="text-sm text-muted-foreground">{route.description}</p>

                        {route.auth_required && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            <span>Requires authentication (Bearer token)</span>
                          </div>
                        )}

                        {/* Request body schema */}
                        {['POST', 'PUT', 'PATCH'].includes(route.method) && table && (
                          <div>
                            <h5 className="text-xs font-medium mb-2">Request Body</h5>
                            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto">
{JSON.stringify(
  Object.fromEntries(
    table.columns
      .filter(c => !c.primary_key && c.name !== 'created_at' && c.name !== 'updated_at')
      .map(c => [c.name, typeToJsonType(c.type) === 'number' ? 0 : typeToJsonType(c.type) === 'boolean' ? false : 'string'])
  ),
  null,
  2
)}
                            </pre>
                          </div>
                        )}

                        {/* Response schema */}
                        {table && (
                          <div>
                            <h5 className="text-xs font-medium mb-2">Response Schema</h5>
                            <div className="bg-muted rounded-md overflow-hidden">
                              <table className="w-full text-xs font-mono">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left p-2 text-muted-foreground">Field</th>
                                    <th className="text-left p-2 text-muted-foreground">Type</th>
                                    <th className="text-left p-2 text-muted-foreground">Required</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {table.columns.map(col => (
                                    <tr key={col.name} className="border-b border-border/50 last:border-0">
                                      <td className="p-2">{col.name}</td>
                                      <td className="p-2 text-primary">{typeToJsonType(col.type)}</td>
                                      <td className="p-2 text-muted-foreground">{col.nullable ? 'No' : 'Yes'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SwaggerDocs;
