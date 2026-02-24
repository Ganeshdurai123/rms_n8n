import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ProgramListPage } from '@/pages/ProgramListPage';
import { SheetViewPage } from '@/pages/SheetViewPage';
import { ImportWizardPage } from '@/pages/ImportWizardPage';
import { ImportHistoryPage } from '@/pages/ImportHistoryPage';
import { RequestDetailPage } from '@/pages/RequestDetailPage';
import { CalendarViewPage } from '@/pages/CalendarViewPage';
import { ComplianceReviewPage } from '@/pages/ComplianceReviewPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ReportDetailPage } from '@/pages/ReportDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';

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
                path="/programs/:programId/compliance-review"
                element={<ComplianceReviewPage />}
              />
              <Route
                path="/programs/:programId/calendar"
                element={<CalendarViewPage />}
              />
              <Route
                path="/programs/:programId/import/history"
                element={<ImportHistoryPage />}
              />
              <Route
                path="/programs/:programId/import"
                element={<ImportWizardPage />}
              />
              <Route
                path="/programs/:programId/requests/:requestId"
                element={<RequestDetailPage />}
              />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/reports/:reportId"
                element={<ReportDetailPage />}
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
