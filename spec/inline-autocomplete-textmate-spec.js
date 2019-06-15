'use babel';
/* globals describe, beforeEach, afterEach, it, expect, waitsForPromise, runs, atom */

import InlineAutocompleteTextmate from '../lib/inline-autocomplete-textmate';
// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g.
// `fit` or `fdescribe`). Remove the `f` to unfocus the block.

describe('InlineAutocompleteTextmate', () => {
  let editorElement, editor;
  let simulateEscKeyEvent = ({ shift } = {}) => {
    let event = atom.keymaps.constructor.buildKeydownEvent('escape', {
      shift,
      target: editorElement
    });
    atom.keymaps.handleKeyboardEvent(event);
  };

  beforeEach(() => {
    waitsForPromise(() => atom.workspace.open('document1.js'));
    waitsForPromise(() => atom.packages.activatePackage('inline-autocomplete-textmate'));
    waitsForPromise(() => atom.packages.activatePackage('language-javascript'));

    runs(() => {
      editor = atom.workspace.getActiveTextEditor();
      editorElement = atom.views.getView(editor);
    });
  });

  afterEach(() => {
    waitsForPromise(() => atom.packages.deactivatePackage('inline-autocomplete-textmate'));
  });

  describe('when autocompletion is invoked with one visible buffer', () => {
    describe('with no prefix or suffix', () => {
      it('does nothing', () => {
        editor.setCursorScreenPosition([13, 0]);
        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('');
      });
    });

    describe('with a typed prefix', () => {
      it('offers completions in order of proximity when ESC is pressed', () => {
        editor.setCursorScreenPosition([13, 0]);
        editor.insertText('month');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthDecember');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthNovember');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthOctober');
      });

      it('offers completions in reverse order when shift-ESC is pressed', () => {
        editor.setCursorScreenPosition([13, 0]);
        editor.insertText('month');

        simulateEscKeyEvent({ shift: true });
        expect(editor.lineTextForBufferRow(13)).toBe('monthJ');

        simulateEscKeyEvent({ shift: true });
        expect(editor.lineTextForBufferRow(13)).toBe('monthJanuary');

        simulateEscKeyEvent({ shift: true });
        expect(editor.lineTextForBufferRow(13)).toBe('monthFebruary');

        simulateEscKeyEvent({ shift: true });
        expect(editor.lineTextForBufferRow(13)).toBe('monthMarch');
      });

      it('resets the cycle of suggestions when the user cursor moves the cursor', () => {
        editor.setCursorScreenPosition([13, 0]);
        editor.insertText('month');

        simulateEscKeyEvent({ shift: true });
        expect(editor.lineTextForBufferRow(13)).toBe('monthJ');

        editor.setCursorScreenPosition([14, 0]);
        expect(InlineAutocompleteTextmate.position).toBe(null);
        expect(InlineAutocompleteTextmate.list).toBe(null);
      });

    });
    describe('with a typed suffix', () => {
      it('offers completions in order of proximity when ESC is pressed', () => {
        editor.setCursorScreenPosition([23, 0]);
        editor.insertText('Day');
        editor.setCursorScreenPosition([23, 0]);

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(23)).toBe('sundayDay');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(23)).toBe('saturdayDay');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(23)).toBe('fridayDay');
      });
    });
    describe('with a typed prefix and suffix', () => {
      it('offers completions in order of proximity when ESC is pressed', () => {
        editor.setCursorScreenPosition([23, 0]);
        editor.insertText('sDay');
        editor.setCursorScreenPosition([23, 1]);

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(23)).toBe('sundayDay');
        expect(editor.getCursorScreenPosition()).toEqual({ row: 23, column: 6 });

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(23)).toBe('saturdayDay');
        expect(editor.getCursorScreenPosition()).toEqual({ row: 23, column: 8 });
      });
    });
  });

  describe('when autocompletion is invoked with two visible buffers', () => {
    beforeEach(() => {
      atom.config.set('inline-autocomplete-textmate.includeCompletionsFromVisibleBuffers', true);

      waitsForPromise(() => {
        // Open document1 in the left pane.
        // Split right to create a second pane.
        // Open document3 in the right pane.
        // Open document2 in the right pane, thereby making document3 invisible.
        // Make the pane with document1 the active pane.
        let firstPane, secondPane;
        return atom.workspace.open('document1.js')
          .then(() => {
            let center = atom.workspace.getCenter();
            let panes = center.getPanes();
            panes[0].splitRight();
            [firstPane, secondPane] = center.getPanes();
            secondPane.activate();
            return atom.workspace.open('document3.js');
          })
          .then(() => {
            return atom.workspace.open('document2.js');
          })
          .then(() => {
            return firstPane.activate();
          });
      });
    });

    afterEach(() => {
      atom.config.set('inline-autocomplete-textmate.includeCompletionsFromVisibleBuffers', false);
    });

    describe('with a typed prefix', () => {
      it('offers completions from all buffers in order of proximity when ESC is pressed', () => {
        editor.setCursorScreenPosition([13, 0]);
        editor.insertText('month');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthDecember');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthNovember');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthOctober');

        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthJ');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthDiciembre');
      });

      it('ignores buffers that are not visible', () => {
        expect(atom.workspace.getTextEditors().length).toBe(3);
        editor.setCursorScreenPosition([13, 0]);
        editor.insertText('monthDe');

        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthDecember');

        // Should not suggest `monthDezember` because it's in an inactive tab.
        simulateEscKeyEvent();
        expect(editor.lineTextForBufferRow(13)).toBe('monthDecember');
      });
    });
  });
});
