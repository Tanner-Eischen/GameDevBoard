// Reference: blueprint:javascript_log_in_with_replit
import { Button } from "@/components/ui/button";
import { Gamepad2, Users, Zap, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Game Dev Board</h1>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-4xl text-center space-y-8">
          {/* Main Heading */}
          <div className="space-y-4">
            <h2 className="text-5xl font-bold tracking-tight">
              Collaborative Game Development
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Design tile-based game levels in real-time with your team. 
              Professional canvas tools, AI assistance, and seamless collaboration.
            </p>
          </div>

          {/* CTA */}
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 pt-12 text-left">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-5 w-5" />
                <h3 className="font-semibold">Real-Time Collaboration</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Work together with your team simultaneously. See each other's presence and changes instantly with Y.js CRDT sync.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Zap className="h-5 w-5" />
                <h3 className="font-semibold">Professional Tools</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Infinite canvas, shape tools, multi-layer tile painting with auto-tiling, sprite animations, and tileset pack management.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Natural language commands to generate maps, paint terrain, place objects, and build complete scenes instantly.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built for game development teams</p>
        </div>
      </footer>
    </div>
  );
}
