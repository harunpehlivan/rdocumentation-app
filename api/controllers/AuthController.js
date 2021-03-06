/**
 * AuthController
 *
 */
var passport = require('passport');
module.exports = {

  login: function (req, res) {
    if(req.allParams().rdr){
      req.session['rdr'] = req.allParams().rdr;
    }
    res.view();
  },
  modalLogin: function(req,res){
    if(req.allParams().rdr){
      req.session['rdr'] = req.allParams().rdr;
    }
    res.view('auth/modalLogin.ejs', {layout: null});
  },
  register: function (req, res) {
      req.session['rdr'] = req.allParams().rdr;
    res.view();
  },
  process: function(req, res){
    var successRedirect =  req.session['rdr'] || '/';
    passport.authenticate('local', { failureRedirect: '/login',
                                     failureFlash: 'Invalid Username or password.' })(req, res, function() {
                                        return res.rstudio_redirect(303, successRedirect);
                                     });
  },
  rstudioProcess:function(req,res){
    var successRedirect =  req.session['rdr'] || '/';
    passport.authenticate('local', function(err, user, info) {
                            if(err || !user) { return res.json({status: "failure", message: "Not Logged"}) };
                            req.logIn(user, function(err) {
                              if (err) { return res.json({status: "failure", message: "Not Logged"}) }
                              return res.json({status :"succes", message: "Logged"})
                            });
                          })(req, res);
  },
  modalProcess: function(req, res){
    passport.authenticate('local', function(err, user, info) {
    if (err) { return res.json({status: "error"}); }
    if (!user) { return res.json({status: "invalid"}); }
    req.logIn(user, function(err) {
      if (err) { return res.json({status: "error"}); }
      return res.json({status: "success"});
    });})(req, res);
  },
  logout: function (req,res){
    req.session['rdr'] =  null; //Reset the session rdr
    req.logout();
    res.rstudio_redirect(303,'/');
  }
};
