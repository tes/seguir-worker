/**
 * A worker will listen for jobs on the job queue, and execute them.
 */
var async = require('async');
var restify = require('restify');
var bunyan = require('bunyan');

function bootstrapWorker (api, config, next) {
  var logger = config.logger || bunyan.createLogger({
    name: 'seguir',
    serializers: restify.bunyan.serializers
  });

  var follower = function (cb) {
    api.messaging.listen('seguir-publish-to-followers', function (data, listenerCallback) {
      var dataToLog = {jobUser: data.user, type: data.type};
      logger.info('Started processing publish-to-followers message', dataToLog);
      api.feed.insertFollowersTimeline(data, function () {
        logger.info('Finished publish-to-followers processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  var mentions = function (cb) {
    api.messaging.listen('seguir-publish-mentioned', function (data, listenerCallback) {
      var dataToLog = {jobUser: data.user, jobType: data.type};
      logger.info('Processing publish-mentioned message', dataToLog);
      api.feed.insertMentionedTimeline(data, function () {
        logger.info('Finished publish-to-mentioned processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  async.series([
    follower,
    mentions
  ], function () {
    console.log('Seguir worker ready for work ...');
    return next && next();
  });
}

/* istanbul ignore if */
if (require.main === module) {
  var config = require('./config')();
  require('seguir')(config, function (err, api) {
    if (err) { return process.exit(0); }
    bootstrapWorker(api, config);
  });
} else {
  // Used for testing
  module.exports = function (config, next) {
    require('seguir')(config, function (err, api) {
      if (err) {
        return next(new Error('Unable to bootstrap API: ' + err.message));
      }
      return bootstrapWorker(api, config, next);
    });
  };
}
