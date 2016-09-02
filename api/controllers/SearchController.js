/**
 * SearchController
 *
 * @description :: Server-side logic for searching
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var Promise = require('bluebird');
var _ = require('lodash');
var striptags = require('striptags');
var querystring = require('querystring');
var numeral = require('numeral');

module.exports = {

  quickSearch: function(req, res) {
    var token = req.body.token;

    var packages, topics, collaborators;

    var elastic = es.msearch({
      body: [
        { index: 'rdoc', type: 'package_version' },
        { query: {
            bool: {
              should: [

                {
                  "has_parent" : {
                    "query" : {
                      "function_score" : {
                        "functions": [
                          {
                            "filter": { "missing" : { "field" : "part_of_r" } },
                            "field_value_factor": {
                              "field":    "last_month_downloads",
                              "modifier": "log1p"
                            }
                          },
                          {
                            "filter": { "term" : { "part_of_r" : 0 } },
                            "field_value_factor": {
                              "field":    "last_month_downloads",
                              "modifier": "log1p"
                            }
                          },
                          {
                            "filter": { "term" : { "part_of_r" : 1 } },
                            "field_value_factor": {
                              "field":    "part_of_r",
                              "modifier": "log1p",
                              "factor": 300000
                            }
                          }
                        ],
                        "boost_mode": "multiply"
                      }
                    },

                    "parent_type" : "package",
                    "score_mode" : "score"
                  }
                }
              ],
              "minimum_number_should_match": 2,
              filter: {
                bool: {
                  must: [
                    {
                      match_phrase_prefix : {
                        "package_name" : {
                            "query" : token,
                            "max_expansions" : 20,
                        }
                      }
                    },
                    {
                      term: { latest_version: 1 }
                    }
                  ]
                }

              }
            }
          },
          size: 4,
          fields: ['package_name', 'version']
        },

        { index: 'rdoc', type: 'topic' },
        { query: {

            bool: {
              should: [
                {
                  "multi_match" : {
                    "query":    token,
                    "fields": [ "aliases^2", "name" ]
                  }
                },
                {
                  "multi_match" : {
                    "fields" : ["aliases^2", "name"],
                    "query" : token,
                    "type" : "phrase_prefix"
                  }
                },
                {
                  has_parent : {
                    "parent_type" : "package_version",
                    "score_mode": "score",
                    query : {
                      "has_parent" : {
                        "query" : {
                          "function_score" : {
                            "functions": [
                              {
                                "filter": { "missing" : { "field" : "part_of_r" } },
                                "field_value_factor": {
                                  "field":    "last_month_downloads",
                                  "modifier": "log1p"
                                }
                              },
                              {
                                "filter": { "term" : { "part_of_r" : 0 } },
                                "field_value_factor": {
                                  "field":    "last_month_downloads",
                                  "modifier": "log1p"
                                }
                              },
                              {
                                "filter": { "term" : { "part_of_r" : 1 } },
                                "field_value_factor": {
                                  "field":    "part_of_r",
                                  "modifier": "log1p",
                                  "factor": 300000
                                }
                              }
                            ],
                            "boost_mode": "replace"
                          }
                        },

                        "parent_type" : "package",
                        "score_mode" : "score"
                      }
                    }
                  }
                }
              ],
              "minimum_number_should_match": 1,
              filter: {
                has_parent : {
                  parent_type : "package_version",
                  query : {
                    term : {
                        latest_version : 1
                    }
                  },
                  inner_hits : { fields: ['package_name', 'version', 'latest_version'] }
                }
              }
            }

          },
          size: 4,
          fields: ['name']
        },

    ]}).then(function(response) {
      var packageResult = response.responses[0];
      var topicResult = response.responses[1];
      packages = _.map(packageResult.hits.hits, function(hit) {
        var name = hit.fields.package_name[0];
        var version = hit.fields.version[0];
        var uri = sails.getUrlFor({ target: 'PackageVersion.findByNameVersion' })
          .replace(':name', encodeURIComponent(name))
          .replace(':version', encodeURIComponent(version))
          .replace('/api/', '/');
        return { uri: uri,  name: name };
      });

      topics = _.map(topicResult.hits.hits, function(hit) {
        var name = hit.fields.name[0];
        var id = hit._id;
        var inner_hit = hit.inner_hits.package_version.hits.hits[0];
        var package_name = inner_hit.fields.package_name[0];
        var version = inner_hit.fields.version[0];
        var uri = '/api/packages/:name/versions/:version/topics/:topic'
          .replace(':name', encodeURIComponent(package_name))
          .replace(':version', encodeURIComponent(version))
          .replace(':topic', encodeURIComponent(name))
          .replace('/api/', '/');
        return { uri: uri,  name: name, package_name: package_name, package_version: version };
      });
    }).catch(function(err) {
      return res.negotiate(err);
    });

    var coll = Collaborator.quickSearch(token).then(function(result){
      collaborators = _.map(result,function(collaborator){
        var uri = '/collaborators/name/' + encodeURIComponent(collaborator.name);
        return {uri : uri, name: collaborator.name};
      });
    });

    Promise.all([elastic,coll]).then(function(){
      return res.json({packages: packages, topics: topics, collaborators: collaborators});
    });

  },

  keywordSearch: function(req, res) {
    var keyword = req.param('keyword');
    var page = parseInt(req.param('page')) || 1;
    var perPage = parseInt(req.param('perPage')) || 10;
    var offset = (page - 1) * perPage;
    var nextPageQuery = _.clone(req.query);
    nextPageQuery.page = page + 1;

    var prevPageQuery = _.clone(req.query);
    prevPageQuery.page = page - 1;


    es.search({
      index: 'rdoc',
      body:{
        query: {
          bool: {
            filter: {
              type : {
                value : "topic"
              }
            },
            must: [
              {
                term: {
                  keywords:  keyword
                }
              },
              {
                has_parent : {
                  parent_type : "package_version",
                  query : {
                    term : {
                        latest_version : 1
                    }
                  },
                  inner_hits : { fields: ['package_name', 'version', 'latest_version'] }
                }
              }
            ]
          }
        },
        highlight : {
          pre_tags : ["<mark>"],
          post_tags : ["</mark>"],
          "fields" : {
            "keywords": {
              highlight_query: {
                term: {
                  keywords:  keyword
                }
              }
            },

          }
        },
        from: offset,
        size: perPage,
        fields: ['title', 'name', 'description', 'keywords']
      }

    }).then(function(response) {
      //return res.json(response);
      var hits = response.hits.hits.map(function(hit) {
        var fields = {};
        var highlight = hit.highlight;
        var inner_hits_fields = hit.inner_hits.package_version.hits.hits[0].fields;

        fields.package_name = inner_hits_fields.package_name[0];
        fields.version = inner_hits_fields.version[0];
        fields.name = hit.fields.name[0];

        highlight.title = hit.fields.title[0];
        highlight.description = hit.fields.description[0];

        return {
          fields: fields,
          type: hit._type,
          score: hit._score,
          highlight: hit.highlight
        };
      });
      return res.ok({
        total: numeral(response.hits.total).format('0,0'),
        hits: hits,
        perPage: perPage,
        currentPage: page,
        prevPageUrl: req.path + '?' + querystring.stringify(prevPageQuery),
        nextPageUrl: req.path + '?' + querystring.stringify(nextPageQuery),
        striptags: striptags,
        pageTitle: 'Search Results'
      }, 'search/keyword_result.ejs');
    });

  },

  packageSearch: function(req,res){
    var query = req.param('q');
    var page = parseInt(req.param('page')) || 1;
    var perPage = parseInt(req.param('perPage')) || 10;
    var offset = (page - 1) * perPage;

    return es.search({
      index: 'rdoc',
      body: {
        query: {
          bool: {
            filter:[
              {
                type : {
                  value : "package_version"
                }
              },
              { term: { latest_version: 1 } }
            ],
            should:[
              {
                multi_match: {
                  query: query,
                  type: "best_fields",
                  fields: ['package_name^6', 'title^4', 'maintainer.name^4', 'collaborators.name^3', 'description^3', 'license', 'url', 'copyright']
                },
              },
              {
                "has_parent" : {
                  "query" : {
                    "function_score" : {
                      "functions": [
                        {
                          "filter": { "missing" : { "field" : "part_of_r" } },
                          "field_value_factor": {
                            "field":    "last_month_downloads",
                            "modifier": "log1p"
                          }
                        },
                        {
                          "filter": { "term" : { "part_of_r" : 0 } },
                          "field_value_factor": {
                            "field":    "last_month_downloads",
                            "modifier": "log1p"
                          }
                        },
                        {
                          "filter": {  "term" : { "part_of_r" : 1 } },
                          "field_value_factor": {
                            "field":    "part_of_r",
                            "modifier": "log1p",
                            "factor": 300000,
                          }
                        }
                      ],
                      "boost_mode": "replace"
                    }
                  },

                  "parent_type" : "package",
                  "score_mode" : "score"
                }
              }
            ],
            minimum_should_match : 1,
          }
        },
        highlight : {
          pre_tags : ["<mark>"],
          post_tags : ["</mark>"],
          "require_field_match": false,
          "fields" : {
            "description": {
              "number_of_fragments" : 0,
              highlight_query: {
                match: { description: query }
              }
            }
          }
        },
        from: offset,
        size: perPage,
        fields: ['package_name', 'version', 'description', 'maintainer.name']
      }
    }).then(function(result){
      var packages  = [];
      result.hits.hits.forEach(function(hit) {
          var fields = {};
          fields.package_name = hit.fields.package_name[0];
          fields.version = hit.fields.version[0];
          fields.maintainer = hit.fields['maintainer.name'];
          var highlights = _.mapValues(hit.highlight, function(highlight) {
            return striptags(highlight.toString(),'<mark>');
          });

          var description = highlights.description || hit.fields.description[0];

          packages.push({
            description: description,
            fields: fields,
            score: hit._score
          });
        });
      res.locals.layout = null;
      return res.view('search/package_results.ejs', { data: {packages: packages, hits: numeral(result.hits.total).format('0,0')}});
    }).catch(function(err) {
      return res.negotiate(err);
    });
  },

  functionSearch: function(req,res){
    var query = req.param('q');
    var page = parseInt(req.param('page')) || 1;
    var perPage = parseInt(req.param('perPage')) || 10;
    var offset = (page - 1) * perPage;
    var searchTopicQuery = {
      multi_match: {
        query: query,
        type: "best_fields",
        boost: 0.7,
        fields: [
          'aliases^6',
          'name^2',
          'title^2', 'description', 'keywords^2',
          'arguments.name', 'arguments.description',
          'details', 'value',
          'note', 'author']
      }
    };
    return es.search({
      index: 'rdoc',
      body: {
        query: {
          bool : {
            should : [
              {
                bool: {
                  filter:[
                    {
                      type : {
                        value : "topic"
                      }
                    },
                    {
                      has_parent : {
                        parent_type : "package_version",
                        query : {  term : { latest_version : 1 } },
                        inner_hits : { fields: ['package_name', 'version', 'latest_version', 'maintainer.name'] }
                      }
                    }
                  ],
                  should: [
                    searchTopicQuery,
                    {
                      has_parent : {
                        parent_type : "package_version",
                        score_mode: "score",

                        query : {
                          "has_parent" : {
                            "parent_type" : "package",
                            "score_mode" : "score",
                            "query" : {
                              "function_score" : {
                                "functions": [
                                  {
                                    "filter": { "missing" : { "field" : "part_of_r" } },
                                    "field_value_factor": {
                                      "field":    "last_month_downloads",
                                      "modifier": "log1p"
                                    }
                                  },
                                  {
                                    "filter": { "term" : { "part_of_r" : 0 } },
                                    "field_value_factor": {
                                      "field":    "last_month_downloads",
                                      "modifier": "log1p"
                                    }
                                  },
                                  {
                                    "filter": { "term" : { "part_of_r" : 1 } },
                                    "field_value_factor": {
                                      "field":    "part_of_r",
                                      "modifier": "log1p",
                                      "factor": 300000,
                                    }
                                  }
                                ],
                                "boost_mode": "replace"
                              }
                            }
                          }
                        }
                      }
                    }
                  ],
                  minimum_should_match : 1,
                }
              }],
            minimum_should_match : 1,
          }
        },
        highlight : {
          pre_tags : ["<mark>"],
          post_tags : ["</mark>"],
          "fields" : {
            "description": {
               "number_of_fragments" : 0,
               highlight_query: searchTopicQuery
             },
            "title" : {
               "number_of_fragments" : 0,
               highlight_query: searchTopicQuery},
          }
        },
        from: offset,
        size: perPage,
        fields: ['package_name', 'version', 'name', 'maintainer.name', 'description', 'title']
      }
    }).then(function(result){
      var functions  = [];
      result.hits.hits.forEach(function(hit) {
          var fields = {};
          var inner_hits_fields = hit.inner_hits.package_version.hits.hits[0].fields;
          fields.package_name = inner_hits_fields.package_name[0];
          fields.version = inner_hits_fields.version[0];
          fields.name = hit.fields.name[0];
          fields.maintainer = inner_hits_fields['maintainer.name'][0];

          var highlights = _.mapValues(hit.highlight, function(highlight) {
            return striptags(highlight.toString(),'<mark>');
          });

          var description = highlights.description || hit.fields.description[0];
          var title = highlights.title || hit.fields.title[0];

          functions.push({
            fields: fields,
            score: hit._score,
            description: description,
            title: title
          });
        });
      res.locals.layout = null;
      return res.view('search/function_results.ejs', {data: {functions: functions, hits: numeral(result.hits.total).format('0,0')}});
    }).catch(function(err) {
        return res.negotiate(err);
    });
  },


  fullSearch: function(req, res) {
    return res.ok({query: req.param('q'),current: req.path+ '?' +querystring.stringify(req.query)},'search/result.ejs');
  }

};
