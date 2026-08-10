import * as os from 'os';
import * as path from 'path';
import { CredentialVault } from './CredentialVault';

const dir = path.join(os.tmpdir(), `umbra-vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const freshDir = () => path.join(dir, Math.random().toString(36).slice(2, 10));

describe('CredentialVault', () => {
  it('round-trips secrets encrypted at rest', () => {
    const vaultDir = freshDir();
    const vault = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1', passphrase: 'pw' });
    vault.unlock();
    vault.set({ service: 'telnyx', username: 'acct', secret: 'tok-abc' });
    vault.set({ service: 'github', username: 'me', secret: 'ghp_xyz' });

    const reloaded = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1', passphrase: 'pw' });
    reloaded.unlock();
    expect(reloaded.find('telnyx')?.secret).toBe('tok-abc');
    expect(reloaded.find('github')?.username).toBe('me');
  });

  it('refuses to unlock with the wrong passphrase', () => {
    const vaultDir = freshDir();
    const vault = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1', passphrase: 'pw' });
    vault.unlock();
    vault.set({ service: 'x', username: 'u', secret: 's' });

    const attacker = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1', passphrase: 'wrong' });
    expect(() => attacker.unlock()).toThrow(/locked|wrong/);
  });

  it('refuses to unlock on a different machine (HWID bound)', () => {
    const vaultDir = freshDir();
    const vault = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1', passphrase: 'pw' });
    vault.unlock();
    vault.set({ service: 'x', username: 'u', secret: 's' });

    const other = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-2', passphrase: 'pw' });
    expect(() => other.unlock()).toThrow(/locked|wrong/);
  });

  it('blocks access while locked', () => {
    const vault = new CredentialVault({ dataDir: freshDir(), hwid: 'machine-1' });
    expect(() => vault.list()).toThrow(/locked/);
  });

  it('lock() clears in-memory entries', () => {
    const vault = new CredentialVault({ dataDir: freshDir(), hwid: 'machine-1' });
    vault.unlock();
    vault.set({ service: 'x', username: 'u', secret: 's' });
    vault.lock();
    expect(vault.isUnlocked).toBe(false);
    expect(() => vault.get('any')).toThrow(/locked/);
  });

  it('vault file is not plaintext', () => {
    const vaultDir = freshDir();
    const vault = new CredentialVault({ dataDir: vaultDir, hwid: 'machine-1' });
    vault.unlock();
    vault.set({ service: 'x', username: 'u', secret: 'super-secret-value' });
    const raw = require('fs').readFileSync(path.join(vaultDir, 'vault.bin'), 'utf8');
    expect(raw).not.toContain('super-secret-value');
  });
});

