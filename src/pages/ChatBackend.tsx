import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Send, Bot, User, Loader2, Sparkles, Database,
  CheckCircle2, ArrowRight, Image as ImageIcon
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

type PlanSummary = {
  appName: string;
  domain: string;
  description: string;
  tables: string[];
  estimatedTableCount: number;
  features: string[];
  storageBuckets: string[];
  authProviders: string[];
  complexity: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;

const ChatBackend = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addProject } = useProjects();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const extractPlan = (text: string): PlanSummary | null => {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.ready_to_generate && parsed.summary) return parsed.summary;
    } catch { /* ignore */ }
    return null;
  };

  const streamChat = useCallback(async (allMessages: Message[], mode?: string) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages, mode }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Error ${resp.status}`);
    }

    if (!resp.body) throw new Error('No response stream');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ') || line.trim() === '' || line.startsWith(':')) continue;

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
        } catch { /* partial chunk */ }
      }
    }

    // Check for plan in completed message
    const detectedPlan = extractPlan(fullText);
    if (detectedPlan) setPlan(detectedPlan);

    return fullText;
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!plan) return;
    setIsGenerating(true);

    try {
      // Build enriched prompt from conversation + plan
      const enrichedPrompt = `Build a ${plan.domain} application called "${plan.appName}": ${plan.description}. 
Tables needed: ${plan.tables.join(', ')}. 
Features: ${plan.features.join(', ')}.
Storage buckets: ${plan.storageBuckets.join(', ')}.
Auth providers: ${plan.authProviders.join(', ')}.
Complexity: ${plan.complexity}. Generate ${plan.estimatedTableCount}+ tables with full relationships, indexes, and storage.`;

      const { data, error } = await supabase.functions.invoke('generate-backend', {
        body: { prompt: enrichedPrompt, backendType: 'supabase' },
      });

      if (error) throw error;

      const result = data?.result || data;
      const projectName = data?.projectName || plan.appName;
      const projectId = crypto.randomUUID();

      const newProject = {
        id: projectId,
        name: projectName,
        prompt: enrichedPrompt,
        backendType: 'supabase' as const,
        result,
        createdAt: new Date().toISOString(),
        status: 'ready' as const,
      };

      addProject(newProject);
      toast({ title: '🎉 Backend Generated!', description: `${result.tables?.length || 0} tables created` });
      navigate(`/project/${projectId}?tab=deploy`);
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (content: string) => {
    // Remove the JSON plan block from display
    const displayContent = content.replace(/```json\s*\{[\s\S]*?"ready_to_generate"[\s\S]*?```/g, '').trim();
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2">
        <ReactMarkdown>{displayContent}</ReactMarkdown>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 py-4 border-b border-border">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Bytebase AI Architect</h1>
            <p className="text-xs text-muted-foreground">Describe what you want to build. I'll design the perfect schema.</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">What are you building?</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">
                Tell me about your app and I'll design a production-grade database schema with tables, relationships, storage, and auth.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto pt-2">
                {[
                  'E-commerce platform with product images',
                  'Banking system with multi-currency',
                  'Healthcare patient management',
                  'SaaS with subscriptions & billing',
                  'Social media with stories & messaging',
                ].map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60'
              }`}>
                {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted/60 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Plan Card */}
          {plan && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Ready to Generate: {plan.appName}</h3>
                  <Badge variant="outline" className="ml-auto text-xs">{plan.complexity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Tables ({plan.estimatedTableCount})</h4>
                    <div className="flex flex-wrap gap-1">
                      {plan.tables.slice(0, 12).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] font-mono">
                          <Database className="h-2.5 w-2.5 mr-0.5" />{t}
                        </Badge>
                      ))}
                      {plan.tables.length > 12 && (
                        <Badge variant="outline" className="text-[10px]">+{plan.tables.length - 12} more</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Features</h4>
                    <div className="flex flex-wrap gap-1">
                      {plan.features.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {plan.storageBuckets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Storage</h4>
                    <div className="flex gap-1 flex-wrap">
                      {plan.storageBuckets.map(b => (
                        <Badge key={b} variant="outline" className="text-[10px]">
                          <ImageIcon className="h-2.5 w-2.5 mr-0.5" />{b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Schema...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Backend <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border py-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your app... e.g. 'I need a banking system with multi-currency accounts'"
              className="pr-12 min-h-[52px] max-h-[160px] resize-none"
              rows={1}
              disabled={isLoading || isGenerating}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isGenerating}
              className="absolute right-2 bottom-2 h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChatBackend;
