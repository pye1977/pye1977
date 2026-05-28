import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ProducerDashboard from "@/pages/ProducerDashboard";
import InvestorDashboard from "@/pages/InvestorDashboard";
import DistributorDashboard from "@/pages/DistributorDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SPVDetail from "@/pages/SPVDetail";
import ContentLibrary from "@/pages/ContentLibrary";
import SupplyChain from "@/pages/SupplyChain";
import AuditTrail from "@/pages/AuditTrail";
import PaymentReturn from "@/pages/PaymentReturn";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App min-h-screen">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/payment/return" element={<PaymentReturn />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/producer"
              element={
                <ProtectedRoute roles={["producer"]}>
                  <ProducerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/investor"
              element={
                <ProtectedRoute roles={["investor"]}>
                  <InvestorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/distributor"
              element={
                <ProtectedRoute roles={["distributor"]}>
                  <DistributorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/spv/:spvId"
              element={
                <ProtectedRoute>
                  <SPVDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditTrail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supply-chain"
              element={
                <ProtectedRoute>
                  <SupplyChain />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#121214",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
