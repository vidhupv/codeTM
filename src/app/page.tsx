'use client';

import { useState, useEffect } from 'react';
import RepositoryUpload from '@/components/RepositoryUpload';
import RepositoryDashboard from '@/components/RepositoryDashboard';
import QueryInterface from '@/components/QueryInterface';

export default function Home() {
  const [currentRepo, setCurrentRepo] = useState<any>(null);
  const [activeView, setActiveView] = useState<'upload' | 'timeline' | 'evolution' | 'ownership' | 'insights'>('upload');
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading Codebase Time Machine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Top Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/70 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">⏱️</div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Codebase Time Machine</h1>
                <p className="text-sm text-slate-400">Navigate code evolution through time</p>
              </div>
            </div>
            
            {/* Global Search */}
            {currentRepo && (
              <div className="flex-1 max-w-md mx-8">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask anything... 'How did auth evolve?' or 'Show me refactoring patterns'"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            
            <div className="text-sm text-slate-400">
              {currentRepo && `${currentRepo.repository.name} • ${currentRepo.analysis.totalCommits} commits`}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Left Sidebar - Repository Overview */}
        {currentRepo && (
          <aside className="w-80 bg-slate-900/40 backdrop-blur-sm border-r border-slate-700/50 overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Repository Overview</h3>
                <div className="space-y-3">
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-400">{currentRepo.analysis.totalCommits.toLocaleString()}</div>
                    <div className="text-sm text-slate-400">Total Commits</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-400">{currentRepo.analysis.authors.length}</div>
                    <div className="text-sm text-slate-400">Contributors</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-400">{currentRepo.analysis.languages.length}</div>
                    <div className="text-sm text-slate-400">Languages</div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">Top Languages</h4>
                <div className="space-y-2">
                  {currentRepo.analysis.languages.slice(0, 5).map((lang: string, i: number) => (
                    <div key={lang} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{lang}</span>
                      <div className={`w-16 h-2 rounded-full bg-gradient-to-r ${
                        i === 0 ? 'from-blue-500 to-blue-600' :
                        i === 1 ? 'from-green-500 to-green-600' :
                        i === 2 ? 'from-yellow-500 to-yellow-600' :
                        'from-slate-500 to-slate-600'
                      }`}></div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-3">Top Contributors</h4>
                <div className="space-y-2">
                  {currentRepo.analysis.authors.slice(0, 5).map((author: string, i: number) => (
                    <div key={author} className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-semibold text-white">
                        {author.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-300 truncate">{author}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {!currentRepo ? (
            <div className="h-full flex items-center justify-center">
              <RepositoryUpload
                onRepositoryUploaded={(repo) => {
                  setCurrentRepo(repo);
                  setActiveView('timeline');
                }}
              />
            </div>
          ) : (
            <>
              {/* Main Navigation */}
              <nav className="border-b border-slate-700/50 bg-slate-800/20">
                <div className="flex space-x-1 p-4">
                  {[
                    { key: 'timeline', label: 'Timeline', icon: '📈' },
                    { key: 'evolution', label: 'Code Evolution', icon: '🔄' },
                    { key: 'ownership', label: 'Ownership', icon: '👥' },
                    { key: 'insights', label: 'AI Insights', icon: '🧠' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveView(tab.key as any)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeView === tab.key
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </nav>

              {/* Dynamic Content */}
              <div className="p-6">
                {activeView === 'timeline' && (
                  <RepositoryDashboard repository={currentRepo} />
                )}
                
                {activeView === 'evolution' && (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-4">🚧</div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">Code Evolution Viewer</h3>
                    <p className="text-slate-400">Coming soon - side-by-side code changes over time</p>
                  </div>
                )}
                
                {activeView === 'ownership' && (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">Code Ownership Dashboard</h3>
                    <p className="text-slate-400">Coming soon - visualize who worked on what, when</p>
                  </div>
                )}
                
                {activeView === 'insights' && (
                  <QueryInterface repository={currentRepo} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
