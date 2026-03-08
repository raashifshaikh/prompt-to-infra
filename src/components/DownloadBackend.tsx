import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Copy, Terminal, Check } from 'lucide-react';
import JSZip from 'jszip';
import { GenerationResult } from '@/types/project';

interface DownloadBackendProps {
  projectName: string;
  result: GenerationResult;
}

function generateServerCode(result: GenerationResult): Record<string, string> {
  const files: Record<string, string> = {};

  // package.json
  files['package.json'] = JSON.stringify({
    name: 'generated-backend',
    version: '1.0.0',
    scripts: {
      dev: 'node server.js',
      start: 'node server.js',
    },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      pg: '^8.11.3',
      jsonwebtoken: '^9.0.2',
      bcryptjs: '^2.4.3',
    },
  }, null, 2);

  // .env
  files['.env'] = result.envTemplate || `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app\nJWT_SECRET=change-me-in-production\nPORT=3000`;

  // server.js
  const routeImports = result.routes.map((r, i) => {
    const name = r.path.split('/').filter(Boolean).pop() || `route${i}`;
    return name;
  });
  const uniqueResources = [...new Set(routeImports)];

  files['server.js'] = `require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

${uniqueResources.map(r => `const ${r}Router = require('./routes/${r}');`).join('\n')}

${uniqueResources.map(r => `app.use('/api/${r}', ${r}Router);`).join('\n')}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`;

  // Routes
  uniqueResources.forEach(resource => {
    const relatedRoutes = result.routes.filter(r => r.path.includes(resource));
    files[`routes/${resource}.js`] = `const express = require('express');
const router = express.Router();

${relatedRoutes.map(r => {
  const method = r.method.toLowerCase();
  const subPath = r.path.replace(`/api/${resource}`, '') || '/';
  return `// ${r.description}
router.${method}('${subPath}', async (req, res) => {
  try {
    res.json({ message: '${r.description}' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;
}).join('\n\n')}

module.exports = router;
`;
  });

  // SQL schema
  const schemaSql = result.tables.map(t => {
    const cols = t.columns.map(c => {
      let def = `  "${c.name}" ${c.type}`;
      if (c.primary_key) def += ' PRIMARY KEY';
      if (!c.nullable && !c.primary_key) def += ' NOT NULL';
      if (c.default) def += ` DEFAULT ${c.default}`;
      return def;
    }).join(',\n');
    return `CREATE TABLE IF NOT EXISTS "${t.name}" (\n${cols}\n);`;
  }).join('\n\n');
  files['schema.sql'] = schemaSql;

  // README
  files['README.md'] = `# Generated Backend

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

Server runs at http://localhost:3000

## API Routes

${result.routes.map(r => `- \`${r.method} ${r.path}\` — ${r.description}`).join('\n')}

## Database

Run \`schema.sql\` against your PostgreSQL database to create the tables.
`;

  // Dockerfile
  if (result.dockerfile) files['Dockerfile'] = result.dockerfile;
  if (result.dockerCompose) files['docker-compose.yml'] = result.dockerCompose;

  return files;
}

const DownloadBackend = ({ projectName, result }: DownloadBackendProps) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const files = generateServerCode(result);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-backend.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backend downloaded!');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Local Backend Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download a complete Node.js backend with Express, routes, and database schema.
          </p>

          <div className="bg-muted/50 rounded-md p-4 font-mono text-xs space-y-1">
            <p className="text-muted-foreground">$ npm install</p>
            <p className="text-muted-foreground">$ npm run dev</p>
            <p className="text-primary">→ Server running on http://localhost:3000</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {Object.keys(files).map(f => (
              <Badge key={f} variant="outline" className="font-mono text-[10px]">{f}</Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownload} disabled={downloading} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {downloading ? 'Generating...' : 'Download ZIP'}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy('npm install && npm run dev')}
            >
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DownloadBackend;
