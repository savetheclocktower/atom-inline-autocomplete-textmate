'use babel';
import WordNode from './word-node';

function bisectBetween (indexStart, indexEnd) {
  let diff = (indexEnd - indexStart) / 2;
  return indexStart + Math.round(diff);
}

// Keeps a list of WordNodes and sorts the items based on their proximity to a
// specific WordNode. Handles the details of sorting by proximity, ensuring
// uniqueness, and assessing possible matches.
class WordNodeList {
  constructor (original) {
    this.distancesByWord = new Map();
    this.nodesByWord = new Map();
    this.insertionSortedList = [];
    this.original = original;
    this._indexAndDistanceOfLastInsertion = null;
  }

  hasWord (word) {
    return !!this.nodesByWord.get(word);
  }

  // Removes a node from the sorted list.
  _removeFromSortedList (node) {
    let { insertionSortedList: sl } = this;
    let indexToRemove;
    for (let i = 0; i < sl.length; i++) {
      let { node: curNode } = sl[i];
      if (curNode === node) {
        indexToRemove = i;
        break;
      }
    }
    if (indexToRemove) {
      sl.splice(indexToRemove, 1);
    }
  }

  // Adds a node to the list, preserving the list's sorting on insertion.
  _addToSortedList (node, distance) {
    let startIndex = 1;
    // Where did we insert last time?
    if (this._indexAndDistanceOfLastInsertion) {
      // Each insertion _tends_ to be more distant than the last one, so this
      // is a useful strategy for finding the right slot.
      let { distance: lDistance, index: lIndex } = this._indexAndDistanceOfLastInsertion;
      if (lDistance <= distance) {
        startIndex = lIndex + 1;
      }
    }
    let { insertionSortedList: sl } = this;
    if (!sl.length || sl[sl.length - 1].distance <= distance) {
      // We're either the first insertion or we're more distant than the most
      // distant item in the list, so this is easy.
      sl.push({ node, distance });
      this._indexAndDistanceOfLastInsertion = { distance, index: sl.length - 1 };
    } else if (sl[0].distance > distance) {
      sl.unshift({ node, distance });
      this._indexAndDistanceOfLastInsertion = { distance, index: 0 };
    } else {
      let insertAtIndex;

      const fitsAt = (i) => {
        // The first two cases rule out any scenarios where `cur` or `prev` may
        // not exist when we start at index `1`.
        let prev = sl[i - 1], cur = sl[i];
        if (distance <= cur.distance && distance >= prev.distance) {
          return [true, 0];
        } else if (distance <= prev.distance) {
          return [false, -1];
        } else if (distance >= cur.distance) {
          return [false, 1];
        }
      };

      // At least try the starting position before we go off on a bisect goose
      // chase.
      let fits, direction;
      [fits] = fitsAt(startIndex);
      if (fits) {
        insertAtIndex = startIndex;
      }

      let currentStart = startIndex, currentEnd = sl.length - 1;
      let lastBIndex = null;
      while (typeof insertAtIndex !== 'number') {
        let bIndex = bisectBetween(currentStart, currentEnd);
        if (bIndex === lastBIndex) {
          throw new Error(`Stuck at ${bIndex}!`);
        }
        [fits, direction] = fitsAt(bIndex);
        if (fits) {
          insertAtIndex = bIndex;
        } else if (direction === -1) {
          // We went too far. Search to the left of this index.
          currentEnd = bIndex;
        } else if (direction === 1) {
          // We didn't go far enough. Search to the right of this index.
          currentStart = bIndex;
        }
        lastBIndex = bIndex;
      }
      sl.splice(insertAtIndex, 0, { node, distance });
      this._indexAndDistanceOfLastInsertion = { distance, index: insertAtIndex };
    }
  }

  add (node, ...args) {
    let addition = node;
    if (!(node instanceof WordNode)) {
      addition = new WordNode(node, ...args);
    }
    let distance = this.original.distanceFrom(addition);
    let { word } = addition;
    // This list should have only one instance of each word match, but it should
    // always keep the one that is closest to the target. So when we try to add
    // a duplicate, we can't just bail; we have to keep whichever one is closer
    // and remove the other.
    if ( this.hasWord(word) ) {
      let existingNode = this.nodesByWord.get(word);
      let existingDistance = this.distancesByWord.get(word);
      if (distance >= existingDistance) {
        // New word is at least as distant! We can ignore it.
        return;
      }
      // Otherwise, the new word is closer! We've got to remove the old word.
      this._removeFromSortedList(existingNode);
    }
    this.distancesByWord.set(word, distance);
    this.nodesByWord.set(word, node);
    this._addToSortedList(addition, distance);
  }

  getMatches (prefix, suffix) {
    let pattern = new RegExp(`^${prefix}.+${suffix}$`);
    let results = [];
    for (let { node, distance } of this.insertionSortedList) {
      let { word } = node;
      if (word === this.original.word) { continue; }
      if (!pattern.test(word)) { continue; }
      results.push({ prefix, suffix, word, distance });
    }

    // DEBUG
    // let debugTable = results.map(r => `${r.distance}  ${r.word}`);
    // console.log(`RESULTS:\n${debugTable.join('\n')}`);
    return results;
  }

  [Symbol.iterator] () {
    let nodes = this.insertionSortedList.map(o => o.node);
    return nodes.values();
  }

  get length () {
    return this.insertionSortedList.length;
  }
}

export default WordNodeList;
