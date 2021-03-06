'use strict';

const chado = require('chado');
const cb = chado.callback;
const verify = chado.verify;

const sinon = require('sinon').sandbox.create();
const expect = require('must-dist');
const moment = require('moment-timezone');

const conf = require('../../testutil/configureForTest');
const beans = conf.get('beans');
const reservedURLs = conf.get('reservedActivityURLs');

const activitiesService = beans.get('activitiesService');
const activitystore = beans.get('activitystore');
const groupsService = beans.get('groupsService');
const groupstore = beans.get('groupstore');
const memberstore = beans.get('memberstore');
const membersService = beans.get('membersService');

const Activity = beans.get('activity');
const Member = beans.get('member');
const Group = beans.get('group');
const notifications = beans.get('notifications');

const dummyActivity = new Activity({
  title: 'Title of the Activity',
  description: 'description',
  assignedGroup: 'assignedGroup',
  location: 'location',
  direction: 'direction',
  startDate: '01.01.2013',
  url: 'urlOfTheActivity',
  color: 'aus Gruppe'
});

const group = new Group({id: 'groupname', longName: 'Buxtehude'});

function waitinglistMembersOf(activity) {
  /* eslint no-underscore-dangle: 0 */
  return activity.allWaitinglistEntries().map(entry => entry.state).map(state => state._memberId);
}

function activityWithEinzelzimmer(ressource) {
  const state = {resources: {Veranstaltung: ressource}};
  const activity = new Activity(state);
  sinon.stub(activitystore, 'saveActivity', (id, callback) => { callback(null); });
  sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, activity); });
  sinon.stub(activitystore, 'getActivityForId', (id, callback) => { callback(null, activity); });
  return activity;
}

describe('Activities Service', () => {

  beforeEach(() => {
    //sinon.stub(membersService, 'getImage', function(member, callback) { callback(); });

    sinon.stub(activitystore, 'allActivities', callback => {callback(null, [dummyActivity]); });

    sinon.stub(groupsService, 'getAllAvailableGroups', callback => {
      callback(null, [
        {id: 'assignedGroup', longName: 'The name of the assigned Group'}
      ]);
    });
    sinon.stub(groupsService, 'allGroupColors', callback => {
      const result = {};
      result.assignedGroup = '#123456';
      callback(null, result);
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns the queried activities and enhances them with their color and group name', () => {
    activitiesService.getActivitiesForDisplay(activitystore.allActivities, (err, activities) => {
      expect(err).to.not.exist();
      expect(activities.length).to.equal(1);
      const activity = activities[0];
      expect(activity.title()).to.equal('Title of the Activity');
      expect(activity.colorRGB).to.equal('#123456');
      expect(activity.groupName()).to.equal('The name of the assigned Group');
    });
  });

  it('returns an activity and enhances it with its group and visitors', done => {
    const member1 = new Member({
      id: 'memberId1',
      nickname: 'participant1',
      email: 'nick1@b.c',
      firstname: 'Firstname1',
      lastname: 'Lastname1'
    });
    const member2 = new Member({
      id: 'memberId2',
      nickname: 'participant2',
      email: 'nick2@b.c',
      firstname: 'Firstname2',
      lastname: 'Lastname2'
    });
    const owner = new Member({id: 'ownerId', nickname: 'owner', email: 'a@b.c'});

    const emptyActivity = new Activity({
      title: 'Title of the Activity',
      url: 'urlOfTheActivity',
      assignedGroup: 'groupname',
      owner: 'ownerId'
    });

    sinon.stub(activitystore, 'getActivity', (activityId, callback) => { callback(null, emptyActivity); });
    sinon.stub(memberstore, 'getMembersForIds', (ids, callback) => {
      const memberA = new Member({
        id: 'memberId1',
        nickname: 'participant1',
        email: 'nick1@b.c',
        firstname: 'Firstname1',
        lastname: 'Lastname1'
      });
      const memberB = new Member({
        id: 'memberId2',
        nickname: 'participant2',
        email: 'nick2@b.c',
        firstname: 'Firstname2',
        lastname: 'Lastname2'
      });

      callback(null, [memberA, memberB]);
    });
    sinon.stub(membersService, 'putAvatarIntoMemberAndSave', (member, callback) => {callback();});
    sinon.stub(memberstore, 'getMemberForId', (id, callback) => {
      callback(null, owner);
    });
    sinon.stub(groupstore, 'getGroup', (groupname, callback) => {
      if (groupname === 'groupname') {
        return callback(null, group);
      }
      return callback(null, null);
    });

    const expectedActivity = new Activity({
      title: 'Title of the Activity',
      url: 'urlOfTheActivity',
      assignedGroup: 'groupname',
      owner: 'ownerId'
    });

    // following are the expected enrichements of the activity
    expectedActivity.group = group;
    expectedActivity.participants = [member1, member2];
    expectedActivity.ownerNickname = 'owner';

    verify('activitiesService')
      .canHandle('getActivityWithGroupAndParticipants')
      .withArgs('urlOfTheActivity', cb)
      .andCallsCallbackWith(null, expectedActivity)
      .on(activitiesService, done);
  });

  describe('checks the validity of URLs and', () => {

    it('does not allow the URL \'edit\'', done => {
      verify('activitiesService')
        .canHandle('isValidUrl')
        .withArgs(reservedURLs, 'edit', cb)
        .andCallsCallbackWith(null, false)
        .on(activitiesService, done);
    });

    it('allows the untrimmed URL \'uhu\'', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, null); });
      verify('activitiesService')
        .canHandle('isValidUrl')
        .withArgs(reservedURLs, 'uhu', cb)
        .andCallsCallbackWith(null, true)
        .on(activitiesService, done);
    });

    it('does not allow a URL containing a "/"', done => {
      verify('activitiesService')
        .canHandle('isValidUrl')
        .withArgs(reservedURLs, 'legal/egal', cb)
        .andCallsCallbackWith(null, false)
        .on(activitiesService, done);
    });
  });

  describe('- when adding a visitor -', () => {

    beforeEach(() => {
      sinon.stub(activitystore, 'saveActivity', (id, callback) => { callback(null); });
      sinon.stub(notifications, 'visitorRegistration');
    });

    function activityWithAddMemberIdReturning(truthValue) {
      return {addMemberId: () => truthValue};
    }

    it('does not show a status message when member addition succeeds', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, activityWithAddMemberIdReturning(true)); });

      activitiesService.addVisitorTo('memberId', 'activity-url', moment(), (err, statusTitle, statusText) => {
        expect(statusTitle).to.not.exist();
        expect(statusText).to.not.exist();
        done(err);
      });
    });

    it('shows a status message when member addition fails', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, activityWithAddMemberIdReturning(false)); });

      activitiesService.addVisitorTo('memberId', 'activity-url', moment(), (err, statusTitle, statusText) => {
        expect(statusTitle).to.be('activities.registration_not_now');
        expect(statusText).to.be('activities.registration_not_possible');
        done(err);
      });
    });

    it('notifies of the registration when member addition succeeds', done => {
      const activity = activityWithAddMemberIdReturning(true);
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, activity); });

      activitiesService.addVisitorTo('memberId', 'activity-url', moment(), err => {
        expect(notifications.visitorRegistration.calledOnce).to.be(true);
        expect(notifications.visitorRegistration.firstCall.args[0]).to.eql(activity);
        expect(notifications.visitorRegistration.firstCall.args[1]).to.equal('memberId');
        done(err);
      });
    });

    it('does not notify of the registration when member addition fails', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(null, activityWithAddMemberIdReturning(false)); });

      activitiesService.addVisitorTo('memberId', 'activity-url', moment(), err => {
        expect(notifications.visitorRegistration.called).to.be(false);
        done(err);
      });
    });

    it('gives an error when activity could not be loaded', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(new Error('error')); });

      activitiesService.addVisitorTo('memberId', 'activity-url', moment(), err => {
        expect(err).to.exist();
        done(); // error condition - do not pass err
      });
    });
  });

  describe('- when removing a visitor -', () => {

    it('succeeds when registration is open', done => {
      const activity = activityWithEinzelzimmer({
        _registrationOpen: true,
        _registeredMembers: [
          {memberId: 'memberId'},
          {memberId: 'otherId'}
        ]
      });
      sinon.stub(notifications, 'visitorUnregistration');

      activitiesService.removeVisitorFrom('memberId', 'activity-url', err => {
        expect(activity.allRegisteredMembers()).to.not.contain('memberId');
        expect(activity.allRegisteredMembers()).to.contain('otherId');
        done(err);
      });
    });

    it('succeeds when registration is not open', done => {
      const activity = activityWithEinzelzimmer({
        _registrationOpen: false,
        _registeredMembers: [
          {memberId: 'memberId'},
          {memberId: 'otherId'}
        ]
      });
      sinon.stub(notifications, 'visitorUnregistration');

      activitiesService.removeVisitorFrom('memberId', 'activity-url', err => {
        expect(activity.allRegisteredMembers()).to.not.contain('memberId');
        expect(activity.allRegisteredMembers()).to.contain('otherId');
        done(err);
      });
    });

    it('notifies of the unregistration', done => {
      const activity = activityWithEinzelzimmer({
        _registrationOpen: true,
        _registeredMembers: [
          {memberId: 'memberId'},
          {memberId: 'otherId'}
        ]
      });
      sinon.stub(notifications, 'visitorUnregistration');

      activitiesService.removeVisitorFrom('memberId', 'activity-url', err => {
        expect(notifications.visitorUnregistration.calledOnce).to.be(true);
        expect(notifications.visitorUnregistration.firstCall.args[0]).to.eql(activity);
        expect(notifications.visitorUnregistration.firstCall.args[1]).to.equal('memberId');
        done(err);
      });
    });

    it('gives an error when activity could not be loaded', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(new Error('error')); });

      activitiesService.removeVisitorFrom('memberId', 'activity-url', err => {
        expect(err, 'Error').to.exist();
        done(); // error condition - do not pass err
      });
    });
  });

  describe('- when adding somebody to the waitinglist -', () => {

    it('succeeds when resource has a waitinglist', done => {
      const activity = activityWithEinzelzimmer({_waitinglist: []});
      sinon.stub(notifications, 'waitinglistAddition');

      activitiesService.addToWaitinglist('memberId', 'activity-url', moment(), (err, statusTitle, statusText) => {
        expect(statusTitle, 'Status Title').to.not.exist();
        expect(statusText, 'Status Text').to.not.exist();
        const waitinglistMembers = waitinglistMembersOf(activity);
        expect(waitinglistMembers).to.contain('memberId');
        done(err);
      });
    });

    it('notifies of the waitinglist addition', done => {
      const activity = activityWithEinzelzimmer({_waitinglist: []});
      sinon.stub(notifications, 'waitinglistAddition');

      activitiesService.addToWaitinglist('memberId', 'activity-url', moment(), err => {
        expect(notifications.waitinglistAddition.calledOnce).to.be(true);
        expect(notifications.waitinglistAddition.firstCall.args[0]).to.eql(activity);
        expect(notifications.waitinglistAddition.firstCall.args[1]).to.equal('memberId');
        done(err);
      });
    });

    it('gives a status message when there is no waitinglist', done => {
      const activity = activityWithEinzelzimmer({});

      activitiesService.addToWaitinglist('memberId', 'activity-url', moment(), (err, statusTitle, statusText) => {
        expect(statusTitle, 'Status Title').to.equal('activities.waitinglist_not_possible');
        expect(statusText, 'Status Text').to.equal('activities.no_waitinglist');
        const waitinglistMembers = waitinglistMembersOf(activity);
        expect(waitinglistMembers).to.not.contain('memberId');
        done(err);
      });
    });

    it('gives an error when activity could not be loaded', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(new Error('error')); });

      activitiesService.addToWaitinglist('memberId', 'activity-url', moment(), err => {
        expect(err, 'Error').to.exist();
        done(); // error condition - do not pass err
      });
    });
  });

  describe('- when removing a waitinglist member -', () => {

    it('succeeds no matter whether registration is open or not', done => {
      const activity = activityWithEinzelzimmer({
        _waitinglist: [
          {_memberId: 'memberId'},
          {_memberId: 'otherId'}
        ]
      });
      sinon.stub(notifications, 'waitinglistRemoval');

      activitiesService.removeFromWaitinglist('memberId', 'activity-url', err => {
        const waitinglistMembers = waitinglistMembersOf(activity);
        expect(waitinglistMembers).to.not.contain('memberId');
        expect(waitinglistMembers).to.contain('otherId');
        done(err);
      });
    });

    it('notifies of the waitinglist removal', done => {
      const activity = activityWithEinzelzimmer({
        _registrationOpen: true,
        _registeredMembers: [
          {memberId: 'memberId'},
          {memberId: 'otherId'}
        ]
      });
      sinon.stub(notifications, 'waitinglistRemoval');

      activitiesService.removeFromWaitinglist('memberId', 'activity-url', err => {
        expect(notifications.waitinglistRemoval.calledOnce).to.be(true);
        expect(notifications.waitinglistRemoval.firstCall.args[0]).to.eql(activity);
        expect(notifications.waitinglistRemoval.firstCall.args[1]).to.equal('memberId');
        done(err);
      });
    });

    it('gives an error when activity could not be loaded', done => {
      sinon.stub(activitystore, 'getActivity', (id, callback) => { callback(new Error('error')); });

      activitiesService.removeFromWaitinglist('memberId', 'activity-url', err => {
        expect(err, 'Error').to.exist();
        done(); // error condition - do not pass err
      });
    });
  });

});
