'use babel';
/* global atom */
import {
  CompositeDisposable,
  Disposable,
  Range,
  TextEditor
} from 'atom';

import WordNode from './word-node';
import WordNodeList from './word-node-list';

function notificationsArePresent () {
  let wv = atom.views.getView(atom.workspace);
  let nv = wv.querySelector('atom-notifications');
  if (!nv) { return false; }

  return nv.querySelectorAll('atom-notification').length > 0;
}

const RE_WORD_CHARACTER = /^\w$/;
const RE_WORD = /[\w]+/g;

const InlineAutocompleteTextmate = {
  wordPattern: /[\w]+/g,
  position:    null,

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
  },

  // When we're bound to Esc, we need to be more selective about when we try to
  // autocomplete, or else we'll end up swallowing all Esc keypresses.
  shouldIgnore () {
    if (!this.setting('useDefensiveMode')) { return false; }

    let editor = atom.workspace.getActiveTextEditor();
    let selections = editor.getSelections();

    // Only try to autocomplete when there's exactly one cursor, or else the
    // user won't be able to use Esc to undo multiple cursors.
    if (selections.length > 1) {
      return true;
    }

    // Don't try to autocomplete when there are notifications present, or else
    // the user won't be able to use Esc to dismiss them.
    if ( notificationsArePresent() ) { return true; }

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
    // Ensure we have a word character adjacent to the cursor on either side.
    let position = this.editor.getCursorBufferPosition();

    let left = this.buffer.getTextInRange(
      Range.fromPointWithDelta(position, 0, -1)
    );
    let right = this.buffer.getTextInRange(
      Range.fromPointWithDelta(position, 0, 1)
    );

    return RE_WORD_CHARACTER.test(left) || RE_WORD_CHARACTER.test(right);
  },

  addWord (word, buffer, row, column) {
    row++;
    this.list.add(
      new WordNode({ word, buffer, row, column })
    );
  },

  match (line, pattern) {
    pattern.lastIndex = 0;
    let match;
    let results = [];
    while ((match = pattern.exec(line)) != null) {
      results.push([match[0], match.index]);
    }
    return results;
  },

  buildList (mainWordNode) {
    this.list = new WordNodeList(mainWordNode);
    let buffers = this.getCandidateBuffers();
    buffers.forEach(buffer => {
      buffer.getLines().forEach((line, row) => {
        let matches = this.match(line, RE_WORD);
        if (!matches) { return; }
        for (let m of matches) {
          let [word, column] = m;
          this.addWord(word, buffer, row, column);
        }
      });
    });
  },
  // Given a cursor position, get the word fragments that are directly on either
  // side of the cursor.
  //
  // Examples (^ represents the placement of the cursor, and [] represent the
  // selected range, if any):
  //
  // foo^Bar                      -> prefix: 'foo',   suffix: 'Bar'
  // lorem ipsum dol^or sit amet  -> prefix: 'dol',   suffix: 'or'
  // dol^or.                      -> prefix: 'dol',   suffix: 'or'
  // lorem ipsum ^dolor.          -> prefix: '',      suffix: 'dolor'
  // lorem ipsum^ dolor.          -> prefix: 'ipsum', suffix: ''
  // lorem i[psu]m dolor.         -> prefix: 'i',     suffix: 'r'
  //
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
    let buffer = editor.getBuffer();
    let selection = editor.getLastSelection();
    let { prefix, suffix } = this.getPrefixAndSuffixOfSelection(selection);
    let text = selection.getText();
    // let text = editor.getSelectedText();

    // Capture the prefix and suffix as they existed when we originated this
    // completion cycle.
    this.prefix = prefix;
    this.suffix = suffix;

    let { row, column } = editor.getCursorBufferPosition();
    let word = new WordNode({
      word: prefix + text + suffix,
      buffer,
      // Rows are zero-indexed. Add 1 to the row just like we do when we create
      // the candidate list.
      row: row + 1,
      column
    });
    this.buildList(word);

    // this.pattern = new RegExp(`^${prefix}.+${suffix}$`);

    // let closest = unique(
    //   sortBy(this.list, candidate => {
    //     return word.distanceFrom(candidate);
    //   })
    // );
    // this.matches = this.getMatchingWordsInList(
    //   closest,
    //   prefix,
    //   suffix,
    //   w => w !== word.word && this.pattern.test(w)
    // );
    this.matches = this.list.getMatches(prefix, suffix);
  },

  autocomplete (steps = 1) {
    this.view.classList.add('inline-autocompleting');
    if (!this.matches) { this.findMatchesForSelection(); }

    if (this.matches.length === 0) { return; }

    if (this.position === null) {
      // We're starting a new completion. If we're moving forward, we want to
      // start with the first item in the list; if we're moving backward, we
      // want to start with the last item.
      this.position = (steps > 0) ? 0 : -1;
    } else {
      this.position += steps;
    }

    // Wrap around if needed.
    if (this.position < 0) {
      this.position = this.matches.length + this.position;
    } else {
      this.position = this.position % this.matches.length;
    }

    this.replaceSelectedTextWithMatch(this.matches[this.position]);
  },

  replaceSelectedTextWithMatch (matched) {
    let selection = this.editor.getLastSelection();
    let { start, end } = selection.getBufferRange();
    let { prefix: curPrefix } = this.getPrefixAndSuffixOfSelection(selection);

    // Reduce the matched word to only the portion that doesn't already exist.
    let matchedWordFragment = matched.word
      .substring(0, matched.word.length - this.suffix.length)
      .substring(this.prefix.length);

    // How many characters back do we have to adjust this range to account for
    // the fact that the prefix might be different now than it was when we
    // started the cycle?
    let lengthOfReplacedPrefix = curPrefix.length - this.prefix.length;
    let replacementRange = new Range(
      [start.row, start.column - lengthOfReplacedPrefix],
      [end.row, end.column]
    );

    this.ignore(() => {
      let { start } = replacementRange;
      selection.setBufferRange(replacementRange);
      selection.insertText(matchedWordFragment, { select: false });

      this.editor.setCursorBufferPosition([
        start.row,
        start.column + matchedWordFragment.length
      ]);
    });
  },

  ignore (callback) {
    this.ignoring = true;
    callback();
    this.ignoring = false;
  },

  // Returns all buffers that should be considered candidates for completions.
  getCandidateBuffers () {
    // Are we considering just the active buffer, or all buffers that are visible
    // in this window?
    let allVisible = this.setting('includeCompletionsFromVisibleBuffers');
    if (!allVisible) { return [this.buffer]; }

    let buffers = [];
    let panes = atom.workspace.getPanes();
    panes.forEach(pane => {
      let item = pane.getActiveItem();
      if (item instanceof TextEditor) {
        buffers.push( item.getBuffer() );
      }
    });

    return buffers;
  },

  reset () {
    if (this.position === null) { return; }
    if (this.view) {
      this.view.classList.remove('inline-autocompleting');
    }
    this.position = null;
    this.pattern  = null;
    this.list     = null;
    this.matches  = null;
    this.buffer   = null;
    this.view     = null;
    this.prefix   = null;
    this.suffix   = null;
  }
};

export default InlineAutocompleteTextmate;
