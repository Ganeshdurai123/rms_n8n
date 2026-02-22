import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ProgramListPage } from '@/pages/ProgramListPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/programs" element={<ProgramListPage />} />
              <Route
                path="/programs/:programId/sheet"
                element={
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    Sheet View (coming in 06-03)
                  </div>
                }
              />
              <Route path="/" element={<Navigate to="/programs" replace />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
