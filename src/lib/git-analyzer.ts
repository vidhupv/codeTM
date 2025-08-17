import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';
import { promises as fs } from 'fs';
import path from 'path';
import { db, Repository, Commit, FileChange } from './database';

export interface GitAnalysisResult {
  repository: Repository;
  totalCommits: number;
  authors: string[];
  languages: string[];
  dateRange: {
    first: string;
    last: string;
  };
  codebase: {
    totalLines: number;
    fileContents: { [filePath: string]: string };
    keyFiles: string[];
  };
}

export class GitAnalyzer {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async analyzeRepository(repoName: string, repoUrl?: string): Promise<GitAnalysisResult> {
    console.log(`Starting comprehensive analysis of repository: ${repoName}`);
    
    // Check if it's a valid git repository
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      console.log('Not a git repository, treating as API-fetched repository');
    }

    let log: LogResult;
    let authors: string[];
    
    try {
      // Get basic repository info
      log = await this.git.log(['--all', '--oneline']);
      authors = await this.getUniqueAuthors();
    } catch (error) {
      console.log('No git history available, using fallback data');
      log = { all: [], latest: null as any, total: 0 };
      authors = ['Unknown'];
    }
    
    const languages = await this.detectLanguages();
    
    // Analyze codebase content
    const codebase = await this.analyzeCodebase();
    
    // Create repository record
    const repository = await db.createRepository({
      name: repoName,
      path: this.repoPath,
      url: repoUrl,
      last_analyzed: null,
      total_commits: log.total,
      total_files: Object.keys(codebase.fileContents).length,
      languages
    });

    // Get date range
    const firstCommit = log.all[log.all.length - 1];
    const lastCommit = log.all[0];

    const result: GitAnalysisResult = {
      repository,
      totalCommits: log.total,
      authors,
      languages,
      codebase,
      dateRange: {
        first: firstCommit?.date || new Date().toISOString(),
        last: lastCommit?.date || new Date().toISOString()
      }
    };

    console.log(`Repository analysis complete. Found ${log.total} commits, ${authors.length} authors, ${languages.length} languages, ${codebase.totalLines} lines of code`);
    return result;
  }

  private async analyzeCodebase(): Promise<{ totalLines: number; fileContents: { [filePath: string]: string }; keyFiles: string[] }> {
    const fileContents: { [filePath: string]: string } = {};
    let totalLines = 0;
    const keyFiles: string[] = [];

    try {
      const files = await this.getImportantFiles();
      
      for (const filePath of files) {
        try {
          const fullPath = path.join(this.repoPath, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // Skip binary files and very large files
          if (this.isTextFile(content) && content.length < 100000) {
            fileContents[filePath] = content;
            totalLines += content.split('\n').length;
            
            // Mark as key file if it's important
            if (this.isKeyFile(filePath)) {
              keyFiles.push(filePath);
            }
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Couldn't read file ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error('Error analyzing codebase:', error);
    }

    return { totalLines, fileContents, keyFiles };
  }

  private async getImportantFiles(): Promise<string[]> {
    const files: string[] = [];
    
    // Get all files from git
    try {
      const gitFiles = await this.git.raw(['ls-files']);
      const allFiles = gitFiles.split('\n').filter(f => f.trim());
      
      // Filter for important file types and exclude common ignore patterns
      const importantFiles = allFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file).toLowerCase();
        
        // Include source code files
        const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb'];
        const configFiles = ['readme', 'package.json', 'tsconfig.json', 'cargo.toml', 'pom.xml', 'build.gradle'];
        
        // Exclude common non-essential files
        const excludePatterns = ['node_modules/', 'dist/', 'build/', '.git/', 'coverage/', 'target/', 'vendor/'];
        
        if (excludePatterns.some(pattern => file.includes(pattern))) {
          return false;
        }
        
        return sourceExtensions.includes(ext) || 
               configFiles.some(config => basename.includes(config)) ||
               basename === 'dockerfile' ||
               file.endsWith('.md');
      });

      // Prioritize key files
      const prioritizedFiles = [
        ...importantFiles.filter(f => this.isKeyFile(f)),
        ...importantFiles.filter(f => !this.isKeyFile(f))
      ];

      return prioritizedFiles.slice(0, 50); // Limit to prevent overwhelming the analysis
    } catch (error) {
      console.error('Error getting important files:', error);
      return [];
    }
  }

  private isKeyFile(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    const keyPatterns = [
      'readme', 'index', 'main', 'app', 'server', 'client', 
      'package.json', 'tsconfig', 'dockerfile', 'makefile',
      'config', 'setup', 'init', 'bootstrap'
    ];
    
    return keyPatterns.some(pattern => basename.includes(pattern));
  }

  private isTextFile(content: string): boolean {
    // Simple heuristic to detect text files
    const nonPrintableChars = content.match(/[\x00-\x08\x0E-\x1F\x7F]/g);
    return !nonPrintableChars || nonPrintableChars.length < content.length * 0.1;
  }

  async analyzeCommitHistory(repoId: string, limit = 1000): Promise<void> {
    console.log(`Analyzing commit history for repository ${repoId}...`);
    
    const log = await this.git.log(['--all', '--stat', `--max-count=${limit}`]);
    
    for (const commit of log.all) {
      try {
        // Parse commit data
        const commitData: Omit<Commit, 'id'> = {
          repo_id: repoId,
          hash: commit.hash,
          author: commit.author_name,
          email: commit.author_email,
          date: commit.date,
          message: commit.message,
          files_changed: 0,
          insertions: 0,
          deletions: 0,
          parents: commit.refs ? commit.refs.split(', ') : []
        };

        // Get file changes for this commit
        const diffSummary = await this.git.diffSummary([`${commit.hash}^`, commit.hash]);
        commitData.files_changed = diffSummary.files.length;
        commitData.insertions = diffSummary.insertions;
        commitData.deletions = diffSummary.deletions;

        // Save commit
        const savedCommit = await db.createCommit(commitData);

        // Analyze file changes
        await this.analyzeFileChanges(savedCommit.id, commit.hash);

      } catch (error) {
        console.error(`Error analyzing commit ${commit.hash}:`, error);
        // Continue with next commit
      }
    }

    console.log(`Commit history analysis complete. Processed ${log.all.length} commits`);
  }

  private async analyzeFileChanges(commitId: string, commitHash: string): Promise<void> {
    try {
      const diff = await this.git.diff([`${commitHash}^`, commitHash, '--name-status']);
      const lines = diff.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const status = parts[0];
        const filePath = parts[1];
        const oldPath = parts[2]; // For renames

        let changeType: FileChange['change_type'];
        switch (status[0]) {
          case 'A':
            changeType = 'added';
            break;
          case 'M':
            changeType = 'modified';
            break;
          case 'D':
            changeType = 'deleted';
            break;
          case 'R':
            changeType = 'renamed';
            break;
          default:
            changeType = 'modified';
        }

        // Get detailed diff stats for this file
        let insertions = 0;
        let deletions = 0;
        
        try {
          const fileDiff = await this.git.diff([`${commitHash}^`, commitHash, '--numstat', '--', filePath]);
          const statLine = fileDiff.split('\n')[0];
          if (statLine && statLine !== '-\t-') {
            const [ins, del] = statLine.split('\t');
            insertions = parseInt(ins) || 0;
            deletions = parseInt(del) || 0;
          }
        } catch (error) {
          // Skip if file diff fails (e.g., binary files)
        }

        // Save file change
        await db.createFileChange({
          commit_id: commitId,
          file_path: filePath,
          change_type: changeType,
          insertions,
          deletions,
          old_path: oldPath
        });
      }
    } catch (error) {
      console.error(`Error analyzing file changes for commit ${commitHash}:`, error);
    }
  }

  private async getUniqueAuthors(): Promise<string[]> {
    const log = await this.git.log(['--all']);
    const authors = new Set<string>();
    
    for (const commit of log.all) {
      authors.add(commit.author_name);
    }
    
    return Array.from(authors);
  }

  private async detectLanguages(): Promise<string[]> {
    const languages = new Set<string>();
    
    try {
      // Simple language detection based on file extensions
      const files = await this.getFileList();
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const language = this.getLanguageFromExtension(ext);
        if (language) {
          languages.add(language);
        }
      }
    } catch (error) {
      console.error('Error detecting languages:', error);
    }
    
    return Array.from(languages);
  }

  private async getFileList(): Promise<string[]> {
    const files: string[] = [];
    
    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    await walkDir(this.repoPath);
    return files;
  }

  private getLanguageFromExtension(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.c': 'C',
      '.cpp': 'C++',
      '.cc': 'C++',
      '.cxx': 'C++',
      '.h': 'C/C++',
      '.hpp': 'C++',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.clj': 'Clojure',
      '.hs': 'Haskell',
      '.ml': 'OCaml',
      '.fs': 'F#',
      '.dart': 'Dart',
      '.lua': 'Lua',
      '.r': 'R',
      '.m': 'Objective-C',
      '.mm': 'Objective-C++',
      '.sh': 'Shell',
      '.bash': 'Shell',
      '.zsh': 'Shell',
      '.fish': 'Shell',
      '.ps1': 'PowerShell',
      '.sql': 'SQL',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.md': 'Markdown',
      '.mdx': 'MDX'
    };
    
    return languageMap[ext] || null;
  }

  async getCommitContent(commitHash: string, filePath?: string): Promise<string> {
    try {
      if (filePath) {
        return await this.git.show([`${commitHash}:${filePath}`]);
      } else {
        return await this.git.show([commitHash]);
      }
    } catch (error) {
      console.error(`Error getting content for commit ${commitHash}:`, error);
      return '';
    }
  }

  async getFileHistory(filePath: string): Promise<LogResult> {
    return await this.git.log(['--follow', '--', filePath]);
  }

  async getDiffBetweenCommits(fromCommit: string, toCommit: string, filePath?: string): Promise<string> {
    try {
      const args = [fromCommit, toCommit];
      if (filePath) {
        args.push('--', filePath);
      }
      return await this.git.diff(args);
    } catch (error) {
      console.error(`Error getting diff between ${fromCommit} and ${toCommit}:`, error);
      return '';
    }
  }
}