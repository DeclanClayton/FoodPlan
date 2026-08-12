import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Not linked anywhere in the UI on purpose — reach it by typing the URL. */}
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
