import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TimerProvider } from "@/context/TimerContext";
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
import NotesPage from "./pages/Notes";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import VerifyEmailChangePage from "./pages/VerifyEmailChangePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegistrationSuccessPage from "./pages/RegistrationSuccessPage";
import UnverifiedEmailPage from "./pages/UnverifiedEmailPage";
import LandingPage from "./pages/LandingPage";
import PricingPage from "./pages/PricingPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import FaqPage from "./pages/FaqPage";
import HelpPage from "./pages/HelpPage";
import HelpArticlePage from "./pages/HelpArticlePage";
import ContactPage from "./pages/ContactPage";
import PlansPage from "./pages/PlansPage";
import { useAuth } from "./hooks/useAuth";
import TickdLoadingScreen from "./components/marketing/TickdLoadingScreen";

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <TickdLoadingScreen />;

  if (!user) return <LandingPage />;

  return <AppLayout><TimeTrackerPage /></AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/help/:topic" component={HelpArticlePage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/contact" component={ContactPage} />
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
            <Route path="/tracker" component={TimeTrackerPage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/invoices" component={InvoicesPage} />
            <Route path="/clients" component={ClientsPage} />
            <Route path="/projects" component={ProjectsPage} />
            <Route path="/notes" component={NotesPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/account" component={AccountPage} />
            <Route path="/plans" component={PlansPage} />
            <Route path="/admin" component={AdminPage} />
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
      <TimerProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </TimerProvider>
    </QueryClientProvider>
  );
}

export default App;
