import { Router } from 'express';
import { SkillRegistry } from '@dstack/core';

export const skillsRouter = Router();

skillsRouter.get('/', async (req, res) => {
  try {
    const registry = new SkillRegistry();
    const skills = await registry.list();
    // Map them to the frontend expectations, add mock states for those missing in manifest
    const enrichedSkills = skills.map((skill) => {
      // Determine stage roughly based on skill name or use a default
      let stage = 'planning';
      if (['design', 'architecture', 'ui'].some(s => skill.name.includes(s))) stage = 'design';
      if (['qa', 'test', 'review', 'audit'].some(s => skill.name.includes(s))) stage = 'qa';
      if (['deploy', 'ship', 'release'].some(s => skill.name.includes(s))) stage = 'shipped';

      return {
        name: skill.name,
        command: skill.name,
        description: skill.description || 'No description provided.',
        stage,
        maturity: 'complete',
        available: true,
        hasLatestArtifact: false,
        requiresArtifacts: skill.requiresArtifacts || [],
        hidden: false,
        model: skill.model || 'gemini-2.5-pro',
        allowedTools: skill.allowedTools || []
      };
    });
    res.json(enrichedSkills);
  } catch (err) {
    console.error('Failed to list skills:', err);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

skillsRouter.get('/market', async (req, res) => {
  const marketSkills = [
    { name: 'deep-audit', description: 'Complete security and performance audit of the codebase.', category: 'Quality', author: 'DStack Official', installs: '12.4k' },
    { name: 'make-landing', description: 'Generate a high-fidelity landing page for your project.', category: 'Marketing', author: 'DStack Official', installs: '8.2k' },
    { name: 'python-optimize', description: 'Refactor and optimize Python scripts for better performance.', category: 'Engineering', author: 'Community', installs: '4.1k' },
    { name: 'figma-to-code', description: 'Convert Figma design descriptions into React components.', category: 'Design', author: 'DesignOps', installs: '22.1k' },
    { name: 'db-architect', description: 'Design scalable database schemas based on project requirements.', category: 'Architecture', author: 'DStack Official', installs: '15.7k' },
    { name: 'edge-tester', description: 'Fuzz test your APIs for edge case vulnerabilities.', category: 'Quality', author: 'SecurityBot', installs: '3.9k' },
  ];
  res.json(marketSkills);
});

