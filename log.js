const DEBUG = true;

////////////////////////////////////////////////////////////////////////////////
const BG_BLACK = "\x1b[40m";
const BG_BLUE = "\x1b[44m";
const BG_CYAN = "\x1b[46m";
const BG_GREEN = "\x1b[42m";
const BG_MAGENTA = "\x1b[45m";
const BG_RED = "\x1b[41m";
const BG_WHITE = "\x1b[47m";
const BG_YELLOW = "\x1b[43m";
const BLINK = "\x1b[5m";
const BRIGHT = "\x1b[1m";
const DIM = "\x1b[2m";
const FG_BLACK = "\x1b[30m";
const FG_BLUE = "\x1b[34m";
const FG_CYAN = "\x1b[36m";
const FG_GREEN = "\x1b[32m";
const FG_MAGENTA = "\x1b[35m";
const FG_RED = "\x1b[31m";
const FG_WHITE = "\x1b[37m";
const FG_YELLOW = "\x1b[33m";
const HIDDEN = "\x1b[8m";
const RESET = "\x1b[0m";
const REVERSE = "\x1b[7m";
const UNDERSCORE = "\x1b[4m";

////////////////////////////////////////////////////////////////////////////////
class Log {
    static out(str) {
        process.stdout.write(str);
    }

    static info(str) {
        console.log(str);
    }

    static warn(str) {
        console.log(`${BRIGHT}${FG_YELLOW}${str}${RESET}`);
    }

    static error(str) {
        console.log(`${BRIGHT}${FG_RED}${str}${RESET}`);
    }

    static debug(str) {
        if (DEBUG) {
            console.log(str);
        }
    }

    static underscore(str) {
        return `${UNDERSCORE}${str}${RESET}`;
    }

    static magenta(str) {
        return `${BRIGHT}${FG_MAGENTA}${str}${RESET}`;
    }
}

////////////////////////////////////////////////////////////////////////////////
module.exports = Log;
