import React, { useState } from 'react';
import { tokens, cn } from '../theme/config';
import { RefreshCw, Send } from 'lucide-react';
import { toast } from '../lib/notifications/toast';

export const ChallengesTab: React.FC<{ isVisible?: boolean }> = ({ isVisible = true }) => {
  const [loading, setLoading] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<string>('');
  const [challengeType, setChallengeType] = useState<'journal' | 'product' | 'business'>('journal');
  const [userResponse, setUserResponse] = useState<string>('');
  const [aiFeedback, setAiFeedback] = useState<string>('');

  const challengeTypes = [
    { id: 'journal' as const, label: 'Journal Prompts', description: 'Reflective writing prompts for personal growth' },
    { id: 'product' as const, label: 'Product Case Questions', description: 'Product management and design thinking challenges' },
    { id: 'business' as const, label: 'Business Ideas', description: 'Entrepreneurial concepts and business opportunities' }
  ];

  const generateChallenge = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // Use proxy in development, direct URL in production
      const webhookUrl = import.meta.env.DEV 
        ? '/api/challenges' 
        : 'https://geronimo.askdavidstone.com/webhook/challenges';
        
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_N8N_WEBHOOK_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: challengeType,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Debug: Log the actual response structure
      console.log('n8n response:', JSON.stringify(data, null, 2));
      
      // Handle n8n response format: [{ message: { content: "..." } }]
      let challengeText;
      if (Array.isArray(data) && data.length > 0 && data[0].message?.content) {
        challengeText = data[0].message.content;
      } else if (data.challenge) {
        challengeText = data.challenge;
      } else {
        console.error('Response structure:', data);
        throw new Error('Invalid response format: expected challenge or message.content field');
      }
      
      setCurrentChallenge(challengeText);
      setUserResponse(''); // Clear previous response
      setAiFeedback(''); // Clear previous feedback
      toast.success('New challenge generated!');
    } catch (error) {
      console.error('Failed to generate challenge:', error);
      toast.error('Failed to generate challenge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!userResponse.trim() || submittingResponse) return;
    
    setSubmittingResponse(true);
    try {
      // TODO: Implement response submission webhook when ready
      throw new Error('Response submission not yet implemented');
    } catch (error) {
      console.error('Failed to submit response:', error);
      toast.error('Response submission not yet implemented');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isVisible) return null;

  return (
    <div className={tokens.layout.container}>
      <div className="grid gap-6">
        {/* Challenge Type Selector */}
        <section>
          <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text, 'mb-4')}>
            Select Challenge
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {challengeTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setChallengeType(type.id)}
                className={cn(
                  'p-4 rounded-lg border-2 transition-all duration-200 text-left',
                  challengeType === type.id
                    ? 'border-emerald-400 bg-emerald-400/10'
                    : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600 hover:bg-neutral-800/70'
                )}
              >
                <h3 className={cn(
                  tokens.typography.scale.h3,
                  tokens.typography.weights.semibold,
                  challengeType === type.id ? 'text-emerald-400' : 'text-white'
                )}>
                  {type.label}
                </h3>
                <p className={cn(
                  tokens.typography.scale.muted,
                  'text-gray-300 mt-2'
                )}>
                  {type.description}
                </p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={generateChallenge}
              disabled={loading}
              className={cn(
                tokens.button.base,
                tokens.button.primary,
                'flex items-center gap-2 px-6 py-3',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </section>

        {/* Current Challenge Display */}
        {currentChallenge && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Current Challenge
              </h2>
              <button
                onClick={() => copyToClipboard(currentChallenge)}
                className={cn(tokens.button.base, tokens.button.ghost, 'text-sm text-white')}
              >
                Copy
              </button>
            </div>
            <div className={cn(
              'p-6 rounded-lg border border-neutral-700 bg-neutral-800/50',
              'min-h-[200px] flex items-center'
            )}>
              <p className={cn(
                tokens.typography.scale.body,
                'text-white leading-relaxed whitespace-pre-wrap'
              )}>
                {currentChallenge}
              </p>
            </div>
          </section>
        )}

        {/* User Response Section */}
        {currentChallenge && (
          <section>
            <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text, 'mb-4')}>
              Your Response
            </h2>
            <div className="space-y-4">
              <textarea
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                placeholder="Share your thoughts, ideas, or solution to the challenge..."
                className={cn(
                  'w-full p-4 rounded-lg border border-neutral-700 bg-neutral-800/50',
                  'text-white placeholder-gray-400 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent',
                  'min-h-[150px]'
                )}
                rows={6}
              />
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  {userResponse.length} characters
                </div>
                <button
                  onClick={submitResponse}
                  disabled={!userResponse.trim() || submittingResponse}
                  className={cn(
                    tokens.button.base,
                    tokens.button.primary,
                    'flex items-center gap-2 px-6 py-2',
                    (!userResponse.trim() || submittingResponse) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Send className={cn('w-4 h-4', submittingResponse && 'animate-pulse')} />
                  {submittingResponse ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* AI Feedback Section */}
        {aiFeedback && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(tokens.typography.scale.h2, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                AI Feedback
              </h2>
              <button
                onClick={() => copyToClipboard(aiFeedback)}
                className={cn(tokens.button.base, tokens.button.ghost, 'text-sm text-white')}
              >
                Copy
              </button>
            </div>
            <div className={cn(
              'p-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5',
              'min-h-[150px] flex items-start'
            )}>
              <p className={cn(
                tokens.typography.scale.body,
                'text-white leading-relaxed whitespace-pre-wrap'
              )}>
                {aiFeedback}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ChallengesTab;