import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, MessageSquare, Wand2, CheckCircle2 } from 'lucide-react';
import { GenerationResult } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  pendingSchema?: GenerationResult;
};

interface SchemaChatProps {
  result: GenerationResult;
  projectName: string;
  onApplyChanges: (updatedResult: GenerationResult) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;

const SchemaChat = ({ result, projectName, onApplyChanges }: SchemaChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const systemPrompt = `You are a database architect refining an existing backend schema. The current project "${projectName}" has this schema:

${JSON.stringify(result, null, 2)}

The user wants to modify this schema. Respond with:
1. A brief explanation of what you're changing and why
2. Then include the FULL updated schema as a JSON code block with \`\`\`json ... \`\`\`

The JSON must be a complete GenerationResult object with tables, routes, auth, features, enums, indexes, storageBuckets etc.

Rules:
- Never add password columns — use Supabase auth.users
- Never store roles on users/profiles — use separate user_roles table
- All _id columns must have foreign key references
- Add created_at/updated_at to all tables
- Keep existing tables/routes unless user asks to remove them`;

      const allMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input.trim() },
      ];

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'system', content: systemPrompt }, ...allMessages],
        }),
      });

      if (!resp.ok) throw new Error('Failed to get response');

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
                }
                return [...prev, { role: 'assistant', content: fullText }];
              });
            }
          } catch { /* skip */ }
        }
      }

      // Extract JSON schema from response
      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed: GenerationResult = JSON.parse(jsonMatch[1]);
          if (parsed.tables && parsed.routes && parsed.auth) {
            setMessages(prev =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, pendingSchema: parsed } : m
              )
            );
          }
        } catch { /* JSON parse failed, no schema to apply */ }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (schema: GenerationResult) => {
    onApplyChanges(schema);
    toast.success('Schema changes applied!');
    setMessages(prev =>
      prev.map(m => (m.pendingSchema ? { ...m, pendingSchema: undefined } : m))
    );
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Refine Schema with AI
        </CardTitle>
      </CardHeader>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Wand2 className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Ask me to modify your schema</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {[
                'Add soft deletes to all tables',
                'Add an audit_logs table',
                'Add multi-tenancy support',
                'Add full-text search indexes',
              ].map(suggestion => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => { setInput(suggestion); }}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content.replace(/```json[\s\S]*?```/g, '_Schema JSON generated — see below_')}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.pendingSchema && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      Schema update ready ({msg.pendingSchema.tables.length} tables)
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleApply(msg.pendingSchema!)}
                    >
                      <Wand2 className="h-3 w-3" /> Apply Changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <CardContent className="shrink-0 pt-3">
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g., Add a reviews table with star ratings..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SchemaChat;
