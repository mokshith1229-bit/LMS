import { useState } from 'react';
import { X, Minus, Plus, Divide, Hash, Delete, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Calculator({ isOpen, onClose }) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [shouldReset, setShouldReset] = useState(false);

  const handleNumber = (num) => {
    if (num === '.' && display.includes('.')) return;
    if (display === '0' || shouldReset) {
      setDisplay(num === '.' ? '0.' : num);
      setShouldReset(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op) => {
    setEquation(display + ' ' + op + ' ');
    setShouldReset(true);
  };

  const calculate = () => {
    try {
      const result = eval(equation + display);
      setDisplay(String(result));
      setEquation('');
      setShouldReset(true);
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  const buttons = [
    { label: 'C', action: clear, type: 'clear' },
    { label: '÷', action: () => handleOperator('/'), type: 'operator' },
    { label: '×', action: () => handleOperator('*'), type: 'operator' },
    { label: 'DEL', action: () => setDisplay(display.length > 1 ? display.slice(0, -1) : '0'), type: 'delete' },
    
    { label: '7', action: () => handleNumber('7') },
    { label: '8', action: () => handleNumber('8') },
    { label: '9', action: () => handleNumber('9') },
    { label: '-', action: () => handleOperator('-'), type: 'operator' },
    
    { label: '4', action: () => handleNumber('4') },
    { label: '5', action: () => handleNumber('5') },
    { label: '6', action: () => handleNumber('6') },
    { label: '+', action: () => handleOperator('+'), type: 'operator' },
    
    { label: '1', action: () => handleNumber('1') },
    { label: '2', action: () => handleNumber('2') },
    { label: '3', action: () => handleNumber('3') },
    { label: '=', action: calculate, type: 'equals' },
    
    { label: '0', action: () => handleNumber('0'), double: true },
    { label: '.', action: () => handleNumber('.') },
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
            width: 280,
            background: '#1a1c23',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            padding: 16,
            cursor: 'grab',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1, opacity: 0.6 }}>CALCULATOR</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* Display */}
          <div style={{ 
            background: '#000', 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16, 
            textAlign: 'right',
            minHeight: 70,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ color: '#4d9eff', fontSize: '0.75rem', height: 18, marginBottom: 2 }}>{equation}</div>
            <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600, overflow: 'hidden' }}>{display}</div>
          </div>

          {/* Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 8 
          }}>
            {buttons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                style={{
                  gridColumn: btn.double ? 'span 2' : 'span 1',
                  height: 48,
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  background: btn.type === 'operator' ? '#2a2d38' : 
                              btn.type === 'equals' ? '#3b82f6' :
                              btn.type === 'clear' ? '#ef4444' :
                              btn.type === 'delete' ? '#374151' : '#374151',
                  color: '#fff',
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.2)'}
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
