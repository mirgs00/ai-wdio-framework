import { LoggerProxy, LogLevel, LogContext } from '../../src/utils/logger';

describe('LoggerProxy', () => {
  it('should pass section context to parent logger', () => {
    const mockDebug = jest.fn();
    const mockInfo = jest.fn();
    const mockWarn = jest.fn();
    const mockError = jest.fn();
    const mockRecordMetric = jest.fn();
    const mockLogServiceEvent = jest.fn();

    const parent = {
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
      recordMetric: mockRecordMetric,
      logServiceEvent: mockLogServiceEvent,
    };

    const proxy = new (LoggerProxy as any)(parent, 'TEST_SECTION');

    proxy.debug('debug msg', { key: 'val' });
    expect(mockDebug).toHaveBeenCalledWith('debug msg', {
      section: 'TEST_SECTION',
      details: { key: 'val' },
    });

    proxy.info('info msg');
    expect(mockInfo).toHaveBeenCalledWith('info msg', {
      section: 'TEST_SECTION',
      details: undefined,
    });

    proxy.warn('warn msg');
    expect(mockWarn).toHaveBeenCalledWith('warn msg', {
      section: 'TEST_SECTION',
      details: undefined,
    });

    proxy.error('err msg', new Error('test'));
    expect(mockError).toHaveBeenCalledWith('err msg', new Error('test'));

    proxy.recordMetric('test', 100);
    expect(mockRecordMetric).toHaveBeenCalledWith('test', 100);

    proxy.logServiceEvent('START', { url: 'http://test.com' });
    expect(mockLogServiceEvent).toHaveBeenCalledWith('START', 'TEST_SECTION', {
      url: 'http://test.com',
    });
  });

  it('should call error without error object', () => {
    const mockError = jest.fn();
    const parent = { error: mockError };

    const proxy = new (LoggerProxy as any)(parent, 'SECTION');
    proxy.error('just a message');

    expect(mockError).toHaveBeenCalledWith('just a message', undefined);
  });
});
