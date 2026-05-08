import { useState, useEffect } from 'react';
import { X, Delete, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { create, all } from 'mathjs';

// Initialize mathjs with high precision
const math = create(all);
math.config({
  number: 'BigNumber',
  precision: 32
});

export default function Calculator({ isOpen, onClose }) {
  const [display, setDisplay] = useState('');
  const [history, setHistory] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDegree, setIsDegree] = useState(true); // Default to Degrees for exams
  const [lastAns, setLastAns] = useState('0');

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
      
      // Handle Degree mode for trig functions
      if (isDegree) {
        // This regex looks for trig functions and appends 'deg' inside them if not already present
        expr = expr.replace(/(sin|cos|tan)\(([^)]+)\)/g, (match, func, args) => {
          if (args.includes('deg') || args.includes('rad')) return match;
          return `${func}((${args}) deg)`;
        });
      }

      // Basic auto-closing brackets if user forgot
      const openBrackets = (expr.match(/\(/g) || []).length;
      const closeBrackets = (expr.match(/\)/g) || []).length;
      for(let i=0; i < openBrackets - closeBrackets; i++) {
        expr += ')';
      }

      const result = math.evaluate(expr);
      const formattedResult = math.format(result, { precision: 14, notation: 'fixed' }).replace(/\.?0+$/, '');
      
      setHistory(display + ' =');
      setDisplay(formattedResult);
      setLastAns(formattedResult);
    } catch (e) {
      console.error(e);
      setDisplay('Error');
    }
  };

  const btnStyle = (type, active = false) => ({
    height: 44,
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    fontSize: '0.85rem',
    fontWeight: type === 'number' ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.1s',
    background: active ? '#0067c0' : 
                type === 'operator' ? '#f3f4f6' : 
                type === 'sci' ? '#f9fafb' :
                type === 'equals' ? '#0067c0' :
                type === 'clear' ? '#f3f4f6' :
                type === 'delete' ? '#f3f4f6' : '#ffffff',
    color: (active || type === 'equals') ? '#fff' : '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  });

  const sciButtons = [
    { label: 'sin', action: () => append('sin('), type: 'sci' },
    { label: 'cos', action: () => append('cos('), type: 'sci' },
    { label: 'tan', action: () => append('tan('), type: 'sci' },
    { label: isDegree ? 'DEG' : 'RAD', action: () => setIsDegree(!isDegree), type: 'sci', active: true },
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
    
    { label: '7', action: () => append('7'), type: 'number' },
    { label: '8', action: () => append('8'), type: 'number' },
    { label: '9', action: () => append('9'), type: 'number' },
    { label: '×', action: () => append('×'), type: 'operator' },
    
    { label: '4', action: () => append('4'), type: 'number' },
    { label: '5', action: () => append('5'), type: 'number' },
    { label: '6', action: () => append('6'), type: 'number' },
    { label: '-', action: () => append('-'), type: 'operator' },
    
    { label: '1', action: () => append('1'), type: 'number' },
    { label: '2', action: () => append('2'), type: 'number' },
    { label: '3', action: () => append('3'), type: 'number' },
    { label: '+', action: () => append('+'), type: 'operator' },
    
    { label: '0', action: () => append('0'), type: 'number' },
    { label: '.', action: () => append('.'), type: 'number' },
    { label: 'ANS', action: () => append(lastAns), type: 'operator' },
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
            background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.1)',
            padding: '16px',
            cursor: 'grab',
            userSelect: 'none'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: '#0067c0' }} />
              <div style={{ color: '#374151', fontSize: '0.75rem', fontWeight: 700 }}>Calculator</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex' }}
                onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <button 
                onClick={onClose} 
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex' }}
                onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Display Area */}
          <div style={{ 
            background: '#ffffff', 
            borderRadius: 4, 
            padding: '8px 4px', 
            marginBottom: 16, 
            textAlign: 'right',
            minHeight: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <div style={{ color: '#6b7280', fontSize: '0.85rem', minHeight: 20, marginBottom: 4, fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
              {history}
            </div>
            <div style={{ 
              color: '#111827', 
              fontSize: display.length > 12 ? '1.8rem' : '2.4rem', 
              fontWeight: 600, 
              overflow: 'hidden',
              fontFamily: 'Segoe UI, system-ui, sans-serif',
              whiteSpace: 'nowrap',
              letterSpacing: '-1px'
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
                  gap: 4,
                  marginBottom: 4
                }}>
                  {sciButtons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.action}
                      style={btnStyle(btn.type, btn.active)}
                      onMouseOver={(e) => {
                        if (!btn.active && btn.type !== 'equals') e.currentTarget.style.background = '#e5e7eb';
                      }}
                      onMouseOut={(e) => {
                        if (!btn.active && btn.type !== 'equals') e.currentTarget.style.background = btnStyle(btn.type).background;
                      }}
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
            gap: 4 
          }}>
            {mainButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                style={btnStyle(btn.type)}
                onMouseOver={(e) => {
                   if (btn.type !== 'equals') e.currentTarget.style.background = '#e5e7eb';
                }}
                onMouseOut={(e) => {
                   if (btn.type !== 'equals') e.currentTarget.style.background = btnStyle(btn.type).background;
                }}
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
