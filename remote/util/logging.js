/*
 * Logging/debug routines
 */

let _logLevel = "warn"

let Debug = () => {}
let Info = () => {}
let Warn = () => {}
let Error = () => {}

export function initLogging(level) {
  if (typeof level === "undefined") {
    level = _logLevel
  } else {
    _logLevel = level
  }

  Debug = Info = Warn = Error = () => {}

  if (typeof window.console !== "undefined") {
    /* eslint-disable no-console, no-fallthrough */
    switch (level) {
      case "debug":
        Debug = console.debug.bind(window.console)
      case "info":
        Info = console.info.bind(window.console)
      case "warn":
        Warn = console.warn.bind(window.console)
      case "error":
        Error = console.error.bind(window.console)
      case "none":
        break
      default:
        throw new window.Error("invalid logging type '" + level + "'")
    }
    /* eslint-enable no-console, no-fallthrough */
  }
}

export function getLogging() {
  return _logLevel
}

export { Debug, Info, Warn, Error }

// Initialize logging level
initLogging()
