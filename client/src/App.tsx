import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AppLayout from "./components/layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import TimeTrackerPage from "./pages/TimeTrackerPage";
import ReportsPage from "./pages/ReportsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ClientsPage from "./pages/ClientsPage";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={TimeTrackerPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppLayout>
          <Router />
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
