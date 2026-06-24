// Temporary test runner script that patches jest-resolve for this environment
const path = require('path');
process.chdir(__dirname);

// Patch jest-resolve to fall back to require.resolve when its internal resolution fails
const Resolver = require('./node_modules/jest-resolve').default;
const origFindNodeModule = Resolver.findNodeModule;
Resolver.findNodeModule = function(name, opts) {
  const result = origFindNodeModule.call(this, name, opts);
  if (result) return result;
  try {
    return require.resolve(name, { paths: [opts.basedir || process.cwd()] });
  } catch (e) {
    // For relative paths, try to resolve manually
    if (name.startsWith('.') && opts.basedir) {
      const resolved = path.resolve(opts.basedir, name);
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'];
      const fs = require('fs');
      // Check exact file
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
      // Check with extensions
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) return withExt;
      }
      // Check index files
      for (const ext of extensions) {
        const indexFile = path.join(resolved, 'index' + ext);
        if (fs.existsSync(indexFile)) return indexFile;
      }
    }
    return null;
  }
};

require('./node_modules/jest/bin/jest.js');
