import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Database, Server, Cloud, Zap, Code2, Rocket,
  Upload, Brain, Layers, ArrowRight, GraduationCap,
  Sun, Moon, Instagram
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import logo from '@/assets/logo.png';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

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
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Navbar — Apple-style frosted glass */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl backdrop-saturate-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Bytebase" className="h-7 w-7" />
            <span className="font-bold text-lg tracking-tight">
              <span className="text-primary">Byte</span>base
            </span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-muted-foreground">
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors duration-200">Features</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors duration-200">Docs</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors duration-200">Pricing</button>
            <button onClick={() => navigate('/about')} className="hover:text-foreground transition-colors duration-200">Changelog</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground text-[13px]" onClick={() => navigate('/dashboard')}>
              Login
            </Button>
            <Button size="sm" className="font-semibold text-[13px] rounded-full px-5" onClick={() => navigate('/chat')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.07),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.05),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20 sm:pb-36">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3.5 py-1.5 text-xs font-medium text-primary mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                NOW IN PUBLIC BETA
              </motion.div>
              <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] leading-[1.08] mb-6">
                Bytebase turns any frontend project into a{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">fully working backend</span>{' '}
                using AI
              </motion.h1>
              <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-muted-foreground max-w-lg mb-9 leading-relaxed font-normal">
                A platform that helps developers build complete backends automatically from a frontend project or prompt.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-3 mb-9">
                <Button size="lg" className="h-12 px-7 text-[15px] font-semibold gap-2 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow duration-300" onClick={() => navigate('/chat')}>
                  Get Started for Free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-7 text-[15px] rounded-full" onClick={() => navigate('/about')}>
                  View Demo
                </Button>
              </motion.div>
              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  {['TS', 'PY', 'JS'].map((l, i) => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {l}
                    </div>
                  ))}
                </div>
                Trusted by 2,000+ developers
              </motion.div>
            </motion.div>

            {/* Code Preview — frosted card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1], delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-2xl shadow-primary/[0.04]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-destructive/70" />
                  <div className="h-3 w-3 rounded-full bg-accent/50" />
                  <div className="h-3 w-3 rounded-full bg-primary/60" />
                  <span className="text-[11px] text-muted-foreground ml-3 font-mono">index.ts — Bytebase CLI</span>
                </div>
                <pre className="text-[13px] font-mono leading-[1.8] overflow-hidden">
                  <code>
                    <span className="text-muted-foreground/60">01</span>  <span className="text-accent">import</span> schema <span className="text-accent">from</span> <span className="text-primary">'./frontend/types'</span>{'\n'}
                    <span className="text-muted-foreground/60">02</span>{'\n'}
                    <span className="text-muted-foreground/60">03</span>  bytebase.<span className="text-primary">analyze</span>(frontend_structure){'\n'}
                    <span className="text-muted-foreground/60">04</span>{'\n'}
                    <span className="text-muted-foreground/60">05</span>  <span className="text-muted-foreground">// AI generating production backend...</span>{'\n'}
                    <span className="text-muted-foreground/60">06</span>{'\n'}
                    <span className="text-muted-foreground/60">07</span>  <span className="text-primary">✓</span> PostgreSQL Schema Detected{'\n'}
                    <span className="text-muted-foreground/60">08</span>  <span className="text-primary">✓</span> Auto Migration Created{'\n'}
                    <span className="text-muted-foreground/60">09</span>  <span className="text-primary">✓</span> REST/GraphQL API Live{'\n'}
                    <span className="text-muted-foreground/60">10</span>{'\n'}
                    <span className="text-muted-foreground/60">11</span>  bytebase.<span className="text-primary">deploy</span>(<span className="text-primary">'production'</span>){'\n'}
                  </code>
                </pre>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/[0.08] border border-primary/15 px-4 py-2.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-semibold">STATUS</span>
                  <span className="text-muted-foreground">Backend Deployed</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="border-t border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-3">THE WORKFLOW</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] mb-4">
              From Frontend to Full-stack in seconds
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-xl mx-auto text-[15px]">
              Our AI analyzes your frontend structure and business logic to scaffold a production-ready backend.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-10"
          >
            {workflowSteps.map((s) => (
              <motion.div key={s.step} variants={fadeUp} custom={s.step} className="text-center group">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-card border border-border/60 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/[0.06] flex items-center justify-center mb-4 transition-all duration-300">
                  <s.icon className="h-5.5 w-5.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-1.5">Step {s.step}</p>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="border-t border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid md:grid-cols-2 gap-5"
          >
            {/* Left: Frontend Input */}
            <motion.div variants={fadeUp} custom={0}>
              <Card className="bg-card/70 backdrop-blur-xl border-border/50 rounded-2xl overflow-hidden h-full">
                <CardContent className="p-6 sm:p-8">
                  <h3 className="text-xl font-bold mb-5 tracking-tight">Your Frontend Input</h3>
                  <div className="rounded-xl bg-background/80 border border-border/50 p-5 font-mono text-xs sm:text-[13px] leading-[1.9] mb-5">
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
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Bytebase understands your types, API calls, and state requirements.
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right: Backend Architecture */}
            <motion.div variants={fadeUp} custom={1}>
              <Card className="bg-card/70 backdrop-blur-xl border-border/50 rounded-2xl overflow-hidden h-full">
                <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-center text-center h-full">
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
                    <Zap className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold mb-7 tracking-tight">Automated Backend Architecture</h3>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                    {[
                      { label: 'DATABASE', sub: 'PostgreSQL Cluster' },
                      { label: 'SERVER', sub: 'Edge Functions' },
                      { label: 'AUTH', sub: 'JWT & RBAC' },
                      { label: 'STORAGE', sub: 'S3 Compatible' },
                    ].map((b) => (
                      <div key={b.label} className="rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-3.5 hover:bg-primary/[0.08] transition-colors duration-200">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em]">{b.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{b.sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="border-t border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-center mb-16"
          >
            Who It's For
          </motion.h2>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {audiences.map((a, i) => (
              <motion.div key={a.title} variants={fadeUp} custom={i}>
                <Card className="bg-card/70 backdrop-blur-xl border-border/50 hover:border-primary/30 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/[0.04] h-full">
                  <CardContent className="p-7">
                    <div className="h-11 w-11 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-5">
                      <a.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base mb-2 tracking-tight">{a.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-br from-primary/[0.08] via-card/80 to-accent/[0.04] border border-border/50 p-10 sm:p-16 text-center backdrop-blur-xl"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] mb-5">
              Ready to build your next big thing?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-9 text-[15px]">
              Join 2,000+ developers turning ideas into production-ready full-stack applications in minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-12 px-8 text-[15px] font-semibold rounded-full shadow-lg shadow-primary/20" onClick={() => navigate('/chat')}>
                Get Started for Free
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-[15px] rounded-full" onClick={() => navigate('/about')}>
                Contact Sales
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Bytebase" className="h-5 w-5" />
            <span className="font-semibold text-sm">Bytebase</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="https://www.instagram.com/_raashif?igsh=bm14Y2FpanVkbHdm" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors duration-200 flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5" /> Raashif
            </a>
            <a href="#" className="hover:text-foreground transition-colors duration-200">Twitter</a>
            <a href="#" className="hover:text-foreground transition-colors duration-200">GitHub</a>
            <a href="#" className="hover:text-foreground transition-colors duration-200">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors duration-200">Terms</a>
          </div>
          <p className="text-xs text-muted-foreground">Built by <a href="https://www.instagram.com/_raashif?igsh=bm14Y2FpanVkbHdm" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Raashif</a> • © 2027 Bytebase</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
