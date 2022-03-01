'use babel';
import WordNode from './word-node';


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


// Keeps a list of WordNodes and sorts the items based on their proximity to a
// specific WordNode. Handles the details of sorting by proximity, ensuring
// uniqueness, and assessing possible matches.
class WordNodeList {
  constructor (original) {
    this.list = [];
    this.original = original;
  }

  add (node, ...args) {
    let addition = node;
    if (!(node instanceof WordNode)) {
      addition = new WordNode(node, ...args);
    }

    this.list.push(addition);
  }

  getMatches (prefix, suffix) {
    let pattern = new RegExp(`^${prefix}.+${suffix}$`);
    let results = [];
    for (let node of this.list) {
      let { word } = node;
      if (word === this.original.word) { continue; }
      if (!pattern.test(word)) { continue; }
      results.push({
        prefix,
        suffix,
        word,
        distance: node.distanceFrom(this.original)
      });
    }

    results = sortBy(results, r => r.distance);
    results = unique(results);

    // DEBUG
    // let debugTable = results.map(r => `${r.distance}  ${r.word}`);
    // console.log(`RESULTS:\n${debugTable.join('\n')}`);
    return results;
  }

  [Symbol.iterator] () {
    let nodes = this.list.map(o => o.node);
    return nodes.values();
  }

  get length () {
    return this.list.length;
  }
}

export default WordNodeList;
