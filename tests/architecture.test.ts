import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}

test('domain and application do not import framework, UI or platform adapters', () => {
  const src = path.resolve('src');
  for (const layer of ['core', 'application']) {
    for (const file of files(path.join(src, layer))) {
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
        const specifier = node.moduleSpecifier.text;
        assert.ok(
          specifier.startsWith('.'),
          `${file} imports platform/framework package ${specifier}`,
        );
        const destination = path.resolve(path.dirname(file), specifier);
        const allowed = [
          path.join(src, 'core'),
          ...(layer === 'application' ? [path.join(src, 'application')] : []),
        ];
        assert.ok(
          allowed.some((dir) => destination.startsWith(dir + path.sep)),
          `${file} violates the ${layer} dependency boundary: ${specifier}`,
        );
      }
    }
  }
});
