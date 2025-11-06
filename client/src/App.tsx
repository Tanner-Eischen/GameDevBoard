import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import Board from "@/pages/Board";
import NotFound from "@/pages/not-found";

function Router() {
  console.log('Router rendering');
  return (
    <AuthGuard>
      <Switch>
        <Route path="/" component={Board} />
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function App() {
  console.log('App rendering');
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
