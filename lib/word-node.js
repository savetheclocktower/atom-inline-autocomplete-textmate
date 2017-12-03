'use babel';

export default class WordNode {
  constructor ({ word, buffer, row }) {
    Object.assign(this, { word, buffer, row });
  }

  distanceFrom (otherWord) {
    return Math.abs(otherWord.row - this.row);
  }
}
