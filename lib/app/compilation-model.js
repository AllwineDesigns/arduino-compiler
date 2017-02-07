var mongoose = require('mongoose');
var fs = require('fs');
var cache = require('mongoose-cache');
var timestamps = require('mongoose-timestamp');
var crypto = require('crypto');
var logger = require('logfmt');
var Promise = require('promise');
var summarize = require('summarize');
var exec = require('child_process').exec;
var shellescape = require('shell-escape');
var config = require('../config');
var _ = require('lodash');

var errors = require('./errors');

var STATES = ['pending', 'complete', 'failed'];
var FIVE_MINUTES = 1000 * 60 * 5;

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
    e: { type: Date, expires: 60, default: Date.now }
  });

  Schema.plugin(timestamps);

  Schema.virtual('isReady').get(function getIsReady() {
    return this.hex != "";
  });

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

        var model = new Compilation({ _id: id, script: script, board: board, hex: "" }).save(onSave);

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
                  return reject(err);
              }
              var filename = path + name + ".ino";
              fs.writeFile(filename, script, function(err) {
                  if(err) {
                      logger.log({ type: 'error', msg: 'could not save script to file', error: err });
                      return reject(err);
                  }
                  var args = [config.arduino_path + "/arduino", "--verify", "--verbose", "--board", board, "--preserve-temp-files", filename];

                  exec(shellescape(args), function(err, stdout, stderr) {
                      logger.log( { type: 'debug', msg: "stdout: " + stdout } );
                      logger.log( { type: 'debug', msg: "stderr: " + stderr } );
                      var match = stdout.match("\"([^\"]*" + name + ".ino.hex)");

                      if(match) {
                          var hexFile = match[1];
                          fs.readFile(hexFile, function(err, data) {
                              if(err) {
                                  reject(err);
                              }
                              var buffer = new Buffer(data);
                              Compilation.update({ _id: id }, { $set: { hex: buffer.toString('base64') } }, function(err) {
                                  if(err) {
                                      reject(err);
                                  }
                              });
                          });
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
