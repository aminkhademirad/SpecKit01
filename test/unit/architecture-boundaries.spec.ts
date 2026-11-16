import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : entry.name.endsWith('.ts') ? [join(directory, entry.name)] : []);
const tree = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const imports = (file: string) => tree(file).statements.filter(ts.isImportDeclaration).map(node => ({ name: (node.moduleSpecifier as ts.StringLiteral).text, typeOnly: node.importClause?.isTypeOnly === true }));

describe('مرزهای معماری مصوب', () => {
  it.each(files('src/domain'))('Domain فقط به Domain وابسته است؛ %s', file => {
    for (const dependency of imports(file)) {
      expect(dependency.name.startsWith('.')).toBe(true);
      const target = resolve(file, '..', dependency.name);
      expect(relative(resolve('src/domain'), target).startsWith('..')).toBe(false);
    }
  });
  it.each(files('src/http/controllers'))('Controller فقط Adapter است؛ %s', file => {
    for (const dependency of imports(file)) {
      expect(dependency.name).not.toMatch(/infrastructure|sqlite|better-sqlite3/);
      if (dependency.name.includes('/domain/') || dependency.name.startsWith('node:')) expect(dependency.typeOnly).toBe(true);
    }
    const visit = (node: ts.Node) => {
      expect(ts.isIfStatement(node) || ts.isSwitchStatement(node) || ts.isForStatement(node) || ts.isWhileStatement(node)).toBe(false);
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) expect(node.text).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE)\s|PendingReview|ChangesRequested|Approved|Draft/);
      ts.forEachChild(node, visit);
    };
    visit(tree(file));
  });
  it.each(files('src/application'))('Application به HTTP یا Nest وابسته نیست؛ %s', file => {
    for (const dependency of imports(file)) expect(dependency.name).not.toMatch(/@nestjs|express|\/http\//);
  });
});
