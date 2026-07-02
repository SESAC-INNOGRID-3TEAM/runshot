import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/common/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import EventListPage from "./pages/EventListPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventSearchPage from "./pages/EventSearchPage";
import EventUploadPage from "./pages/EventUploadPage";
import EventNewPage from "./pages/EventNewPage";
import EventEditPage from "./pages/EventEditPage";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/events" element={<EventListPage />} />
        <Route path="/events/new" element={
          <ProtectedRoute minRole="organizer">
            <EventNewPage />
          </ProtectedRoute>
        } />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={
          <ProtectedRoute minRole="organizer">
            <EventEditPage />
          </ProtectedRoute>
        } />
        <Route path="/events/:id/search" element={<EventSearchPage />} />
        <Route path="/events/:id/upload" element={
          <ProtectedRoute minRole="photographer">
            <EventUploadPage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute minRole="admin">
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
