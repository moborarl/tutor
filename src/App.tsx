import { Routes, Route, Navigate } from 'react-router-dom';
import SuperAdmin from './routes/SuperAdmin';
import Login from './routes/parent/Login';
import Signup from './routes/parent/Signup';
import ParentLayout from './routes/parent/ParentLayout';
import ChildrenList from './routes/parent/ChildrenList';
import ExerciseList from './routes/parent/ExerciseList';
import Upload from './routes/parent/Upload';
import ReviewExercise from './routes/parent/ReviewExercise';
import TeacherView from './routes/parent/TeacherView';
import StudentWorksheet from './routes/parent/StudentWorksheet';
import ImportShared from './routes/parent/ImportShared';
import ChildProgress from './routes/parent/ChildProgress';
import Admin from './routes/parent/Admin';
import ProfilePicker from './routes/play/ProfilePicker';
import PlayExerciseList from './routes/play/PlayExerciseList';
import Player from './routes/play/Player';
import PlayProgress from './routes/play/PlayProgress';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProfilePicker />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      <Route path="/parent/login" element={<Login />} />
      <Route path="/parent/signup" element={<Signup />} />
      <Route path="/parent" element={<ParentLayout />}>
        <Route index element={<Admin />} />
        <Route path="children" element={<ChildrenList />} />
        <Route path="children/:id/progress" element={<ChildProgress />} />
        <Route path="admin" element={<Navigate to="/parent" replace />} />
        <Route path="exercises" element={<ExerciseList />} />
        <Route path="upload" element={<Upload />} />
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
  );
}
