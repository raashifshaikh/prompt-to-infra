import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const analysisPrompt = `You are a backend architecture AI. Analyze the provided frontend project structure and code to suggest a matching backend.

You MUST respond with ONLY valid JSON matching this schema:
{
  "detectedStack": {
    "framework": "React/Vue/Angular/etc",
    "language": "TypeScript/JavaScript",
    "stateManagement": "Redux/Zustand/Context/etc",
    "styling": "Tailwind/CSS Modules/etc",
    "existingBackend": "Supabase/Firebase/None/etc"
  },
  "suggestedBackendType": "supabase|firebase|local|cloud",
  "prompt": "A detailed prompt describing the backend this frontend needs",
  "tables": [
    {
      "name": "table_name",
      "columns": [
        { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()", "primary_key": true }
      ]
    }
  ],
  "routes": [
    { "method": "GET", "path": "/api/resource", "description": "Description", "auth_required": false }
  ],
  "features": ["Feature 1", "Feature 2"],
  "reasoning": "Why this backend architecture fits this frontend"
}

Analyze package.json for dependencies, look at component names and file structure to infer data models, and suggest appropriate tables, routes, and features.`;

async function fetchGitHubRepo(repoUrl: string): Promise<{ structure: string; files: Record<string, string> }> {
  // Parse GitHub URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');

  // Fetch repo tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'BackendForge' },
  });

  let treeData;
  if (!treeRes.ok) {
    // Try master branch
    const masterRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'BackendForge' },
    });
    if (!masterRes.ok) throw new Error(`Failed to fetch repo: ${masterRes.status}`);
    treeData = await masterRes.json();
  } else {
    treeData = await treeRes.json();
  }

  const structure = treeData.tree
    .filter((f: any) => f.type === 'blob')
    .map((f: any) => f.path)
    .join('\n');

  // Fetch key files
  const keyFiles = ['package.json', 'tsconfig.json', 'src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx'];
  const files: Record<string, string> = {};

  for (const filePath of keyFiles) {
    try {
      const fileRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/contents/${filePath}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'BackendForge' },
      });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData.content) {
          files[filePath] = atob(fileData.content.replace(/\n/g, ''));
        }
      }
    } catch { /* skip */ }
  }

  // Also fetch component file names from src/
  const componentFiles = treeData.tree
    .filter((f: any) => f.type === 'blob' && f.path.startsWith('src/') && (f.path.endsWith('.tsx') || f.path.endsWith('.jsx')))
    .map((f: any) => f.path)
    .slice(0, 50);

  files['_component_files'] = componentFiles.join('\n');

  return { structure, files };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl, uploadedFiles } = await req.json();
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    let projectInfo = '';

    if (githubUrl) {
      const { structure, files } = await fetchGitHubRepo(githubUrl);
      projectInfo = `## File Structure:\n${structure}\n\n`;
      for (const [path, content] of Object.entries(files)) {
        projectInfo += `## ${path}:\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\`\n\n`;
      }
    } else if (uploadedFiles && typeof uploadedFiles === 'object') {
      for (const [path, content] of Object.entries(uploadedFiles)) {
        projectInfo += `## ${path}:\n\`\`\`\n${(content as string).slice(0, 3000)}\n\`\`\`\n\n`;
      }
    } else {
      throw new Error('Provide either a GitHub URL or uploaded files');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: analysisPrompt },
          { role: 'user', content: `Analyze this frontend project and suggest a backend:\n\n${projectInfo}` },
        ],
        temperature: 0.3,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq analysis error:', response.status, errText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in Groq response');

    const parsed = JSON.parse(content);

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
