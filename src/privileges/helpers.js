
'use strict';

var async = require('async'),
	db = require('../database'),
	meta = require('../meta'),
	user = require('../user'),
	groups = require('../groups'),
	categories = require('../categories');

var helpers = {};

helpers.some = function(tasks, callback) {
	async.some(tasks, function(task, next) {
		task(function(err, result) {
			next(!err && result);
		});
	}, function(result) {
		callback(null, result);
	});
};

helpers.isUserAllowedTo = function(privilege, uid, cids, callback) {
	if (parseInt(uid, 10) === 0) {
		return isGuestAllowedTo(privilege, cids, callback);
	}

	var userKeys = [], groupKeys = [];
	for (var i=0; i<cids.length; ++i) {
		userKeys.push('cid:' + cids[i] + ':privileges:' + privilege);
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	async.parallel({
		hasUserPrivilege: function(next) {
			groups.isMemberOfGroups(uid, userKeys, next);
		},
		hasGroupPrivilege: function(next) {
			groups.isMemberOfGroupsList(uid, groupKeys, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i=0; i<cids.length; ++i) {
			result.push(results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
};

helpers.isUsersAllowedTo = function(privilege, uids, cid, callback) {
	async.parallel({
		hasUserPrivilege: function(next) {
			groups.isMembers(uids, 'cid:' + cid + ':privileges:' + privilege, next);
		},
		hasGroupPrivilege: function(next) {
			groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:' + privilege, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for(var i=0; i<uids.length; ++i) {
			result.push(results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
};

function isGuestAllowedTo(privilege, cids, callback) {
	var groupKeys = [];
	for (var i=0; i<cids.length; ++i) {
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	groups.isMemberOfGroups('guests', groupKeys, callback);
}

helpers.hasEnoughReputationFor = function(privilege, uid, callback) {
	if (parseInt(meta.config['privileges:disabled'], 10) || !parseInt(uid, 10)) {
		return callback(null, false);
	}

	user.getUserField(uid, 'reputation', function(err, reputation) {
		if (err) {
			return callback(null, false);
		}

		reputation = parseInt(reputation, 10);

		if (Array.isArray(privilege)) {
			for(var i=0; i<privilege.length; ++i) {
				if (reputation >= parseInt(meta.config[privilege[i]], 10)) {
					return callback(null, true);
				}
			}

			callback(null, false);
		} else {
			callback(null, reputation >= parseInt(meta.config[privilege], 10));
		}
	});
};

module.exports = helpers;