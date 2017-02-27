// Papertrail = add to here
var path = require('path');

module.exports = {

  // Services
  mongo_url: process.env.MONGODB_URI || 'mongodb://localhost:27017/appDev',
  rabbit_url: process.env.CLOUDAMQP_URL || 'amqp://localhost',
  port: int(process.env.PORT) || 5000,
  root_dir: path.join(__dirname,'..'),

  // Security
  cookie_secret: process.env.COOKIE_SECRET || 'myCookieSecret',

  // App behavior
  verbose: bool(process.env.VERBOSE) || false,                    // Log 200s?
  concurrency: int(process.env.CONCURRENCY) || 1,                 // Number of Cluster processes to fork in Server
  worker_concurrency: int(process.env.WORKER_CONCURRENCY) || 1,   // Number of Cluster processes to fork in Worker
  thrifty: bool(process.env.THRIFTY) || false,                    // Web process also executes job queue?
  view_cache: bool(process.env.VIEW_CACHE) || true,               // Cache rendered views?
  mongo_cache: int(process.env.MONGO_CACHE) || 10000,             // LRU cache for mongo queries

  arduino_path: process.env.ARDUINO_PATH || "/app/arduino-nightly"
};

function bool(str) {
  if (str == void 0) return false;
  return str.toLowerCase() === 'true';
}

function int(str) {
  if (!str) return 0;
  return parseInt(str, 10);
}

function float(str) {
  if (!str) return 0;
  return parseFloat(str, 10);
}
