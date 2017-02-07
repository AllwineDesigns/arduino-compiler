var express = require('express');
var path = require('path');

var ERR_MAP = {
  'CompilationNotFound': 404,
  'CompilationFailed': 500
};

module.exports = function compilationsRouter(app) {

  return new express.Router()
    .get('/', showForm)
    .get('/compilation/:compilationId', showCompilation)
    .post('/compilations', addCompilation)
    .use(compilationErrors)
    .use(express.static(path.join(__dirname, 'public')));

  function showForm(req, res, next) {
    res.render(path.join(__dirname, 'showForm'));
  }

  function addCompilation(req, res, next) {
    app
      .addCompilation(req.body.script, req.body.board)
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
