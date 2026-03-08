import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Server, Cloud, Shield, Zap } from 'lucide-react';
import logo from '@/assets/logo.png';

const features = [
  { icon: Zap, title: 'AI Backend Generation', desc: 'Describe your backend in plain English. Get a complete schema, routes, and config instantly.' },
  { icon: Database, title: 'Supabase Setup', desc: 'Auto-generate Supabase tables, RLS policies, and edge functions from a single prompt.' },
  { icon: Server, title: 'Firebase Setup', desc: 'Create Firestore collections, Cloud Functions, and auth rules automatically.' },
  { icon: Shield, title: 'Local Database Setup', desc: 'Generate SQLite or PostgreSQL schemas for local development environments.' },
  { icon: Cloud, title: 'Cloud Deployment', desc: 'Deploy your generated backend to Fly.io, Railway, or other cloud providers.' },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(142_70%_45%/0.08),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Backend Generation
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Backend<span className="text-primary">Forge</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Describe your backend in plain English. Get database schemas, API routes, auth configs, and deployment scripts — generated in seconds.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold"
              onClick={() => navigate('/dashboard')}
            >
              Start Building
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              onClick={() => navigate('/about')}
            >
              Documentation
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Landing;
