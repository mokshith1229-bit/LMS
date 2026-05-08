import { useState, useEffect } from 'react';
import { X, Delete, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { evaluate } from 'mathjs';

export default function Calculator({ isOpen, onClose }) {
  const [display, setDisplay] = useState('');
  const [history, setHistory] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Handle keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key >= '0' && e.key <= '9') append(''+e.key);
      if (['+', '-', '*', '/', '(', ')', '.', '^'].includes(e.key)) append(e.key);
      if (e.key === 'Enter') calculate();
      if (e.key === 'Backspace') backspace();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display]);

  const append = (val) => {
    setDisplay(prev => prev + val);
  };

  const clear = () => {
    setDisplay('');
    setHistory('');
  };

  const backspace = () => {
    setDisplay(prev => prev.slice(0, -1));
  };

  const calculate = () => {
    if (!display) return;
    try {
      // Replace symbols for mathjs
      let expr = display.replace(/×/g, '*').replace(/÷/g, '/');
      
      // Basic auto-closing brackets if user forgot
      const openBrackets = (expr.match(/\(/g) || []).length;
      const closeBrackets = (expr.match(/\)/g) || []).length;
      for(let i=0; i < openBrackets - closeBrackets; i++) {
        expr += ')';
      }

      const result = evaluate(expr);
      setHistory(display + ' =');
      setDisplay(Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const btnStyle = (type) => ({
    height: 42,
    borderRadius: 8,
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: type === 'operator' ? '#2d3343' : 
                type === 'sci' ? '#1e293b' :
                type === 'equals' ? '#3b82f6' :
                type === 'clear' ? '#ef4444' :
                type === 'delete' ? '#475569' : '#334155',
    color: type === 'sci' ? '#94a3b8' : '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const sciButtons = [
    { label: 'sin', action: () => append('sin('), type: 'sci' },
    { label: 'cos', action: () => append('cos('), type: 'sci' },
    { label: 'tan', action: () => append('tan('), type: 'sci' },
    { label: 'deg', action: () => append(' deg'), type: 'sci' },
    { label: 'log', action: () => append('log10('), type: 'sci' },
    { label: 'ln', action: () => append('log('), type: 'sci' },
    { label: '(', action: () => append('('), type: 'sci' },
    { label: ')', action: () => append(')'), type: 'sci' },
    { label: '√', action: () => append('sqrt('), type: 'sci' },
    { label: 'xʸ', action: () => append('^'), type: 'sci' },
    { label: 'π', action: () => append('pi'), type: 'sci' },
    { label: 'e', action: () => append('e'), type: 'sci' },
  ];

  const mainButtons = [
    { label: 'C', action: clear, type: 'clear' },
    { label: 'DEL', action: backspace, type: 'delete' },
    { label: '%', action: () => append('/100'), type: 'operator' },
    { label: '÷', action: () => append('÷'), type: 'operator' },
    
    { label: '7', action: () => append('7') },
    { label: '8', action: () => append('8') },
    { label: '9', action: () => append('9') },
    { label: '×', action: () => append('×'), type: 'operator' },
    
    { label: '4', action: () => append('4') },
    { label: '5', action: () => append('5') },
    { label: '6', action: () => append('6') },
    { label: '-', action: () => append('-'), type: 'operator' },
    
    { label: '1', action: () => append('1') },
    { label: '2', action: () => append('2') },
    { label: '3', action: () => append('3') },
    { label: '+', action: () => append('+'), type: 'operator' },
    
    { label: '0', action: () => append('0') },
    { label: '.', action: () => append('.') },
    { label: 'ANS', action: () => {}, type: 'operator' },
    { label: '=', action: calculate, type: 'equals' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          style={{
            position: 'fixed',
            right: 40,
            bottom: 40,
            zIndex: 10000,
            width: 320,
            background: '#0f172a',
            borderRadius: 20,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)',
            padding: '20px',
            cursor: 'grab',
            userSelect: 'none'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.5px' }}>SCIENTIFIC</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Display Area */}
          <div style={{ 
            background: '#1e293b', 
            borderRadius: 12, 
            padding: '16px', 
            marginBottom: 20, 
            textAlign: 'right',
            minHeight: 80,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ color: '#3b82f6', fontSize: '0.8rem', minHeight: 20, marginBottom: 4, fontFamily: 'monospace' }}>
              {history}
            </div>
            <div style={{ 
              color: '#fff', 
              fontSize: display.length > 12 ? '1.2rem' : '1.8rem', 
              fontWeight: 600, 
              overflow: 'hidden',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}>
              {display || '0'}
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: 8,
                  marginBottom: 12
                }}>
                  {sciButtons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.action}
                      style={btnStyle(btn.type)}
                      onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.3)'}
                      onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Keypad */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 8 
          }}>
            {mainButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                style={btnStyle(btn.type)}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.3)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
