import { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Database, Link2, Loader2, Table2, Play, Plus, Trash2, Edit3, Save,
  RefreshCw, Search, Download, Eye, EyeOff, KeyRound, ArrowUpDown
} from 'lucide-react';

interface DBConnection {
  mode: 'url' | 'easy';
  projectUrl: string;
  dbPassword: string;
  connectionString: string;
  accessToken: string;
  projectRef: string;
}

interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  rowCount: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary: boolean;
  is_foreign: boolean;
  fk_ref?: string;
}

interface SQLResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  duration: number;
}

const INTROSPECT_TABLES_SQL = `
SELECT 
  t.table_name,
  t.table_schema,
  (SELECT count(*)::int FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = t.table_schema) as col_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
`;

const INTROSPECT_COLUMNS_SQL = (table: string) => `
SELECT 
  c.column_name as name,
  c.data_type as type,
  c.is_nullable = 'YES' as nullable,
  c.column_default as default_value,
  COALESCE(
    (SELECT true FROM information_schema.table_constraints tc 
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name = c.table_name AND tc.table_schema = c.table_schema 
     AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY'), false
  ) as is_primary,
  COALESCE(
    (SELECT true FROM information_schema.table_constraints tc 
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_name = c.table_name AND tc.table_schema = c.table_schema 
     AND kcu.column_name = c.column_name AND tc.constraint_type = 'FOREIGN KEY'), false
  ) as is_foreign,
  (SELECT ccu.table_name || '(' || ccu.column_name || ')' 
   FROM information_schema.referential_constraints rc
   JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
   WHERE kcu.table_name = c.table_name AND kcu.table_schema = c.table_schema AND kcu.column_name = c.column_name
   LIMIT 1
  ) as fk_ref
FROM information_schema.columns c
WHERE c.table_name = '${table}' AND c.table_schema = 'public'
ORDER BY c.ordinal_position;
`;

const ROW_COUNT_SQL = (table: string) => `SELECT count(*)::int as count FROM public."${table}";`;

export default function DatabaseManager() {
  const [connection, setConnection] = useState<DBConnection>({
    mode: 'easy', projectUrl: '', dbPassword: '', connectionString: '', accessToken: '', projectRef: ''
  });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<SQLResult | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlHistory, setSqlHistory] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [dataPage, setDataPage] = useState(0);
  const [dataPageSize] = useState(50);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text', nullable: true });
  const [dropColumnConfirm, setDropColumnConfirm] = useState<string | null>(null);

  const runSQL = useCallback(async (sql: string) => {
    const { data, error } = await supabase.functions.invoke('supabase-manage', {
      body: {
        action: 'run-sql',
        accessToken: connection.accessToken,
        projectRef: connection.projectRef,
        sql
      }
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [connection.accessToken, connection.projectRef]);

  const extractProjectRef = (url: string) => {
    const match = url.match(/(?:https?:\/\/)?([a-z0-9]+)\.supabase\.co/);
    return match ? match[1] : url.trim();
  };

  const handleConnect = async () => {
    if (!connection.accessToken) {
      toast.error('Supabase access token is required');
      return;
    }
    const ref = connection.mode === 'easy'
      ? extractProjectRef(connection.projectUrl)
      : extractProjectRef(connection.connectionString || connection.projectUrl);

    if (!ref) {
      toast.error('Could not determine project reference');
      return;
    }

    setLoading(true);
    try {
      setConnection(c => ({ ...c, projectRef: ref }));

      // Test connection by listing tables
      const { data, error } = await supabase.functions.invoke('supabase-manage', {
        body: { action: 'run-sql', accessToken: connection.accessToken, projectRef: ref, sql: INTROSPECT_TABLES_SQL }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      const tableList: TableInfo[] = (data || []).map((r: any) => ({
        name: r.table_name,
        schema: r.table_schema,
        columns: [],
        rowCount: 0
      }));

      setTables(tableList);
      setConnected(true);
      toast.success(`Connected! Found ${tableList.length} tables.`);
    } catch (err: any) {
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTableDetails = async (tableName: string) => {
    setSelectedTable(tableName);
    setDataLoading(true);
    setDataPage(0);
    try {
      const [colData, countData] = await Promise.all([
        runSQL(INTROSPECT_COLUMNS_SQL(tableName)),
        runSQL(ROW_COUNT_SQL(tableName))
      ]);

      setTables(prev => prev.map(t =>
        t.name === tableName ? {
          ...t,
          columns: colData || [],
          rowCount: countData?.[0]?.count || 0
        } : t
      ));

      const rows = await runSQL(`SELECT * FROM public."${tableName}" LIMIT ${dataPageSize} OFFSET 0;`);
      setTableData(rows || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const loadDataPage = async (page: number) => {
    setDataLoading(true);
    try {
      const rows = await runSQL(`SELECT * FROM public."${selectedTable}" LIMIT ${dataPageSize} OFFSET ${page * dataPageSize};`);
      setTableData(rows || []);
      setDataPage(page);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const runUserSQL = async () => {
    if (!sqlQuery.trim()) return;
    setSqlRunning(true);
    const start = Date.now();
    try {
      const data = await runSQL(sqlQuery);
      const duration = Date.now() - start;
      const rows = Array.isArray(data) ? data : [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      setSqlResult({ columns, rows, rowCount: rows.length, duration });
      setSqlHistory(prev => [sqlQuery, ...prev.filter(q => q !== sqlQuery)].slice(0, 20));
      toast.success(`Query executed in ${duration}ms`);
    } catch (err: any) {
      toast.error(err.message);
      setSqlResult(null);
    } finally {
      setSqlRunning(false);
    }
  };

  const handleSaveRow = async (row: any) => {
    const table = tables.find(t => t.name === selectedTable);
    const pkCol = table?.columns.find(c => c.is_primary);
    if (!pkCol) { toast.error('No primary key found'); return; }

    const setClauses = Object.entries(editedValues)
      .map(([col, val]) => `"${col}" = '${String(val).replace(/'/g, "''")}'`)
      .join(', ');

    try {
      await runSQL(`UPDATE public."${selectedTable}" SET ${setClauses} WHERE "${pkCol.name}" = '${row[pkCol.name]}';`);
      toast.success('Row updated');
      setEditingRow(null);
      setEditedValues({});
      loadDataPage(dataPage);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteRow = async (row: any) => {
    const table = tables.find(t => t.name === selectedTable);
    const pkCol = table?.columns.find(c => c.is_primary);
    if (!pkCol) { toast.error('No primary key found'); return; }

    try {
      await runSQL(`DELETE FROM public."${selectedTable}" WHERE "${pkCol.name}" = '${row[pkCol.name]}';`);
      toast.success('Row deleted');
      setDeleteConfirm(null);
      loadDataPage(dataPage);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleInsertRow = async () => {
    const cols = Object.keys(newRowValues).filter(k => newRowValues[k] !== '');
    if (cols.length === 0) { toast.error('No values provided'); return; }

    const colNames = cols.map(c => `"${c}"`).join(', ');
    const values = cols.map(c => `'${newRowValues[c].replace(/'/g, "''")}'`).join(', ');

    try {
      await runSQL(`INSERT INTO public."${selectedTable}" (${colNames}) VALUES (${values});`);
      toast.success('Row inserted');
      setAddRowOpen(false);
      setNewRowValues({});
      loadDataPage(dataPage);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumn.name.trim()) return;
    try {
      await runSQL(`ALTER TABLE public."${selectedTable}" ADD COLUMN "${newColumn.name}" ${newColumn.type} ${newColumn.nullable ? '' : 'NOT NULL'};`);
      toast.success(`Column "${newColumn.name}" added`);
      setAddColumnOpen(false);
      setNewColumn({ name: '', type: 'text', nullable: true });
      loadTableDetails(selectedTable);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDropColumn = async (colName: string) => {
    try {
      await runSQL(`ALTER TABLE public."${selectedTable}" DROP COLUMN "${colName}";`);
      toast.success(`Column "${colName}" dropped`);
      setDropColumnConfirm(null);
      loadTableDetails(selectedTable);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateTable = async (tableName: string) => {
    try {
      await runSQL(`CREATE TABLE public."${tableName}" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now());`);
      toast.success(`Table "${tableName}" created`);
      handleConnect();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDropTable = async (tableName: string) => {
    try {
      await runSQL(`DROP TABLE public."${tableName}" CASCADE;`);
      toast.success(`Table "${tableName}" dropped`);
      setSelectedTable('');
      handleConnect();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const exportCSV = () => {
    if (tableData.length === 0) return;
    const headers = Object.keys(tableData[0]);
    const csv = [
      headers.join(','),
      ...tableData.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedTable}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const currentTable = tables.find(t => t.name === selectedTable);
  const filteredData = searchFilter
    ? tableData.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(searchFilter.toLowerCase())))
    : tableData;

  if (!connected) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-16 px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Database Manager</h1>
            <p className="text-muted-foreground">Connect your existing Supabase database to view, edit, and manage it visually.</p>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Link2 className="h-5 w-5" /> Connect to Database</CardTitle>
              <CardDescription>Enter your Supabase project details to get started.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={connection.mode} onValueChange={(v) => setConnection(c => ({ ...c, mode: v as 'url' | 'easy' }))}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="easy">Easy Setup</TabsTrigger>
                  <TabsTrigger value="url">Project Ref</TabsTrigger>
                </TabsList>
                <TabsContent value="easy" className="space-y-3 mt-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Supabase Project URL</label>
                    <Input placeholder="https://abcdefgh.supabase.co" value={connection.projectUrl}
                      onChange={e => setConnection(c => ({ ...c, projectUrl: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">Found in Settings → General in your Supabase dashboard</p>
                  </div>
                </TabsContent>
                <TabsContent value="url" className="space-y-3 mt-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Project Reference ID</label>
                    <Input placeholder="abcdefghijklmnop" value={connection.projectUrl}
                      onChange={e => setConnection(c => ({ ...c, projectUrl: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">The unique reference ID of your Supabase project</p>
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Supabase Access Token <span className="text-destructive">*</span></label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} placeholder="sbp_xxxxxxxxxxxxx"
                    value={connection.accessToken}
                    onChange={e => setConnection(c => ({ ...c, accessToken: e.target.value }))} />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate at{' '}
                  <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer"
                    className="text-primary underline">supabase.com/dashboard/account/tokens</a>
                </p>
              </div>

              <Button className="w-full" onClick={handleConnect} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</> : <><Database className="mr-2 h-4 w-4" /> Connect Database</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Database Manager</h1>
              <p className="text-xs text-muted-foreground">Project: {connection.projectRef}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleConnect}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
            <Button variant="ghost" size="sm" onClick={() => { setConnected(false); setTables([]); setSelectedTable(''); }}>Disconnect</Button>
          </div>
        </div>

        <Tabs defaultValue="schema" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-fit">
            <TabsTrigger value="schema"><Table2 className="mr-1 h-3.5 w-3.5" /> Schema</TabsTrigger>
            <TabsTrigger value="data"><Eye className="mr-1 h-3.5 w-3.5" /> Data Browser</TabsTrigger>
            <TabsTrigger value="sql"><Play className="mr-1 h-3.5 w-3.5" /> SQL Editor</TabsTrigger>
          </TabsList>

          {/* SCHEMA TAB */}
          <TabsContent value="schema" className="flex-1 overflow-auto mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Table List */}
              <div className="md:col-span-1 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Tables ({tables.length})</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Create Table</DialogTitle></DialogHeader>
                      <CreateTableForm onSubmit={handleCreateTable} />
                    </DialogContent>
                  </Dialog>
                </div>
                {tables.map(t => (
                  <button key={t.name} onClick={() => loadTableDetails(t.name)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedTable === t.name
                      ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                      : 'hover:bg-muted text-foreground'}`}>
                    <div className="flex items-center gap-2">
                      <Table2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Table Detail */}
              <div className="md:col-span-3">
                {selectedTable && currentTable ? (
                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{selectedTable}</CardTitle>
                          <CardDescription>{currentTable.columns.length} columns · {currentTable.rowCount} rows</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Add Column</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Add Column to {selectedTable}</DialogTitle></DialogHeader>
                              <div className="space-y-3 py-2">
                                <Input placeholder="Column name" value={newColumn.name}
                                  onChange={e => setNewColumn(c => ({ ...c, name: e.target.value }))} />
                                <Select value={newColumn.type} onValueChange={v => setNewColumn(c => ({ ...c, type: v }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {['text', 'integer', 'bigint', 'boolean', 'uuid', 'timestamptz', 'jsonb', 'float8', 'varchar(255)'].map(t => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={newColumn.nullable}
                                    onChange={e => setNewColumn(c => ({ ...c, nullable: e.target.checked }))} />
                                  Nullable
                                </label>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleAddColumn}><Plus className="mr-1 h-3.5 w-3.5" /> Add Column</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="destructive" size="sm" onClick={() => {
                            if (confirm(`Drop table "${selectedTable}"? This cannot be undone.`)) handleDropTable(selectedTable);
                          }}><Trash2 className="mr-1 h-3.5 w-3.5" /> Drop Table</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Nullable</TableHead>
                            <TableHead>Default</TableHead>
                            <TableHead>Keys</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentTable.columns.map(col => (
                            <TableRow key={col.name}>
                              <TableCell className="font-mono text-sm">{col.name}</TableCell>
                              <TableCell><Badge variant="secondary" className="font-mono text-xs">{col.type}</Badge></TableCell>
                              <TableCell>{col.nullable ? <span className="text-muted-foreground">yes</span> : <span className="text-foreground font-medium">no</span>}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono max-w-[150px] truncate">{col.default_value || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {col.is_primary && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"><KeyRound className="h-2.5 w-2.5 mr-0.5" />PK</Badge>}
                                  {col.is_foreign && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">FK{col.fk_ref ? ` → ${col.fk_ref}` : ''}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {!col.is_primary && (
                                  dropColumnConfirm === col.name ? (
                                    <div className="flex gap-1">
                                      <Button variant="destructive" size="icon" className="h-6 w-6" onClick={() => handleDropColumn(col.name)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDropColumnConfirm(null)}>✕</Button>
                                    </div>
                                  ) : (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDropColumnConfirm(col.name)}>
                                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>Select a table to view its schema</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* DATA BROWSER TAB */}
          <TabsContent value="data" className="flex-1 flex flex-col min-h-0 mt-4">
            {selectedTable && currentTable ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{selectedTable}</h3>
                    <Badge variant="outline" className="text-xs">{currentTable.rowCount} rows</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input className="pl-8 h-8 w-48 text-xs" placeholder="Filter rows..."
                        value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-3.5 w-3.5" /> CSV</Button>
                    <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => {
                          const vals: Record<string, string> = {};
                          currentTable.columns.forEach(c => { vals[c.name] = ''; });
                          setNewRowValues(vals);
                        }}><Plus className="mr-1 h-3.5 w-3.5" /> Insert Row</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Insert Row into {selectedTable}</DialogTitle></DialogHeader>
                        <div className="space-y-3 py-2">
                          {currentTable.columns.map(col => (
                            <div key={col.name}>
                              <label className="text-xs font-medium text-foreground flex items-center gap-1 mb-1">
                                {col.name}
                                <Badge variant="secondary" className="text-[9px] font-mono">{col.type}</Badge>
                                {col.default_value && <span className="text-muted-foreground">(has default)</span>}
                              </label>
                              <Input placeholder={col.default_value ? `Default: ${col.default_value}` : ''}
                                value={newRowValues[col.name] || ''}
                                onChange={e => setNewRowValues(v => ({ ...v, [col.name]: e.target.value }))} />
                            </div>
                          ))}
                        </div>
                        <DialogFooter>
                          <Button onClick={handleInsertRow}><Save className="mr-1 h-3.5 w-3.5" /> Insert</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={() => loadDataPage(dataPage)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto border border-border rounded-lg">
                  {dataLoading ? (
                    <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {tableData.length > 0 && Object.keys(tableData[0]).map(col => (
                            <TableHead key={col} className="text-xs font-mono whitespace-nowrap">{col}</TableHead>
                          ))}
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.entries(row).map(([col, val]) => (
                              <TableCell key={col} className="text-xs font-mono max-w-[200px] truncate">
                                {editingRow === idx ? (
                                  <Input className="h-7 text-xs" value={editedValues[col] ?? String(val ?? '')}
                                    onChange={e => setEditedValues(v => ({ ...v, [col]: e.target.value }))} />
                                ) : (
                                  String(val ?? 'null')
                                )}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex gap-1">
                                {editingRow === idx ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveRow(row)}>
                                      <Save className="h-3 w-3 text-primary" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingRow(null); setEditedValues({}); }}>
                                      ✕
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-6 w-6"
                                      onClick={() => { setEditingRow(idx); setEditedValues(Object.fromEntries(Object.entries(row))); }}>
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                    {deleteConfirm === idx ? (
                                      <Button variant="destructive" size="icon" className="h-6 w-6" onClick={() => handleDeleteRow(row)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteConfirm(idx)}>
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {dataPage * dataPageSize + 1}–{Math.min((dataPage + 1) * dataPageSize, currentTable.rowCount)} of {currentTable.rowCount}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={dataPage === 0} onClick={() => loadDataPage(dataPage - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={(dataPage + 1) * dataPageSize >= currentTable.rowCount}
                      onClick={() => loadDataPage(dataPage + 1)}>Next</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Select a table from the Schema tab first</p>
              </div>
            )}
          </TabsContent>

          {/* SQL EDITOR TAB */}
          <TabsContent value="sql" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="relative">
                <Textarea className="font-mono text-sm min-h-[120px] resize-y" placeholder="SELECT * FROM your_table LIMIT 10;"
                  value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runUserSQL(); }} />
                <div className="absolute bottom-2 right-2 flex gap-2 items-center">
                  <span className="text-[10px] text-muted-foreground">⌘+Enter to run</span>
                  <Button size="sm" onClick={runUserSQL} disabled={sqlRunning}>
                    {sqlRunning ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                    Run
                  </Button>
                </div>
              </div>

              {/* SQL History */}
              {sqlHistory.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-1">History:</span>
                  {sqlHistory.slice(0, 5).map((q, i) => (
                    <button key={i} onClick={() => setSqlQuery(q)}
                      className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground font-mono truncate max-w-[200px]">
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Results */}
              {sqlResult && (
                <div className="flex-1 overflow-auto border border-border rounded-lg">
                  <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex justify-between text-xs text-muted-foreground">
                    <span>{sqlResult.rowCount} rows returned</span>
                    <span>{sqlResult.duration}ms</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sqlResult.columns.map(col => (
                          <TableHead key={col} className="text-xs font-mono">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sqlResult.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {sqlResult.columns.map(col => (
                            <TableCell key={col} className="text-xs font-mono max-w-[250px] truncate">{String(row[col] ?? 'null')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function CreateTableForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-3 py-2">
      <Input placeholder="table_name" value={name} onChange={e => setName(e.target.value)} />
      <p className="text-xs text-muted-foreground">Creates with id (uuid) and created_at columns by default.</p>
      <DialogFooter>
        <Button onClick={() => name.trim() && onSubmit(name.trim())} disabled={!name.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Create Table
        </Button>
      </DialogFooter>
    </div>
  );
}
