import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Database } from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground text-sm mb-8">Configure your Bytebase environment.</p>
        <div className="space-y-4">
          {/* Quick Access */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Your Profile</CardTitle>
              <CardDescription>Edit your display name, username, and avatar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
                <UserCircle className="h-4 w-4 mr-2" /> Go to Profile
              </Button>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Database Manager</CardTitle>
              <CardDescription>Connect to and edit your existing Supabase database easily.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => navigate('/db-manager')}>
                <Database className="h-4 w-4 mr-2" /> Open DB Manager
              </Button>
            </CardContent>
          </Card>
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
};

export default SettingsPage;
