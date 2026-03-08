import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useProjects } from '@/context/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Send, Loader2, Sparkles, Database,
  CheckCircle2, ArrowRight, Image as ImageIcon,
  Plus, Github, FileUp, X, FileText, ChevronDown
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

type Attachment = {
  type: 'file' | 'github';
  name: string;
  content?: string;
  url?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;

const ChatBackend = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    const detectedPlan = extractPlan(fullText);
    if (detectedPlan) setPlan(detectedPlan);

    return fullText;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 5MB limit`, variant: 'destructive' });
        continue;
      }
      try {
        const content = await file.text();
        newAttachments.push({ type: 'file', name: file.name, content });
      } catch {
        toast({ title: 'Read error', description: `Could not read ${file.name}`, variant: 'destructive' });
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setShowAttachPanel(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddGithub = () => {
    const url = githubUrl.trim();
    if (!url) return;
    if (!url.match(/github\.com\/[^/]+\/[^/]+/)) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid GitHub repository URL', variant: 'destructive' });
      return;
    }
    setAttachments(prev => [...prev, { type: 'github', name: url.split('/').slice(-2).join('/'), url }]);
    setGithubUrl('');
    setShowAttachPanel(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeAttachments = async (): Promise<string> => {
    const fileAttachments = attachments.filter(a => a.type === 'file');
    const githubAttachments = attachments.filter(a => a.type === 'github');
    const contextParts: string[] = [];

    for (const gh of githubAttachments) {
      try {
        const { data, error } = await supabase.functions.invoke('analyze-repo', {
          body: { githubUrl: gh.url },
        });
        if (error) throw error;
        contextParts.push(
          `## Deep Analysis of GitHub Repo: ${gh.name}\n` +
          `**Stack**: ${data.detectedStack?.framework || 'Unknown'} / ${data.detectedStack?.language || 'Unknown'}\n` +
          `**State Management**: ${data.detectedStack?.stateManagement || 'Unknown'}\n` +
          `**Styling**: ${data.detectedStack?.styling || 'Unknown'}\n` +
          `**Router**: ${data.detectedStack?.router || 'Unknown'}\n` +
          `**Existing Backend**: ${data.detectedStack?.existingBackend || 'None detected'}\n` +
          `**Suggested Backend Type**: ${data.suggestedBackendType || 'supabase'}\n\n` +
          `**Detailed Analysis**:\n${data.prompt || data.reasoning || 'No analysis available'}\n\n` +
          `**Detected Features**: ${data.features?.join(', ') || 'None'}\n` +
          (data.tables?.length ? `**Suggested Tables** (${data.tables.length}):\n${data.tables.map((t: any) =>
            `- \`${t.name}\`: ${t.columns?.map((c: any) => c.name).join(', ') || 'no columns'}`
          ).join('\n')}` : '') +
          (data.storageBuckets?.length ? `\n**Storage Buckets**: ${data.storageBuckets.join(', ')}` : '') +
          (data.authProviders?.length ? `\n**Auth Providers**: ${data.authProviders.join(', ')}` : '')
        );
      } catch (e: any) {
        contextParts.push(`## GitHub Repo: ${gh.name}\n⚠️ Could not analyze: ${e.message}`);
      }
    }

    if (fileAttachments.length > 0) {
      try {
        const uploadedFiles: Record<string, string> = {};
        fileAttachments.forEach(f => { uploadedFiles[f.name] = f.content || ''; });
        const { data, error } = await supabase.functions.invoke('analyze-repo', {
          body: { uploadedFiles },
        });
        if (error) throw error;
        contextParts.push(
          `## Deep Analysis of Uploaded Files (${fileAttachments.length} files)\n` +
          `**Stack**: ${data.detectedStack?.framework || 'Unknown'} / ${data.detectedStack?.language || 'Unknown'}\n` +
          `**Detailed Analysis**:\n${data.prompt || data.reasoning || 'No analysis available'}\n\n` +
          `**Detected Features**: ${data.features?.join(', ') || 'None'}\n` +
          (data.tables?.length ? `**Suggested Tables** (${data.tables.length}):\n${data.tables.map((t: any) =>
            `- \`${t.name}\`: ${t.columns?.map((c: any) => c.name).join(', ') || 'no columns'}`
          ).join('\n')}` : '')
        );
      } catch {
        // Fallback: pass raw file contents
        const filesSummary = fileAttachments.map(f => `### ${f.name}\n\`\`\`\n${(f.content || '').slice(0, 3000)}\n\`\`\``).join('\n\n');
        contextParts.push(`## Uploaded Files (raw content)\n${filesSummary}`);
      }
    }

    // Also include raw file content for uploaded files so AI can reference actual code
    if (fileAttachments.length > 0) {
      let rawContent = '\n\n## Raw File Contents for Reference\n';
      for (const f of fileAttachments) {
        const snippet = (f.content || '').slice(0, 3000);
        rawContent += `### ${f.name}\n\`\`\`\n${snippet}\n\`\`\`\n\n`;
        if (rawContent.length > 15000) break;
      }
      contextParts.push(rawContent);
    }

    return contextParts.join('\n\n');
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isLoading) return;

    if (attachments.length > 0) {
      setIsLoading(true);
      setIsAnalyzing(true);

      const attachmentNames = attachments.map(a =>
        a.type === 'github' ? `📦 ${a.name}` : `📄 ${a.name}`
      ).join(', ');

      const userDisplay = trimmed
        ? `${trimmed}\n\n*Attached: ${attachmentNames}*`
        : `Analyze and build backend for: ${attachmentNames}`;

      const userMsg: Message = { role: 'user', content: userDisplay };
      setMessages(prev => [...prev, userMsg]);
      setInput('');

      try {
        const analysisContext = await analyzeAttachments();
        const contextMessage = trimmed
          ? `${trimmed}\n\nThe user has attached the following project files/repos for analysis. Use this deep context to design the perfect backend:\n\n${analysisContext}`
          : `The user wants a backend for their project. Analyze this deeply and design a comprehensive backend:\n\n${analysisContext}`;

        const newMessages: Message[] = [...messages, { role: 'user', content: contextMessage }];
        setAttachments([]);
        await streamChat(newMessages);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
        setIsAnalyzing(false);
      }
      return;
    }

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
    const displayContent = content.replace(/```json\s*\{[\s\S]*?"ready_to_generate"[\s\S]*?```/g, '').trim();
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1">
        <ReactMarkdown>{displayContent}</ReactMarkdown>
      </div>
    );
  };

  const msgVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        {/* Frosted Glass Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3.5 py-5 px-1 border-b border-border/50"
        >
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">AI Architect</h1>
            <p className="text-xs text-muted-foreground">Describe your app, attach files, or paste a GitHub repo.</p>
          </div>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 space-y-5 scroll-smooth">
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center py-20 space-y-6"
              >
                <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mx-auto ring-1 ring-primary/10">
                  <Sparkles className="h-9 w-9 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">What are you building?</h2>
                  <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                    Describe your app, upload project files, or paste a GitHub repo — I'll architect the perfect backend.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto pt-1">
                  {[
                    'E-commerce with product images',
                    'SaaS with subscriptions',
                    'Social media with messaging',
                    'Healthcare patient portal',
                    'Banking multi-currency system',
                  ].map(s => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="text-xs px-4 py-2 rounded-full border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
                <div className="flex gap-3 justify-center pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAttachPanel(true)}
                    className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <FileUp className="h-4 w-4" /> Upload Files
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAttachPanel(true)}
                    className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <Github className="h-4 w-4" /> Import from GitHub
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              variants={msgVariants}
              initial="hidden"
              animate="visible"
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border border-border/50 shadow-sm rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? renderMessageContent(msg.content) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}

          {/* Loading indicator */}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-card border border-border/50 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Deep-analyzing your project…</span>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center py-1">
                    <span className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '200ms' }} />
                    <span className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '400ms' }} />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Plan Card */}
          <AnimatePresence>
            {plan && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <Card className="border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold tracking-tight">Ready to Generate: {plan.appName}</h3>
                      <Badge variant="outline" className="ml-auto text-[10px] font-medium">{plan.complexity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Tables ({plan.estimatedTableCount})</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.tables.slice(0, 12).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px] font-mono bg-muted/30">
                              <Database className="h-2.5 w-2.5 mr-0.5" />{t}
                            </Badge>
                          ))}
                          {plan.tables.length > 12 && (
                            <Badge variant="outline" className="text-[10px]">+{plan.tables.length - 12} more</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Features</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.features.map(f => (
                            <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {plan.storageBuckets.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Storage</h4>
                        <div className="flex gap-1.5 flex-wrap">
                          {plan.storageBuckets.map(b => (
                            <Badge key={b} variant="outline" className="text-[10px] bg-muted/30">
                              <ImageIcon className="h-2.5 w-2.5 mr-0.5" />{b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-11 rounded-xl text-sm font-medium">
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Schema…</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Generate Backend <ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Panel */}
        <AnimatePresence>
          {showAttachPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="border-t border-border/50 bg-card/80 backdrop-blur-lg"
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Add Context</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowAttachPanel(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <FileUp className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload Files</p>
                      <p className="text-[10px] text-muted-foreground">JS, TS, JSON, package.json, etc.</p>
                    </div>
                  </motion.button>

                  <div className="flex flex-col gap-3 p-5 rounded-xl border border-dashed border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                        <Github className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">GitHub Repo</p>
                        <p className="text-[10px] text-muted-foreground">Paste repository URL</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/user/repo"
                        className="text-xs h-9 rounded-lg"
                        onKeyDown={e => e.key === 'Enter' && handleAddGithub()}
                      />
                      <Button size="sm" className="h-9 px-4 text-xs rounded-lg" onClick={handleAddGithub} disabled={!githubUrl.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment Chips */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 flex-wrap px-1 pt-2"
            >
              {attachments.map((att, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 bg-card border border-border/50 rounded-lg px-3 py-1.5 text-xs shadow-sm"
                >
                  {att.type === 'github' ? (
                    <Github className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="max-w-[150px] truncate">{att.name}</span>
                  <button onClick={() => removeAttachment(i)} className="opacity-50 hover:opacity-100 transition-opacity ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".js,.jsx,.ts,.tsx,.json,.css,.html,.md,.txt,.yaml,.yml,.toml,.env,.gitignore,.sql,.py,.go,.rs,.java,.swift,.kt"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Input Area */}
        <div className="border-t border-border/50 py-3 pb-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 bottom-2 h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setShowAttachPanel(prev => !prev)}
              disabled={isLoading || isGenerating}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachments.length > 0
                ? "Add instructions for attached files, then press Enter…"
                : "Describe your app, or click 📎 to attach…"
              }
              className="flex w-full rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm pl-12 pr-12 py-3.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] max-h-[160px] resize-none"
              rows={1}
              disabled={isLoading || isGenerating}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isLoading || isGenerating}
              className="absolute right-2 bottom-2 h-9 w-9 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center opacity-60">
            Enter to send · Shift+Enter for new line · 📎 Attach files or GitHub repo
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChatBackend;
