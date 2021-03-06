/**
 * A worker will listen for jobs on the job queue, and execute them.
 */
var async = require('async');

function bootstrapWorker (api, next) {
  var follower = function (cb) {
    api.messaging.listen('seguir-publish-to-followers', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, type: data.type };
      api.logger.info('Started processing publish-to-followers message', dataToLog);
      api.feed.insertFollowersTimeline(data, function (error) {
        if (error) {
          api.logger.error('Failed to process publish-to-followers', dataToLog);
        } else {
          api.logger.info('Finished publish-to-followers processing', dataToLog);
        }
      });
      listenerCallback();
    }, cb);
  };

  var members = function (cb) {
    api.messaging.listen('seguir-publish-to-members', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, type: data.type };
      api.logger.info('Started processing publish-to-members message', dataToLog);
      api.feed.insertMembersTimeline(data, function (error) {
        if (error) {
          api.logger.error('Failed to process publish-to-members', dataToLog);
        } else {
          api.logger.info('Finished publish-to-members processing', dataToLog);
        }
      });
      listenerCallback();
    }, cb);
  };

  var removeMembers = function (cb) {
    api.messaging.listen('seguir-remove-members', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, jobGroup: data.group, type: data.type };
      api.logger.info('Started processing remove-members message', dataToLog);
      api.group.removeMembers(data, function (error) {
        if (error) {
          api.logger.error('Failed to process remove-members', dataToLog);
        } else {
          api.logger.info('Finished remove-members processing', dataToLog);
        }
      });
      listenerCallback();
    }, cb);
  };

  var interestedUsers = function (cb) {
    api.messaging.listen('seguir-publish-to-interested-users', { maxReceiveCount: 1, invisibletime: 86400, timeout: 0 }, function (jobData, listenerCallback) {
      api.feed.insertInterestedUsersTimelines(jobData, function (error) {
        if (error) {
          listenerCallback(error);
        } else {
          listenerCallback();
        }
      });
    }, cb);
  };

  var mentions = function (cb) {
    api.messaging.listen('seguir-publish-mentioned', function (data, listenerCallback) {
      var dataToLog = { jobUser: data.user, jobType: data.type };
      api.logger.info('Processing publish-mentioned message', dataToLog);
      api.feed.insertMentionedTimeline(data, function (error) {
        if (error) {
          api.logger.error('Failed to process publish-mentioned', dataToLog);
        } else {
          api.logger.info('Finished publish-mentioned processing', dataToLog);
        }
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
