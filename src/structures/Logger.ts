import pkg from 'signale';
const { Signale } = pkg;

enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    DEBUG = 'debug',
    SUCCESS = 'success',
    LOG = 'log',
    PAUSE = 'pause',
    START = 'start',
}

interface LoggerOptions {
    disabled?: boolean;
    interactive?: boolean;
    logLevel?: LogLevel;
    scope?: string;
    types?: Partial<Record<LogLevel, { badge: string; color: string; label: string }>>;
}

const defaultOptions: LoggerOptions = {
    disabled: false,
    interactive: false,
    logLevel: LogLevel.INFO,
    scope: 'AikouTicket',
    types: {
        [LogLevel.INFO]: { badge: 'ℹ', color: 'blue', label: 'info' },
        [LogLevel.WARN]: { badge: '⚠', color: 'yellow', label: 'warn' },
        [LogLevel.ERROR]: { badge: '✖', color: 'red', label: 'error' },
        [LogLevel.DEBUG]: { badge: '🐛', color: 'magenta', label: 'debug' },
        [LogLevel.SUCCESS]: { badge: '✔', color: 'green', label: 'success' },
        [LogLevel.LOG]: { badge: '📝', color: 'white', label: 'log' },
        [LogLevel.PAUSE]: { badge: '⏸', color: 'yellow', label: 'pause' },
        [LogLevel.START]: { badge: '▶', color: 'green', label: 'start' },
    },
};

export default class Logger extends Signale {
    constructor(options: LoggerOptions = {}) {
        const { types, ...rest } = options;
        super({ ...defaultOptions, ...rest, types });
        this.validateOptions(options);
    }

    private validateOptions(options: LoggerOptions): void {
        const validLogLevels = Object.values(LogLevel);
        if (options.logLevel && !validLogLevels.includes(options.logLevel)) {
            throw new Error(`Invalid log level: ${options.logLevel}`);
        }
        if (options.types) {
            for (const level of Object.keys(options.types)) {
                if (!validLogLevels.includes(level as LogLevel)) {
                    throw new Error(`Invalid log level in types: ${level}`);
                }
            }
        }
    }
}
