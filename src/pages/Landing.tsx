import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Database, Server, Cloud, Shield, Zap, Code2, Rocket,
  Upload, Brain, Layers, ArrowRight, Users, GraduationCap,
  Github, Twitter, Linkedin, ChevronRight
} from 'lucide-react';
import logo from '@/assets/logo.png';

const workflowSteps = [
  { icon: Upload, step: 1, title: 'Import Project', desc: 'Connect your GitHub or upload your frontend folder.' },
  { icon: Brain, step: 2, title: 'AI Analysis', desc: 'Bytebase scans your components and state management.' },
  { icon: Layers, step: 3, title: 'Generation', desc: 'AI generates schemas, controllers, and services.' },
  { icon: Database, step: 4, title: 'Database/APIs', desc: 'Instant provisioning of PostgreSQL and APIs.' },
  { icon: Rocket, step: 5, title: 'Deploy', desc: 'One-click deployments to our global edge network.' },
];

const audiences = [
  { icon: Code2, title: 'Frontend Developers', desc: 'Ship full-stack features without touching complex server logic or infrastructure management. Focus on the UI you love.' },
  { icon: Zap, title: 'Startup Founders', desc: 'Go from MVP to market in days, not months. Reduce your burn rate by automating the heavy lifting of backend development.' },
  { icon: GraduationCap, title: 'Students', desc: 'Learn by doing. Build powerful apps for your portfolio instantly and understand how backends work by reverse-engineering AI output.' },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Bytebase" className="h-7 w-7" />
            <span className="font-bold text-lg tracking-tight">
              <span className="text-primary">Byte</span>base
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors">Features</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors">Docs</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors">Pricing</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors">Changelog</button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground" onClick={() => navigate('/dashboard')}>
              Login
            </Button>
            <Button size="sm" className="font-semibold" onClick={() => navigate('/chat')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(142_70%_45%/0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(262_80%_60%/0.04),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                NOW IN PUBLIC BETA
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Bytebase turns any frontend project into a{' '}
                <span className="text-primary">fully working backend</span>{' '}
                using AI
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                A platform that helps developers build complete backends automatically from a frontend project or prompt.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Button size="lg" className="h-12 px-6 text-base font-semibold gap-2" onClick={() => navigate('/chat')}>
                  Get Started for Free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => navigate('/about')}>
                  View Demo
                </Button>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {['TS', 'PY', 'JS'][i]}
                    </div>
                  ))}
                </div>
                Trusted by 2,000+ developers
              </div>
            </div>

            {/* Code Preview */}
            <div className="relative hidden lg:block">
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xl shadow-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-accent/60" />
                  <div className="h-3 w-3 rounded-full bg-primary/60" />
                  <span className="text-xs text-muted-foreground ml-2 font-mono">index.ts — Bytebase CLI</span>
                </div>
                <pre className="text-sm font-mono leading-relaxed overflow-hidden">
                  <code>
                    <span className="text-muted-foreground">01</span>  <span className="text-accent">import</span> schema <span className="text-accent">from</span> <span className="text-primary">'./frontend/types'</span>{'\n'}
                    <span className="text-muted-foreground">02</span>{'\n'}
                    <span className="text-muted-foreground">03</span>  bytebase.<span className="text-primary">analyze</span>(frontend_structure){'\n'}
                    <span className="text-muted-foreground">04</span>{'\n'}
                    <span className="text-muted-foreground">05</span>  <span className="text-muted-foreground">// AI generating production backend...</span>{'\n'}
                    <span className="text-muted-foreground">06</span>{'\n'}
                    <span className="text-muted-foreground">07</span>  <span className="text-primary">✓</span> PostgreSQL Schema Detected{'\n'}
                    <span className="text-muted-foreground">08</span>  <span className="text-primary">✓</span> Auto Migration Created{'\n'}
                    <span className="text-muted-foreground">09</span>  <span className="text-primary">✓</span> REST/GraphQL API Live{'\n'}
                    <span className="text-muted-foreground">10</span>{'\n'}
                    <span className="text-muted-foreground">11</span>  bytebase.<span className="text-primary">deploy</span>(<span className="text-primary">'production'</span>){'\n'}
                  </code>
                </pre>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-medium">STATUS</span>
                  <span className="text-muted-foreground">Backend Deployed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">THE WORKFLOW</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              From Frontend to Full-stack in seconds
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our AI analyzes your frontend structure and business logic to scaffold a production-ready backend.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
            {workflowSteps.map((s) => (
              <div key={s.step} className="text-center group">
                <div className="h-14 w-14 mx-auto rounded-xl bg-card border border-border group-hover:border-primary/40 flex items-center justify-center mb-4 transition-colors">
                  <s.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Step {s.step}</p>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Frontend Input */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <h3 className="text-xl font-bold mb-4">Your Frontend Input</h3>
                <div className="rounded-lg bg-background border border-border p-4 font-mono text-xs sm:text-sm leading-relaxed mb-4">
                  <p className="text-muted-foreground">// UserProfile.tsx</p>
                  <p><span className="text-accent">interface</span> <span className="text-primary">User</span> {'{'}</p>
                  <p className="pl-4">id: <span className="text-primary">string</span>;</p>
                  <p className="pl-4">username: <span className="text-primary">string</span>;</p>
                  <p className="pl-4">email: <span className="text-primary">string</span>;</p>
                  <p className="pl-4">posts: <span className="text-primary">Post[]</span>;</p>
                  <p>{'}'}</p>
                  <p className="mt-2"><span className="text-accent">const</span> fetchUser = {'() =>'}</p>
                  <p className="pl-4">axios.<span className="text-primary">get</span>(<span className="text-primary">'/api/users/me'</span>)</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Bytebase understands your types, API calls, and state requirements.
                </div>
              </CardContent>
            </Card>

            {/* Right: Backend Architecture */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-6">Automated Backend Architecture</h3>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {[
                    { label: 'DATABASE', sub: 'PostgreSQL Cluster' },
                    { label: 'SERVER', sub: 'Edge Functions' },
                    { label: 'AUTH', sub: 'JWT & RBAC' },
                    { label: 'STORAGE', sub: 'S3 Compatible' },
                  ].map((b) => (
                    <div key={b.label} className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">{b.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center mb-14">
            Who It's For
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {audiences.map((a) => (
              <Card key={a.title} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <a.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{a.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/5 border border-border p-8 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Ready to build your next big thing?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Join 2,000+ developers turning ideas into production-ready full-stack applications in minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-12 px-8 text-base font-semibold" onClick={() => navigate('/chat')}>
                Get Started for Free
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => navigate('/about')}>
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Bytebase" className="h-5 w-5" />
            <span className="font-semibold text-sm">Bytebase</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2027 Bytebase Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
