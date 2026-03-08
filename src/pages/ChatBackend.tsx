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
  Plus, Github, FileUp, X, FileText, ChevronDown,
  MessageSquarePlus, ArrowDown
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

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-backend`;
const CHAT_HISTORY_KEY = 'bytebase-chat-history';

const loadChatHistory = (): ChatSession[] => {
  try {
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
  } catch { return []; }
};

const saveChatHistory = (sessions: ChatSession[]) => {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(0, 20)));
};

const ChatBackend = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(loadChatHistory);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addProject } = useProjects();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(fromBottom > 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Save messages to chat history
  useEffect(() => {
    if (messages.length === 0) return;
    const title = messages[0]?.content.slice(0, 50) || 'New Chat';
    setChatSessions(prev => {
      const existing = prev.findIndex(s => s.id === currentSessionId);
      const session: ChatSession = { id: currentSessionId, title, messages, createdAt: new Date().toISOString() };
      const updated = existing >= 0
        ? prev.map((s, i) => i === existing ? session : s)
        : [session, ...prev];
      saveChatHistory(updated);
      return updated;
    });
  }, [messages, currentSessionId]);

  const handleNewChat = () => {
    setMessages([]);
    setPlan(null);
    setAttachments([]);
    setInput('');
    setCurrentSessionId(crypto.randomUUID());
    inputRef.current?.focus();
  };

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
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        {/* Minimal Header */}
        <div className="flex items-center gap-2 py-4 px-1">
          <h1 className="text-base font-semibold tracking-tight text-foreground">AI Architect</h1>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Design your backend</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 scroll-smooth">
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-24 space-y-5"
              >
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">What are you building?</h2>
                  <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                    Describe your app or attach project files.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {[
                    'E-commerce with images',
                    'SaaS with subscriptions',
                    'Social media app',
                    'Patient portal',
                  ].map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="text-xs px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
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
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-[hsl(30,25%,93%)] dark:bg-[hsl(30,10%,20%)] text-foreground rounded-br-sm'
                  : 'bg-card border border-border rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? renderMessageContent(msg.content) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}

          {/* Thinking indicator */}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Analyzing your project…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Thinking…</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Plan Card */}
          <AnimatePresence>
            {plan && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border bg-card overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold tracking-tight">{plan.appName}</h3>
                      <Badge variant="outline" className="ml-auto text-[10px]">{plan.complexity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{plan.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Tables ({plan.estimatedTableCount})</h4>
                        <div className="flex flex-wrap gap-1">
                          {plan.tables.slice(0, 10).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px] font-mono">
                              <Database className="h-2.5 w-2.5 mr-0.5" />{t}
                            </Badge>
                          ))}
                          {plan.tables.length > 10 && (
                            <Badge variant="outline" className="text-[10px]">+{plan.tables.length - 10}</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Features</h4>
                        <div className="flex flex-wrap gap-1">
                          {plan.features.map(f => (
                            <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {plan.storageBuckets.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Storage</h4>
                        <div className="flex gap-1 flex-wrap">
                          {plan.storageBuckets.map(b => (
                            <Badge key={b} variant="outline" className="text-[10px]">
                              <ImageIcon className="h-2.5 w-2.5 mr-0.5" />{b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button onClick={handleGenerate} disabled={isGenerating} className="w-full h-10 rounded-xl text-sm font-medium">
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Generate Backend <ArrowRight className="h-4 w-4 ml-1" /></>
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="border border-border rounded-xl bg-card mb-2 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Add context</span>
                  <button onClick={() => setShowAttachPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                  >
                    <FileUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Upload Files</p>
                      <p className="text-[10px] text-muted-foreground">JS, TS, JSON, etc.</p>
                    </div>
                  </button>
                  <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium">GitHub Repo</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        placeholder="github.com/user/repo"
                        className="text-xs h-8 rounded-lg"
                        onKeyDown={e => e.key === 'Enter' && handleAddGithub()}
                      />
                      <Button size="sm" className="h-8 px-3 text-xs rounded-lg" onClick={handleAddGithub} disabled={!githubUrl.trim()}>
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
              className="flex gap-1.5 flex-wrap px-1 pb-2"
            >
              {attachments.map((att, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1 text-xs"
                >
                  {att.type === 'github' ? <Github className="h-3 w-3 text-muted-foreground" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                  <span className="max-w-[140px] truncate text-foreground">{att.name}</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground transition-colors">
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

        {/* Input Area — Lovable-style pill */}
        <div className="pb-4 pt-2">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
            <button
              onClick={() => setShowAttachPanel(prev => !prev)}
              disabled={isLoading || isGenerating}
              className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI Architect..."
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none resize-none min-h-[36px] max-h-[120px] py-2 px-1"
              rows={1}
              disabled={isLoading || isGenerating}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isLoading || isGenerating}
              className="flex-shrink-0 h-8 w-8 rounded-lg"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ChatBackend;
