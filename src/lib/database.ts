import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface Repository {
  id: string;
  name: string;
  path: string;
  url?: string;
  created_at: string;
  last_analyzed: string | null;
  total_commits: number;
  total_files: number;
  languages: string[];
}

export interface Commit {
  id: string;
  repo_id: string;
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  parents: string[];
}

export interface FileChange {
  id: string;
  commit_id: string;
  file_path: string;
  change_type: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;
  deletions: number;
  old_path?: string;
}

export interface Analysis {
  id: string;
  repo_id: string;
  commit_id: string;
  file_path: string;
  analysis_type: 'pattern' | 'complexity' | 'ownership' | 'evolution' | 'architecture';
  result: string; // JSON string of analysis results
  created_at: string;
}

class Database {
  private db: sqlite3.Database;
  private initialized = false;

  constructor(dbPath: string = './codebase_time_machine.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const run = promisify(this.db.run.bind(this.db));

    // Create repositories table
    await run(`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL,
        last_analyzed TEXT,
        total_commits INTEGER DEFAULT 0,
        total_files INTEGER DEFAULT 0,
        languages TEXT DEFAULT '[]'
      )
    `);

    // Create commits table
    await run(`
      CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        hash TEXT NOT NULL,
        author TEXT NOT NULL,
        email TEXT NOT NULL,
        date TEXT NOT NULL,
        message TEXT NOT NULL,
        files_changed INTEGER DEFAULT 0,
        insertions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        parents TEXT DEFAULT '[]',
        FOREIGN KEY (repo_id) REFERENCES repositories (id),
        UNIQUE(repo_id, hash)
      )
    `);

    // Create file_changes table
    await run(`
      CREATE TABLE IF NOT EXISTS file_changes (
        id TEXT PRIMARY KEY,
        commit_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        insertions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        old_path TEXT,
        FOREIGN KEY (commit_id) REFERENCES commits (id)
      )
    `);

    // Create analysis table
    await run(`
      CREATE TABLE IF NOT EXISTS analysis (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        commit_id TEXT,
        file_path TEXT,
        analysis_type TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES repositories (id),
        FOREIGN KEY (commit_id) REFERENCES commits (id)
      )
    `);

    // Create indexes for better query performance
    await run(`CREATE INDEX IF NOT EXISTS idx_commits_repo_date ON commits (repo_id, date)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_file_changes_commit ON file_changes (commit_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_analysis_repo_type ON analysis (repo_id, analysis_type)`);

    this.initialized = true;
  }

  async getRepository(id: string): Promise<Repository | null> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM repositories WHERE id = ?', [id], (err: any, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve({
          ...row,
          languages: JSON.parse(row.languages || '[]')
        });
      });
    });
  }

  async createRepository(repo: Omit<Repository, 'id' | 'created_at'>): Promise<Repository> {
    await this.initialize();
    
    const id = `repo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created_at = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO repositories (id, name, path, url, created_at, last_analyzed, total_commits, total_files, languages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, repo.name, repo.path, repo.url, created_at, repo.last_analyzed, repo.total_commits, repo.total_files, JSON.stringify(repo.languages)], (err: any) => {
        if (err) reject(err);
        else resolve({
          id,
          created_at,
          ...repo
        });
      });
    });
  }

  async getCommits(repoId: string, limit = 100, offset = 0): Promise<Commit[]> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM commits 
        WHERE repo_id = ? 
        ORDER BY date DESC 
        LIMIT ? OFFSET ?
      `, [repoId, limit, offset], (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          parents: JSON.parse(row.parents || '[]')
        })));
      });
    });
  }

  async createCommit(commit: Omit<Commit, 'id'>): Promise<Commit> {
    await this.initialize();
    const run = promisify(this.db.run.bind(this.db));
    
    const id = `commit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await run(`
      INSERT OR REPLACE INTO commits (id, repo_id, hash, author, email, date, message, files_changed, insertions, deletions, parents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, commit.repo_id, commit.hash, commit.author, commit.email, commit.date, commit.message, commit.files_changed, commit.insertions, commit.deletions, JSON.stringify(commit.parents)]);

    return { id, ...commit };
  }

  async getFileChanges(commitId: string): Promise<FileChange[]> {
    await this.initialize();
    const all = promisify(this.db.all.bind(this.db));
    
    return await all('SELECT * FROM file_changes WHERE commit_id = ?', [commitId]) as FileChange[];
  }

  async createFileChange(fileChange: Omit<FileChange, 'id'>): Promise<FileChange> {
    await this.initialize();
    const run = promisify(this.db.run.bind(this.db));
    
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await run(`
      INSERT INTO file_changes (id, commit_id, file_path, change_type, insertions, deletions, old_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, fileChange.commit_id, fileChange.file_path, fileChange.change_type, fileChange.insertions, fileChange.deletions, fileChange.old_path]);

    return { id, ...fileChange };
  }

  async saveAnalysis(analysis: Omit<Analysis, 'id' | 'created_at'>): Promise<Analysis> {
    await this.initialize();
    const run = promisify(this.db.run.bind(this.db));
    
    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created_at = new Date().toISOString();
    
    await run(`
      INSERT INTO analysis (id, repo_id, commit_id, file_path, analysis_type, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, analysis.repo_id, analysis.commit_id, analysis.file_path, analysis.analysis_type, analysis.result, created_at]);

    return { id, created_at, ...analysis };
  }

  async getAnalysis(repoId: string, analysisType?: string): Promise<Analysis[]> {
    await this.initialize();
    const all = promisify(this.db.all.bind(this.db));
    
    if (analysisType) {
      return await all('SELECT * FROM analysis WHERE repo_id = ? AND analysis_type = ? ORDER BY created_at DESC', [repoId, analysisType]) as Analysis[];
    }
    
    return await all('SELECT * FROM analysis WHERE repo_id = ? ORDER BY created_at DESC', [repoId]) as Analysis[];
  }

  async close(): Promise<void> {
    const close = promisify(this.db.close.bind(this.db));
    await close();
  }
}

export const db = new Database();