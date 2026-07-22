import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { honoApp } from '../../index';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode('test-secret');

async function createTestToken(userId: number, sessionId: string = 'mock-session-id') {
  return await new jose.SignJWT({ id: userId, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

describe('Templates API', () => {
  beforeAll(async () => {
    // Basic setup for D1 in test environment
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        modality TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_hidden_templates (
        user_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, template_id)
      )
    `).run();
    
    // Create a mock user since our middleware expects the user to exist in the DB
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        subscription_plan TEXT DEFAULT 'Free',
        credits INTEGER DEFAULT 0
      )
    `).run();

    await env.DB.prepare(`INSERT OR IGNORE INTO users (id, email, subscription_plan) VALUES (1, 'test@example.com', 'Pro')`).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.DB.prepare(`INSERT OR IGNORE INTO active_sessions (session_id, user_id) VALUES ('mock-session-id', 1)`).run();
    
    // Seed test data
    await env.DB.prepare(`
      INSERT INTO templates (user_id, modality, name, content, is_system) 
      VALUES (NULL, 'Radio', 'System Radio', 'System Content', true)
    `).run();
  });

  it('should return 401 if not authenticated', async () => {
    const res = await honoApp.request('/api/templates', undefined, env);
    expect(res.status).toBe(401);
  });

  it('should create and retrieve user template', async () => {
    const token = await createTestToken(1);
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    // Create a new template
    const createRes = await honoApp.request('/api/templates', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Test', modality: 'IRM', content: 'Test content' })
    }, env);
    
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.name).toBe('My Test');

    // Retrieve templates
    const getRes = await honoApp.request('/api/templates', {
      headers: authHeaders
    }, env);
    
    const templates = await getRes.json();
    // Should return the 1 system template + 1 newly created template
    expect(templates.length).toBe(2);
    expect(templates.some((t: any) => t.name === 'My Test')).toBe(true);
  });

  it('should sanitize HTML input when creating a template', async () => {
    const token = await createTestToken(1);
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    const dirtyContent = `<p>Safe text</p><script>alert("xss")</script><iframe src="malicious.com"></iframe><b onclick="bad()">Bold</b>`;

    const createRes = await honoApp.request('/api/templates', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'XSS Test', modality: 'IRM', content: dirtyContent })
    }, env);
    
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    
    // The script and iframe tags should be removed, and onclick attribute stripped
    expect(createdData.content).not.toContain('<script>');
    expect(createdData.content).not.toContain('<iframe>');
    expect(createdData.content).not.toContain('onclick');
    expect(createdData.content).toContain('<p>Safe text</p>');
    expect(createdData.content).toContain('<b>Bold</b>');
  });
});
