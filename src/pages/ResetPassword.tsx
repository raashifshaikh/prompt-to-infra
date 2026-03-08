import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      navigate('/auth');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Bytebase" className="h-10 w-10" />
        </div>
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
          <p className="text-sm text-muted-foreground">Enter your new password below</p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-medium">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
