'use babel';
/* global atom */
import {
  Disposable,
  CompositeDisposable,
  Range
} from 'atom';

import WordNode from './word-node';

function notificationsArePresent () {
  let wv = atom.views.getView(atom.workspace);
  let nv = wv.querySelector('atom-notifications');
  if (!nv) { return false; }

  return nv.querySelectorAll('atom-notification').length > 0;
}

function unique (wordList) {
  let seenWords = new Set();
  let results = [];
  wordList.forEach((item) => {
    if (seenWords.has(item.word)) return;
    seenWords.add(item.word);
    results.push(item);
  });
  return results;
}

function sortBy (obj, iteratee, context) {
  let indexed = obj.map((value, index, list) => {
    return {
      value,
      index,
      criterion: iteratee.call(context, value, index, list)
    };
  }, context);

  let sorted = indexed.sort((left, right) => {
    let [a, b] = [left.criterion, right.criterion];
    if (a !== b) {
      if (a > b || a === undefined) return 1;
      if (a < b || b === undefined) return -1;
    }
    return left.index - right.index;
  });

  return sorted.map(s => s.value, context);
}

const InlineAutocompleteTextmate = {
  config: {},

  wordPattern: /[\w]+/g,
  position:    -1,

  list:        null,
  view:        null,
  editor:      null,
  buffer:      null,
  matches:     null,
  disposables: null,

  isAutocompleting () {
    if (!this.view) return false;
    return this.view.classList.contains('inline-autocompleting');
  },

  // Filter out any situations in which we should let the existing Esc key
  // bindings take precedence.
  shouldAutocomplete () {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) { return false; }
    let selections = editor.getSelections();
    // Only try to autocomplete when there's exactly one cursor and no selected
    // text.
    if ( selections.length > 1 || !selections[0].isEmpty() ) {
      return true;
    }

    // If any notifications are present, ESC should dismiss them instead of
    // trying to autocomplete.
    if ( notificationsArePresent() ) { return true; }
  },

  setting (name) {
    return atom.config.get(`inline-autocomplete-textmate.${name}`);
  },

  activate () {
    let disposables = new CompositeDisposable();

    let clickListener = () => {
      if (!this.isAutocompleting()) { return; }
      this.reset();
    };

    let observer = atom.workspace.observeTextEditors(editor => {
      let disposable = new Disposable(() => this.reset());
      disposables.add(editor.onDidDestroy(() => disposable.dispose()));
      disposables.add(disposable);

      // Watch for changes to the buffer or the cursor position. If any happen
      // as a result of something we didn't initiate, we can reset the
      // autocompleting state.
      let onChange = () => {
        if (this.ignoring) { return; }
        this.reset();
      };

      disposables.add(editor.onDidChange(onChange));
      disposables.add(editor.onDidChangeCursorPosition(onChange));
      disposables.add(editor.onDidSave(onChange));
    });

    disposables.add(observer);

    // Clicking anywhere should reset autocomplete.
    let workspaceView = atom.views.getView(atom.workspace);
    workspaceView.addEventListener('click', clickListener);

    disposables.add(
      atom.commands.add(
        'inline-autocompleting',
        'inline-autocomplete-textmate:stop',
        () => this.reset()
      )
    );

    disposables.add(
      atom.commands.add(
        'atom-workspace',
        'inline-autocomplete-textmate:cycle-back',
        e => {
          if (this.shouldIgnore()) { return e.abortKeyBinding(); }
          this.toggleAutocomplete(e, -1);
        }
      )
    );

    disposables.add(
      atom.commands.add(
        'atom-workspace',
        'inline-autocomplete-textmate:cycle',
        e => {
          if (this.shouldIgnore()) { return e.abortKeyBinding(); }
          this.toggleAutocomplete(e, 1);
        }
      )
    );

    this.disposables = disposables;

    // Detect whether we're bound to the Esc key. If so, we have to be more diligent about allowing other usages of ESC.
    let manager = atom.packages.keymapManager;
    let bindings = manager.findKeyBindings({
      keystrokes: 'esc',
      command: 'inline-autocomplete-textmate:cycle'
    });
    this.isBoundToEscape = bindings.length > 0;
  },

  // When we're bound to Esc, we need to be more selective about when we try to
  // autocomplete, or else we'll end up swallowing all Esc keypresses.
  shouldIgnore () {
    if (!this.isBoundToEscape) { return false; }

    let editor = atom.workspace.getActiveTextEditor();
    let selections = editor.getSelections();

    // Only try to autocomplete when there's exactly one cursor and no selected
    // text, or else the user won't be able to use Esc to undo multiple cursors.
    if (selections.length > 1 || !selections[0].isEmpty()) {
      return true;
    }

    // Don't try to autocomplete when there are notifications present, or else
    // the user won't be able to use Esc to dismiss them.
    if (notificationsArePresent()) { return true; }

    return false;
  },

  deactivate () {
    this.disposables.dispose();
  },

  toggleAutocomplete (e, step) {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      this.reset();
      return e.abortKeyBinding();
    }

    this.editor   = editor;
    this.buffer   = editor.getBuffer();
    this.view     = atom.views.getView(editor);
    this.cursor   = editor.getLastCursor();
    this.cursorPosition = this.cursor.getBufferPosition();

    if (this.isValidAutocompletePosition()) {
      this.autocomplete(step);
    } else {
      this.reset();
      return e.abortKeyBinding();
    }
  },

  isValidAutocompletePosition () {
    let position = this.editor.getCursorBufferPosition();

    let left = this.buffer.getTextInRange(
      Range.fromPointWithDelta(position, 0, -1)
    );
    let right = this.buffer.getTextInRange(
      Range.fromPointWithDelta(position, 0, 1)
    );

    let w = /^\w$/;

    return w.test(left) || w.test(right);
  },

  addWord (word, buffer, row) {
    row++;
    this.list.push(new WordNode({ word, buffer, row }));
  },

  buildList () {
    this.list = [];

    this.buffer.getLines().forEach((line, row) => {
      let matches = line.match(this.wordPattern);
      if (!matches) { return; }
      matches.forEach(m => this.addWord(m, this.buffer, row));
    });
  },

  getPrefixAndSuffixOfSelection (selection) {
    let sRange = selection.getBufferRange();
    let lineLength = this.editor.lineTextForBufferRow(sRange.end.row).length;
    let lRange = new Range(
      [sRange.start.row, 0],
      [sRange.end.row, lineLength]
    );

    let [prefix, suffix] = ['', ''];
    let pOffset, sOffset;

    this.buffer.scanInRange(this.wordPattern, lRange, ({ match, range, stop }) => {
      let [fullMatch] = match;
      // If we see a match that occurs after the end of the selection, we can
      // skip it and the rest of the matches.
      if (range.start.isGreaterThan(sRange.end)) {
        stop();
      }

      if (range.intersectsWith(sRange)) {
        // How many characters long is the prefix?
        pOffset = sRange.start.column - range.start.column;
        // How many characters long is the suffix?
        sOffset = sRange.end.column - range.end.column;

        if (range.start.isLessThan(sRange.start)) {
          prefix = fullMatch.slice(0, pOffset);
        }
        if (range.end.isGreaterThan(sRange.end)) {
          suffix = fullMatch.slice(sOffset);
        }
      }
    });

    return { prefix, suffix };
  },

  findMatchesForSelection () {
    let { editor } = this;
    let selection = editor.getLastSelection();
    let text = editor.getSelectedText();
    let { prefix, suffix } = this.getPrefixAndSuffixOfSelection(selection);

    let word = new WordNode({
      word: prefix + text + suffix,
      buffer: editor.getBuffer(),
      row: editor.getCursorBufferPosition().row
    });

    this.pattern = new RegExp(`^${prefix}.+${suffix}$`);

    let closest = unique(
      sortBy(this.list, candidate => {
        return word.distanceFrom(candidate);
      })
    );

    this.matches = this.getMatchingWordsInList(
      closest,
      prefix,
      suffix,
      w => w !== word.word && this.pattern.test(w)
    );
  },

  autocomplete (steps = 1) {
    this.view.classList.add('inline-autocompleting');
    if (!this.list) this.buildList();

    if (!this.matches) {
      this.findMatchesForSelection();
    }

    if (this.matches.length === 0) {
      return;
    }

    this.position += steps;

    // Wrap around if needed.
    if (this.position < 0) {
      this.position = this.matches.length + this.position;
    } else {
      this.position = this.position % this.matches.length;
    }

    this.replaceSelectedTextWithMatch(this.matches[this.position]);
  },

  replaceSelectedTextWithMatch (matched) {
    this.ignore(() => {
      let selection = this.editor.getLastSelection();
      let { suffix } = this.getPrefixAndSuffixOfSelection(selection);

      selection.selectWord();
      let { start } = selection.getBufferRange();
      selection.insertText(matched.word, { select: false });

      // The cursor should go at the end of the part that got filled in; i.e.,
      // right before the suffix. (For end-of-word completion the suffix will
      // be an empty string, so the cursor will go to the end of the word.)
      let offset = matched.word.length - suffix.length;
      let newPoint = [start.row, start.column + offset];
      this.editor.setCursorBufferPosition(newPoint);
    });
  },

  ignore (callback) {
    this.ignoring = true;
    callback();
    this.ignoring = false;
  },

  getMatchingWordsInList (list, prefix, suffix, test) {
    let results = [];
    if (!test) test = (() => true);
    list.forEach(({ word }) => {
      if (!test(word)) {
        return;
      }
      results.push({ prefix, suffix, word });
    });
    return results;
  },

  reset () {
    if (this.view) {
      this.view.classList.remove('inline-autocompleting');
    }
    this.position = -1;
    this.pattern  = null;
    this.list     = null;
    this.matches  = null;
    this.buffer   = null;
    this.view     = null;
  }
};

export default InlineAutocompleteTextmate;
