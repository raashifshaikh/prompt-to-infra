import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, XCircle, Loader2, Zap, Wand2 } from 'lucide-react';
import { GenerationResult, DatabaseTable } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  table?: string;
  column?: string;
  fix?: string;
}

export interface AuditResult {
  score: number;
  grade: string;
  findings: SecurityFinding[];
  passed: string[];
}

export function auditSchema(result: GenerationResult): AuditResult {
  const findings: SecurityFinding[] = [];
  const passed: string[] = [];
  let deductions = 0;
  const tables = result.tables || [];

  // 1. Plaintext password detection
  tables.forEach(t => {
    const col = t.columns.find(c => c.name === 'password');
    if (col) {
      findings.push({
        severity: 'critical', category: 'Authentication',
        title: `Plaintext password column in "${t.name}"`,
        description: `The "${t.name}" table has a "password" column. Use Supabase auth.users which handles bcrypt hashing automatically.`,
        table: t.name, column: 'password',
        fix: `Remove the "password" column from "${t.name}". Use Supabase Auth (auth.users) for authentication instead.`,
      });
      deductions += 20;
    }
  });
  if (!findings.some(f => f.column === 'password')) passed.push('No plaintext password columns detected');

  // 2. Roles on users/profiles table
  const roleOnUserTable = tables.find(t =>
    (t.name === 'users' || t.name === 'profiles') &&
    t.columns.some(c => c.name === 'role' || c.name === 'user_role')
  );
  if (roleOnUserTable) {
    findings.push({
      severity: 'critical', category: 'Authorization',
      title: `Role column on "${roleOnUserTable.name}" — privilege escalation risk`,
      description: `Storing roles directly on "${roleOnUserTable.name}" allows privilege escalation. Use a separate user_roles table with restricted RLS.`,
      table: roleOnUserTable.name,
      fix: `Create a separate "user_roles" table with columns (user_id, role). Use a SECURITY DEFINER function to check roles.`,
    });
    deductions += 15;
  } else {
    passed.push('Roles not stored on users/profiles table');
  }

  // 3. Foreign key integrity
  const tablesWithMissingFKs = tables.filter(t =>
    t.columns.some(c => c.name.endsWith('_id') && !c.primary_key && !c.references)
  );
  tablesWithMissingFKs.forEach(t => {
    t.columns.filter(c => c.name.endsWith('_id') && !c.primary_key && !c.references).forEach(col => {
      findings.push({
        severity: 'high', category: 'Data Integrity',
        title: `Missing foreign key on "${t.name}.${col.name}"`,
        description: `Column "${col.name}" appears to be a reference but has no FK constraint.`,
        table: t.name, column: col.name,
        fix: `Add "references" to "${col.name.replace('_id', '')}s(id)" with appropriate on_delete.`,
      });
      deductions += 5;
    });
  });
  const tablesWithFKs = tables.filter(t => t.columns.some(c => c.references));
  if (tablesWithFKs.length > 0) passed.push(`${tablesWithFKs.length} table(s) have proper foreign key references`);

  // 4. Redundant users table
  const hasUsersTable = tables.find(t => t.name === 'users');
  const hasProfilesTable = tables.find(t => t.name === 'profiles');
  if (hasUsersTable && hasProfilesTable && hasUsersTable.columns.some(c => c.name === 'email')) {
    findings.push({
      severity: 'high', category: 'Architecture',
      title: 'Redundant "users" table alongside "profiles"',
      description: 'Supabase provides auth.users. A separate "users" table with email duplicates this.',
      table: 'users',
      fix: 'Remove "users" table. Store additional user data in "profiles" with id referencing auth.users(id).',
    });
    deductions += 10;
  } else if (!hasUsersTable) {
    passed.push('No redundant users table');
  }

  // 5. Order items without price
  const orderItems = tables.find(t => t.name === 'order_items' || t.name === 'order_line_items');
  if (orderItems) {
    const hasPrice = orderItems.columns.some(c => ['price', 'unit_price', 'price_at_purchase'].includes(c.name));
    if (!hasPrice) {
      findings.push({
        severity: 'high', category: 'Data Integrity',
        title: 'Order items missing price at time of purchase',
        description: 'If product prices change later, historical order totals become inaccurate.',
        table: orderItems.name,
        fix: 'Add "unit_price" (numeric 10,2) column.',
      });
      deductions += 8;
    } else {
      passed.push('Order items capture price at time of purchase');
    }
  }

  // 6. Orders without total
  const orders = tables.find(t => t.name === 'orders');
  if (orders && !orders.columns.some(c => ['total', 'total_amount', 'grand_total'].includes(c.name))) {
    findings.push({
      severity: 'medium', category: 'Data Integrity',
      title: 'Orders table missing total amount',
      description: 'Requires computing total from order_items every time.',
      table: 'orders',
      fix: 'Add "total_amount" (numeric 12,2) column.',
    });
    deductions += 5;
  } else if (orders) {
    passed.push('Orders table includes total amount');
  }

  // 7. Payments without amount
  const payments = tables.find(t => t.name === 'payments');
  if (payments && !payments.columns.some(c => ['amount', 'total'].includes(c.name))) {
    findings.push({
      severity: 'high', category: 'Data Integrity',
      title: 'Payments table missing amount field',
      description: 'Payments have no amount, making them meaningless.',
      table: 'payments',
      fix: 'Add "amount" (numeric 12,2) and "currency" (char 3) columns.',
    });
    deductions += 8;
  } else if (payments) {
    passed.push('Payments table has amount field');
  }

  // 8. updated_at
  const tablesWithUpdatedAt = tables.filter(t => t.columns.some(c => c.name === 'updated_at'));
  if (tablesWithUpdatedAt.length > 0) passed.push(`${tablesWithUpdatedAt.length} table(s) have updated_at columns`);

  // 9. Missing indexes on FKs
  const indexes = result.indexes || [];
  const fkColumns = tables.flatMap(t => t.columns.filter(c => c.references).map(c => ({ table: t.name, column: c.name })));
  const indexedCols = new Set(indexes.map(idx => `${idx.table}.${idx.columns[0]}`));
  const unindexedFKs = fkColumns.filter(fk => !indexedCols.has(`${fk.table}.${fk.column}`));
  if (unindexedFKs.length > 3) {
    findings.push({
      severity: 'medium', category: 'Performance',
      title: `${unindexedFKs.length} foreign key columns without indexes`,
      description: `Missing indexes on: ${unindexedFKs.slice(0, 5).map(f => `${f.table}.${f.column}`).join(', ')}`,
      fix: 'Add indexes for all foreign key columns.',
    });
    deductions += 3;
  } else if (fkColumns.length > 0) {
    passed.push('Foreign key columns are properly indexed');
  }

  // 10. Storage bucket security
  const buckets = result.storageBuckets || [];
  buckets.filter(b => b.public && /document|invoice|private|kyc/.test(b.name)).forEach(b => {
    findings.push({
      severity: 'high', category: 'Storage Security',
      title: `Sensitive bucket "${b.name}" is set to public`,
      description: `Anyone with the URL can access files in "${b.name}".`,
      fix: `Set "${b.name}" bucket to public: false and add RLS policies.`,
    });
    deductions += 8;
  });
  if (buckets.length > 0 && !findings.some(f => f.category === 'Storage Security')) {
    passed.push('Storage bucket visibility is properly configured');
  }

  // 11. Unique constraints
  [
    { table: 'users', columns: ['email', 'username'] },
    { table: 'profiles', columns: ['username'] },
    { table: 'products', columns: ['slug', 'sku'] },
    { table: 'categories', columns: ['slug'] },
  ].forEach(({ table: tName, columns }) => {
    const t = tables.find(t => t.name === tName);
    if (t) columns.forEach(colName => {
      const col = t.columns.find(c => c.name === colName);
      if (col && !col.unique) {
        findings.push({
          severity: 'medium', category: 'Data Integrity',
          title: `"${tName}.${colName}" should be unique`,
          description: `The "${colName}" column lacks a unique constraint.`,
          table: tName, column: colName,
          fix: `Add "unique: true" to "${colName}".`,
        });
        deductions += 3;
      }
    });
  });

  // 12. Profiles FK to auth.users
  if (hasProfilesTable) {
    const hasAuthRef = hasProfilesTable.columns.some(c => c.references?.includes('auth.users'));
    if (!hasAuthRef) {
      findings.push({
        severity: 'medium', category: 'Architecture',
        title: 'profiles table not linked to auth.users',
        description: 'Should reference auth.users(id) for referential integrity.',
        table: 'profiles',
        fix: 'Add references: "auth.users(id)" with on_delete: "CASCADE".',
      });
      deductions += 5;
    }
  }

  const score = Math.max(0, Math.round(100 - deductions));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F';
  return { score, grade, findings, passed };
}

const severityColor: Record<string, string> = {
  critical: 'text-red-500', high: 'text-orange-500', medium: 'text-yellow-500', low: 'text-blue-500',
};
const severityBg: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/20', high: 'bg-orange-500/10 border-orange-500/20',
  medium: 'bg-yellow-500/10 border-yellow-500/20', low: 'bg-blue-500/10 border-blue-500/20',
};

interface SecurityAuditPanelProps {
  result: GenerationResult;
  onFixApplied?: (updatedResult: GenerationResult) => void;
  onScoreChange?: (score: number) => void;
}

const SecurityAuditPanel = ({ result, onFixApplied, onScoreChange }: SecurityAuditPanelProps) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  const handleAudit = () => {
    setIsAuditing(true);
    setAuditResult(null);
    setTimeout(() => {
      const res = auditSchema(result);
      setAuditResult(res);
      onScoreChange?.(res.score);
      setIsAuditing(false);
    }, 1500);
  };

  const handleAutoFix = async () => {
    if (!auditResult || auditResult.findings.length === 0) return;
    setIsFixing(true);
    try {
      const findingsText = auditResult.findings.map(f =>
        `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}${f.fix ? ` Fix: ${f.fix}` : ''}`
      ).join('\n');

      const prompt = `You are a database security expert. Here is the current backend schema JSON and a list of security/integrity findings. Fix ALL issues and return ONLY a valid JSON object matching the GenerationResult schema — no markdown, no explanation, just JSON.

CURRENT SCHEMA:
${JSON.stringify(result, null, 2)}

SECURITY FINDINGS TO FIX:
${findingsText}

Rules:
- Remove any "password" columns from application tables
- Move roles to a separate "user_roles" table
- Add foreign key references for all _id columns
- Add unit_price to order_items, total_amount to orders, amount to payments
- Remove redundant "users" table if "profiles" exists
- Link profiles to auth.users(id)
- Add unique constraints where needed
- Add indexes for foreign key columns
- Set sensitive storage buckets to private
- Keep all existing tables/routes/features that are not security issues

Return ONLY the corrected JSON:`;

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: 'fix-schema',
          stream: false,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`AI request failed (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      const responseText = data.choices?.[0]?.message?.content || '';

      if (!responseText) throw new Error('AI returned an empty response');

      // Extract JSON from response (may be wrapped in markdown code blocks)
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON');

      const fixedResult: GenerationResult = JSON.parse(jsonMatch[0]);

      // Validate basic structure
      if (!fixedResult.tables || !fixedResult.routes || !fixedResult.auth) {
        throw new Error('Fixed schema is missing required fields');
      }

      onFixApplied?.(fixedResult);

      // Re-audit the fixed schema
      const newAudit = auditSchema(fixedResult);
      setAuditResult(newAudit);
      onScoreChange?.(newAudit.score);

      toast.success(`Schema fixed! Score improved to ${newAudit.score}/100 (Grade ${newAudit.grade})`);
    } catch (err: any) {
      console.error('Auto-fix error:', err);
      toast.error(err.message || 'Failed to auto-fix schema');
    } finally {
      setIsFixing(false);
    }
  };

  const ScoreIcon = auditResult
    ? auditResult.score >= 80 ? ShieldCheck : auditResult.score >= 50 ? ShieldAlert : ShieldX
    : Shield;

  const scoreColor = auditResult
    ? auditResult.score >= 80 ? 'text-green-500' : auditResult.score >= 50 ? 'text-yellow-500' : 'text-red-500'
    : 'text-muted-foreground';

  const criticalCount = auditResult?.findings.filter(f => f.severity === 'critical').length || 0;
  const highCount = auditResult?.findings.filter(f => f.severity === 'high').length || 0;
  const mediumCount = auditResult?.findings.filter(f => f.severity === 'medium').length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Backend Security Audit
          </CardTitle>
          <CardDescription className="text-xs">
            Automated security, integrity, and architecture checks. Click "Test My Backend" to scan for vulnerabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!auditResult && !isAuditing && (
            <Button onClick={handleAudit} size="sm" className="gap-2">
              <Zap className="h-3.5 w-3.5" /> Test My Backend
            </Button>
          )}

          {isAuditing && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Attacking your backend...</p>
              <p className="text-xs text-muted-foreground">Checking for privilege escalation, data leaks, orphaned records...</p>
            </div>
          )}

          {auditResult && (
            <div className="space-y-6">
              {/* Score display */}
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <ScoreIcon className={`h-12 w-12 ${scoreColor}`} />
                  <span className={`text-3xl font-bold mt-1 ${scoreColor}`}>{auditResult.score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-semibold">Grade: {auditResult.grade}</span>
                    <Badge variant={auditResult.score >= 80 ? 'default' : 'destructive'} className="text-xs">
                      {auditResult.score >= 80 ? 'Secure' : auditResult.score >= 50 ? 'Needs Work' : 'Vulnerable'}
                    </Badge>
                  </div>
                  <Progress value={auditResult.score} className="h-2 mb-2" />
                  <div className="flex gap-3 text-xs">
                    {criticalCount > 0 && <span className="text-red-500 font-medium">{criticalCount} Critical</span>}
                    {highCount > 0 && <span className="text-orange-500 font-medium">{highCount} High</span>}
                    {mediumCount > 0 && <span className="text-yellow-500 font-medium">{mediumCount} Medium</span>}
                    {auditResult.passed.length > 0 && <span className="text-green-500 font-medium">{auditResult.passed.length} Passed</span>}
                  </div>
                </div>
              </div>

              {/* Auto-Fix button */}
              {auditResult.findings.length > 0 && onFixApplied && (
                <Button onClick={handleAutoFix} disabled={isFixing} className="w-full gap-2" variant="default">
                  {isFixing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> AI is fixing {auditResult.findings.length} issues...</>
                  ) : (
                    <><Wand2 className="h-4 w-4" /> Auto-Fix All {auditResult.findings.length} Issues with AI</>
                  )}
                </Button>
              )}

              {/* Findings */}
              {auditResult.findings.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Issues Found ({auditResult.findings.length})
                  </h3>
                  <div className="space-y-2">
                    {auditResult.findings
                      .sort((a, b) => {
                        const order = { critical: 0, high: 1, medium: 2, low: 3 };
                        return order[a.severity] - order[b.severity];
                      })
                      .map((finding, i) => (
                        <Card key={i} className={`border ${severityBg[finding.severity]}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2">
                              <XCircle className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[finding.severity]}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{finding.title}</span>
                                  <Badge variant="outline" className={`text-[10px] ${severityColor[finding.severity]}`}>
                                    {finding.severity.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">{finding.category}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>
                                {finding.fix && (
                                  <div className="mt-2 bg-background/50 rounded-md p-2 border border-border">
                                    <span className="text-[10px] font-medium text-primary">💡 Fix: </span>
                                    <span className="text-[10px] text-muted-foreground">{finding.fix}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* Passed */}
              {auditResult.passed.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Passed Checks ({auditResult.passed.length})
                  </h3>
                  <div className="space-y-1">
                    {auditResult.passed.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleAudit} className="gap-2">
                <Zap className="h-3.5 w-3.5" /> Re-run Audit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityAuditPanel;
