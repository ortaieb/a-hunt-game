import { config } from './config';

describe('Configuration', () => {
  it('should have default port when no environment variable is set', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
  });

  it('should have default nodeEnv when no environment variable is set', () => {
    expect(config.nodeEnv).toBeDefined();
    expect(typeof config.nodeEnv).toBe('string');
  });

  it('should contain all required configuration properties', () => {
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('nodeEnv');
  });
});