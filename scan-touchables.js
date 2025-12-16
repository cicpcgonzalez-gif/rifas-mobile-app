const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const targetPath = process.argv[2] || path.join('src');

function listFilesRecursive(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let st;
    try {
      st = fs.statSync(cur);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(cur)) {
        if (entry === 'node_modules' || entry === '.git') continue;
        stack.push(path.join(cur, entry));
      }
    } else {
      if (/\.(js|jsx|ts|tsx)$/i.test(cur)) out.push(cur);
    }
  }
  return out;
}

function getJsxName(node) {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    const obj = getJsxName(node.object);
    const prop = getJsxName(node.property);
    return obj && prop ? `${obj}.${prop}` : null;
  }
  return null;
}

function hasAttr(openingEl, attrName) {
  if (!openingEl || !Array.isArray(openingEl.attributes)) return false;
  return openingEl.attributes.some((a) => a && a.type === 'JSXAttribute' && a.name && a.name.name === attrName);
}

const targets = (() => {
  try {
    const st = fs.statSync(targetPath);
    if (st.isDirectory()) return listFilesRecursive(targetPath);
  } catch {
    // fallthrough
  }
  return [targetPath];
})();

let total = 0;

for (const file of targets) {
  let code;
  try {
    code = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread'],
    });
  } catch (e) {
    console.log(`${file} :: PARSE_ERROR ${String(e && e.message ? e.message : e)}`);
    continue;
  }

  const hits = [];

  traverse(ast, {
    JSXOpeningElement(p) {
      const name = getJsxName(p.node.name);
      if (!name) return;
      if (name !== 'TouchableOpacity' && name !== 'Pressable' && name !== 'TouchableWithoutFeedback') return;

      const hasOnPress = hasAttr(p.node, 'onPress') || hasAttr(p.node, 'onLongPress');
      const isDisabled = hasAttr(p.node, 'disabled');

      // Consider disabled-only buttons as intentional, skip.
      if (!hasOnPress && !isDisabled) {
        hits.push({ name, loc: p.node.loc });
      }
    },
  });

  if (hits.length) {
    console.log(`\n=== ${file} ===`);
    for (const h of hits) {
      if (!h.loc) continue;
      console.log(`${h.loc.start.line}:${h.loc.start.column} <${h.name}> missing onPress`);
    }
    console.log(`TOTAL missing onPress (file): ${hits.length}`);
  }

  total += hits.length;
}

console.log(`\nTOTAL missing onPress: ${total}`);
