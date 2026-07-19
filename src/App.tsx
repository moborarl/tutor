import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

const SuperAdmin = lazy(() => import('./routes/SuperAdmin'));
const Login = lazy(() => import('./routes/parent/Login'));
const Signup = lazy(() => import('./routes/parent/Signup'));
const ParentLayout = lazy(() => import('./routes/parent/ParentLayout'));
const ChildrenList = lazy(() => import('./routes/parent/ChildrenList'));
const ExerciseList = lazy(() => import('./routes/parent/ExerciseList'));
const Upload = lazy(() => import('./routes/parent/Upload'));
const ReviewExercise = lazy(() => import('./routes/parent/ReviewExercise'));
const TeacherView = lazy(() => import('./routes/parent/TeacherView'));
const StudentWorksheet = lazy(() => import('./routes/parent/StudentWorksheet'));
const ImportShared = lazy(() => import('./routes/parent/ImportShared'));
const ChildProgress = lazy(() => import('./routes/parent/ChildProgress'));
const Admin = lazy(() => import('./routes/parent/Admin'));
const AiSettings = lazy(() => import('./routes/parent/AiSettings'));
const AiHelp = lazy(() => import('./routes/parent/AiHelp'));
const ProfilePicker = lazy(() => import('./routes/play/ProfilePicker'));
const PlayExerciseList = lazy(() => import('./routes/play/PlayExerciseList'));
const Player = lazy(() => import('./routes/play/Player'));
const PlayProgress = lazy(() => import('./routes/play/PlayProgress'));

function LoadingRoute() {
  return (
    <div className="play-root centered-play">
      <div className="state-card">
        <div className="state-spinner" />
        <b>กำลังโหลดหน้า</b>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingRoute />}>
      <Routes>
        <Route path="/" element={<ProfilePicker />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/parent/login" element={<Login />} />
        <Route path="/parent/signup" element={<Signup />} />
        <Route path="/parent" element={<ParentLayout />}>
          <Route index element={<Admin />} />
          <Route path="children" element={<ChildrenList />} />
          <Route path="children/:id/progress" element={<ChildProgress />} />
          <Route path="children/:id/attempts/:attemptId" element={<ChildProgress />} />
          <Route path="admin" element={<Navigate to="/parent" replace />} />
          <Route path="exercises" element={<ExerciseList />} />
          <Route path="upload" element={<Upload />} />
          <Route path="ai" element={<AiSettings />} />
          <Route path="ai/help" element={<AiHelp />} />
          <Route path="exercises/:id" element={<ReviewExercise />} />
          <Route path="exercises/:id/teacher" element={<TeacherView />} />
          <Route path="exercises/:id/student" element={<StudentWorksheet />} />
          <Route path="import/:token" element={<ImportShared />} />
        </Route>
        <Route path="/play" element={<ProfilePicker />} />
        <Route path="/play/exercises" element={<PlayExerciseList />} />
        <Route path="/play/progress" element={<PlayProgress />} />
        <Route path="/play/exercises/:id" element={<Player />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
