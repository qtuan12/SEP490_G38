import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showText?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showText = false }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-full flex items-center justify-center gap-2 transition-colors hover:bg-[hsl(var(--border)/0.5)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none border-none ${className}`}
      title={theme === 'dark' ? 'Chuyển sang giao diện Sáng (Light)' : 'Chuyển sang giao diện Tối (Dark)'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={20} className="text-amber-400 animate-fade-in" />
      ) : (
        <Moon size={20} className="text-indigo-500 animate-fade-in" />
      )}
      {showText && (
        <span className="text-sm font-medium">
          {theme === 'dark' ? 'Giao diện Tối' : 'Giao diện Sáng'}
        </span>
      )}
    </button>
  );
};
