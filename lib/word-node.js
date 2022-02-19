'use babel';

const CONSIDER_COLUMNS = false; // needs refinement

export default class WordNode {
  constructor ({ word, buffer, row, column }) {
    Object.assign(this, { word, buffer, row, column });
  }

  distanceFrom (otherWord) {
    let value = Math.abs(otherWord.row - this.row);
    // When two candidates are the same number of rows apart, use columnar
    // distance as a tie-breaker. If `otherWord` is above the selection, a
    // higher column value is _closer_ to the word than it is when we ignore
    // columns, and if `otherWord` is below the selection, a higher column
    // value is _farther away_.
    if (CONSIDER_COLUMNS) {
      let columnDiff = Math.abs(otherWord.column - this.column);
      if (otherWord.row < this.row) { columnDiff = -columnDiff; }
      value += (columnDiff * 0.01);
    }

    // How do you compare the distance between two words that are in entirely
    // different buffers? Just to have a consistent rule, we pretend that
    // they're in the same buffer.
    //
    // But we add a large constant value to the distance so that, practically
    // speaking, suggestions in other buffers are always deemed to be a greater
    // distance away than suggestions in the same buffer.
    if (otherWord.buffer !== this.buffer) {
      return 1000000 + value;
    }
    return value;
  }
}
