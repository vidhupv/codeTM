'use client';

import { useState, useEffect } from 'react';

interface Repository {
  id: string;
  name: string;
  path: string;
  url?: string;
  total_commits: number;
  total_files: number;
  languages: string[];
  created_at: string;
}

interface RepositoryDashboardProps {
  repository: {
    repository: Repository;
    analysis: {
      totalCommits: number;
      authors: string[];
      languages: string[];
      dateRange: {
        first: string;
        last: string;
      };
    };
  };
}

export default function RepositoryDashboard({ repository }: RepositoryDashboardProps) {
  const [commits, setCommits] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [architecture, setArchitecture] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'commits' | 'patterns' | 'architecture'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, [repository.repository.id]);

  const loadDashboardData = async () => {
    try {
      const [commitsRes, patternsRes, archRes] = await Promise.all([
        fetch(`/api/commits?repoId=${repository.repository.id}&limit=20`),
        fetch(`/api/analyze?repoId=${repository.repository.id}&type=pattern`),
        fetch(`/api/analyze?repoId=${repository.repository.id}&type=architecture`)
      ]);

      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        setCommits(commitsData.commits || []);
      }

      if (patternsRes.ok) {
        const patternsData = await patternsRes.json();
        setPatterns(patternsData.analyses || []);
      }

      if (archRes.ok) {
        const archData = await archRes.json();
        setArchitecture(archData.analyses || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzePatterns = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: repository.repository.id })
      });
      
      if (response.ok) {
        const result = await response.json();
        setPatterns([{ result: result.patterns, createdAt: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeArchitecture = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: repository.repository.id })
      });
      
      if (response.ok) {
        const result = await response.json();
        setArchitecture([{ result: result.decisions, createdAt: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error('Error analyzing architecture:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'JavaScript': 'bg-yellow-100 text-yellow-800',
      'TypeScript': 'bg-blue-100 text-blue-800',
      'Python': 'bg-green-100 text-green-800',
      'Java': 'bg-red-100 text-red-800',
      'Go': 'bg-cyan-100 text-cyan-800',
      'Rust': 'bg-orange-100 text-orange-800',
    };
    return colors[language] || 'bg-gray-100 text-gray-800';
  };

  if (loading && activeSection !== 'overview') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900">{repository.repository.name}</h2>
        {repository.repository.url && (
          <a
            href={repository.repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {repository.repository.url}
          </a>
        )}
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'commits', label: 'Recent Commits' },
            { key: 'patterns', label: 'Patterns' },
            { key: 'architecture', label: 'Architecture' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {repository.analysis.totalCommits.toLocaleString()}
                </div>
                <div className="text-sm text-blue-600">Total Commits</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {repository.analysis.authors.length}
                </div>
                <div className="text-sm text-green-600">Contributors</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {repository.analysis.languages.length}
                </div>
                <div className="text-sm text-purple-600">Languages</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {repository.repository.total_files.toLocaleString()}
                </div>
                <div className="text-sm text-orange-600">Files</div>
              </div>
            </div>

            {/* Languages */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {repository.analysis.languages.map((language) => (
                  <span
                    key={language}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getLanguageColor(language)}`}
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Top Contributors</h3>
              <div className="space-y-2">
                {repository.analysis.authors.slice(0, 10).map((author, index) => (
                  <div key={author} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                      {author.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-900">{author}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Development Timeline</h3>
              <div className="text-gray-600">
                <p>First commit: {formatDate(repository.analysis.dateRange.first)}</p>
                <p>Latest commit: {formatDate(repository.analysis.dateRange.last)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Commits Section */}
        {activeSection === 'commits' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Commits</h3>
            {commits.length === 0 ? (
              <p className="text-gray-500">No commits loaded yet. Commit analysis is running in the background.</p>
            ) : (
              <div className="space-y-3">
                {commits.map((commit) => (
                  <div key={commit.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{commit.message}</p>
                        <div className="mt-1 text-sm text-gray-500">
                          <span>{commit.author}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(commit.date)}</span>
                          <span className="mx-2">•</span>
                          <span>{commit.files_changed} files changed</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div className="text-green-600">+{commit.insertions}</div>
                        <div className="text-red-600">-{commit.deletions}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {commit.hash.substring(0, 8)}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patterns Section */}
        {activeSection === 'patterns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Code Patterns</h3>
              <button
                onClick={analyzePatterns}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Analyze Patterns'}
              </button>
            </div>
            
            {patterns.length === 0 ? (
              <p className="text-gray-500">
                No pattern analysis available yet. Click "Analyze Patterns" to start.
              </p>
            ) : (
              <div className="space-y-3">
                {patterns[0]?.result?.map((pattern: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{pattern.pattern}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pattern.impact === 'high' ? 'bg-red-100 text-red-800' :
                        pattern.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {pattern.impact} impact
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{pattern.description}</p>
                    <p className="text-sm text-gray-500">{pattern.reasoning}</p>
                    {pattern.introducedAt && (
                      <p className="text-xs text-gray-400 mt-2">
                        Introduced: {pattern.introducedAt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Architecture Section */}
        {activeSection === 'architecture' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Architectural Decisions</h3>
              <button
                onClick={analyzeArchitecture}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Analyze Architecture'}
              </button>
            </div>
            
            {architecture.length === 0 ? (
              <p className="text-gray-500">
                No architectural analysis available yet. Click "Analyze Architecture" to start.
              </p>
            ) : (
              <div className="space-y-3">
                {architecture[0]?.result?.map((decision: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{decision.decision}</h4>
                    <p className="text-gray-600 mb-2">{decision.rationale}</p>
                    <div className="text-sm text-gray-500 mb-2">
                      <strong>Impact:</strong> {decision.impact}
                    </div>
                    {decision.alternatives && decision.alternatives.length > 0 && (
                      <div className="text-sm text-gray-500">
                        <strong>Alternatives considered:</strong>
                        <ul className="list-disc list-inside ml-2">
                          {decision.alternatives.map((alt: string, altIndex: number) => (
                            <li key={altIndex}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {decision.commit && (
                      <p className="text-xs text-gray-400 mt-2">
                        Commit: {decision.commit}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}