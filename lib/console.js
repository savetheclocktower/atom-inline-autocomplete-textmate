'use babel';

const CONSOLE = {};
const isEnabled = atom.inDevMode();

function makeConsoleMethod (name) {
  return (...args) => {
    if (!isEnabled) { return; }
    return window.console[name](
      '[inline-autocomplete-textmate]',
      ...args
    );
  };
}

['log', 'warn', 'error', 'info', 'debug', 'group'].forEach(name => {
  CONSOLE[name] = makeConsoleMethod(name);
});

export default CONSOLE;
