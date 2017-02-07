function CompilationNotFound() {
  Error.call(this);
  Error.captureStackTrace(this, CompilationNotFound);
  this.name = 'CompilationNotFound';
  this.message = 'Compilation Not Found';
}

CompilationNotFound.prototype = Object.create(Error.prototype);

function CompilationFailed() {
  Error.call(this);
  Error.captureStackTrace(this, CompilationFailed);
  this.name = 'CompilationFailed';
  this.message = 'Compilation Failed';
}

CompilationFailed.prototype = Object.create(Error.prototype);

module.exports = {
  CompilationNotFound: CompilationNotFound,
  CompilationFailed: CompilationFailed
};
