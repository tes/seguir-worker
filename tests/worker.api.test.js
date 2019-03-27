/**
 * Acceptance test the Cassandra API directly.
 */

/* eslint-env node, mocha */
var expect = require('expect.js');
var async = require('async');
var seguir = require('seguir');
var config = require('../config')();
var worker = require('../');

describe('Worker Processing', function () {
  var api;
  var users = [];
  var postId;
  var mentionPostId;
  var followId;

  var logger = { info: function () {} };
  var statsd = { increment: function () {} };

  this.timeout(20000);
  this.slow(5000);

  before(function (done) {
    config.keyspace = 'test_seguir_app_worker';
    seguir(config, function (err, seguirApi) {
      expect(err).to.be(null);
      api = seguirApi;
      api.client.setup.setupTenant(api.client, config.keyspace, function (err) {
        expect(err).to.be(undefined);
        api.migrations.getMigrationsToApplyToKeyspace(config.keyspace, 'tenant', (err, migrations) => {
          if (err) { return done(err); }
          api.migrations.applyMigrations(migrations, (err) => {
            if (err) { return done(err); }
            worker(config, logger, statsd, done);
          });
        });
      });
    });
  });

  after(function (done) {
    api.client._client.shutdown(function () {
      done();
      process.exit();
    });
  });

  describe('users', function () {
    it('can create users', function (done) {
      async.map([
        { username: 'cliftonc', altid: '1' },
        { username: 'phteven', altid: '2' },
        { username: 'ted', altid: '3' }
      ], function (user, cb) {
        api.user.addUser(config.keyspace, user.username, user.altid, { userdata: { 'age': 15 } }, cb);
      }, function (err, results) {
        expect(err).to.be(null);
        users = results;
        done(err);
      });
    });
  });

  describe('follows', function () {
    it('can follow a user who is not a friend', function (done) {
      api.follow.addFollower(config.keyspace, users[0].user, users[1].user, Date.now(), api.visibility.PUBLIC, function (err, follow) {
        expect(err).to.be(null);
        expect(follow.user).to.eql(users[0]);
        expect(follow.user_follower).to.eql(users[1]);
        followId = follow.follow;
        done();
      });
    });
  });

  describe('posts', function () {
    it('can post a message from a user', function (done) {
      api.post.addPost(config.keyspace, users[0].user, 'Hello, this is a post', 'text/html', Date.now(), api.visibility.PUBLIC, function (err, post) {
        expect(err).to.be(null);
        expect(post.content).to.be('Hello, this is a post');
        expect(post.user).to.eql(users[0]);
        postId = post.post;
        done();
      });
    });

    it('you can mention someone in a post', function (done) {
      api.post.addPost(config.keyspace, users[2].user, 'Hello, this is a post mentioning @cliftonc, not from a follower', 'text/html', Date.now(), api.visibility.PUBLIC, function (err, post) {
        expect(err).to.be(null);
        expect(post.content).to.be('Hello, this is a post mentioning @cliftonc, not from a follower');
        mentionPostId = post.post;
        done();
      });
    });

    it('you can create and delete a post', function (done) {
      api.post.addPost(config.keyspace, users[0].user, 'This is a short lived post', 'text/html', Date.now(), api.visibility.PUBLIC, function (err, post) {
        expect(err).to.be(null);
        setTimeout(function () {
          api.post.removePost(config.keyspace, users[0].user, post.post, function (err, result) {
            expect(err).to.be(null);
            expect(result.status).to.be('removed');
            done();
          });
        }, 1000);
      });
    });
  });

  describe('feeds', function () {
    it('logged in-can get a feed for yourself that is in the correct order', function (done) {
      setTimeout(function () {
        api.feed.getFeed(config.keyspace, users[0].user, users[0].user, function (err, { feed }) {
          expect(err).to.be(null);
          expect(feed[2].follow).to.eql(followId);
          expect(feed[1].post).to.eql(postId);
          expect(feed[0].post).to.eql(mentionPostId);
          done();
        });
      }, 500);
    });
  });
});
