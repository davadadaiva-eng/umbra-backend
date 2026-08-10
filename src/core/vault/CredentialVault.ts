/**
 * CredentialVault — AES-256-GCM encrypted secret store.
 *
 * The master key is derived from a machine fingerprint (HWID) plus an
 * optional user passphrase via scrypt, so an extracted vault file is not
 * decryptable on another machine or without the passphrase.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface VaultEntry {
  id: string;
  service: string;
  username: string;
  secret: string;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialVaultOptions {
  dataDir: string;
  /** Machine fingerprint; a stable HWID in production, injectable in tests. */
  hwid?: string;
  passphrase?: string;
  /** Envelope filename. */
  file?: string;
}

const KDF_SALT_LEN = 16;
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

export class CredentialVault {
  private file: string;
  private hwid: string;
  private passphrase: string;
  private entries = new Map<string, VaultEntry>();
  private unlocked = false;

  constructor(options: CredentialVaultOptions) {
    this.file = path.join(options.dataDir, options.file ?? 'vault.bin');
    this.hwid = options.hwid ?? 'hwid-default';
    this.passphrase = options.passphrase ?? '';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Derive the AES key from HWID + passphrase. */
  private deriveKey(): Buffer {
    const salt = crypto
      .createHash('sha256')
      .update(this.hwid + '::umbra-vault')
      .digest()
      .subarray(0, KDF_SALT_LEN);
    return crypto.scryptSync(this.hwid + this.passphrase, salt, KEY_LEN);
  }

  unlock(): void {
    const key = this.deriveKey();
    if (!fs.existsSync(this.file)) {
      this.unlocked = true;
      return;
    }
    try {
      const raw = fs.readFileSync(this.file);
      const iv = raw.subarray(0, IV_LEN);
      const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
      const data = raw.subarray(IV_LEN + TAG_LEN);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      this.entries = new Map(JSON.parse(plain).map((e: VaultEntry) => [e.id, e]));
      this.unlocked = true;
    } catch {
      throw new Error('Vault is locked: wrong machine, wrong passphrase, or corrupted file');
    }
  }

  lock(): void {
    this.entries.clear();
    this.unlocked = false;
  }

  set(entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>, id?: string): VaultEntry {
    this.assertUnlocked();
    const now = Date.now();
    const existing = id ? this.entries.get(id) : undefined;
    const full: VaultEntry = {
      id: id ?? crypto.randomBytes(8).toString('hex'),
      service: entry.service,
      username: entry.username,
      secret: entry.secret,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entries.set(full.id, full);
    this.persist();
    return full;
  }

  get(id: string): VaultEntry | undefined {
    this.assertUnlocked();
    return this.entries.get(id);
  }

  find(service: string, username?: string): VaultEntry | undefined {
    this.assertUnlocked();
    for (const e of this.entries.values()) {
      if (e.service === service && (!username || e.username === username)) return e;
    }
    return undefined;
  }

  delete(id: string): boolean {
    this.assertUnlocked();
    const removed = this.entries.delete(id);
    if (removed) this.persist();
    return removed;
  }

  list(): VaultEntry[] {
    this.assertUnlocked();
    return [...this.entries.values()].sort((a, b) => a.service.localeCompare(b.service));
  }

  private persist(): void {
    this.assertUnlocked();
    const key = this.deriveKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify([...this.entries.values()]), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(this.file, Buffer.concat([iv, tag, data]));
  }

  private assertUnlocked(): void {
    if (!this.unlocked) throw new Error('Vault is locked; call unlock() first');
  }
}
