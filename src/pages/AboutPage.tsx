import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Database, Server, Cloud, Shield, FileUp, Github, BookOpen,
  Container, Rocket, Lock, CheckCircle2, ArrowRight, Clock, Code2,
  Table2, Terminal, Eye
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'AI Backend Generation', desc: 'Describe your backend in plain English. Get structured database schemas, API routes, authentication configs, and feature lists — powered by Groq\'s Llama 3.3 70B.' },
  { icon: Database, title: 'Direct Supabase Integration', desc: 'Connect your Supabase database URL and apply SQL migrations directly. Transactions with BEGIN/COMMIT/ROLLBACK, RLS policies auto-generated, SQL safety validation built-in.' },
  { icon: Server, title: 'Firebase Config Generation', desc: 'Generate complete firestore.rules and firestore.indexes.json files. Download and deploy to any Firebase project instantly.' },
  { icon: Container, title: 'Docker Containerization', desc: 'Auto-generated Dockerfile, docker-compose.yml, and .env.example for every project. Production-ready container configs with multi-stage builds.' },
  { icon: Rocket, title: 'Fly.io Deployment', desc: 'One-click deployment to Fly.io using the real Machines API. App creation, machine provisioning, and health checks — all automated.' },
  { icon: Github, title: 'GitHub Repo Analysis', desc: 'Paste any GitHub URL (public or private via OAuth) to analyze frontend code and auto-suggest a matching backend architecture.' },
  { icon: FileUp, title: 'File Upload Analysis', desc: 'Upload your project files directly for backend analysis. Supports package.json, component files, and configuration files.' },
  { icon: BookOpen, title: 'Integration Tutorials', desc: 'Step-by-step code snippets showing exactly how to connect your generated backend to your frontend. Covers setup, CRUD operations, and auth.' },
  { icon: Cloud, title: 'Multiple Backend Types', desc: 'Choose from Supabase, Firebase, Local Database (SQLite/PostgreSQL), or Cloud Database configurations — all from a single prompt.' },
];

const steps = [
  { num: '01', title: 'Choose Backend Type', desc: 'Select Supabase, Firebase, Local DB, or Cloud DB as your target platform.' },
  { num: '02', title: 'Describe or Import', desc: 'Write a plain English description of your backend OR import a GitHub repository for analysis.' },
  { num: '03', title: 'AI Generates Everything', desc: 'Groq AI analyzes your input and generates schemas, routes, auth configs, Docker files, and integration tutorials.' },
  { num: '04', title: 'Review & Customize', desc: 'Inspect generated tables, API routes, features, and configurations. Everything is editable.' },
  { num: '05', title: 'Deploy or Apply', desc: 'Apply SQL directly to your Supabase DB, download Firebase configs, or deploy to Fly.io with one click.' },
  { num: '06', title: 'Integrate Your Frontend', desc: 'Follow the auto-generated tutorial to connect your frontend to the new backend.' },
];

const timeline = [
  { phase: 'Phase 1', title: 'Core Scaffold', desc: 'Landing page, Dashboard, Create Backend page, Project Context with localStorage persistence, sidebar navigation with shadcn/ui.', color: 'bg-primary' },
  { phase: 'Phase 2', title: 'AI Generation Engine', desc: 'Groq API integration via generate-backend edge function. Structured JSON output for database schemas, API routes, auth configs, and feature lists using Llama 3.3 70B.', color: 'bg-primary' },
  { phase: 'Phase 3', title: 'Real Platform Integrations', desc: 'Direct Supabase SQL execution with Deno Postgres driver. Firebase rules generation. Fly.io Machines API deployment with app creation and health checks.', color: 'bg-primary' },
  { phase: 'Phase 4', title: 'Repository Analysis', desc: 'analyze-repo edge function for GitHub API integration. File upload support for direct project analysis. Auto-suggest backend architecture from frontend code.', color: 'bg-primary' },
  { phase: 'Phase 5', title: 'Security & Reliability', desc: 'SQL safety validation with allowlist (CREATE, ALTER) and blocklist (DROP, TRUNCATE). Transaction wrapping with BEGIN/COMMIT/ROLLBACK. Port 5432 direct connection guidance.', color: 'bg-accent' },
  { phase: 'Phase 6', title: 'GitHub OAuth', desc: 'Private repository access via OAuth token exchange. github-auth edge function for secure code-to-token flow. Authenticated GitHub API requests.', color: 'bg-accent' },
  { phase: 'Phase 7', title: 'Docker & Tutorials', desc: 'AI-generated Dockerfile with multi-stage builds, docker-compose.yml, .env.example. Dynamic integration guides with platform-specific code snippets.', color: 'bg-accent' },
];

const techStack = [
  { label: 'Frontend', value: 'React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui' },
  { label: 'AI Engine', value: 'Groq API — Llama 3.3 70B Versatile' },
  { label: 'Backend', value: '7 Supabase Edge Functions (Deno runtime)' },
  { label: 'Database', value: 'Direct PostgreSQL via Deno Postgres driver' },
  { label: 'Deployment', value: 'Fly.io Machines API' },
  { label: 'Auth', value: 'GitHub OAuth for private repo access' },
  { label: 'Storage', value: 'Browser localStorage (client-side project persistence)' },
];

const edgeFunctions = [
  { name: 'generate-backend', purpose: 'AI-powered schema/route/auth generation via Groq' },
  { name: 'apply-supabase', purpose: 'Direct PostgreSQL migration with transactions + SQL validation' },
  { name: 'apply-firebase', purpose: 'Firestore rules + indexes generation' },
  { name: 'deploy-flyio', purpose: 'Fly.io app creation + machine deployment' },
  { name: 'analyze-repo', purpose: 'GitHub/file repo analysis for backend suggestion' },
  { name: 'github-auth', purpose: 'GitHub OAuth token exchange' },
  { name: 'backend-actions', purpose: 'Legacy action router (apply, deploy, logs)' },
];

const securityMeasures = [
  { icon: Shield, title: 'SQL Allowlist', desc: 'Only CREATE TABLE, ALTER TABLE, CREATE POLICY, CREATE INDEX, CREATE TYPE, CREATE FUNCTION statements are permitted.' },
  { icon: Lock, title: 'SQL Blocklist', desc: 'DROP DATABASE, DROP SCHEMA, TRUNCATE, DELETE FROM, ALTER ROLE, and other destructive commands are blocked.' },
  { icon: CheckCircle2, title: 'Transaction Safety', desc: 'All migrations wrapped in BEGIN/COMMIT with automatic ROLLBACK on any failure — no partial schema corruption.' },
  { icon: Eye, title: 'No Server Storage', desc: 'Database URLs are sent to the edge function and used only for that request — never stored server-side.' },
];

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-16 pb-20">
        {/* Hero */}
        <section className="text-center pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
            <Zap className="h-3.5 w-3.5" />
            Prompt-to-Infrastructure Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Byte<span className="text-primary">base</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            AI-powered backend generator that takes plain English prompts and produces complete database schemas, API routes, auth configs, Docker files, and deployment scripts.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">v1.0.0</Badge>
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Last updated: March 2026
            </Badge>
          </div>
        </section>

        {/* What You Can Do */}
        <section>
          <h2 className="text-2xl font-bold mb-2">What You Can Do</h2>
          <p className="text-muted-foreground mb-6"><p className="text-muted-foreground mb-6">Everything Bytebase offers — from AI generation to production deployment.</p> — from AI generation to production deployment.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <f.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold mb-2">How It Works</h2>
          <p className="text-muted-foreground mb-6">From prompt to production in six steps.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((s) => (
              <div key={s.num} className="relative p-5 rounded-lg border border-border/50 bg-card/30">
                <span className="font-mono text-3xl font-bold text-primary/15 absolute top-3 right-4">{s.num}</span>
                <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Architecture & Tech Stack</h2>
          <p className="text-muted-foreground mb-6">Built on modern, production-grade technologies.</p>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {techStack.map((t) => (
                  <div key={t.label} className="flex items-start gap-4 px-5 py-3.5">
                    <span className="text-xs font-semibold text-primary min-w-[90px] pt-0.5">{t.label}</span>
                    <span className="text-sm text-muted-foreground font-mono">{t.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Development Timeline */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Development Timeline</h2>
          <p className="text-muted-foreground mb-6">How BackendForge was built, phase by phase.</p>
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/50" />
            <div className="space-y-6">
              {timeline.map((t) => (
                <div key={t.phase} className="relative pl-12">
                  <div className={`absolute left-2.5 top-1.5 h-3.5 w-3.5 rounded-full ${t.color} ring-4 ring-background`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-[10px] px-2 py-0">{t.phase}</Badge>
                      <h3 className="font-semibold text-sm">{t.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Edge Functions Reference */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Edge Functions Reference</h2>
          <p className="text-muted-foreground mb-6">All 7 Supabase Edge Functions powering BackendForge.</p>
          <Card className="bg-card/50 border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" /> Function</div>
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {edgeFunctions.map((f) => (
                    <tr key={f.name}>
                      <td className="px-5 py-3 font-mono text-xs text-primary">{f.name}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{f.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* Security */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Security Measures</h2>
          <p className="text-muted-foreground mb-6">Production-grade safety built into every migration.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {securityMeasures.map((s) => (
              <Card key={s.title} className="bg-card/50 border-border/50">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-4.5 w-4.5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pt-4">
          <h2 className="text-2xl font-bold mb-3">Ready to Build?</h2>
          <p className="text-muted-foreground mb-6">Start generating your backend in seconds.</p>
          <div className="flex items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate('/create')}>
              Start Building <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/dashboard')}>
              View Projects
            </Button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default AboutPage;
