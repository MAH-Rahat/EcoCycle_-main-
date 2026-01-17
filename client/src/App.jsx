import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx'; 
import Signup from './pages/Signup.jsx';
import Home from './pages/Home.jsx'; 
import LogWaste from './pages/Citizen/LogWaste.jsx'; 
import AdminDashboard from './pages/Admin/AdminDashboard.jsx'; 
import AdminWasteManager from './pages/Admin/AdminWasteManager.jsx'; 
import MyActivity from './pages/Citizen/MyActivity.jsx'; 
import AdminCampaigns from './pages/Admin/AdminCampaigns.jsx'; 
import AdminRewards from './pages/Admin/AdminRewards.jsx'; 
import AdminAnalytics from './pages/Admin/AdminAnalytics.jsx'; 
import UserManager from './pages/Admin/AdminUserManagement.jsx'; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* FIXED: Root now leads to Home, not Login */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Citizen Actions */}
        <Route path="/log-waste" element={<LogWaste />} /> 
        <Route path="/my-activity" element={<MyActivity />} />

        {/* Admin Management */}
        <Route path="/admin-panel" element={<AdminDashboard />} /> 
        <Route path="/admin/waste" element={<AdminWasteManager />} /> 
        <Route path="/admin/campaigns" element={<AdminCampaigns />} />
        <Route path="/admin/rewards" element={<AdminRewards />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/users" element={<UserManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;