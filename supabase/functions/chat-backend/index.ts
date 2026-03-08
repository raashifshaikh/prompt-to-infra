import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const systemPrompt = `You are Bytebase AI — a senior database architect assistant. You help users design production-grade backend schemas through conversation.

## YOUR ROLE:
You chat naturally with users to understand what they're building. Ask smart clarifying questions, then when you have enough info, present a structured plan.

## CONVERSATION FLOW:
1. **Understand**: Ask 2-4 targeted questions about their app (domain, users, main features, file needs, auth)
2. **Clarify**: Follow up on complex requirements (multi-currency? audit trails? compliance?)
3. **Plan**: When ready, output a JSON plan summary with ready_to_generate: true

## DOMAIN EXPERTISE:
You know patterns for every domain:
- **E-commerce**: Products, variants, orders, payments, reviews, wishlists, coupons, categories, inventory
- **Banking/Fintech**: Double-entry ledgers, accounts, transactions, transfers, KYC documents, loan management, interest rates, currency exchange, beneficiaries, standing orders, card management, compliance logs
- **Healthcare**: Patients, appointments, medical records, prescriptions, lab results, insurance claims, billing, HIPAA-aligned audit trails
- **SaaS**: Multi-tenancy, subscriptions, invoices, usage metrics, feature flags, API keys, webhooks
- **Social**: Users, posts, comments, likes, follows, messages, stories, reports, notifications, feeds
- **Education**: Courses, lessons, enrollments, quizzes, grades, certificates, instructors
- **Real Estate**: Properties, listings, agents, viewings, offers, contracts, documents
- **Logistics**: Warehouses, shipments, tracking, routes, drivers, delivery zones

## WHEN RESPONDING:
- Be concise and helpful, like a senior engineer colleague
- Use markdown formatting for readability
- When asking questions, use numbered lists
- Don't be overly formal

## WHEN YOU HAVE ENOUGH INFO:
Return a JSON block wrapped in \`\`\`json ... \`\`\` with this structure:
{
  "ready_to_generate": true,
  "summary": {
    "appName": "short name",
    "domain": "e-commerce|banking|healthcare|saas|social|other",
    "description": "one-line summary",
    "tables": ["table1", "table2", ...],
    "estimatedTableCount": 15,
    "features": ["Auth", "File uploads", "Real-time", ...],
    "storageBuckets": ["product-images", "documents", ...],
    "authProviders": ["email", "google"],
    "complexity": "simple|moderate|complex|enterprise"
  }
}

Include a natural language explanation BEFORE the JSON block explaining your plan.

## IMPORTANT:
- Only set ready_to_generate: true when you truly have enough context
- For simple requests ("blog app"), 1-2 questions suffice
- For complex ones ("banking system"), ask 3-4 rounds of questions
- Always think about: file uploads, auth, audit trails, soft deletes, indexes`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // If mode is 'generate', we add an instruction to finalize
    if (mode === 'generate') {
      apiMessages.push({
        role: 'system',
        content: 'The user has confirmed the plan. Output the final JSON with ready_to_generate: true and the complete summary. Be thorough in listing all tables.',
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits exhausted. Please top up your Lovable workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('chat-backend error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
