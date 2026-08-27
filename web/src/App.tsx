import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { 
  HomePage, 
  DeploymentEventsPage, 
  ContractProfilePage,
  ChainProfilePage,
  DeploymentDetailPage,
  NotFoundPage,
} from "./pages";
import Toast from "./components/ui/Toast";
import Footer from "./components/Footer";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/deployment-events" element={<DeploymentEventsPage />} />
        <Route path="/contract/:name" element={<ContractProfilePage />} />
        <Route path="/contract/:name/deployment/:txHash" element={<DeploymentDetailPage />} />
        <Route path="/chain/:chainId" element={<ChainProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toast />
    </QueryClientProvider>
  );
}

export default App;