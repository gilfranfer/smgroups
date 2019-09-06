//Mapping: /groups
okulusApp.controller('GroupsListCntrl',
	['$rootScope','$scope','$firebaseAuth','$location','GroupsSvc', 'AuthenticationSvc',
	function($rootScope,$scope,$firebaseAuth,$location,GroupsSvc,AuthenticationSvc){

		let unwatch = undefined;
		/* Executed everytime we enter to /groups
		  This function is used to confirm the user is Admin */
		$scope.response = {loading: true, message: systemMsgs.inProgress.loading };
		$firebaseAuth().$onAuthStateChanged(function(authUser){ if(authUser){
			AuthenticationSvc.loadSessionData(authUser.uid).$loaded().then( function(user){
				if(user.type == constants.roles.user){
					$rootScope.response = {error:true, showHomeButton: true, message:systemMsgs.error.noPrivileges};
					$location.path(constants.pages.error);
				}else{
					/*Load Group Counters and Set Watch*/
					$rootScope.groupsGlobalCount = GroupsSvc.getGlobalGroupsCounter();
					$rootScope.groupsGlobalCount.$loaded().then(
						function(groupsCount) {
							$scope.response = undefined;
							/* Adding a Watch to the groupsGlobalCount to detect changes.
							The idea is to update the maxPossible value from adminGroupsParams.*/
							if(unwatch){ unwatch(); }
							unwatch = $rootScope.groupsGlobalCount.$watch( function(data){
								if($rootScope.adminGroupsParams){
									let loader = $rootScope.adminGroupsParams.activeLoader;
									$rootScope.adminGroupsParams = getParamsByLoader(loader);
									$scope.response = undefined;
								}
							});
					});
				}
			});
		}});

		/* All the following on-demand loaders (called from html view) will limit the
		 initial result list to the maxQueryListResults value (from $rootScope.config).
		 They will create a params object containing the name of the loader used,
		 and determining the max possible records to display. */
		$scope.loadAllGroupsList = function () {
			$scope.response = {loading:true, message:systemMsgs.inProgress.loadingAllGroups};
			$rootScope.adminGroupsParams = getParamsByLoader("AllGroupsLoader");
			$rootScope.adminGroupsList = GroupsSvc.getAllGroups();
			whenGroupsRetrieved();
		};

		$scope.loadActiveGroupsList = function () {
 			$scope.response = {loading:true, message:systemMsgs.inProgress.loadingActiveGroups};
 			$rootScope.adminGroupsParams = getParamsByLoader("ActiveGroupsLoader");
 			$rootScope.adminGroupsList = GroupsSvc.getActiveGroups($rootScope.config.maxQueryListResults);
 			whenGroupsRetrieved();
		};

		$scope.loadInactiveGroupsList = function () {
 			$scope.response = {loading:true, message:systemMsgs.inProgress.loadingInactiveGroups};
 			$rootScope.adminGroupsParams = getParamsByLoader("InactiveGroupsLoader");
 			$rootScope.adminGroupsList = GroupsSvc.getInactiveGroups($rootScope.config.maxQueryListResults);
 			whenGroupsRetrieved();
		};

		/* Load ALL pending groups. Use the adminGroupsParams.activeLoader
		to determine what type of groups should be loaded, and how. */
		$scope.loadPendingGroups = function () {
			let loaderName = $rootScope.adminGroupsParams.activeLoader;
			$scope.response = {loading: true, message: systemMsgs.inProgress.loading };
			if(loaderName=="AllGroupsLoader"){
				$rootScope.adminGroupsList = GroupsSvc.getAllGroups();
			} else if(loaderName=="ActiveGroupsLoader"){
				$rootScope.adminGroupsList = GroupsSvc.getActiveGroups();
			} else if(loaderName=="InactiveGroupsLoader"){
				$rootScope.adminGroupsList = GroupsSvc.getInactiveGroups();
			}
			whenGroupsRetrieved();
		};

		/*Build object with Params used in the view.
		 activeLoader: Will help to identify what type of groups we want to load.
		 searchFilter: Container for the view filter
		 title: Title of the Groups List will change according to the loader in use
		 maxPossible: Used to inform the user how many elements are pending to load */
		getParamsByLoader = function (loaderName) {
			let params = {activeLoader:loaderName, searchFilter:undefined};
			if(loaderName == "AllGroupsLoader"){
				params.title= systemMsgs.success.allGroupsTitle;
				params.maxPossible = $rootScope.groupsGlobalCount.total;
			}
			else if(loaderName == "ActiveGroupsLoader"){
				params.title= systemMsgs.success.activeGroupsTitle;
				params.maxPossible = $rootScope.groupsGlobalCount.active;
			}
			else if(loaderName == "InactiveGroupsLoader"){
				params.title= systemMsgs.success.inactiveGroupsTitle;
				params.maxPossible = $rootScope.groupsGlobalCount.total - $rootScope.groupsGlobalCount.active;
			}
			return params;
		};

		/*Prepares the response after the groups list is loaded */
		whenGroupsRetrieved = function () {
			$rootScope.adminGroupsList.$loaded().then(function(groups) {
				$scope.response = undefined;
				$rootScope.groupResponse = null;
				if(!groups.length){
					$scope.response = { error: true, message: systemMsgs.error.noGroupsError };
				}
			}).catch( function(error){
				$scope.response = { error: true, message: systemMsgs.error.loadingGroupsError };
				console.error(error);
			});
		};

	}
]);

/* Controller linked to /mygroups
 * It will load the Groups the Current Member has Access to */
okulusApp.controller('GroupsUserCntrl',
	['$rootScope','$scope', '$location','$firebaseAuth','AuthenticationSvc', 'MembersSvc','GroupsSvc',
	function($rootScope,$scope,$location,$firebaseAuth,AuthenticationSvc,MembersSvc, GroupsSvc){
		$scope.response = {loading: true, message: systemMsgs.inProgress.loading};

		/* Executed everytime we enter to /mygroups
		  This function is used to confirm the user has an associated Member */
		$firebaseAuth().$onAuthStateChanged(function(authUser){
    	if(authUser){
				AuthenticationSvc.loadSessionData(authUser.uid).$loaded().then(function (user) {
					if(!user.memberId){
						$rootScope.response = {error: true, message: systemMsgs.error.noMemberAssociated};
						$location.path(constants.pages.error);
						return;
					}

					$rootScope.myGroupsList = new Array();
					//Get the Groups the user has access to
					MembersSvc.getAccessRulesList(user.memberId).$loaded().then(function(rules){
						rules.forEach(function(rule) {
							$rootScope.myGroupsList.push( GroupsSvc.getGroupBasicDataObject(rule.groupId) );
						});
					});

				});
			}
		});
	}
]);

/* Controller linked to /groups/view/:groupId and /groups/edit/:groupId
 * It will load the Group for the id passed */
okulusApp.controller('GroupDetailsCntrl',
['$rootScope','$scope','$routeParams','$location','$firebaseAuth',
 'GroupsSvc','MembersSvc','ConfigSvc','AuditSvc','AuthenticationSvc',
	function($rootScope, $scope, $routeParams, $location, $firebaseAuth,
		GroupsSvc, MembersSvc, ConfigSvc, AuditSvc, AuthenticationSvc){

		/* Init. Executed everytime we enter to /gorups/new, /groups/view/:groupId or /groups/edit/:groupId */
		$firebaseAuth().$onAuthStateChanged(function(authUser){ if(authUser){
			$scope.response = {loading: true, message: systemMsgs.inProgress.loadingGroup };
			$scope.objectDetails = {};
			AuthenticationSvc.loadSessionData(authUser.uid).$loaded().then(function (user) {
				/* Only Root and Valid Users (with an associated MemberId) can see the content */
				if($rootScope.currentSession.user.type != constants.roles.root && !user.memberId){
					$rootScope.response = {error: true, showHomeButton:true, message: systemMsgs.error.noMemberAssociated};
					$location.path(constants.pages.error);
					return;
				}

				$scope.countriesList = ConfigSvc.getCountriesList();
				$scope.grouptypesList = ConfigSvc.getGroupTypesArray();
				let groupId = $routeParams.groupId;
				/* Prepare for Edit or View Details of Existing Group */
				if(groupId){
					$scope.objectDetails.basicInfo = GroupsSvc.getGroupBasicDataObject(groupId);
					$scope.objectDetails.basicInfo.$loaded().then(function(group){
						//If group from DB hasn't name, is because no group was found
						if(!group.name){
							$rootScope.response = {error: true, message: systemMsgs.error.recordDoesntExist };
							$location.path(constants.pages.error);
							return;
						}

						$scope.statesList = ConfigSvc.getStatesForCountry(group.address.country);
						$scope.objectDetails.audit = GroupsSvc.getGroupAuditObject(groupId);
						$scope.objectDetails.roles = GroupsSvc.getGroupRolesObject(groupId);
						// $scope.objectDetails.access = GroupsSvc.getAccessRulesList(groupId);
						/*Address is already part of objectDetails.basicInfo.address (same date)
						But it is needed in this other object for the reusable address html fragments */
						$scope.objectDetails.address = GroupsSvc.getGroupAddressObject(groupId);
						$scope.prepareViewForEdit(group);
					}).catch( function(error){
						$rootScope.response = { error: true, message: error };
						$location.path(constants.pages.error);
					});
				}
				/* Prepare for Group Creation */
				else{
					$scope.prepareViewForNew();
				}
			});
		}});

		$scope.updateStatesList = function() {
			$scope.statesList = ConfigSvc.getStatesForCountry($scope.objectDetails.address.country);
		};

		$scope.prepareViewForEdit = function (groupObject) {
			$scope.groupEditParams = {};
			$scope.groupEditParams.actionLbl = $rootScope.i18n.groups.modifyLbl;
			$scope.groupEditParams.isEdit = true;
			$scope.groupEditParams.groupId = groupObject.$id;
			$scope.response = undefined;
		};

		$scope.prepareViewForNew = function () {
			$scope.groupEditParams = {};
			$scope.objectDetails.basicInfo = {};
			$scope.groupEditParams.actionLbl = $rootScope.i18n.groups.newLbl;
			$scope.groupEditParams.isEdit = false;
			$scope.groupEditParams.groupId = undefined;
			$scope.response = undefined;

			//Use config.location to set initial address details
			$scope.statesList = ConfigSvc.getStatesForCountry($scope.config.location.country);
			$scope.objectDetails.address = $scope.config.location;
		};

		$scope.saveGroup = function() {
			clearResponse();
			if($rootScope.currentSession.user.type != constants.roles.user){
				$scope.response = {working:true, message: systemMsgs.inProgress.savingGroupInfo};
				let groupId = $scope.groupEditParams.groupId;

				/*UPDATE Current Group */
				if($scope.objectDetails.basicInfo.$id){
					$scope.objectDetails.basicInfo.address = $scope.objectDetails.address;
					$scope.objectDetails.basicInfo.$save().then(function() {
						let description = systemMsgs.notifications.groupUpdated + $scope.objectDetails.basicInfo.name;
						AuditSvc.saveAuditAndNotify(constants.actions.update, constants.db.folders.groups, groupId, description);
						$scope.response = {success:true, message: systemMsgs.success.groupInfoSaved};
					});
				}
				/*CREATE A NEW GROUP, and redirect to /groups/edit/ */
				else{
					$scope.objectDetails.basicInfo.isActive = true;
					$scope.objectDetails.basicInfo.address = $scope.objectDetails.address;
					let newgroupRef = GroupsSvc.persistGroup($scope.objectDetails.basicInfo);
					GroupsSvc.getGroupBasicDataObject(newgroupRef.key).$loaded().then(function() {
						let description = systemMsgs.notifications.groupCreated + $scope.objectDetails.basicInfo.name;
						AuditSvc.saveAuditAndNotify(constants.actions.create, constants.db.folders.groups, newgroupRef.key, description );
						GroupsSvc.increaseTotalGroupsCount();
						GroupsSvc.increaseActiveGroupsCount();
						$rootScope.groupResponse = {created:true, message:systemMsgs.success.groupCreated };
						$location.path(constants.pages.groupEdit+newgroupRef.key);
					});
				}
			}
		};

		/* A group can be deleted by Admin , if not active, and if there are no reports associated to it.
		 When deleting a Group:
		  1. Delete from /groups/list
		  2. Delete from /groups/details
			3. Decrease the Groups total count
			4. Delete all references to this group from member/access
		*/
		$scope.deleteGroup = function() {
			clearResponse();
			let groupId = $scope.objectDetails.basicInfo.$id;
			let groupInfo = $scope.objectDetails.basicInfo;
			//A group cannot be deleted if isActive
			if(groupInfo.isActive){
				$scope.response = {deleteError:true, message: systemMsgs.error.deletingActiveGroup};
				return;
			}

			let deletedGroupName = groupInfo.name;
			if(groupInfo && $rootScope.currentSession.user.type != constants.roles.user){
				$scope.response = {working:true, message: systemMsgs.inProgress.deletingGroup};
				//Remove Group from groups/list
				let deletedGroupId = undefined;
				GroupsSvc.getGroupReportsList(groupId).$loaded().then(function(reports){
					if(reports.length){
						$scope.response = {deleteError:true, message: systemMsgs.error.groupHasReports};
					}else{
						return groupInfo.$remove();
					}
				})
				//After removing Group Basic Info
				.then(function(deletedGroupRef){
					deletedGroupId = deletedGroupRef.key;
					let description = systemMsgs.notifications.groupDeleted + deletedGroupName;
					AuditSvc.saveAuditAndNotify(constants.actions.delete, constants.db.folders.groups, deletedGroupId, description);
					GroupsSvc.decreaseTotalGroupsCount();
					return GroupsSvc.getAccessRulesList(deletedGroupId).$loaded();
				})
				//After loading Group access rules
				.then(function(accessList){
					MembersSvc.removeAccessRules(accessList);
					GroupsSvc.deleteGroupDetails(deletedGroupId);
					$rootScope.groupResponse = {deleted:true, message: systemMsgs.success.groupRemoved};
					$location.path(constants.pages.adminGroups);
				});
			}
		};

		/* Toogle the Group status.*/
		$scope.setGroupStatus = function(setGroupActive){
			clearResponse();
			if($rootScope.currentSession.user.type != constants.roles.user){
				let groupInfo = $scope.objectDetails.basicInfo;
				groupInfo.isActive = setGroupActive;
				let notificationDesc = undefined;
				if(setGroupActive){
					notificationDesc = systemMsgs.notifications.groupSetActive + groupInfo.name;
					GroupsSvc.increaseActiveGroupsCount();
				}else{
					notificationDesc = systemMsgs.notifications.groupSetInactive + groupInfo.name;
					GroupsSvc.decreaseActiveGroupsCount();
				}
				groupInfo.$save();
				AuditSvc.saveAuditAndNotify(constants.actions.update, constants.db.folders.groups, groupInfo.$id, notificationDesc );
				$scope.response = {success:true, message: systemMsgs.success.groupStatusUpdated};
			}
		};

		clearResponse = function() {
			$rootScope.groupResponse = null;
			$scope.response = null;
		};

		/*Called when change detected on time input*/
		$scope.updateTimeModel = function(){
			$scope.groupEditParams.timeUpdated = true;
			let schdTime = document.getElementById("schdTime").value;
			$scope.objectDetails.basicInfo.time = schdTime;
		};

		$scope.prepareForGroupLeadUpdate = function(){
			$scope.response = {working:true, message: systemMsgs.inProgress.loading};

			if(!$scope.groupEditParams.leadsList){
				$scope.groupEditParams.leadsList = MembersSvc.getLeadMembers();
			}
			$scope.groupEditParams.leadsList.$loaded().then(function(){
				clearResponse();
				$scope.groupEditParams.updatingGroupLead = true;
				$scope.groupEditParams.currentLeadId= $scope.objectDetails.roles.leadId;
			});
		};

		/* Persist the Groups's Lead Selection */
		$scope.updateGroupLead = function(){
			clearResponse();
			if($rootScope.currentSession.user.type != constants.roles.user){
				let newLeadRole = $scope.objectDetails.roles;
				if($scope.groupEditParams.currentLeadId == newLeadRole.leadId){
					$scope.groupEditParams.updatingGroupLead = false;
					return;
				}

				if(newLeadRole.leadId){
					let member = $scope.groupEditParams.leadsList.$getRecord(newLeadRole.leadId);
					newLeadRole.leadName = member.shortname;
				}else{
					newLeadRole.leadId = null;
					newLeadRole.leadName = null;
				}
				newLeadRole.$save().then(function() {
					let description = systemMsgs.notifications.groupLeadUpdated + " " + $scope.objectDetails.basicInfo.name;
					AuditSvc.saveAuditAndNotify(constants.actions.update, constants.db.folders.groups, $scope.objectDetails.basicInfo.$id, description );
					$scope.groupEditParams.updatingGroupLead = false;
					$scope.response = {success:true, message: systemMsgs.success.groupLeadUpdated};
				});
			}
		};

		$scope.prepareForGroupHostUpdate = function(){
			$scope.response = {working:true, message: systemMsgs.inProgress.loading};

			if(!$scope.groupEditParams.hostsList){
				$scope.groupEditParams.hostsList = MembersSvc.getHostMembers();
			}
			$scope.groupEditParams.hostsList.$loaded().then(function(){
				clearResponse();
				$scope.groupEditParams.updatingGroupHost = true;
				$scope.groupEditParams.currentHostId= $scope.objectDetails.roles.hostId;
			});
		};

		/*Persist the Groups's Host Selection */
		$scope.updateGroupHost = function(){
			clearResponse();
			if($rootScope.currentSession.user.type != constants.roles.user){
				let groupRoles = $scope.objectDetails.roles;
				if($scope.groupEditParams.currentHostId == groupRoles.hostId){
					$scope.groupEditParams.updatingGroupHost = false;
					return;
				}

				if(groupRoles.hostId){
					let member = $scope.groupEditParams.hostsList.$getRecord(groupRoles.hostId);
					groupRoles.hostName = member.shortname;
				}else{
					groupRoles.hostId = null;
					groupRoles.hostName = null;
				}
				groupRoles.$save().then(function() {
					let description = systemMsgs.notifications.groupHostUpdated + " " + $scope.objectDetails.basicInfo.name;
					AuditSvc.saveAuditAndNotify(constants.actions.update, constants.db.folders.groups, $scope.objectDetails.basicInfo.$id, description);
					$scope.groupEditParams.updatingGroupHost = false;
					$scope.response = {success:true, message: systemMsgs.success.groupHostUpdated};
				});
			}
		};

		$scope.prepareForGroupTraineeUpdate = function(){
			$scope.response = {working:true, message: systemMsgs.inProgress.loading};

			if(!$scope.groupEditParams.traineesList){
				$scope.groupEditParams.traineesList = MembersSvc.getTraineeMembers();
			}
			$scope.groupEditParams.traineesList.$loaded().then(function(){
				clearResponse();
				$scope.groupEditParams.updatingGroupTrainee = true;
				$scope.groupEditParams.currentTraineeId= $scope.objectDetails.roles.traineeId;
			});
		};

		/*Persist the Groups's Trainee Selection */
		$scope.updateGroupTrainee = function(){
			clearResponse();
			if($rootScope.currentSession.user.type != constants.roles.user){
				let groupRoles = $scope.objectDetails.roles;
				if($scope.groupEditParams.currentTraineeId == groupRoles.traineeId){
					$scope.groupEditParams.updatingGroupTrainee = false;
					return;
				}
				if(groupRoles.traineeId){
					let member = $scope.groupEditParams.traineesList.$getRecord(groupRoles.traineeId);
					groupRoles.traineeName = member.shortname;
				}else{
					groupRoles.traineeId = null;
					groupRoles.traineeName = null;
				}
				groupRoles.$save().then(function() {
					let description = systemMsgs.notifications.groupTraineeUpdated + " " + $scope.objectDetails.basicInfo.name;
					AuditSvc.saveAuditAndNotify(constants.actions.update, constants.db.folders.groups, $scope.objectDetails.basicInfo.$id, description);
					$scope.groupEditParams.updatingGroupTrainee = false;
					$scope.response = {success:true, message: systemMsgs.success.groupTraineeUpdated};
				});
			}
		};

	}
]);

okulusApp.factory('GroupsSvc',
['$rootScope', '$firebaseArray', '$firebaseObject',
	function($rootScope, $firebaseArray, $firebaseObject){

		let baseRef = firebase.database().ref().child(constants.db.folders.root);
		let groupListRef = baseRef.child(constants.db.folders.groupsList);
		let groupDetailsRef = baseRef.child(constants.db.folders.groupsDetails);
		let isActiveGroupRef = groupListRef.orderByChild(constants.status.isActive);
		//Deprecated
		let groupsRef = baseRef.child(constants.db.folders.groups);

		/*Using a Transaction with an update function to reduce the counter by 1 */
		let decreaseCounter = function(counterRef){
			counterRef.transaction(function(currentCount) {
				if(currentCount>0)
					return currentCount - 1;
				return currentCount;
			});
		};

		/*Using a Transaction with an update function to increase the counter by 1 */
		let increaseCounter = function(counterRef){
			counterRef.transaction(function(currentCount) {
				return currentCount + 1;
			});
		};

		return {
			getGlobalGroupsCounter: function(){
				return $firebaseObject(baseRef.child(constants.db.folders.groupsCounters));
			},
			/* Return all Groups, using a limit for the query, if specified*/
			getAllGroups: function(limit) {
					if(limit){
						return $firebaseArray(groupListRef.orderByKey().limitToLast(limit));
					}else{
						return $firebaseArray(groupListRef.orderByKey());
					}
			},
			/* Return all Groups with isActive:true, using a limit for the query, if specified*/
			getActiveGroups: function(limit) {
				if(limit){
					return $firebaseArray(isActiveGroupRef.equalTo(true).limitToLast(limit));
				}else{
					return $firebaseArray(isActiveGroupRef.equalTo(true));
				}
			},
			/* Return all Groups with isActive:false, using a limit for the query, if specified*/
			getInactiveGroups: function(limit) {
				if(limit){
					return $firebaseArray(isActiveGroupRef.equalTo(false).limitToLast(limit));
				}else{
					return $firebaseArray(isActiveGroupRef.equalTo(false));
				}
			},
			/* Get group basic info from firebase and return as object */
			getGroupBasicDataObject: function(whichGroupId){
				return $firebaseObject(groupListRef.child(whichGroupId));
			},
			/* Get group address from firebase and return as object */
			getGroupAddressObject: function(whichGroupId){
				return $firebaseObject(groupListRef.child(whichGroupId).child(constants.db.folders.address));
			},
			/* Get group audit from firebase and return as object */
			getGroupAuditObject: function(whichGroupId){
				return $firebaseObject(groupDetailsRef.child(whichGroupId).child(constants.db.folders.audit));
			},
			/* Get group roles from firebase and return as object */
			getGroupRolesObject: function(whichGroupId){
				return $firebaseObject(groupDetailsRef.child(whichGroupId).child(constants.db.folders.roles));
			},
			/* Get group roles from firebase and return as object */
			getGroupReportsList: function(whichGroupId){
				return $firebaseArray(groupDetailsRef.child(whichGroupId).child(constants.db.folders.reports));
			},
			/* Get the list of Access Rules that indicate the members with access to the group */
			getAccessRulesList: function(whichGroupId) {
				return $firebaseArray(groupDetailsRef.child(whichGroupId).child(constants.db.folders.accessRules));
			},
			/* Push Member Basic Details Object to Firebase*/
			persistGroup: function(groupObj){
				let ref = groupListRef.push();
				ref.set(groupObj);
				return ref;
			},
			/* Remove all Member details (Address, Audit, Access Rules, attendance, etc.)*/
			deleteGroupDetails:function(whichGroupId){
				groupDetailsRef.child(whichGroupId).set({});
			},
			/* Used when creating a Member */
			increaseTotalGroupsCount: function () {
				let conunterRef = baseRef.child(constants.db.folders.totalGroupsCount);
				increaseCounter(conunterRef);
			},
			/* Used when deleting a Member */
			decreaseTotalGroupsCount: function () {
				let conunterRef = baseRef.child(constants.db.folders.totalGroupsCount);
				decreaseCounter(conunterRef);
			},
			/* Called after setting the membership status "isActive" to True  */
			increaseActiveGroupsCount: function() {
				let conunterRef = baseRef.child(constants.db.folders.activeGroupsCount);
				increaseCounter(conunterRef);
			},
			/* Called after setting the membership status "isActive" to False  */
			decreaseActiveGroupsCount: function() {
				let conunterRef = baseRef.child(constants.db.folders.activeGroupsCount);
				decreaseCounter(conunterRef);
			},
			/* Called after Report Creation, to add some Report details in the
			 Group folder: /groups/details/:groupId/reports */
			addReportReferenceToGroup: function(report){
				let groupReportsFolder = groupDetailsRef.child(report.groupId).child(constants.db.folders.reports);
				groupReportsFolder.child(report.$id).set({
					reportId:report.$id, weekId:report.weekId,date:report.date
				});
			},
			/* Called when deleting Report, to remove the Report details from the
			 Group folder: /groups/details/:groupId/reports */
			removeReportReferenceFromGroup: function(groupId,reportId){
				let groupReportsFolder = groupDetailsRef.child(groupId).child(constants.db.folders.reports);
				groupReportsFolder.child(reportId).set(null);
			},
			//Deprecated
			removeReportReference: function(reportId,groupId){
				let ref = groupsRef.child(groupId).child("reports").child(reportId);
				ref.set(null);
			},
			/* Receives the member's access rules ( { accessRuleId: {groupId,groupName,date} , ...} ),
			and use them to delete the member's access to each of those groups.
			The accessRuleId is the same on groups/:gropuId/access/:accessRuleId
			and members/:memberId/access/:accessRuleId */
			removeAccessRules: function(accessList){
				if(accessList){
					accessList.forEach(function(accessRule) {
						groupDetailsRef.child(accessRule.groupId).child("access").child(accessRule.$id).set(null);
					});
				}
			}
		};//return end
	}
]);

//Mapping: /groups/access
okulusApp.controller('GroupAccessRulesCntrl',
	['$rootScope', '$scope','$routeParams', '$location','$firebaseAuth',
	'GroupsSvc', 'MembersSvc', 'AuditSvc','NotificationsSvc','AuthenticationSvc',
	function($rootScope, $scope,$routeParams, $location, $firebaseAuth,
		GroupsSvc, MembersSvc, AuditSvc, NotificationsSvc, AuthenticationSvc){

		$scope.response = {loading: true, message: systemMsgs.inProgress.loadingAccessRules};
		$firebaseAuth().$onAuthStateChanged( function(authUser){ if(authUser){
			AuthenticationSvc.loadSessionData(authUser.uid).$loaded().then(function(user) {
				if(user.type == constants.roles.user){
					$rootScope.response = { error:true, message:systemMsgs.error.noPrivileges};
					$location.path(constants.pages.error);
					return;
				}

				let whichGroup = $routeParams.groupId;
				$scope.group = GroupsSvc.getGroupBasicDataObject(whichGroup);

				$scope.group.$loaded().then(function(group){
					if(group.$value === null){
						$rootScope.response = { error:true, message:systemMsgs.error.inexistingGroup};
						$location.path(constants.pages.error);
						return;
					}
					/* else(!group.isActive){
						$rootScope.response = { error:true, message:systemMsgs.error.inactiveGroup};
						$location.path(constants.pages.error);
						return;
					}*/

					//Retrieve List of Members that have a User associated
					$scope.membersList = MembersSvc.getMembersWithUser();
					//Retrieve List of Users already having access (Some could be invalid Users)
					$scope.acessList = GroupsSvc.getAccessRulesList(whichGroup);
					$scope.response = null;
				});

			});
		}});

		$scope.addRule = function(){
			$scope.response = {working: true, message: systemMsgs.inProgress.creatingRule};

			let whichMember = $scope.access.memberId;
			let memberName = document.getElementById('userSelect').options[document.getElementById('userSelect').selectedIndex].text;
			let whichGroup = $scope.group.$id;
			let groupName = $scope.group.name;

			let ruleExists = false;
			//Review in the current Lists, if a similar rule already exist
			$scope.acessList.forEach(function(rule) {
					if(rule.memberId == whichMember){
						ruleExists = true;
					}
			});
			if(ruleExists){
				$scope.response = {error: true, message: systemMsgs.error.duplicatedRule};
				return;
			}

			let creationDate = firebase.database.ServerValue.TIMESTAMP;
			let record = { memberName: memberName, memberId: whichMember, date:creationDate};
			//Use the Group´s access list to add a new record
			$scope.acessList.$add(record).then(function(ref) {
				//Create cross Reference. The Member must have the same rule in members/details/:memberId/access
				record = { groupName:groupName, groupId: whichGroup, date:creationDate };
				MembersSvc.addAccessRuleToMember(whichMember,ref.key,record);
				//Send notification the User linked to the member that got the access
				MembersSvc.getMemberBasicDataObject(whichMember).$loaded().then(function(member){
					let description = member.shortname + " " + systemMsgs.notifications.gotAccessToGroup + groupName;
					AuditSvc.saveAuditAndNotify(constants.actions.grantAccess, constants.db.folders.groups, whichGroup, description);
					let notification = { description: description,
															action: constants.actions.grantAccess,
															onFolder: constants.db.folders.groups,
															onObject: whichGroup,	url:null };
					//Notify the request's creator about the rejection
					NotificationsSvc.notifyUser(member.userId, notification);
				});
				$scope.response = { success: true, message: systemMsgs.success.ruleCreated};
			}).catch( function(error){
				$scope.response = { error: true, message: systemMsgs.error.creatingRuleError };
				console.error(error);
			});
		};

		$scope.deleteRule = function(ruleId){
			$scope.response = {working: true, message: systemMsgs.inProgress.deletingRule};

			let whichGroup = $scope.group.$id;
			var ruleRecord = $scope.acessList.$getRecord(ruleId);
			let whichMember = ruleRecord.memberId;
			$scope.acessList.$remove(ruleRecord).then(function(ref) {
				//Remove the same rule from the Member's access folder
				MembersSvc.addAccessRuleToMember(whichMember,ref.key,null);
				//Send notification the User linked to the member that got the access
				MembersSvc.getMemberBasicDataObject(whichMember).$loaded().then(function(member){
					let description = member.shortname + " " + systemMsgs.notifications.lostAccessToGroup + groupName;
					AuditSvc.saveAuditAndNotify(constants.actions.revokeAccess, constants.db.folders.groups, whichGroup, description);
					let notification = { description: description,
															action: constants.actions.revokeAccess,
															onFolder: constants.db.folders.groups,
															onObject: whichGroup,	url:null };
					//Notify the request's creator about the rejection
					NotificationsSvc.notifyUser(member.userId, notification);
				});
				$scope.response = { success: true, message: systemMsgs.success.ruleRemoved};
			}).catch( function(error){
				$scope.response = { error: true, message: systemMsgs.error.deletingRuleError };
				console.error(error);
			});
		};

	}
]);
