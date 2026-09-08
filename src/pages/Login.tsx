import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, UserPlus, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [loginUsername, setLoginUsername] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [registerKey, setRegisterKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await login(loginUsername, loginKey);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: 'Welcome back!',
      description: 'You have successfully logged in.',
    });
    navigate('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await register(registerUsername, registerKey);

    if (error) {
      toast({
        title: 'Registration Failed',
        description: error,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: 'Account Created!',
      description: 'Your account has been created successfully.',
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/50 neon-border bg-card/80 backdrop-blur-xl animate-slide-in">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-2xl font-display neon-text">TaskStreak</CardTitle>
          <CardDescription className="font-body tracking-wide">
            Login or create a new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="login" className="flex items-center gap-2 font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
                <User className="w-4 h-4" />
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2 font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
                <UserPlus className="w-4 h-4" />
                Register
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="font-semibold">Username</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary/50 focus:shadow-glow transition-all duration-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-key" className="font-semibold">Access Key</Label>
                  <Input
                    id="login-key"
                    type="password"
                    placeholder="Enter the access key"
                    value={loginKey}
                    onChange={(e) => setLoginKey(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary/50 focus:shadow-glow transition-all duration-300"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || !loginUsername.trim() || !loginKey.trim()}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username" className="font-semibold">Username</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary/50 focus:shadow-glow transition-all duration-300"
                  />
                  <p className="text-xs text-muted-foreground font-body">
                    Only letters, numbers, and underscores. Minimum 3 characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-key" className="font-semibold">Access Key</Label>
                  <Input
                    id="register-key"
                    type="password"
                    placeholder="Enter the access key"
                    value={registerKey}
                    onChange={(e) => setRegisterKey(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 bg-secondary/30 border-border/50 focus:border-primary/50 focus:shadow-glow transition-all duration-300"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || !registerUsername.trim() || !registerKey.trim()}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
