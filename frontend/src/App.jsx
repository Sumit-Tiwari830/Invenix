import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Chat from "./pages/Chat";
import KnowledgeBases from "./pages/KnowledgeBases";

function App() {
  return (
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/knowledge" element={<KnowledgeBases />} />
        </Routes>
      </DashboardLayout>
    </Router>
  );
}

export default App;
