import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SettingsPage = () => (
  <DashboardLayout>
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm mb-8">Configure your BackendForge environment.</p>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Provider</CardTitle>
            <CardDescription>Groq API is configured via server-side secrets.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-primary border-primary/30">Connected</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage</CardTitle>
            <CardDescription>Projects are stored locally in your browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">localStorage</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  </DashboardLayout>
);

export default SettingsPage;
