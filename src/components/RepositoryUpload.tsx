'use client';

import { useState } from 'react';

interface RepositoryUploadProps {
  onRepositoryUploaded: (repository: any) => void;
}

export default function RepositoryUpload({ onRepositoryUploaded }: RepositoryUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');

  // Auto-populate repo name from GitHub URL
  const handleRepoUrlChange = (url: string) => {
    setRepoUrl(url);
    
    // Extract repo name from GitHub URL
    if (url.includes('github.com')) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const repoName = pathParts[1].replace(/\.git$/, ''); // Remove .git suffix if present
          setRepoName(repoName);
        }
      } catch (error) {
        // Invalid URL, ignore
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!repoName.trim()) {
      setError('Please enter a repository name');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('repository', file);
      formData.append('repoName', repoName.trim());
      if (repoUrl.trim()) {
        formData.append('repoUrl', repoUrl.trim());
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      onRepositoryUploaded(result);
    } catch (err: any) {
      setError(err.message || 'Failed to upload repository');
    } finally {
      setUploading(false);
    }
  };

  const handleGitHubUrl = async () => {
    if (!repoUrl.trim() || !repoName.trim()) {
      setError('Please enter both repository name and GitHub URL');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // For demo purposes, we'll simulate cloning
      // In a real implementation, you'd clone the repo server-side
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoName: repoName.trim(),
          repoUrl: repoUrl.trim(),
          cloneFromGitHub: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Clone failed');
      }

      onRepositoryUploaded(result);
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700/50 p-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-6 text-center">
          Upload Repository
        </h2>

        {/* Repository Information */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="repoName" className="block text-sm font-medium text-slate-200 mb-2">
              Repository Name *
            </label>
            <input
              type="text"
              id="repoName"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="my-awesome-project"
              className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
              disabled={uploading}
            />
          </div>

          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-slate-200 mb-2">
              GitHub URL (auto-populates name)
            </label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => handleRepoUrlChange(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 text-white placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-700"
              disabled={uploading}
            />
          </div>
        </div>

        {/* GitHub Clone Option */}
        {repoUrl.includes('github.com') && (
          <div className="mb-6">
            <button
              onClick={handleGitHubUrl}
              disabled={uploading || !repoName.trim() || !repoUrl.trim()}
              className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-700"
            >
              {uploading ? 'Cloning from GitHub...' : 'Clone from GitHub'}
            </button>
            
            <div className="my-4 text-center text-slate-400">
              <span className="bg-slate-800/50 px-3">OR</span>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-900/20'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="text-4xl text-slate-400">📁</div>
            <div>
              <p className="text-lg font-medium text-slate-100">
                Upload Repository Archive
              </p>
              <p className="text-sm text-slate-400">
                Drag and drop a ZIP file or click to browse
              </p>
            </div>
            
            <div>
              <input
                type="file"
                id="fileInput"
                accept=".zip,.tar.gz,.tar"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
              <label
                htmlFor="fileInput"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Processing...' : 'Choose File'}
              </label>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-md">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 text-sm text-slate-300">
          <h3 className="font-medium mb-2 text-slate-200">Supported formats:</h3>
          <ul className="space-y-1">
            <li>• ZIP archives containing git repositories</li>
            <li>• Public GitHub repositories (via URL)</li>
            <li>• TAR.GZ archives</li>
          </ul>
        </div>
      </div>
    </div>
  );
}