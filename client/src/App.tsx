import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ProgramListPage } from '@/pages/ProgramListPage';
import { SheetViewPage } from '@/pages/SheetViewPage';
import { ImportWizardPage } from '@/pages/ImportWizardPage';

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
                element={<SheetViewPage />}
              />
              <Route
                path="/programs/:programId/import"
                element={<ImportWizardPage />}
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
