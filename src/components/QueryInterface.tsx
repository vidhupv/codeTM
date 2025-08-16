'use client';

import { useState } from 'react';

interface Repository {
  id: string;
  name: string;
}

interface QueryInterfaceProps {
  repository: {
    repository: Repository;
  };
}

export default function QueryInterface({ repository }: QueryInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [filePath, setFilePath] = useState('');
  const [timeRange, setTimeRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const exampleQuestions = [
    "Why was this pattern introduced?",
    "Show me how authentication evolved",
    "What architectural decisions were made?",
    "How did the API design change over time?",
    "Who worked on the user interface components?",
    "When was dependency injection introduced?"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const requestBody: any = {
        question: question.trim(),
        repoId: repository.repository.id
      };

      if (filePath.trim()) {
        requestBody.filePath = filePath.trim();
      }

      if (timeRange.from && timeRange.to) {
        requestBody.timeRange = timeRange;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResults(prev => [
        {
          question: question.trim(),
          result: data.result,
          timestamp: new Date().toISOString(),
          filePath: filePath.trim() || null,
          timeRange: (timeRange.from && timeRange.to) ? timeRange : null
        },
        ...prev
      ]);

      setQuestion('');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze question');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Query Form */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700/50 p-6">
        <h2 className="text-2xl font-bold text-slate-100 mb-6">
          Ask Questions About {repository.repository.name}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Question */}
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-slate-200 mb-2">
              Your Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Why was this pattern introduced? How did authentication evolve?"
              rows={3}
              className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
              disabled={loading}
            />
          </div>

          {/* Optional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="filePath" className="block text-sm font-medium text-slate-200 mb-2">
                Specific File Path (optional)
              </label>
              <input
                type="text"
                id="filePath"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="src/components/Auth.tsx"
                className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Time Range (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={timeRange.from}
                  onChange={(e) => setTimeRange(prev => ({ ...prev, from: e.target.value }))}
                  className="px-3 py-2 bg-slate-700/80 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
                  disabled={loading}
                />
                <input
                  type="date"
                  value={timeRange.to}
                  onChange={(e) => setTimeRange(prev => ({ ...prev, to: e.target.value }))}
                  className="px-3 py-2 bg-slate-700/80 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {loading ? 'Analyzing...' : 'Ask Question'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-md">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Example Questions */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Example Questions:</h3>
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-slate-700/50 text-slate-300 rounded-full hover:bg-slate-600/50 hover:text-white transition-colors disabled:opacity-50 border border-slate-600/50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-100">Analysis Results</h3>
          
          {results.map((result, index) => (
            <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700/50 p-6">
              {/* Question Header */}
              <div className="border-b border-slate-700 pb-4 mb-4">
                <h4 className="text-lg font-medium text-slate-100 mb-2">
                  "{result.question}"
                </h4>
                <div className="text-sm text-slate-400">
                  <span>Asked on {formatDate(result.timestamp)}</span>
                  {result.filePath && (
                    <>
                      <span className="mx-2">•</span>
                      <span>File: {result.filePath}</span>
                    </>
                  )}
                  {result.timeRange && (
                    <>
                      <span className="mx-2">•</span>
                      <span>
                        Time range: {formatDate(result.timeRange.from)} - {formatDate(result.timeRange.to)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Answer */}
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium text-slate-200 mb-2">Answer:</h5>
                  <p className="text-slate-300 whitespace-pre-wrap">{result.result.answer}</p>
                </div>

                {/* Relevant Commits */}
                {result.result.relevantCommits && result.result.relevantCommits.length > 0 && (
                  <div>
                    <h5 className="font-medium text-slate-200 mb-2">Relevant Commits:</h5>
                    <div className="flex flex-wrap gap-2">
                      {result.result.relevantCommits.map((commit: string, commitIndex: number) => (
                        <code
                          key={commitIndex}
                          className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-sm border border-slate-600"
                        >
                          {commit}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Insights */}
                {result.result.keyInsights && result.result.keyInsights.length > 0 && (
                  <div>
                    <h5 className="font-medium text-slate-200 mb-2">Key Insights:</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-300">
                      {result.result.keyInsights.map((insight: string, insightIndex: number) => (
                        <li key={insightIndex}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Patterns */}
                {result.result.patterns && result.result.patterns.length > 0 && (
                  <div>
                    <h5 className="font-medium text-slate-200 mb-2">Patterns Observed:</h5>
                    <ul className="list-disc list-inside space-y-1 text-slate-300">
                      {result.result.patterns.map((pattern: string, patternIndex: number) => (
                        <li key={patternIndex}>{pattern}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Business Context */}
                {result.result.businessContext && (
                  <div>
                    <h5 className="font-medium text-slate-200 mb-2">Business Context:</h5>
                    <p className="text-slate-300">{result.result.businessContext}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}