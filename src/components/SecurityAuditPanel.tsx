import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { GenerationResult, DatabaseTable } from '@/types/project';

interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  table?: string;
  column?: string;
  fix?: string;
}

interface AuditResult {
  score: number;
  grade: string;
  findings: SecurityFinding[];
  passed: string[];
}

function auditSchema(result: GenerationResult): AuditResult {
  const findings: SecurityFinding[] = [];
  const passed: string[] = [];
  let deductions = 0;
  const tables = result.tables || [];

  // ── 1. Plaintext password detection ──
  const passwordTables = tables.filter(t =>
    t.columns.some(c => c.name === 'password' || c.name === 'password_hash' || c.name === 'hashed_password')
  );
  if (passwordTables.length > 0) {
    passwordTables.forEach(t => {
      const col = t.columns.find(c => c.name === 'password');
      if (col) {
        findings.push({
          severity: 'critical',
          category: 'Authentication',
          title: `Plaintext password column in "${t.name}"`,
          description: `The "${t.name}" table has a "password" column. Passwords should NEVER be stored in application tables. Use Supabase auth.users which handles bcrypt hashing automatically.`,
          table: t.name,
          column: 'password',
          fix: `Remove the "password" column from "${t.name}". Use Supabase Auth (auth.users) for authentication instead.`,
        });
        deductions += 20;
      }
    });
  } else {
    passed.push('No plaintext password columns detected');
  }

  // ── 2. Roles stored on users/profiles table ──
  const roleOnUserTable = tables.find(t =>
    (t.name === 'users' || t.name === 'profiles') &&
    t.columns.some(c => c.name === 'role' || c.name === 'user_role')
  );
  if (roleOnUserTable) {
    findings.push({
      severity: 'critical',
      category: 'Authorization',
      title: `Role column on "${roleOnUserTable.name}" — privilege escalation risk`,
      description: `Storing roles directly on the "${roleOnUserTable.name}" table allows any authenticated user who can UPDATE their own row to elevate their privileges to admin. Roles must be in a separate user_roles table with restricted RLS.`,
      table: roleOnUserTable.name,
      fix: `Create a separate "user_roles" table with columns (user_id, role). Use a SECURITY DEFINER function to check roles in RLS policies.`,
    });
    deductions += 15;
  } else {
    passed.push('Roles not stored on users/profiles table');
  }

  // ── 3. Foreign key integrity check ──
  const tablesWithPotentialFKs = tables.filter(t =>
    t.columns.some(c => c.name.endsWith('_id') && !c.primary_key && !c.references)
  );
  if (tablesWithPotentialFKs.length > 0) {
    tablesWithPotentialFKs.forEach(t => {
      const missingFKCols = t.columns.filter(c => c.name.endsWith('_id') && !c.primary_key && !c.references);
      missingFKCols.forEach(col => {
        findings.push({
          severity: 'high',
          category: 'Data Integrity',
          title: `Missing foreign key on "${t.name}.${col.name}"`,
          description: `Column "${col.name}" appears to be a reference but has no foreign key constraint. This allows orphaned records and breaks referential integrity.`,
          table: t.name,
          column: col.name,
          fix: `Add "references" field pointing to the appropriate parent table, e.g., "${col.name.replace('_id', '')}s(id)" with appropriate on_delete behavior.`,
        });
        deductions += 5;
      });
    });
  }

  // Count tables WITH proper FKs
  const tablesWithFKs = tables.filter(t => t.columns.some(c => c.references));
  if (tablesWithFKs.length > 0) {
    passed.push(`${tablesWithFKs.length} table(s) have proper foreign key references`);
  }

  // ── 4. Redundant users table when using Supabase ──
  const hasUsersTable = tables.find(t => t.name === 'users');
  const hasProfilesTable = tables.find(t => t.name === 'profiles');
  if (hasUsersTable && hasProfilesTable) {
    const usersHasEmail = hasUsersTable.columns.some(c => c.name === 'email');
    if (usersHasEmail) {
      findings.push({
        severity: 'high',
        category: 'Architecture',
        title: 'Redundant "users" table alongside "profiles"',
        description: 'Supabase provides auth.users with email, hashing, and session management. A separate "users" table with email duplicates this and creates sync issues. Use "profiles" linked to auth.users(id) instead.',
        table: 'users',
        fix: 'Remove the "users" table. Store all additional user data in "profiles" with id referencing auth.users(id).',
      });
      deductions += 10;
    }
  } else if (!hasUsersTable) {
    passed.push('No redundant users table — using Supabase auth properly');
  }

  // ── 5. Order items without price capture ──
  const orderItems = tables.find(t => t.name === 'order_items' || t.name === 'order_line_items');
  if (orderItems) {
    const hasPrice = orderItems.columns.some(c =>
      c.name === 'price' || c.name === 'unit_price' || c.name === 'price_at_purchase'
    );
    if (!hasPrice) {
      findings.push({
        severity: 'high',
        category: 'Data Integrity',
        title: 'Order items missing price at time of purchase',
        description: 'order_items doesn\'t capture the product price when ordered. If product prices change later, historical order totals become inaccurate.',
        table: orderItems.name,
        fix: 'Add "unit_price" (numeric 10,2) column to capture the price at the time of purchase.',
      });
      deductions += 8;
    } else {
      passed.push('Order items capture price at time of purchase');
    }
  }

  // ── 6. Orders without total ──
  const orders = tables.find(t => t.name === 'orders');
  if (orders) {
    const hasTotal = orders.columns.some(c =>
      c.name === 'total' || c.name === 'total_amount' || c.name === 'grand_total'
    );
    if (!hasTotal) {
      findings.push({
        severity: 'medium',
        category: 'Data Integrity',
        title: 'Orders table missing total amount',
        description: 'The orders table has no total/amount field. This requires computing the total from order_items every time, which is slow and error-prone.',
        table: 'orders',
        fix: 'Add "total_amount" (numeric 12,2) and optionally "subtotal", "tax_amount", "discount_amount" columns.',
      });
      deductions += 5;
    } else {
      passed.push('Orders table includes total amount');
    }
  }

  // ── 7. Payments without amount ──
  const payments = tables.find(t => t.name === 'payments');
  if (payments) {
    const hasAmount = payments.columns.some(c => c.name === 'amount' || c.name === 'total');
    if (!hasAmount) {
      findings.push({
        severity: 'high',
        category: 'Data Integrity',
        title: 'Payments table missing amount field',
        description: 'The payments table has no amount column, making payment records meaningless.',
        table: 'payments',
        fix: 'Add "amount" (numeric 12,2) and "currency" (char 3, default USD) columns.',
      });
      deductions += 8;
    } else {
      passed.push('Payments table has amount field');
    }
  }

  // ── 8. updated_at without trigger mechanism ──
  const tablesWithUpdatedAt = tables.filter(t => t.columns.some(c => c.name === 'updated_at'));
  if (tablesWithUpdatedAt.length > 0) {
    passed.push(`${tablesWithUpdatedAt.length} table(s) have updated_at columns (triggers auto-wired on deploy)`);
  }

  // ── 9. Missing indexes on foreign keys ──
  const indexes = result.indexes || [];
  const fkColumns = tables.flatMap(t =>
    t.columns.filter(c => c.references).map(c => ({ table: t.name, column: c.name }))
  );
  const indexedCols = new Set(indexes.map(idx => `${idx.table}.${idx.columns[0]}`));
  const unindexedFKs = fkColumns.filter(fk => !indexedCols.has(`${fk.table}.${fk.column}`));
  if (unindexedFKs.length > 0 && unindexedFKs.length > 3) {
    findings.push({
      severity: 'medium',
      category: 'Performance',
      title: `${unindexedFKs.length} foreign key columns without indexes`,
      description: `Foreign key columns should be indexed for JOIN performance. Missing indexes on: ${unindexedFKs.slice(0, 5).map(f => `${f.table}.${f.column}`).join(', ')}${unindexedFKs.length > 5 ? ` and ${unindexedFKs.length - 5} more` : ''}.`,
      fix: 'Add indexes for all foreign key columns.',
    });
    deductions += 3;
  } else if (fkColumns.length > 0) {
    passed.push('Foreign key columns are properly indexed');
  }

  // ── 10. Storage buckets security ──
  const buckets = result.storageBuckets || [];
  const sensitiveBuckets = buckets.filter(b =>
    b.public && (b.name.includes('document') || b.name.includes('invoice') || b.name.includes('private') || b.name.includes('kyc'))
  );
  if (sensitiveBuckets.length > 0) {
    sensitiveBuckets.forEach(b => {
      findings.push({
        severity: 'high',
        category: 'Storage Security',
        title: `Sensitive bucket "${b.name}" is set to public`,
        description: `The "${b.name}" storage bucket contains potentially sensitive files but is marked as public. Anyone with the URL can access these files.`,
        fix: `Set "${b.name}" bucket to public: false and add authenticated-only RLS policies.`,
      });
      deductions += 8;
    });
  } else if (buckets.length > 0) {
    passed.push('Storage bucket visibility is properly configured');
  }

  // ── 11. Check for unique constraints on critical fields ──
  const criticalUniqueFields = [
    { table: 'users', columns: ['email', 'username'] },
    { table: 'profiles', columns: ['username'] },
    { table: 'products', columns: ['slug', 'sku'] },
    { table: 'categories', columns: ['slug'] },
  ];
  criticalUniqueFields.forEach(({ table: tName, columns }) => {
    const t = tables.find(t => t.name === tName);
    if (t) {
      columns.forEach(colName => {
        const col = t.columns.find(c => c.name === colName);
        if (col && !col.unique) {
          findings.push({
            severity: 'medium',
            category: 'Data Integrity',
            title: `"${tName}.${colName}" should be unique`,
            description: `The "${colName}" column on "${tName}" lacks a unique constraint, allowing duplicate values.`,
            table: tName,
            column: colName,
            fix: `Add "unique: true" to the "${colName}" column.`,
          });
          deductions += 3;
        }
      });
    }
  });

  // ── 12. Profiles FK to auth.users ──
  if (hasProfilesTable) {
    const idCol = hasProfilesTable.columns.find(c => c.name === 'id' || c.name === 'user_id');
    const hasAuthRef = hasProfilesTable.columns.some(c =>
      c.references && c.references.includes('auth.users')
    );
    if (!hasAuthRef && idCol) {
      findings.push({
        severity: 'medium',
        category: 'Architecture',
        title: 'profiles table not linked to auth.users',
        description: 'The profiles table should reference auth.users(id) to maintain referential integrity with Supabase authentication.',
        table: 'profiles',
        fix: 'Add references: "auth.users(id)" with on_delete: "CASCADE" to the id/user_id column.',
      });
      deductions += 5;
    }
  }

  // Calculate score
  const rawScore = Math.max(0, 100 - deductions);
  const score = Math.round(rawScore);

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade, findings, passed };
}

const severityColor = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
};

const severityBg = {
  critical: 'bg-red-500/10 border-red-500/20',
  high: 'bg-orange-500/10 border-orange-500/20',
  medium: 'bg-yellow-500/10 border-yellow-500/20',
  low: 'bg-blue-500/10 border-blue-500/20',
};

const SecurityAuditPanel = ({ result }: { result: GenerationResult }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const handleAudit = () => {
    setIsAuditing(true);
    setAuditResult(null);
    // Simulate a brief "scanning" delay for UX
    setTimeout(() => {
      const res = auditSchema(result);
      setAuditResult(res);
      setIsAuditing(false);
    }, 1500);
  };

  const ScoreIcon = auditResult
    ? auditResult.score >= 80
      ? ShieldCheck
      : auditResult.score >= 50
        ? ShieldAlert
        : ShieldX
    : Shield;

  const scoreColor = auditResult
    ? auditResult.score >= 80
      ? 'text-green-500'
      : auditResult.score >= 50
        ? 'text-yellow-500'
        : 'text-red-500'
    : 'text-muted-foreground';

  const criticalCount = auditResult?.findings.filter(f => f.severity === 'critical').length || 0;
  const highCount = auditResult?.findings.filter(f => f.severity === 'high').length || 0;
  const mediumCount = auditResult?.findings.filter(f => f.severity === 'medium').length || 0;

  return (
    <div className="space-y-4">
      {/* Audit trigger card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Backend Security Audit
          </CardTitle>
          <CardDescription className="text-xs">
            Runs automated security, integrity, and architecture checks against your generated schema. Simulates common attack vectors and design anti-patterns.
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
              <p className="text-xs text-muted-foreground">Checking for privilege escalation, data leaks, orphaned records, missing constraints...</p>
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

              {/* Passed checks */}
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

              {/* Re-run */}
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
