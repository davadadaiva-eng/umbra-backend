import * as os from 'os';
import * as path from 'path';
import { SkillCompiler, SkillSpec } from './SkillCompiler';
import { NoopBackend } from './NativeCompiler';
import { SkillRecorder } from './SkillRecorder';
import { SkillRouter } from './SkillRouter';
import { ALL_SKILLS, SKILL_DOMAINS, skillCount } from './SkillStack';

const dir = path.join(os.tmpdir(), `umbra-skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

describe('Skill Compiler', () => {
  const spec: SkillSpec = {
    name: 'email-triage',
    version: '1.0.0',
    domain: 'productivity',
    description: 'Triages inbox and drafts replies.',
    systemPrompt: 'You are an email triage assistant.',
    tools: [
      { name: 'classify', description: 'Classify an email', inputSchema: { text: 'string' }, native: true },
      { name: 'draft', description: 'Draft a reply', inputSchema: { subject: 'string' } },
    ],
    hot: true,
    memorySize: 1024,
  };

  it('compiles a skill into deployable units + MCP registry entries', async () => {
    const compiler = new SkillCompiler({ outDir: dir, backend: new NoopBackend() });
    const compiled = await compiler.compile(spec);
    expect(compiled.name).toBe('email-triage');
    expect(compiled.tools).toHaveLength(2);
    expect(compiled.mcpRegistry).toHaveLength(2);
    expect(compiled.mcpRegistry[0]).toEqual({ skill: 'email-triage', tool: 'classify', method: 'native' });
    expect(compiled.native).toBeDefined();
  });

  it('does not compile when backend is absent', async () => {
    const compiler = new SkillCompiler({ outDir: dir });
    const compiled = await compiler.compile({ ...spec, hot: true });
    expect(compiled.native).toBeUndefined();
  });
});

describe('SkillRecorder', () => {
  it('learns hot skills from usage patterns', () => {
    const recorder = new SkillRecorder({ dataDir: dir });
    for (let i = 0; i < 30; i++) {
      recorder.record({ skill: 'web-research', startedAt: Date.now(), durationMs: 5000, tokens: 2000, result: 'success' });
    }
    recorder.record({ skill: 'crypto-tool', startedAt: Date.now(), durationMs: 50, tokens: 100, result: 'success' });
    const stats = recorder.stats();
    expect(stats[0].skill).toBe('web-research');
    expect(recorder.hotSkills(20)).toContain('web-research');
  });
});

describe('Master Skill Stack', () => {
  it('defines 20 domains × 5 skills = 100 skills', () => {
    expect(SKILL_DOMAINS).toHaveLength(20);
    expect(skillCount()).toBe(100);
    for (const domain of SKILL_DOMAINS) expect(domain.skills).toHaveLength(5);
  });

  it('assigns unique skill ids', () => {
    const ids = new Set(ALL_SKILLS.map(s => s.id));
    expect(ids.size).toBe(100);
  });
});

describe('SkillRouter', () => {
  const router = new SkillRouter();

  it('routes intent to the right skill', () => {
    const result = router.route('please draft a follow up email to the prospect');
    expect(result.skill?.id).toBe('sales.follow-up-drafting');
    expect(result.direct).toBe(true);
  });

  it('returns candidates for ambiguous intent', () => {
    const result = router.route('help me out here');
    expect(result.direct).toBe(false);
    expect(Array.isArray(result.candidates)).toBe(true);
  });
});
