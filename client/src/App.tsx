import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import TicketCreate from "./pages/TicketCreate";
import SmartChat from "./pages/SmartChat";
import AdminDashboard from "./pages/AdminDashboard";
import KnowledgeBase from "./pages/KnowledgeBase";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tickets"} component={TicketList} />
      <Route path={"/ticket/create"} component={TicketCreate} />
      <Route path={"/ticket/:id"} component={TicketDetail} />
      <Route path={"/chat"} component={SmartChat} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/admin/knowledge"} component={KnowledgeBase} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
