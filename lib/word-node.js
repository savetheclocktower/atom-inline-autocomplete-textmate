'use babel';

export default class WordNode {
  constructor ({ word, buffer, row }) {
    Object.assign(this, { word, buffer, row });
  }

  distanceFrom (otherWord) {
    let value = Math.abs(otherWord.row - this.row);
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
