
# inline-autocomplete-textmate

A spiritual fork of [`inline-autocomplete`][inline-autocomplete] that aims to work (almost) exactly like TextMate 2’s auto completion — no more and no less.

I wrote it for switchers like me who want to pretend Atom is actually TextMate 2.

## What does that mean?

[Here’s how autocompleting works in TextMate][textmate]. Assume you've got a file that looks like this:

```
fooBar
fooThud
fooBazThud
fooTrozThud


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

## Is anything left out?

Yes. TextMate 2’s concept of scope-specific “character classes” is left unimplemented; my experience is that it misfires more often than it helps. I wouldn’t rule out its addition as a setting in some future version.

I also removed all features from `inline-autocomplete-textmate` that implement things not present in TextMate 2’s autocompletion, namely (a) suggesting words across all open buffers and (b) suggesting keywords for the current scope even if they aren’t present in the buffer. The first of these I might put back if people want it.

## Any caveats?

Yes. TextMate binds autocompletion to the <kbd>Esc</kbd> key, but <kbd>Esc</kbd> is already used for several things in Atom, so if we’re not careful we run the risk of breaking those other functions.

When this package activates, we check if `inline-autocomplete-textmate:cycle` is mapped to <kbd>Esc</kbd>. If it is, we use some heuristics to limit the situations in which we trigger autocompletion:

1. <kbd>Esc</kbd> can be used to dismiss the Find and Replace panel, so we skip autocompletion when any text is selected.
2. <kbd>Esc</kbd> can be used to cancel a multi-cursor operation, so we skip autocompletion when there is more than one cursor. (Autocompletion operates only on the last cursor anyway, so this is no great loss.)
3. <kbd>Esc</kbd> can be used to dismiss notifications, so we skip autocompletion when notifications are present.

Remember: the package will only behave this way when mapped to <kbd>Esc</kbd>. If you disable the default keymap and map `inline-autocomplete-textmate:cycle` to a different key, none of these caveats apply.


[textmate]: http://blog.macromates.com/2012/clever-completion/
[inline-autocomplete]: https://github.com/alexchee/atom-inline-autocomplete
