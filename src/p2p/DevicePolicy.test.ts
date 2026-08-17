import { maxDevicesForTier, assertCanJoinDevice, deviceLimitLabel } from './DevicePolicy';

describe('DevicePolicy', () => {
  describe('maxDevicesForTier', () => {
    it('allows exactly 1 device on free / byok / pro', () => {
      expect(maxDevicesForTier('free')).toBe(1);
      expect(maxDevicesForTier('byok')).toBe(1);
      expect(maxDevicesForTier('pro')).toBe(1);
    });

    it('allows unlimited devices on ultimate', () => {
      expect(maxDevicesForTier('ultimate')).toBe('unlimited');
    });

    it('defaults unknown tiers to 1 (fail-closed)', () => {
      expect(maxDevicesForTier('whatever')).toBe(1);
    });
  });

  describe('assertCanJoinDevice', () => {
    it('lets the first device join on a 1-device plan', () => {
      expect(() => assertCanJoinDevice('pro', 0)).not.toThrow();
    });

    it('blocks a second device on pro with an actionable message', () => {
      expect(() => assertCanJoinDevice('pro', 1)).toThrow(/at most 1 connected device/);
      expect(() => assertCanJoinDevice('pro', 1)).toThrow(/revoke an existing device/i);
      expect(() => assertCanJoinDevice('pro', 1)).toThrow(/ultimate/i);
    });

    it('never blocks on ultimate', () => {
      expect(() => assertCanJoinDevice('ultimate', 0)).not.toThrow();
      expect(() => assertCanJoinDevice('ultimate', 5)).not.toThrow();
      expect(() => assertCanJoinDevice('ultimate', 1000)).not.toThrow();
    });
  });

  describe('deviceLimitLabel', () => {
    it('is 1 for pro and "unlimited" for ultimate (JSON-safe)', () => {
      expect(deviceLimitLabel('pro')).toBe(1);
      expect(deviceLimitLabel('ultimate')).toBe('unlimited');
    });
  });
});
