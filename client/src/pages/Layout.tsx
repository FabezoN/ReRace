import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#15151E]">
      <Header />
      <div className="container mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
}
