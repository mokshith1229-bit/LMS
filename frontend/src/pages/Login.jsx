import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  // --- Authentication State ---
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // --- Professional 3D Parallax Physics ---
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 40 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 40 });

  const rotateX = useTransform(mouseYSpring, [0, 1], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [0, 1], ["-12deg", "12deg"]);

  // Dynamic shadows and ambient lighting that shifts based on angle
  const shadowX = useTransform(mouseXSpring, [0, 1], ["-30px", "30px"]);
  const shadowY = useTransform(mouseYSpring, [0, 1], ["-30px", "30px"]);
  const dynamicFilter = useMotionTemplate`drop-shadow(${shadowX} ${shadowY} 30px rgba(0,0,0,0.08))`;

  // High-End Specular Glare Tracking
  const glareX = useTransform(mouseXSpring, [0, 1], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [0, 1], ["100%", "0%"]);
  const glarePosition = useMotionTemplate`${glareX} ${glareY}`;
  
  // Parallax background orbs
  const glowX1 = useTransform(mouseXSpring, [0, 1], [-80, 80]);
  const glowY1 = useTransform(mouseYSpring, [0, 1], [-80, 80]);
  const glowX2 = useTransform(mouseXSpring, [0, 1], [80, -80]);
  const glowY2 = useTransform(mouseYSpring, [0, 1], [80, -80]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(Math.max(0, Math.min(1, mouseX / rect.width)));
    y.set(Math.max(0, Math.min(1, mouseY / rect.height)));
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate(data.user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Form Stagger Animation Variants
  const formContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.6 }
    }
  };

  const formItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 150, damping: 15 } }
  };

  return (
    <div className="auth-page">
      {/* Ultra-Modern Interactive SaaS Branding Side */}
      <div 
        className="auth-branding-side" 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ 
          position: 'relative', 
          overflow: 'hidden', 
          background: '#ffffff', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          perspective: '1500px'
        }}
      >
        {/* Subtle dot matrix background */}
        <div 
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 2px, transparent 2px)',
            backgroundSize: '32px 32px',
            opacity: 0.6
          }}
        />

        {/* Soft colorful accent glow blurs with Parallax */}
        <motion.div 
          style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'rgba(56,189,248,0.25)', borderRadius: '50%', filter: 'blur(70px)', zIndex: 1, x: glowX1, y: glowY1 }}
        />
        <motion.div 
          style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '400px', height: '400px', background: 'rgba(16,185,129,0.2)', borderRadius: '50%', filter: 'blur(90px)', zIndex: 1, x: glowX2, y: glowY2 }}
        />

        {/* Refined Story Mode Interactive 3D Logo Container */}
        <motion.div 
          style={{ 
            position: 'relative', 
            zIndex: 10, 
            width: '100%', 
            maxWidth: '550px', 
            padding: '40px',
            rotateX,
            rotateY,
            transformStyle: "preserve-3d"
          }}
        >
          {/* Parallax Container */}
          <motion.div 
            style={{ position: 'relative', width: '100%', mixBlendMode: 'multiply', transform: 'translateZ(50px)' }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Base Logo with Cinematic Mask Reveal */}
            <motion.img 
              src="/assets/cube_tech_logo.png" 
              alt="Cube Tech" 
              style={{ 
                width: '100%', 
                height: 'auto', 
                display: 'block',
                filter: dynamicFilter
              }}
              initial={{ clipPath: 'inset(0% 0% 100% 0%)', opacity: 0, scale: 0.95 }}
              animate={{ 
                clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 45% 0%)', 'inset(0% 0% 45% 0%)', 'inset(0% 0% 0% 0%)'], // 45% covers the bulb, then holds, then reveals the typography
                opacity: 1, 
                scale: 1 
              }}
              transition={{ 
                clipPath: {
                  duration: 2.5,
                  times: [0, 0.35, 0.65, 1],
                  ease: ["easeOut", "linear", "easeOut"],
                  delay: 0.3
                },
                opacity: { duration: 0.6 },
                scale: { duration: 1.5, ease: "easeOut" }
              }}
            />

            {/* Glowing Sweep that follows the mask line to make it look like a scanner printing it */}
            <motion.div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, height: '4px',
                background: 'rgba(56, 189, 248, 0.8)',
                boxShadow: '0px 0px 15px 4px rgba(56, 189, 248, 0.6)',
                zIndex: 20
              }}
              initial={{ top: '0%', opacity: 0 }}
              animate={{ top: ['0%', '55%', '55%', '100%'], opacity: [0, 1, 1, 0] }}
              transition={{ 
                top: {
                  duration: 2.5,
                  times: [0, 0.35, 0.65, 1],
                  ease: ["easeOut", "linear", "easeOut"],
                  delay: 0.3
                },
                opacity: { 
                  duration: 2.5,
                  times: [0, 0.1, 0.9, 1],
                  delay: 0.3
                }
              }}
            />

            {/* Dynamic Holographic Surface Glare */}
            <motion.div
               style={{
                 position: 'absolute', inset: -20, zIndex: 40, pointerEvents: 'none',
                 background: 'radial-gradient(circle at center, rgba(255,255,255,0.6) 0%, transparent 60%)',
                 backgroundSize: '200% 200%',
                 backgroundPosition: glarePosition,
                 mixBlendMode: 'overlay', // Catches the light naturally
                 borderRadius: '20px'
               }}
            />
          </motion.div>
        </motion.div>
      </div>


      {/* Form Side */}
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="auth-header">
            <h1>Sign In</h1>
            <p>Welcome back! Please enter your credentials.</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="login-email"
                  className="form-input"
                  style={{ paddingLeft: 40 }}
                  type="email"
                  name="email"
                  placeholder="admin@test.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="login-password"
                  className="form-input"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button id="login-submit" type="submit" className="btn btn-primary btn-full" style={{ marginTop: 12 }} disabled={loading}>
              {loading ? 'Processing...' : 'Login'}
            </button>
          </form>

          <div className="auth-link" style={{ textAlign: 'center', marginTop: 24, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 700 }}>Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );

}
