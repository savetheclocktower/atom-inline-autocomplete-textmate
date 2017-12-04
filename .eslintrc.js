module.exports = {
  "env": {
    "browser": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "sourceType": "module"
  },
  "rules": {
    "brace-style": [
      "error",
      "1tbs",
      { "allowSingleLine": true }
    ],
    "space-before-function-paren": [
      "error",
      "always"
    ],
    "keyword-spacing": [
      "error",
      {
        "before": true,
        "after": true
      }
    ],
    "indent": [
      "error",
      2
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-useless-escape": "off",
    "no-cond-assign": "off"
  }
};
