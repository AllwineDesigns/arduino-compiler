var logger = require('logfmt');
var Promise = require('promise');
var uuidV1 = require('uuid/v1');
var EventEmitter = require('events').EventEmitter;

var connections = require('./connections');
var CompilationModel = require('./compilation-model');

var COMPILE_QUEUE = 'jobs.compile';

function App(config) {
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.onConnected = function() {
  var queues = 0;
  this.Compilation = CompilationModel(this.connections.db, this.config.mongo_cache);
  this.connections.queue.create(COMPILE_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === 1) this.onReady();
  }
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

App.prototype.addCompilation = function(script, board) {
    logger.log({type: "debug", script: script, board: board });
  var id = uuidV1();
  this.connections.queue.publish(COMPILE_QUEUE, { id: id, script: script, board: board });
  return Promise.resolve(id);
};

App.prototype.compileScript = function(id, script, board) {
  return this.Compilation.compile(id, script, board);
};

App.prototype.purgePendingCompilations = function() {
  logger.log({ type: 'info', msg: 'app.purgePendingCompilations' });

  return new Promise(function(resolve, reject) {
    this.connections.queue.purge(COMPILE_QUEUE, onPurge);

    function onPurge(err, count) {
      if (err) return reject(err);
      resolve(count);
    }
  }.bind(this));
};

App.prototype.getCompilation = function(id) {
  return this.Compilation.get(id);
};

App.prototype.startCompiling = function() {
    logger.log({ type: 'debug', msg: "in startCompiling" });
  this.connections.queue.handle(COMPILE_QUEUE, this.handleCompilationJob.bind(this));
  return this;
};

App.prototype.handleCompilationJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: COMPILE_QUEUE, script: job.script });

  this
    .compileScript(job.id, job.script, job.board)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', status: 'success', url: job.script });
    ack();
  }

  function onError() {
    logger.log({ type: 'info', msg: 'job complete', status: 'failure', url: job.script });
    ack();
  }
};

App.prototype.stopCompiling = function() {
  this.connections.queue.ignore(COMPILE_QUEUE);
  return this;
};

App.prototype.deleteAllCompilations = function() {
  logger.log({ type: 'info', msg: 'app.deleteAllCompilations' });
  return this.Compilation.deleteAll();
};
