okulusApp.factory('ErrorsSvc', ['$rootScope','$firebaseObject',
	function($rootScope,$firebaseObject){
		let baseRef = firebase.database().ref().child(constants.db.folders.root);
		let errorsRef = baseRef.child(constants.db.folders.errors);
		let counterRef = baseRef.child(constants.db.folders.errorsCount).child(constants.db.fields.systemErrors);

		/*Using a Transaction with an update function to reduce the counter by 1 */
		let decreaseUnreadErrorsCounter = function(){
			counterRef.transaction(function(systemErrors) {
				if(systemErrors>0)
					return systemErrors - 1;
				return systemErrors;
			});
		};

		/*Using a Transaction with an update function to increase the counter by 1 */
		let increaseUnreadErrorsCounter = function(){
			counterRef.transaction(function(systemErrors) {
				return systemErrors + 1;
			});
		};

		return {
			/*Add an error ecord in the DB, and increase the global error counter*/
			logError: function(errorMessage){
				console.error(errorMessage);
				let record = { error: errorMessage, date: firebase.database.ServerValue.TIMESTAMP,
											impactedUserId: $rootScope.currentSession.user.$id,
											impactedUserEmail: $rootScope.currentSession.user.email
										 };
		    errorsRef.push().set(record);
				increaseUnreadErrorsCounter();
			},
			updateErrorReadedStatus: function(errorId, isReaded){
				errorsRef.child(errorId).update({readed:isReaded});
				if(isReaded){
					decreaseUnreadErrorsCounter();
				}else{
					increaseUnreadErrorsCounter();
				}
			},
			/*Delete the error element, and reduce the counter */
			deleteErrorRecord: function(error){
				if(!error.readed){
					decreaseUnreadErrorsCounter();
				}
				errorsRef.child(error.$id).set({});
			},
			getGlobalErrorCounter: function(){
				return $firebaseObject(baseRef.child(constants.db.folders.errorsCount));
			},
		};
	}
]);

okulusApp.factory('UtilsSvc', ['$firebaseArray', '$firebaseObject', '$rootScope',
	function( $firebaseArray, $firebaseObject, $rootScope){
		let countersRef = firebase.database().ref().child(constants.db.folders.root).child(constants.db.folders.counters);

		return {
			buildDateJson: function(dateObject){
		    	let dateJson = null;
		    	if(dateObject){
		    		dateJson = { day:dateObject.getDate(),
							 month: dateObject.getMonth()+1,
							 year:dateObject.getFullYear() };
				}
				return dateJson;
			},
			buildTimeJson: function(dateObject){
		    	let timeJson = null;
		    	if(dateObject){
		    		timeJson = { HH:dateObject.getHours(),
							 	 MM:dateObject.getMinutes() };
				}
				return timeJson;
			}
		};
	}
]);
