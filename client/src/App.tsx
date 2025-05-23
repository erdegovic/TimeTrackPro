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
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import VerifyEmailChangePage from "./pages/VerifyEmailChangePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegistrationSuccessPage from "./pages/RegistrationSuccessPage";
import UnverifiedEmailPage from "./pages/UnverifiedEmailPage";

function Router() {
  // Public routes (no layout)
  const isAuthRoute = (path: string) => {
    return path === '/login' || 
           path === '/register' || 
           path.startsWith('/verify-email') || 
           path.startsWith('/verify-email-change') ||
           path === '/forgot-password' || 
           path.startsWith('/reset-password');
  };
  
  return (
    <Switch>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/register">
        <RegisterPage />
      </Route>
      <Route path="/verify-email">
        <VerifyEmailPage />
      </Route>
      <Route path="/verify-email-change">
        <VerifyEmailChangePage />
      </Route>
      <Route path="/forgot-password">
        <ForgotPasswordPage />
      </Route>
      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>
      <Route path="/registration-success">
        <RegistrationSuccessPage />
      </Route>
      <Route path="/unverified-email">
        <UnverifiedEmailPage />
      </Route>
      
      {/* Protected routes with app layout */}
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={TimeTrackerPage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/invoices" component={InvoicesPage} />
            <Route path="/clients" component={ClientsPage} />
            <Route path="/projects" component={ProjectsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/account" component={AccountPage} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
