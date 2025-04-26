import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/auth-page";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ 
  path, 
  component: Component 
}: { 
  path: string, 
  component: React.ComponentType 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <AuthPage />
      </Route>
    );
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
