import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectProvider } from "@/context/ProjectContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreateBackend from "./pages/CreateBackend";
import ProjectView from "./pages/ProjectView";
import ChatBackend from "./pages/ChatBackend";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/AboutPage";
import DatabaseManager from "./pages/DatabaseManager";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ProjectProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create" element={<CreateBackend />} />
            <Route path="/chat" element={<ChatBackend />} />
            <Route path="/project/:id" element={<ProjectView />} />
            <Route path="/db-manager" element={<DatabaseManager />} />
            
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
