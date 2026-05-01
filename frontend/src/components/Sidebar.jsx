import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, Upload, ClipboardList,
  LogOut, Award, UserPlus, BarChart2, ClipboardCheck, FileSpreadsheet, PieChart, MonitorPlay
} from 'lucide-react';

const adminLinks = [
  { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/create-course', icon: <BookOpen size={18} />, label: 'Create Course' },
  { to: '/admin/upload', icon: <Upload size={18} />, label: 'Upload Content' },
  { to: '/admin/add-quiz', icon: <ClipboardList size={18} />, label: 'Add Quiz' },
  { to: '/admin/assign', icon: <UserPlus size={18} />, label: 'Assign Quiz' },
  { to: '/admin/results', icon: <BarChart2 size={18} />, label: 'Results' },
  { to: '/admin/detailed-reports', icon: <FileSpreadsheet size={18} />, label: 'Detailed Reports' },
  { to: '/admin/polls', icon: <PieChart size={18} />, label: 'Live Polls' },
  { to: '/admin/presentations', icon: <MonitorPlay size={18} />, label: 'Presentations' },
];

const studentLinks = [
  { to: '/student/assessments', icon: <ClipboardCheck size={18} />, label: 'My Assessments' },
  { to: '/student/certificates', icon: <Award size={18} />, label: 'GetMy Certificate' },
];

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 260;

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === 'admin' ? adminLinks : studentLinks;
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Invisible hover trigger zone - slightly wider than collapsed sidebar */}
      <div
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: COLLAPSED_WIDTH + 16, zIndex: 999 }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      />

      <motion.aside
        className="sidebar"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        animate={{ width: isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{
          overflow: 'hidden',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 1000,
        }}
      >
        {/* Logo */}
        <div className="sidebar-logo" style={{ justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '0 20px' : '0', transition: 'padding 0.3s' }}>
          {/* Icon placeholder dot */}
          <motion.div
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, #8DC63F, #7EB038)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontWeight: 900, fontSize: 14, color: '#fff',
            }}
          >
            C
          </motion.div>
          <AnimatePresence>
            {isOpen && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.95rem', letterSpacing: 0.5 }}
              >
                CUBE TECH
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <AnimatePresence>
              {isOpen && (
                <motion.p
                  key="section-label"
                  className="sidebar-section-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {user?.role === 'admin' ? 'Management' : 'Learning'}
                </motion.p>
              )}
            </AnimatePresence>

            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin' || link.to === '/student'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                style={{
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  padding: isOpen ? '10px 14px' : '10px',
                  overflow: 'hidden',
                }}
                title={!isOpen ? link.label : undefined}
              >
                <span style={{ flexShrink: 0 }}>{link.icon}</span>
                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.18, delay: 0.05 }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {link.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-card" style={{ justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '12px' : '8px' }}>
            <div className="user-avatar" style={{ flexShrink: 0 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  className="user-info"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p className="user-name">{user?.name}</p>
                  <p className="user-role">{user?.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isOpen && (
                <motion.button
                  className="logout-btn"
                  onClick={handleLogout}
                  title="Logout"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  whileHover={{ color: '#fca5a5' }}
                >
                  <LogOut size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
