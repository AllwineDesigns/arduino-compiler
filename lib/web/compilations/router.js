var config = require('../../config');
var logger = require('logfmt');
var express = require('express');
var path = require('path');
var fs = require('fs');

var ERR_MAP = {
  'CompilationNotFound': 404,
  'CompilationFailed': 500
};

module.exports = function compilationsRouter(app) {

  return new express.Router()
    .use(express.static(path.join(__dirname, 'public')))
    .get('/sketch/:sketch', showForm)
    .get('/compilation/:compilationId', showCompilation)
    .post('/compilations', addCompilation)
    .use(compilationErrors);

  function showForm(req, res, next) {
    fs.readFile(config.root_dir + "/sketches/" + req.params.sketch + "/" + req.params.sketch + ".ino", function(err, data) {
        if(err) {
            return next(err);
        }
        res.render(path.join(__dirname, 'showForm'), { script: data });
    });
  }

  function addCompilation(req, res, next) {
      logger.log(req.body);
    var script;
    var board;
    if(req.body.script && req.body.board) {
        script = req.body.script;
        board = req.body.board;
    } else {
        var obj = JSON.parse(req.body);
        script = obj.script;
        board = obj.board;
    }
    app
      .addCompilation(script, board)
      .then(sendLink, next);

    function sendLink(id) {
      res.json({ link: '/compilation/' + id });
    }
  }

  function showCompilation(req, res, next) {
    app
      .getCompilation(req.params.compilationId)
      .then(sendCompilation, next);

    function sendCompilation(compilation) {
      return res.json(compilation);
    }
  }

  function compilationErrors(err, req, res, next) {
    var status = ERR_MAP[err.name];
    if (status) err.status = status;
    next(err);
  }
};
