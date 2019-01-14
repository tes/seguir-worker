/**
 * A worker will listen for jobs on the job queue, and execute them.
 */
var async = require('async');

function bootstrapWorker (api, next) {
  var follower = function (cb) {
    api.messaging.listen('seguir-publish-to-followers', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, type: data.type };
      api.logger.info('Started processing publish-to-followers message', dataToLog);
      api.feed.insertFollowersTimeline(data, function () {
        api.logger.info('Finished publish-to-followers processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  var members = function (cb) {
    api.messaging.listen('seguir-publish-to-members', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, type: data.type };
      api.logger.info('Started processing publish-to-members message', dataToLog);
      api.feed.insertMembersTimeline(data, function () {
        api.logger.info('Finished publish-to-members processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  var removeMembers = function (cb) {
    api.messaging.listen('seguir-remove-members', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, jobGroup: data.group, type: data.type };
      api.logger.info('Started processing seguir-remove-members message', dataToLog);
      api.group.removeMembers(data, function () {
        api.logger.info('Finished seguir-remove-members processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  var interestedUsers = function (cb) {
    api.messaging.listen('seguir-publish-to-interested-users', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, jobInterest: data.interest, type: data.type };
      api.logger.info('Started processing seguir-publish-to-interested-users message', dataToLog);
      api.feed.insertInterestedUsersTimelines(data, function () {
        api.logger.info('Finished publish-to-interested-users processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  var mentions = function (cb) {
    api.messaging.listen('seguir-publish-mentioned', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, jobType: data.type };
      api.logger.info('Processing publish-mentioned message', dataToLog);
      api.feed.insertMentionedTimeline(data, function () {
        api.logger.info('Finished publish-to-mentioned processing', dataToLog);
      });
      listenerCallback();
    }, cb);
  };

  async.series([
    follower,
    members,
    removeMembers,
    interestedUsers,
    mentions
  ], function () {
    api.logger.info('Seguir worker ready for work ...');
    return next && next();
  });
}

/* istanbul ignore if */
if (require.main === module) {
  var config = require('./config')();
  require('seguir')(config, function (err, api) {
    if (err) { return process.exit(0); }
    bootstrapWorker(api);
  });
} else {
  module.exports = function (config, logger, statsd, next) {
    if (!next) { next = statsd; statsd = undefined; }
    if (!next) { next = logger; logger = undefined; }

    require('seguir')(config, logger, statsd, function (err, api) {
      if (err) {
        return next(new Error('Unable to bootstrap API: ' + err.message));
      }
      return bootstrapWorker(api, next);
    });
  };
}
