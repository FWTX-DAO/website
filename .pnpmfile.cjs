module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'sharp') {
        pkg.requiresBuild = true;
      }
      return pkg;
    }
  }
};