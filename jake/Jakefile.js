var lifter = require('./sails-lifter');
var _ = require('lodash');
var Promise = require('bluebird');


//Load sails to benefit from services and models definition
// This will load a minimal version of sails without http, sessions, controllers, ...
task('sails-load', {async: true}, function(){
  lifter.lift(function(err, sails) {
    complete();
  });
});

task('recoverPackageVersions',['sails-load'], {async: true}, function(){
  RecoverService.recoverPackageVersionFromSourceJSON().then(function() {
    complete();
  });
});




desc('Call a fn in sails');
task('sitemap', ['sails-load'], {async: true}, function () {

  var host = 'http://www.rdocumentation.org';
  var directoryUrl = host + '/sitemap/';

  var sg = require('sitemap-stream')({
    sitemapDirectoryUrl: directoryUrl,
    outputFolder:'assets/sitemap/'
  });
  //set concurrency to maximum number of connection to database
  var concurrency = sails.config.connections.sequelize_mysql.options.pool.max;

  PackageVersion.findAll({
    attributes:['id', 'package_name', 'version']
  }).map(function(p){

    var package_json = p.toJSON();
    var url =  package_json.uri;

    sg.inject(host + url);

    return p.getTopics({
      attributes: ['id', 'package_version_id', 'name']
    }).map(function(t) {
      var topic_json = t.toJSON();
      var url = '/packages/'+
        encodeURIComponent(package_json.package_name)+
        '/versions/'+
        encodeURIComponent(package_json.version)+
        '/topics/' +
        encodeURIComponent(topic_json.name);

      sg.inject(host + url);
      return 1;
    });

  }, {concurrency: concurrency})
  .then(function() {
    return sg.done();
  });

  sg.on('drain', function() {
    console.info('drain');
  });

  sg.on('done', function() {
    console.info('The job is done !');
    complete();
  });

});

task('download-statistics', ['sails-load'], {async: true}, function () {
  CronService.splittedAggregatedDownloadstats(1).then(function(resp) {
    console.log("Done !");
    complete();
  }).catch({message: "empty"}, function() {
    console.log("No stats for this time range yet");
    complete();
  });
});



task('bootstrap-splitted-download-statistics', ['sails-load'], {async: true}, function () {
  var lastMonth = _.range(3, 28);
  Promise.map(lastMonth, function(day) {
    return CronService.splittedAggregatedDownloadstats(day).then(function(resp) {
      console.log("Done " + day);
      return 1;
    }).catch({message: "empty"}, function() {
      console.log("No stats for this time range yet");
      return 0;
    });
  }, {concurrency: 1}).then(function () {
    complete();
  });

});

jake.addListener('complete', function () {
  process.exit();
});

