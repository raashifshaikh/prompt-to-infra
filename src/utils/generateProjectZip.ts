import JSZip from 'jszip';
import { GenerationResult } from '@/types/project';

const generatePrismaSchema = (result: GenerationResult): string => {
  let schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

  // Enums
  result.enums?.forEach(e => {
    schema += `enum ${e.name} {\n${e.values.map(v => `  ${v}`).join('\n')}\n}\n\n`;
  });

  // Models
  result.tables.forEach(table => {
    schema += `model ${table.name} {\n`;
    table.columns.forEach(col => {
      const prismaType = mapToPrismaType(col.type);
      const modifiers: string[] = [];
      if (col.primary_key) modifiers.push('@id');
      if (col.type.toLowerCase().includes('serial') || col.default?.includes('gen_random')) modifiers.push('@default(autoincrement())');
      else if (col.default === 'now()') modifiers.push('@default(now())');
      else if (col.default === 'gen_random_uuid()') modifiers.push('@default(uuid())');
      if (col.unique && !col.primary_key) modifiers.push('@unique');
      const nullable = col.nullable ? '?' : '';
      schema += `  ${col.name} ${prismaType}${nullable}${modifiers.length ? ' ' + modifiers.join(' ') : ''}\n`;
    });
    schema += `}\n\n`;
  });

  return schema;
};

const mapToPrismaType = (sqlType: string): string => {
  const t = sqlType.toLowerCase();
  if (t.includes('serial') || t.includes('int')) return 'Int';
  if (t.includes('text') || t.includes('varchar') || t.includes('char')) return 'String';
  if (t.includes('bool')) return 'Boolean';
  if (t.includes('timestamp') || t.includes('date')) return 'DateTime';
  if (t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric')) return 'Float';
  if (t.includes('json')) return 'Json';
  if (t === 'uuid') return 'String';
  return 'String';
};

const routeFileName = (method: string, path: string): string =>
  `${method.toLowerCase()}-${path.replace(/\//g, '-').replace(/:/g, '').replace(/^-/, '') || 'root'}.ts`;

const generateRouteFile = (method: string, path: string, description: string): string => {
  return `import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  // ${description}
  fastify.${method.toLowerCase()}('${path}', async (request, reply) => {
    // TODO: Implement ${method} ${path}
    return { message: '${description}' };
  });
}
`;
};

const generateRoutesIndex = (routes: { method: string; path: string }[]): string => {
  const imports = routes.map((r, i) => {
    const fname = routeFileName(r.method, r.path).replace(/\.ts$/, '');
    return `import route${i} from './${fname}.js';`;
  }).join('\n');
  const registers = routes.map((_, i) => `  await fastify.register(route${i});`).join('\n');
  return `import { FastifyInstance } from 'fastify';
${imports}

export async function registerRoutes(fastify: FastifyInstance) {
${registers}
}
`;
};

const generateServerTs = (projectName: string): string => `import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { registerRoutes } from './routes/index.js';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });

  await app.register(swagger, {
    openapi: {
      info: { title: '${projectName} API', version: '1.0.0' },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', async () => ({ status: 'ok' }));

  await registerRoutes(app);

  const port = parseInt(process.env.PORT || '3000');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(\`Server running on port \${port}\`);
}

start().catch(console.error);
`;

const generateDockerfile = (): string => `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
`;

const generateDockerCompose = (projectName: string): string => `version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${projectName}
      - JWT_SECRET=\${JWT_SECRET}
      - PORT=3000
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${projectName}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`;

const generatePackageJson = (projectName: string): string => JSON.stringify({
  name: projectName.toLowerCase().replace(/\s+/g, '-'),
  version: '1.0.0',
  scripts: {
    dev: 'tsx watch src/server.ts',
    build: 'tsc',
    start: 'node dist/server.js',
    'db:migrate': 'prisma migrate dev',
    'db:push': 'prisma db push',
    'db:studio': 'prisma studio',
  },
  dependencies: {
    fastify: '^4.28.0',
    '@fastify/cors': '^9.0.0',
    '@fastify/swagger': '^8.15.0',
    '@fastify/swagger-ui': '^4.1.0',
    '@prisma/client': '^5.19.0',
  },
  devDependencies: {
    prisma: '^5.19.0',
    typescript: '^5.5.0',
    tsx: '^4.19.0',
    '@types/node': '^22.0.0',
  },
}, null, 2);

const generateEnvTemplate = (result: GenerationResult): string => {
  const lines = [
    '# Database',
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb',
    '',
    '# Server',
    'PORT=3000',
  ];
  if (result.auth.enabled) {
    lines.push('', '# Auth', 'JWT_SECRET=your-secret-key-here');
  }
  if (result.envTemplate) {
    lines.push('', '# Custom', result.envTemplate);
  }
  return lines.join('\n');
};

const generateReadme = (projectName: string, result: GenerationResult): string => `# ${projectName}

Generated by [Bytebase](https://bytebase.dev)

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
docker-compose up -d db
npx prisma db push

# Start dev server
npm run dev
\`\`\`

## API Endpoints

${result.routes.map(r => `- \`${r.method} ${r.path}\` — ${r.description}${r.auth_required ? ' 🔒' : ''}`).join('\n')}

## Database Schema

${result.tables.map(t => `### ${t.name}\n${t.columns.map(c => `- \`${c.name}\` ${c.type}${c.primary_key ? ' (PK)' : ''}${c.references ? ` → ${c.references}` : ''}`).join('\n')}`).join('\n\n')}

## Docs

Start the server and visit [http://localhost:3000/docs](http://localhost:3000/docs) for Swagger UI.
`;

export const generateProjectZip = async (projectName: string, result: GenerationResult): Promise<Blob> => {
  const zip = new JSZip();
  const root = zip.folder(projectName.toLowerCase().replace(/\s+/g, '-'))!;

  root.file('package.json', generatePackageJson(projectName));
  root.file('Dockerfile', generateDockerfile());
  root.file('docker-compose.yml', generateDockerCompose(projectName.toLowerCase().replace(/\s+/g, '_')));
  root.file('.env.example', generateEnvTemplate(result));
  root.file('README.md', generateReadme(projectName, result));
  root.file('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'commonjs', outDir: './dist', rootDir: './src',
      strict: true, esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true,
    },
    include: ['src/**/*'],
  }, null, 2));

  // Prisma
  const prismaDir = root.folder('prisma')!;
  prismaDir.file('schema.prisma', generatePrismaSchema(result));

  // Source
  const srcDir = root.folder('src')!;
  srcDir.file('server.ts', generateServerTs(projectName));

  const routesDir = srcDir.folder('routes')!;
  result.routes.forEach(route => {
    const fileName = routeFileName(route.method, route.path);
    routesDir.file(fileName, generateRouteFile(route.method, route.path, route.description));
  });
  routesDir.file('index.ts', generateRoutesIndex(result.routes));

  return await zip.generateAsync({ type: 'blob' });
};
