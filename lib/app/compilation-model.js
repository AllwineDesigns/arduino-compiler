var mongoose = require('mongoose');
var fs = require('fs');
var cache = require('mongoose-cache');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var exec = require('child_process').exec;
var shellescape = require('shell-escape');
var config = require('../config');
var _ = require('lodash');

var errors = require('./errors');

var status = {
    COMPILING: "compiling",
    COMPILE_ERROR: "compile_error",
    SERVER_ERROR: "server_error",
    SUCCESS: "success"
};

module.exports = function createCompilationModel(connection, maxAge) {

  // Monkey-patch Mongoose to support in-memory caching for 10s
  cache.install(mongoose, {
    max: 50,
    maxAge: maxAge
  });

  var Schema = mongoose.Schema({
    _id: { type: String },
    script: { type: String },
    board: { type: String },
    hex: { type: String },
    status: { type: String },
    line_number: { type: Number },
    error: { type: String },
    e: { type: Date, expires: 60, default: Date.now }
  });

  Schema.plugin(timestamps);

  Schema.set('toJSON', {
    getters: true,
    transform: function safeTransform(doc, ret, options) {
      delete ret.votes;
    }
  });

  Schema.statics = {
    compile: function(id, script, board) {
      return new Promise(function(resolve, reject) {
        var Compilation = this;

        var model = new Compilation({ _id: id, script: script, board: board, hex: "", status: status.COMPILING }).save(onSave);

        function onSave(err, compilation) {
          if (err) {
            logger.log({ type: 'error', msg: 'could not save compilation', error: err });
            return reject(err);
          }
          logger.log({ type: 'info', msg: 'saved compilation', id: compilation.id, script: compilation.script });

          var name = "script" + id;
          var path = "/tmp/" + name + "/";
          fs.mkdir(path, function(err) {
              if(err) {
                  Compilation.update({ _id: id }, { $set: { status: status.SERVER_ERROR, error: "couldn't make temporary directory" } }, function(err) {
                      if(err) {
                          reject(err);
                      }
                  });
                  return reject(err);
              }
              var filename = path + name + ".ino";
              fs.writeFile(filename, script, function(err) {
                  if(err) {
                      logger.log({ type: 'error', msg: 'could not save script to file', error: err });
                      Compilation.update({ _id: id }, { $set: { status: status.SERVER_ERROR, error: "couldn't save script to disk" } }, function(err) {
                          if(err) {
                              reject(err);
                          }
                      });
                      return reject(err);
                  }
                  var args = [config.arduino_path + "/arduino", "--verify", "--verbose", "--board", board, "--preserve-temp-files", filename];

                  exec(shellescape(args), function(err, stdout, stderr) {
                      logger.log( { type: 'debug', msg: "stdout: " + stdout } );
                      logger.log( { type: 'debug', msg: "stderr: " + stderr } );

                      var err_match = stderr.match(new RegExp(name + ":(\\d+):\\s+error:\\s+(.+)"));
                      if(err_match) {
                          logger.log({ type: 'debug', line_number: parseInt(err_match[1]), error: err_match[2] });
                          Compilation.update({ _id: id }, { $set: { line_number: err_match[1], error: err_match[2], status: status.COMPILE_ERROR } }, function(err) {
                              if(err) {
                                  reject(err);
                              }
                          });
                      } else {
                          var match = stdout.match("\"([^\"]*" + name + ".ino.hex)");

                          if(match) {
                              var hexFile = match[1];
                              fs.readFile(hexFile, function(err, data) {
                                  if(err) {
                                      Compilation.update({ _id: id }, { $set: { status: status.SERVER_ERROR, error: "couldn't read hex file" } }, function(err) {
                                          if(err) {
                                              reject(err);
                                          }
                                      });
                                      reject(err);
                                  }
                                  var buffer = new Buffer(data);
                                  Compilation.update({ _id: id }, { $set: { hex: buffer.toString('base64'), status: status.SUCCESS } }, function(err) {
                                      if(err) {
                                          reject(err);
                                      }
                                  });
                              });
                          } else {
                              Compilation.update({ _id: id }, { $set: { status: status.SERVER_ERROR, error: "couldn't locate hex file" } }, function(err) {
                                  if(err) {
                                      reject(err);
                                  }
                              });
                              reject("Couldn't find hex file");
                          }
                      }
                  });
              });
          });

          return resolve(compilation);
        }

      }.bind(this));
    },

    get: function(id) {
      logger.log({ type: 'debug', msg: "in get"});
      return new Promise(function(resolve, reject) {
        this.findById(id).exec(function(err, compilation) {
            logger.log({ type: 'debug', msg: "in find by id" + id, compilation: compilation });
          if (err) return reject(err);
          if (!compilation) return reject(new errors.CompilationNotFound());
          resolve(compilation);
        });
      }.bind(this));
    },

    deleteAll: function() {
      return new Promise(function(resolve, reject) {
        this.remove().exec(function(err) {
          if (err) return reject(err);
          resolve();
        });
      }.bind(this));
    }
  };

  Schema.methods = {
  };

  var Compilation = connection.model('Compilation', Schema);
  return Compilation;
};
