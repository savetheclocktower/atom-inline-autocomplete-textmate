
# inline-autocomplete-textmate

A spiritual fork of [`inline-autocomplete`][inline-autocomplete] that aims to work (almost) exactly like TextMate 2’s autocompletion.

I wrote it for switchers like me who want to pretend Atom is actually TextMate 2.

## What does that mean?

[Here’s how autocompleting works in TextMate][textmate]. Assume you've got a file that looks like this, except that `^` signifies where the cursor is:

```
fooBar
fooThud
fooBazThud
fooTrozThud

^
```

### End-of-word completion

1. Type `foo`. Press <kbd>Esc</kbd>.
2. TextMate finds all the tokens in the current file that begin with `foo`, ordered by proximity to the cursor.
3. TextMate fills in the nearest match (`fooTrozThud`) and puts the cursor at the end.
4. If you press <kbd>Esc</kbd> again, TextMate replaces it with the next nearest match (`fooBazThud`). You can keep pressing <kbd>Esc</kbd> to cycle through the matches, or <kbd>Shift-Esc</kbd> to cycle backwards.
5. You can keep cycling either way until you move the cursor or start typing.

### Middle-of-word completion

1. Type `fooThud` and move the cursor to the left of the capital T. Press <kbd>Esc</kbd>.
2. TextMate finds all the tokens in the current file that begin with `foo` and end with `Thud` (ignoring `fooThud` if it exists), ordered by proximity to the cursor.
3. TextMate fills in the nearest match (`fooTrozThud`) and moves the cursor so that it's still to the left of the capital T.
4. Otherwise behaves identically to end-of-word completion.

### Beginning-of-word completion

1. Type `Thud` and move the cursor to the left of the capital T. Press <kbd>Esc</kbd>.
2. TextMate finds all the tokens in the current file that end with `Thud`, ordered by proximity to the cursor.
3. TextMate fills in the nearest match (`fooTrozThud`) and moves the cursor so that it's still to the left of the capital T.
4. Otherwise behaves identically to end-of-word completion.

## Is anything added?

TextMate 2’s autocompletion suggestions are always restricted to tokens in the same buffer. I kept one enhancement from `inline-autocomplete`, but changed it to be more conservative. Instead of an option to suggest words across all open buffers, `inline-autocomplete-textmate` has an option to suggest words across all _visible_ buffers.

### What’s a visible buffer?

Whenever you create a new pane in your workspace — for instance, by right-clicking on a tab and selecting **Split Right** — you’re creating a new visible buffer. This package finds visible buffers like so: for each pane in the workspace, consider the pane’s active item. If it’s a text editor, its buffer is added to the list of buffers from which we draw completion suggestions.

### Why visible buffers instead of open buffers?

Why? For selfish reasons. I always have _far_ too many tabs open, and there’s no particular significance to the set of tabs that happen to be open in my workspace at once. But if I’ve set up my workspace to have more than one editor pane, it’s usually so that I can refer to one file as I’m writing another, and in those situations it’s immensely useful to have both files’ words as candidates for autocompletion.

A future version of this package _might_ turn this setting from a checkbox to a dropdown and allow you to choose between three options: active buffer only, all visible buffers, or all open buffers.

### You said that suggestions are “ordered by proximity to the cursor.” How can words in _other buffers_ have a proximity to the cursor?

Good question! They can’t. But we’ll pretend they can in order to deliver vaguely consistent behavior. The only thing you need to know is that completions from the current buffer are _always_ more proximate to the cursor than completions from different buffers.

In other words, when you’re cycling through autocompletion suggestions (in the forward direction), you’ll always see _all_ of the completion options from the current buffer before you see _any_ options from other buffers.

## Is anything left out?

Yes. TextMate 2’s concept of scope-specific “character classes” is left unimplemented; my experience is that it misfires more often than it helps. I wouldn’t rule out its addition as a setting in some future version.

I also removed a feature that was present in `inline-autocomplete`: suggesting keywords for the current scope even if they aren’t present in the buffer. I don’t think I’ve needed to autocomplete a keyword in my entire coding life.

## Any caveats?

Yes. TextMate binds autocompletion to the <kbd>Esc</kbd> key, but <kbd>Esc</kbd> is already used for several things in Atom, so if we’re not careful we run the risk of breaking those other functions.

Hence there’s a setting called “Escape-key mode” that is enabled by default. In this mode, the package will ignore an <kbd>Esc</kbd> keypress if it thinks that the user pressed it for a different reason. For example:

1. <kbd>Esc</kbd> can be used to dismiss the Find and Replace panel, so we skip autocompletion when any text is selected.
2. <kbd>Esc</kbd> can be used to cancel a multi-cursor operation, so we skip autocompletion when there is more than one cursor. (Autocompletion operates only on the last cursor anyway, so this is no great loss.)
3. <kbd>Esc</kbd> can be used to dismiss notifications, so we skip autocompletion when notifications are present.

If you disable the default key binding and map `inline-autocomplete-textmate:cycle` to a different key, you should disable this setting.

[textmate]: http://blog.macromates.com/2012/clever-completion/
[inline-autocomplete]: https://github.com/alexchee/atom-inline-autocomplete
