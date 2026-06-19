/**
 * SourceTree JSON - JQ/JSONPath Lite Query Engine
 * Supports common jq and JSONPath syntax for querying JSON data
 */

(function(global) {
  'use strict';

  class JQLite {
    constructor() {
      this.filters = {
        // Built-in filters
        'keys': (input) => Array.isArray(input) ? input.map((_, i) => i) : Object.keys(input || {}),
        'values': (input) => Array.isArray(input) ? input : Object.values(input || {}),
        'length': (input) => Array.isArray(input) ? input.length : typeof input === 'string' ? input.length : Object.keys(input || {}).length,
        'type': (input) => {
          if (input === null) return 'null';
          if (Array.isArray(input)) return 'array';
          return typeof input;
        },
        'reverse': (input) => Array.isArray(input) ? [...input].reverse() : input,
        'sort': (input) => Array.isArray(input) ? [...input].sort() : input,
        'unique': (input) => Array.isArray(input) ? [...new Set(input.map(x => JSON.stringify(x)))].map(x => JSON.parse(x)) : input,
        'flatten': (input) => Array.isArray(input) ? input.flat(Infinity) : input,
        'first': (input) => Array.isArray(input) ? input[0] : input,
        'last': (input) => Array.isArray(input) ? input[input.length - 1] : input,
        'min': (input) => Array.isArray(input) ? Math.min(...input.filter(x => typeof x === 'number')) : input,
        'max': (input) => Array.isArray(input) ? Math.max(...input.filter(x => typeof x === 'number')) : input,
        'add': (input) => Array.isArray(input) ? input.reduce((a, b) => {
          if (typeof a === 'number' && typeof b === 'number') return a + b;
          if (typeof a === 'string' && typeof b === 'string') return a + b;
          if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
          return a;
        }) : input,
        'not': (input) => !input,
        'empty': () => undefined,
        'null': () => null,
        'true': () => true,
        'false': () => false,
        'now': () => Date.now() / 1000,
        'tostring': (input) => String(input),
        'tonumber': (input) => Number(input),
        'ascii_downcase': (input) => typeof input === 'string' ? input.toLowerCase() : input,
        'ascii_upcase': (input) => typeof input === 'string' ? input.toUpperCase() : input,
        // Literal prefix/suffix strip (no regex — avoids ReDoS + regex-injection from user query args).
        'ltrimstr': (input, args) => (typeof input === 'string' && args && input.startsWith(args)) ? input.slice(args.length) : input,
        'rtrimstr': (input, args) => (typeof input === 'string' && args && input.endsWith(args)) ? input.slice(0, input.length - args.length) : input,
        'trim': (input) => typeof input === 'string' ? input.trim() : input,
        'split': (input, args) => typeof input === 'string' ? input.split(args || '') : input,
        'join': (input, args) => Array.isArray(input) ? input.join(args || '') : input,
        'startswith': (input, args) => typeof input === 'string' ? input.startsWith(args || '') : false,
        'endswith': (input, args) => typeof input === 'string' ? input.endsWith(args || '') : false,
        'contains': (input, args) => {
          if (typeof input === 'string') return input.includes(args || '');
          if (Array.isArray(input)) return input.some(x => JSON.stringify(x) === JSON.stringify(args));
          return false;
        },
        'floor': (input) => Math.floor(input),
        'ceil': (input) => Math.ceil(input),
        'round': (input) => Math.round(input),
        'sqrt': (input) => Math.sqrt(input),
        'abs': (input) => Math.abs(input),
      };
    }

    /**
     * Execute a query on JSON data
     * @param {any} data - The JSON data to query
     * @param {string} query - The query string (jq or JSONPath style)
     * @returns {any} - Query result
     */
    query(data, query) {
      query = query.trim();
      
      // Handle empty query
      if (!query || query === '.') {
        return data;
      }

      // Detect query style and normalize
      if (query.startsWith('$')) {
        // JSONPath style - convert to jq style
        query = this.jsonPathToJq(query);
      }

      try {
        return this.executeJq(data, query);
      } catch (e) {
        throw new Error(`Query error: ${e.message}`);
      }
    }

    /**
     * Convert JSONPath to jq-style query
     */
    jsonPathToJq(jsonPath) {
      let jq = jsonPath
        .replace(/^\$/, '.')           // $ -> .
        .replace(/\['([^']+)'\]/g, '.$1') // ['key'] -> .key
        .replace(/\[(\d+)\]/g, '.[$1]')   // [0] -> .[0]
        .replace(/\[\*\]/g, '.[]')        // [*] -> .[]
        .replace(/\.\.(\w+)/g, '.. | .$1'); // ..key -> recursive descent
      
      return jq;
    }

    /**
     * Execute jq-style query
     */
    executeJq(data, query) {
      // Handle pipe operations
      if (query.includes(' | ')) {
        const parts = this.splitPipe(query);
        let result = data;
        for (const part of parts) {
          result = this.executeJq(result, part.trim());
          if (result === undefined) break;
        }
        return result;
      }

      // Handle select() filter
      const selectMatch = query.match(/^select\((.+)\)$/);
      if (selectMatch) {
        return this.executeSelect(data, selectMatch[1]);
      }

      // Handle map() filter
      const mapMatch = query.match(/^map\((.+)\)$/);
      if (mapMatch) {
        if (!Array.isArray(data)) return data;
        return data.map(item => this.executeJq(item, mapMatch[1]));
      }

      // Handle array construction [...]
      if (query.startsWith('[') && query.endsWith(']') && !query.match(/^\[\d+\]$/) && query !== '.[]') {
        const inner = query.slice(1, -1).trim();
        if (inner === '') {
          // Empty array
          return [];
        }
        const result = this.executeJq(data, inner);
        return Array.isArray(result) ? result : [result];
      }

      // Handle object construction {...}
      if (query.startsWith('{') && query.endsWith('}')) {
        return this.constructObject(data, query);
      }

      // Handle built-in filters
      for (const [name, fn] of Object.entries(this.filters)) {
        const filterMatch = query.match(new RegExp(`^${name}(?:\\((.*)\\))?$`));
        if (filterMatch) {
          const args = filterMatch[1] ? this.parseArgs(filterMatch[1]) : undefined;
          return fn(data, args);
        }
      }

      // Handle comparison/arithmetic operations
      const opMatch = query.match(/^(.+?)\s*(==|!=|<=|>=|<|>|\+|-|\*|\/|%|and|or)\s*(.+)$/);
      if (opMatch) {
        const left = this.executeJq(data, opMatch[1].trim());
        const right = this.parseValue(opMatch[3].trim(), data);
        return this.applyOperator(left, opMatch[2], right);
      }

      // Handle path access
      return this.accessPath(data, query);
    }

    /**
     * Split by pipe, respecting parentheses and brackets
     */
    splitPipe(query) {
      const parts = [];
      let current = '';
      let depth = 0;
      let inString = false;
      let stringChar = '';

      for (let i = 0; i < query.length; i++) {
        const char = query[i];
        const prev = query[i - 1];

        if ((char === '"' || char === "'") && prev !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        if (!inString) {
          if (char === '(' || char === '[' || char === '{') depth++;
          if (char === ')' || char === ']' || char === '}') depth--;
          
          if (char === '|' && depth === 0 && query[i + 1] !== '|') {
            parts.push(current);
            current = '';
            continue;
          }
        }

        current += char;
      }
      
      if (current) parts.push(current);
      return parts;
    }

    /**
     * Access a path in the data
     */
    accessPath(data, path) {
      // Handle identity
      if (path === '.') return data;

      // Handle array iteration .[]
      if (path === '.[]' || path === '[]') {
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data !== null) return Object.values(data);
        return data;
      }

      // Handle recursive descent ..
      if (path.startsWith('..')) {
        return this.recursiveDescent(data, path.slice(2));
      }

      // Parse the path
      const tokens = this.tokenizePath(path);
      let result = data;

      for (const token of tokens) {
        if (result === undefined || result === null) return undefined;

        if (token.type === 'key') {
          // Never traverse into prototype-chain keys via a query path.
          if (token.value === '__proto__' || token.value === 'constructor' || token.value === 'prototype') return undefined;
          result = Object.prototype.hasOwnProperty.call(result, token.value) ? result[token.value] : undefined;
        } else if (token.type === 'index') {
          if (Array.isArray(result)) {
            const idx = token.value < 0 ? result.length + token.value : token.value;
            result = result[idx];
          } else {
            result = undefined;
          }
        } else if (token.type === 'iterate') {
          if (Array.isArray(result)) {
            // Continue with array (will be expanded)
          } else if (typeof result === 'object') {
            result = Object.values(result);
          }
        } else if (token.type === 'slice') {
          if (Array.isArray(result)) {
            result = result.slice(token.start, token.end);
          }
        } else if (token.type === 'wildcard') {
          if (Array.isArray(result)) {
            const key = token.key;
            result = result.map(item => item && item[key]).filter(x => x !== undefined);
          }
        }
      }

      return result;
    }

    /**
     * Tokenize a path string
     */
    tokenizePath(path) {
      const tokens = [];
      let remaining = path.startsWith('.') ? path.slice(1) : path;

      while (remaining.length > 0) {
        // Match array index .[0] or [0]
        let match = remaining.match(/^\[(-?\d+)\]/);
        if (match) {
          tokens.push({ type: 'index', value: parseInt(match[1]) });
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Match array slice .[0:5]
        match = remaining.match(/^\[(\d*):(\d*)\]/);
        if (match) {
          tokens.push({ 
            type: 'slice', 
            start: match[1] ? parseInt(match[1]) : 0,
            end: match[2] ? parseInt(match[2]) : undefined
          });
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Match array iteration .[] or []
        match = remaining.match(/^\[\]/);
        if (match) {
          tokens.push({ type: 'iterate' });
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Match key with dots: .key or key
        match = remaining.match(/^\.?([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (match) {
          tokens.push({ type: 'key', value: match[1] });
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Match quoted key .["key"] or ["key"]
        match = remaining.match(/^\[["']([^"']+)["']\]/);
        if (match) {
          tokens.push({ type: 'key', value: match[1] });
          remaining = remaining.slice(match[0].length);
          continue;
        }

        // Skip dots
        if (remaining.startsWith('.')) {
          remaining = remaining.slice(1);
          continue;
        }

        // Unknown token - break
        break;
      }

      return tokens;
    }

    /**
     * Execute select() filter
     */
    executeSelect(data, condition) {
      if (Array.isArray(data)) {
        return data.filter(item => {
          try {
            return this.evaluateCondition(item, condition);
          } catch {
            return false;
          }
        });
      }
      return this.evaluateCondition(data, condition) ? data : undefined;
    }

    /**
     * Evaluate a condition
     */
    evaluateCondition(data, condition) {
      // Handle comparison
      const match = condition.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
      if (match) {
        const left = this.executeJq(data, match[1].trim());
        const right = this.parseValue(match[3].trim(), data);
        return this.applyOperator(left, match[2], right);
      }

      // Handle type check
      const typeMatch = condition.match(/^type\s*==\s*"(\w+)"$/);
      if (typeMatch) {
        const actualType = this.filters.type(data);
        return actualType === typeMatch[1];
      }

      // Handle has() check
      const hasMatch = condition.match(/^has\("(.+)"\)$/);
      if (hasMatch) {
        return data && typeof data === 'object' && hasMatch[1] in data;
      }

      // Evaluate as boolean
      const result = this.executeJq(data, condition);
      return Boolean(result);
    }

    /**
     * Parse a value (literal or path)
     */
    parseValue(str, context) {
      str = str.trim();
      
      // Null
      if (str === 'null') return null;
      
      // Boolean
      if (str === 'true') return true;
      if (str === 'false') return false;
      
      // Number
      if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
      
      // String (quoted)
      if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
      }
      
      // Path reference
      if (str.startsWith('.')) {
        return this.executeJq(context, str);
      }
      
      return str;
    }

    /**
     * Apply an operator
     */
    applyOperator(left, op, right) {
      switch (op) {
        case '==': return JSON.stringify(left) === JSON.stringify(right);
        case '!=': return JSON.stringify(left) !== JSON.stringify(right);
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        case '+': return typeof left === 'string' ? left + right : left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case 'and': return left && right;
        case 'or': return left || right;
        default: return left;
      }
    }

    /**
     * Construct an object from query
     */
    constructObject(data, query) {
      const inner = query.slice(1, -1).trim();
      if (!inner) return {};
      
      const result = {};
      const pairs = this.splitComma(inner);
      
      const isUnsafeKey = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) {
          // Shorthand: just a key
          const key = pair.trim().replace(/^\./, '');
          if (isUnsafeKey(key)) continue;   // block prototype pollution
          result[key] = this.executeJq(data, '.' + key);
        } else {
          let key = pair.slice(0, colonIdx).trim();
          const value = pair.slice(colonIdx + 1).trim();

          // Remove quotes from key
          if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
            key = key.slice(1, -1);
          }

          if (isUnsafeKey(key)) continue;   // block prototype pollution
          result[key] = this.executeJq(data, value);
        }
      }
      
      return result;
    }

    /**
     * Split by comma, respecting nesting
     */
    splitComma(str) {
      const parts = [];
      let current = '';
      let depth = 0;
      let inString = false;
      let stringChar = '';

      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const prev = str[i - 1];

        if ((char === '"' || char === "'") && prev !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        if (!inString) {
          if (char === '(' || char === '[' || char === '{') depth++;
          if (char === ')' || char === ']' || char === '}') depth--;
          
          if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
            continue;
          }
        }

        current += char;
      }
      
      if (current.trim()) parts.push(current.trim());
      return parts;
    }

    /**
     * Recursive descent
     */
    recursiveDescent(data, key) {
      const results = [];
      
      const traverse = (obj) => {
        if (obj === null || typeof obj !== 'object') return;
        
        if (Array.isArray(obj)) {
          for (const item of obj) {
            traverse(item);
          }
        } else {
          for (const [k, v] of Object.entries(obj)) {
            if (k === key || key === '') {
              results.push(v);
            }
            traverse(v);
          }
        }
      };
      
      traverse(data);
      return results;
    }

    /**
     * Parse function arguments
     */
    parseArgs(argsStr) {
      argsStr = argsStr.trim();
      if ((argsStr.startsWith('"') && argsStr.endsWith('"')) || 
          (argsStr.startsWith("'") && argsStr.endsWith("'"))) {
        return argsStr.slice(1, -1);
      }
      return argsStr;
    }

    /**
     * Get all available filters
     */
    getFilters() {
      return Object.keys(this.filters);
    }
  }

  // Export
  global.JQLite = JQLite;

})(window);
