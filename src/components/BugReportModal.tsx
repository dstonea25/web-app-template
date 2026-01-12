import React, { useState } from 'react';
import { X, Bug as BugIcon, Send } from 'lucide-react';
import { submitBug } from '../lib/api';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!description.trim()) return;
    
    setIsSubmitting(true);
    try {
      await submitBug({
        description: description.trim(),
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
      
      // Success - clear and close
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Failed to submit bug:', error);
      alert('Failed to submit bug. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-w-lg w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-700">
            <div className="flex items-center gap-2">
              <BugIcon className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-neutral-100">Report a Bug</h2>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-sm text-neutral-400 mb-3">
              Describe the bug briefly. This will be stored for you to review and fix later.
            </p>
            
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="E.g., Habit tracker shows wrong streak count on mobile..."
              className="w-full h-32 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
              disabled={isSubmitting}
            />
            
            <p className="text-xs text-neutral-500 mt-2">
              Tip: Include what you were doing, what went wrong, and what you expected. <br />
              Press <kbd className="px-1 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-xs">⌘ Enter</kbd> to submit.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Bug
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
