import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import CreateCourse from './pages/admin/CreateCourse';
import UploadContent from './pages/admin/UploadContent';
import AddQuiz from './pages/admin/AddQuiz';
import AssignQuiz from './pages/admin/AssignQuiz';
import AdminResults from './pages/admin/Results';
import AdminSubmissionView from './pages/admin/AdminSubmissionView';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import CourseDetail from './pages/student/CourseDetail';
import QuizPage from './pages/student/QuizPage';
import AssessmentPage from './pages/student/AssessmentPage';
import ResultPage from './pages/student/ResultPage';
import GetCertificates from './pages/student/GetCertificates';
import MyAssessments from './pages/student/MyAssessments';

function RootRedirect() {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/student/assessments'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#16181f',
              color: '#f1f2f6',
              border: '1px solid #2a2d38',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#16181f' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#16181f' } },
          }}
        />
        <Routes>
          {/* Root */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>}
          />
          <Route
            path="/admin/create-course"
            element={<ProtectedRoute role="admin"><CreateCourse /></ProtectedRoute>}
          />
          <Route
            path="/admin/upload"
            element={<ProtectedRoute role="admin"><UploadContent /></ProtectedRoute>}
          />
          <Route
            path="/admin/add-quiz"
            element={<ProtectedRoute role="admin"><AddQuiz /></ProtectedRoute>}
          />
          <Route
            path="/admin/assign"
            element={<ProtectedRoute role="admin"><AssignQuiz /></ProtectedRoute>}
          />
          <Route
            path="/admin/results"
            element={<ProtectedRoute role="admin"><AdminResults /></ProtectedRoute>}
          />
          <Route
            path="/admin/results/:id"
            element={<ProtectedRoute role="admin"><AdminSubmissionView /></ProtectedRoute>}
          />

          {/* Student Routes */}
          <Route
            path="/student"
            element={<ProtectedRoute role="student"><Navigate to="/student/assessments" replace /></ProtectedRoute>}
          />
          <Route
            path="/student/courses"
            element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>}
          />
          <Route
            path="/student/courses/:id"
            element={<ProtectedRoute role="student"><CourseDetail /></ProtectedRoute>}
          />
          <Route
            path="/student/quiz/:quizId"
            element={<ProtectedRoute role="student"><AssessmentPage /></ProtectedRoute>}
          />
          <Route
            path="/student/result/:quizId"
            element={<ProtectedRoute role="student"><ResultPage /></ProtectedRoute>}
          />
          <Route
            path="/student/certificates"
            element={<ProtectedRoute role="student"><GetCertificates /></ProtectedRoute>}
          />
          <Route
            path="/student/assessments"
            element={<ProtectedRoute role="student"><MyAssessments /></ProtectedRoute>}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
