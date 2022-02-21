'use babel';
import WordNode from './word-node';

function bisectBetween (indexStart, indexEnd) {
  let diff = (indexEnd - indexStart) / 2;
  return indexStart + Math.round(diff);
}

// Detect when an index in the list would be a valid slot for a word of a given
// distance.
//
// We could stop whenever we find any possible insertion index that wouldn't
// violate sorting (e.g., a node with a distance of 16 could go anywhere among
// an existing group of 16s in the list). But to make it easier to reason about
// the insertion behavior, we'll say that if we're inserting a node with
// distance 16, and there are some 16s already in the list, the new one will go
// at the end of the series of 16s.
const fitsAtIndex = (sl, i, distance) => {
  // The first two cases rule out any scenarios where `cur` or `prev` may
  // not exist when we start at index `1`.
  let prev = sl[i - 1], cur = sl[i];
  if (distance < cur.distance && distance >= prev.distance) {
    return 0;
  } else if (distance < prev.distance) {
    return -1;
  } else if (distance >= cur.distance) {
    return 1;
  }
};

// Detect the earliest item in the list that has a given distance.
const beginsSeriesAtDistance = (sl, i, distance) => {
  let prev = sl[i - 1], cur = sl[i];
  if (distance === cur.distance && distance > prev.distance) {
    return 0;
  } else if (distance > cur.distance) {
    return 1;
  } else if (distance <= prev.distance) {
    return -1;
  }
};

// Keeps a list of WordNodes and sorts the items based on their proximity to a
// specific WordNode. Handles the details of sorting by proximity, ensuring
// uniqueness, and assessing possible matches.
class WordNodeList {
  constructor (original) {
    this.distancesByWord = new Map();
    this.nodesByWord = new Map();
    this.insertionSortedList = [];
    this.original = original;
    this._lastInsertion = { distance: null, index: null };
  }

  hasWord (word) {
    return !!this.nodesByWord.get(word);
  }

  _updateLastInsertion (distance, index) {
    this._lastInsertion.distance = distance;
    this._lastInsertion.index = index;
  }

  // Removes a node from the sorted list.
  _removeFromSortedList (node, distance) {
    let sl = this.insertionSortedList;
    let removeAtIndex = null;
    let beginAtIndex = null;
    let currentStart = 0, currentEnd = sl.length;
    let lastBIndex = null;
    let fitResult;
    if (distance === sl[0].distance) { beginAtIndex = 0; }
    // Pretend the distance is 4. Instead of stopping whenever we find
    // ourselves within the group of 4s, we need to keep going until we find
    // the exact place where the 4s start, then iterate through each 4 to find
    // the right one.
    while (beginAtIndex === null) {
      let bIndex = bisectBetween(currentStart, currentEnd);
      if (bIndex === lastBIndex) {
        throw new Error(`Stuck at ${bIndex}!`);
      }
      fitResult = beginsSeriesAtDistance(sl, bIndex, distance);
      if (fitResult === 0) {
        beginAtIndex = bIndex;
      } else if (fitResult === -1) {
        // We went too far. Search to the left of this index.
        currentEnd = bIndex;
      } else if (fitResult === 1) {
        // We didn't go far enough. Search to the right of this index.
        currentStart = bIndex;
      }
      lastBIndex = bIndex;
    }
    // Unlike with addition, the bisect is just the first step; if there's more
    // than one node with the same distance, we just have to loop through them
    // until we find the right node.
    for (let i = beginAtIndex; i < sl.length; i++) {
      if (sl[i].node === node) {
        removeAtIndex = i;
        break;
      }
    }
    if (removeAtIndex !== null) {
      sl.splice(removeAtIndex, 1);
    } else {
      // If we get here it's because there's a logic error.
      throw new Error(`Couldn't find node for removal`);
    }
  }

  // Adds a node to the list, preserving the list's sorting on insertion.
  _addToSortedList (node, distance) {
    let sl = this.insertionSortedList;
    let bundle = { node, distance };
    let startIndex = 1, endIndex = sl.length - 1;
    // Where did we insert last time?
    if (this._lastInsertion.distance !== null) {
      // Each insertion _tends_ to either slightly less or slightly more
      // distant than the last one, so this is a useful strategy for finding
      // the right slot.
      let { distance: lDistance, index: lIndex } = this._lastInsertion;
      if (lDistance <= distance) {
        // Distance of what we're about to insert is greater than that of the
        // last thing we inserted, so we can ignore anything before that index.
        startIndex = lIndex + 1;
      } else {
        // Distance of what we're about to insert is less than that of the last
        // thing we inserted, so we can ignore anything after that index.
        endIndex = lIndex;
      }
    }
    if (!sl.length || sl[sl.length - 1].distance <= distance) {
      // We're either the first insertion or we're more distant than the most
      // distant item in the list, so this is easy.
      sl.push(bundle);
      this._updateLastInsertion(distance, sl.length - 1);
    } else if (sl[0].distance > distance) {
      // Everything in the list is more distant than what we're inserting, so
      // we can stick it in the front.
      sl.unshift(bundle);
      this._updateLastInsertion(distance, 0);
    } else {
      // We're not quite that lucky, so let's do a bisection search to find a
      // valid place to insert this element.
      let insertAtIndex = null;

      // At least try the starting position before we go off on a bisect goose
      // chase. If we got `startIndex` from reading `this._lastInsertion`,
      // there's a decent chance that our first attempt will be a valid
      // insertion position.
      let fitResult = fitsAtIndex(sl, startIndex, distance);
      if (fitResult === 0) {
        insertAtIndex = startIndex;
      }

      // Otherwise, we'll test the midpoint(ish) of the list, use the result to
      // rule out one half of the remaining candidates, and repeat until we get
      // to the right place.
      let currentStart = startIndex, currentEnd = endIndex;
      let lastBIndex = null;
      while (insertAtIndex === null) {
        let bIndex = bisectBetween(currentStart, currentEnd);
        if (bIndex === lastBIndex) {
          throw new Error(`Stuck at ${bIndex}!`);
        }
        fitResult = fitsAtIndex(sl, bIndex, distance);
        if (fitResult === 0) {
          insertAtIndex = bIndex;
        } else if (fitResult === -1) {
          // We went too far. Search to the left of this index.
          currentEnd = bIndex;
        } else if (fitResult === 1) {
          // We didn't go far enough. Search to the right of this index.
          currentStart = bIndex;
        }
        lastBIndex = bIndex;
      }
      sl.splice(insertAtIndex, 0, bundle);
      this._updateLastInsertion(distance, insertAtIndex);
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
      this._removeFromSortedList(existingNode, existingDistance);
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
