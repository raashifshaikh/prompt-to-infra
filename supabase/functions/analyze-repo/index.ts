import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const analysisPrompt = `You are a senior backend architecture AI. Analyze the provided frontend project deeply — read every file, understand data flows, component relationships, state management patterns, and API calls.

You MUST respond with ONLY valid JSON matching this schema:
{
  "detectedStack": {
    "framework": "React/Vue/Angular/etc",
    "language": "TypeScript/JavaScript",
    "stateManagement": "Redux/Zustand/Context/TanStack Query/etc",
    "styling": "Tailwind/CSS Modules/Styled Components/etc",
    "existingBackend": "Supabase/Firebase/REST API/GraphQL/None",
    "router": "React Router/Next.js/etc",
    "uiLibrary": "shadcn/MUI/Ant Design/custom/etc"
  },
  "suggestedBackendType": "supabase|firebase|local|cloud",
  "prompt": "A very detailed prompt describing the exact backend this frontend needs, including specific data models inferred from component props, form fields, list views, and state shapes",
  "tables": [
    {
      "name": "table_name",
      "columns": [
        { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()", "primary_key": true }
      ],
      "relationships": ["references other_table(id)"]
    }
  ],
  "routes": [
    { "method": "GET", "path": "/api/resource", "description": "Description", "auth_required": false }
  ],
  "features": ["Feature 1", "Feature 2"],
  "storageBuckets": ["avatars", "uploads"],
  "authProviders": ["email", "google", "github"],
  "reasoning": "Detailed explanation of why this backend architecture fits this frontend, referencing specific files and patterns found"
}

IMPORTANT ANALYSIS RULES:
1. Look at component props and state to infer data models
2. Look at form fields to infer table columns and validation rules
3. Look at list/grid components to infer collection endpoints
4. Look at route structure to infer API routes needed
5. Look at auth-related imports/components to suggest auth providers
6. Look at image/file handling to suggest storage buckets
7. If you see fetch/axios calls, note the API patterns being used
8. Infer relationships between tables from how components reference each other`;

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'BackendForge',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchGitHubRepo(repoUrl: string, token?: string): Promise<{ structure: string; files: Record<string, string> }> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  const headers = githubHeaders(token);

  let treeData;
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`, { headers });

  if (!treeRes.ok) {
    const masterRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`, { headers });
    if (!masterRes.ok) throw new Error(`Failed to fetch repo: ${masterRes.status}. ${token ? '' : 'If this is a private repo, connect your GitHub account first.'}`);
    treeData = await masterRes.json();
  } else {
    treeData = await treeRes.json();
  }

  const allFiles = treeData.tree.filter((f: any) => f.type === 'blob').map((f: any) => f.path);
  const structure = allFiles.slice(0, 300).join('\n');

  const keyFiles = [
    'package.json', 'tsconfig.json', 'README.md', 'readme.md',
    'src/App.tsx', 'src/App.jsx', 'src/App.vue', 'src/App.svelte',
    'src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/index.tsx', 'src/index.jsx',
    'src/router.tsx', 'src/router.ts', 'src/routes.tsx', 'src/routes.ts',
    'next.config.js', 'next.config.ts', 'nuxt.config.ts', 'vite.config.ts',
    '.env.example', '.env.local.example',
  ];

  const importantPatterns = [
    /^src\/(pages|views|screens)\/[^/]+\.(tsx|jsx|vue|svelte)$/,
    /^src\/(components)\/[^/]+\.(tsx|jsx|vue|svelte)$/,
    /^src\/(hooks|composables)\/[^/]+\.(ts|tsx|js)$/,
    /^src\/(types|models|interfaces)\/[^/]+\.(ts|js)$/,
    /^src\/(lib|utils|helpers|services|api)\/[^/]+\.(ts|tsx|js)$/,
    /^src\/(store|stores|state|context)\/[^/]+\.(ts|tsx|js)$/,
    /^src\/(config|constants)\/[^/]+\.(ts|js)$/,
    /^app\/.*\.(tsx|jsx)$/,
    /^pages\/.*\.(tsx|jsx|vue)$/,
  ];

  const dynamicFiles: string[] = [];
  for (const filePath of allFiles) {
    if (dynamicFiles.length >= 25) break;
    if (importantPatterns.some(p => p.test(filePath))) {
      dynamicFiles.push(filePath);
    }
  }

  const allKeyFiles = [...new Set([...keyFiles, ...dynamicFiles])];
  const files: Record<string, string> = {};

  for (let i = 0; i < allKeyFiles.length; i += 5) {
    const batch = allKeyFiles.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (filePath) => {
        const fileRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}`, { headers });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          if (fileData.content) {
            return { path: filePath, content: atob(fileData.content.replace(/\n/g, '')) };
          }
        }
        return null;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        files[r.value.path] = r.value.content;
      }
    }
  }

  const componentFiles = allFiles
    .filter((f: string) => f.startsWith('src/') && (f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.vue')))
    .slice(0, 80);
  files['_component_files'] = componentFiles.join('\n');

  return { structure, files };
}

// Free models to try on OpenRouter (in priority order)
const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-4-maverick:free',
  'deepseek/deepseek-r1:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-32b:free',
];

async function callLovableAI(messages: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lovable AI error ${response.status}: ${errText}`);
  }

  return response;
}

async function callOpenRouter(messages: any[]) {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  for (const model of OPENROUTER_FREE_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://prompt-to-infra.lovable.app',
          'X-Title': 'BackendForge Repo Analyzer',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 8192,
        }),
      });

      if (response.ok) {
        console.log(`OpenRouter fallback succeeded with model: ${model}`);
        return response;
      }

      console.warn(`OpenRouter model ${model} failed: ${response.status}`);
    } catch (e) {
      console.warn(`OpenRouter model ${model} threw: ${e}`);
    }
  }

  throw new Error('All OpenRouter free models failed');
}

async function callAIWithFallback(messages: any[]) {
  try {
    return await callLovableAI(messages);
  } catch (e) {
    console.warn('Lovable AI failed, falling back to OpenRouter:', e);
  }

  return await callOpenRouter(messages);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl, uploadedFiles, githubToken } = await req.json();

    let projectInfo = '';
    const MAX_PROJECT_INFO = 30000;

    if (githubUrl) {
      const { structure, files } = await fetchGitHubRepo(githubUrl, githubToken);
      const structLines = structure.split('\n').slice(0, 300).join('\n');
      projectInfo = `## File Structure (${structLines.split('\n').length} files):\n${structLines}\n\n`;
      for (const [path, content] of Object.entries(files)) {
        if (projectInfo.length > MAX_PROJECT_INFO) break;
        projectInfo += `## ${path}:\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\`\n\n`;
      }
    } else if (uploadedFiles && typeof uploadedFiles === 'object') {
      for (const [path, content] of Object.entries(uploadedFiles)) {
        if (projectInfo.length > MAX_PROJECT_INFO) break;
        projectInfo += `## ${path}:\n\`\`\`\n${(content as string).slice(0, 4000)}\n\`\`\`\n\n`;
      }
    } else {
      throw new Error('Provide either a GitHub URL or uploaded files');
    }

    if (projectInfo.length > MAX_PROJECT_INFO) {
      projectInfo = projectInfo.slice(0, MAX_PROJECT_INFO) + '\n\n[... truncated for token limits]';
    }

    const messages = [
      { role: 'system', content: analysisPrompt },
      { role: 'user', content: `Analyze this frontend project thoroughly and suggest a complete backend architecture:\n\n${projectInfo}` },
    ];

    const response = await callAIWithFallback(messages);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in AI response');

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analyze-repo error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
