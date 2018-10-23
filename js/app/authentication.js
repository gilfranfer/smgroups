//This will catch routeChangeError from route resolve
okulusApp.run( ['$rootScope', '$location', function($rootScope,$location){
	$rootScope.$on('$routeChangeError', function( event, next, previous, error){
		if(error == 'AUTH_REQUIRED'){
			$location.path('/error/login');
		}else{
			console.error(error);
			$location.path('/error');
		}
	});
}]);

okulusApp.controller('AuthenticationCntrl', ['$scope', '$rootScope', '$firebaseAuth','$location',
											'AuthenticationSvc','ChatService', 'NotificationsSvc', 'MembersSvc', 'UsersSvc', 'ErrorsSvc',
	function($scope, $rootScope, $firebaseAuth, $location,
						AuthenticationSvc, ChatService, NotificationsSvc, MembersSvc, UsersSvc,ErrorsSvc){

		let onlineStatus = "online";
		let activeStatus = "active";
		let typeUser = "user";
		let errorPage ="/error";
		let loginPage ="/login";
		let errorMsg = {
			memberDoesntExist: "El Miembro asociado al Usuario ya no existe.",
			emailNotEqual: "El Correo del Miembro no coincide con el del Usuario.",
			memberNotActiveUser: "El Miembro asociado/encontrado no es un Usuario activo.",
			referenceRemoved: "Se ha borrado la referencia entre el Usuario y el Miembro.",
			contactAdmin: "Contacta al Administrador del Sistema.",
			noMemberFound: "No se encontró un Miembro con el correo electrónico:",
			moreThanOneMemberFound: "Existe mas de un Miembro con el correo electrónico:",
			pwdResetEmailError: "Ha sucedido un Error. Revisa el correo proporcionado o comunícate con el Administrador."
		};

		$firebaseAuth().$onAuthStateChanged( function(authUser){
				if(authUser){
					console.debug("AuthSvc: Auth State Changed");
					AuthenticationSvc.loadSessionData(authUser.uid).$loaded().then(
						function(user){
							/* An User should be linked to a Member.
							When the link already exist, we must check the member is still valid*/
							if(user.memberId && !user.isRoot ){
								validateMemberFromUser(user);
							}
							/* If the User doesnt have a Member linked, we will use the User's email
							to find a matching member and link it*/
							else if(!user.memberId && !user.isRoot ){
								setMemberToUser(user);
							}
							/* Update lastlogin, and sessionStatus*/
							AuthenticationSvc.updateUserLastActivity(authUser.uid, onlineStatus);
							//TODO: Move to counter to reduce data traffic
							$rootScope.unreadChats = ChatService.getUnreadChats(authUser.uid);
							if(user.type == "admin"){
								AuthenticationSvc.loadSystemCounter();
							}
					});
					// usersFolder.child(authUser.uid).update({lastActivityOn: firebase.database.ServerValue.TIMESTAMP});
				}else{
					cleanRootScope();
					$location.path( loginPage );
				}
		});

		/* This process is to ensure the User is tagged to a valid Member.
		1. Get the Member Object from DB, using the Member Id reference in the User
		2. When no object is returned, is because the Member was deleated (error)
		3. Email from the User and the linked Member must match (error, when email upadated for the Member)
		4. The User already has a reference to the member, Now Link the Member to User (Cross Reference)
		5. Load Member data to scope only when member isActive and canBeUser
		In case of any error, Remove the Cross Reference */
		var validateMemberFromUser = function(user) {
			let memberId = user.memberId;
			let userEmail = user.email;
			let userId = user.$id;
			let error = undefined;

			MembersSvc.getMemberDataObject(memberId).$loaded().then(function(memberDataObj){
				if(!memberDataObj || !memberDataObj.email){
					error = errorMsg.memberDoesntExist;
				}else{
					if(memberDataObj.email == userEmail){
						MembersSvc.updateUserInMemberObject(true, userId, memberDataObj);
						if(memberDataObj.status == activeStatus && memberDataObj.canBeUser){
							$rootScope.currentSession.memberData = memberDataObj;
						}else{
							error = errorMsg.memberNotActiveUser;
						}
					}else{
						error = errorMsg.emailNotEqual;
					}
				}

				if(error){
					console.log(error);
					UsersSvc.updateMemberInUserObject(null, typeUser, user);
					if(memberDataObj){
						MembersSvc.updateUserInMemberObject(false, null, memberDataObj);
					}
					ErrorsSvc.logError(error + " " + errorMsg.referenceRemoved);
					$rootScope.response = { errorMsg: error + " " + errorMsg.contactAdmin};
					$location.path( errorPage );
				}
			});
		};

		/* This process is to find a Member that matches the User's email.
		1. More than one member is an error that must be notified to the Admin
		2. Exactly one member found will be linked to the user, only if the
		   member isActive and canBeUser
		*/
		var setMemberToUser = function(user){
			let userEmail = user.email;
			let userId = user.$id;
			let error = undefined;

			MembersSvc.getMembersByEmail(userEmail).$loaded().then(function(membersFound) {
				if(membersFound.length == 0){
					error = errorMsg.noMemberFound + " " + userEmail+ ".";
				}else if(membersFound.length > 1){
					error = errorMsg.moreThanOneMemberFound + " " + userEmail+ ".";
				}else if(membersFound[0]){
					memberObj = membersFound[0];
					membersFound.$destroy();

					if(memberObj.member.status == activeStatus && memberObj.member.canBeUser){
						$rootScope.currentSession.memberData = memberObj.member;
						//Create Cross Reference
						UsersSvc.updateMemberInUserObject(memberObj.$id, typeUser, user);
						MembersSvc.updateUserInMember(true, userId, memberObj.$id);
					}else{
						error = errorMsg.memberNotActiveUser;
					}
				}

				if(error){
					ErrorsSvc.logError(error);
					$rootScope.response = { errorMsg: error + " " + errorMsg.contactAdmin};
					$location.path( errorPage );
				}

			});
		};

		/* Delete all properties from rootScope (except for config and i18n)*/
		var cleanRootScope = function(){
			for (var prop in $rootScope) {
			    if (prop.substring(0,1) !== '$') {
						if( prop!="config" && prop!="i18n"){
							delete $rootScope[prop];
						}
			    }
			}
		};

		/** Using firebase Auth to send Verification Email **/
		$scope.sendVerificationEmail = function() {
			firebase.auth().currentUser.sendEmailVerification().then(function() {
				$scope.response = { emailSent: true };
			}).catch(function(error) {
				$scope.response = { emailSent: false };
			});
		};

		$scope.resetPwd = function(form) {
			$scope.response = {working: true, message: $rootScope.i18n.login.resetPwdInProgress };
			let email = form.email.$modelValue;

			$firebaseAuth().$sendPasswordResetEmail(email).then(function() {
				$scope.response = {success: true, message: $rootScope.i18n.login.pwdResetEmailSent };
			}).catch(function(error) {
				$scope.response = { error: true, message: errorMsg.pwdResetEmailError};
				//console.error("Error: ", error);
			});
		};

		$scope.logout = function(){
			let userId = $rootScope.currentSession.user.$id;
			AuthenticationSvc.updateUserLastActivity(userId,"offline");
			AuthenticationSvc.logout(userId);
		};
	}]//function
);

okulusApp.controller('LoginCntrl', ['$scope', '$rootScope', '$location', 'AuthenticationSvc',
	function($scope, $rootScope, $location, AuthenticationSvc){

		let homePage ="/home";
		let onlineStatus = "online";
		let errorMsg = {
			incorrectCredentials: "Usuario o Contraseña Incorrectos",
			tryAgain: "Intente nuevamente"
		};
		/* When navigating to "#!/login", but the user is already logged-in
		 we better redirect him to Home Page, instead of showing the login page */
		if($rootScope.currentSession && $rootScope.currentSession.user ){
			$location.path(homePage);
		}
		$scope.response = null;

		$scope.login = function(){
			$scope.response = {working: true, message: $rootScope.i18n.login.loginInProgress };
			AuthenticationSvc.loginUser($scope.user).then( function (user){
				$scope.response = null;
				AuthenticationSvc.updateUserLastLogin(user.uid);
				$location.path(homePage);
			})
			/* Catching unsuccessful login attempts */
			.catch( function(error){
				let message = undefined;
				switch(error.code) {
						case "auth/wrong-password":
						case "auth/user-not-found":
								message = errorMsg.incorrectCredentials;
								//AuthenticationSvc.increaseFailedLoginAttemptCount(user.uid);
								break;
						default:
							message = errorMsg.tryAgain;
				}
				$scope.response = { error: true, message: message };
			});
		};
	}]
);

okulusApp.controller('RegistrationCntrl', ['$scope', '$rootScope', '$location', 'AuthenticationSvc',
																	'AuditSvc', 'UsersSvc',
	function($scope, $rootScope, $location, AuthenticationSvc, AuditSvc, UsersSvc){
		let homePage ="/home";
		let typeUser = "user";
		let errorMsg = {
			emailExist: "El correo electrónico ya está en uso.",
			tryAgain: "Error al crear el usuario. Intente más tarde."
		};

		/* When navigating to "#!/register", but the user is already logged-in
		 we better redirect him to Home Page, instead of showing the login page */
		if($rootScope.currentSession && $rootScope.currentSession.user){
			$location.path(homePage);
		}

		$scope.register = function(){
			$scope.response = {working: true, message: $rootScope.i18n.register.registerInProgress };
			AuthenticationSvc.register($scope.newUser).then(function(regUser){
				$scope.response = {success: true, message: $rootScope.i18n.register.registerSuccess };
				UsersSvc.createUser(regUser.uid, $scope.newUser.email, typeUser);
				AuditSvc.recordAudit(regUser.uid, "create", "users");
				$location.path(homePage);
			})
			.catch( function(error){
				let message = undefined;
				switch(error.code) {
						case "auth/email-already-in-use":
								message = errorMsg.emailExist;
								break;
						default:
							message = errorMsg.tryAgain;
				}
				$scope.response = { error: true, message: message };
				console.error(error);
			});
		};

	}]
);

okulusApp.factory('AuthenticationSvc', ['$rootScope','$location','$firebaseObject', 'MembersSvc', '$firebaseAuth',
	function($rootScope, $location,$firebaseObject,MembersSvc,$firebaseAuth){
		let usersFolder = firebase.database().ref().child(rootFolder).child('users')
		let countersRef = firebase.database().ref().child(rootFolder).child('counters');
		var auth = $firebaseAuth();

		return{
			/* Creates currentSession in $rootScope with the User Object from firebase
			 and the emailVerified status.*/
			loadSessionData: function(authUserUid){
				if(!$rootScope.currentSession){
					let emailVerified = firebase.auth().currentUser.emailVerified;
					let userObject = $firebaseObject(usersFolder.child(authUserUid));
					$rootScope.currentSession = { user: userObject, emailVerified: emailVerified };
				}
				return $rootScope.currentSession.user;
			},
			/* Builds a firebase Object representing the global counters */
			loadSystemCounter: function(){
				if(!$rootScope.currentSession.systemCounters){
					$rootScope.currentSession.systemCounters = $firebaseObject(countersRef);
				}
			},
			/* Update the date when User was "active" for last time, and make sure to
			update his session status (online or offline) */
			updateUserLastActivity: function(userid,sessionStatus){
				usersFolder.child(userid).update(
					{lastActivityOn: firebase.database.ServerValue.TIMESTAMP, sessionStatus:sessionStatus});
			},
			/* Only called after a successful login */
			updateUserLastLogin: function(userid){
				//TODO: Remove lastLogin: old value. setting null to remove from DB
				let record = { lastLoginOn:firebase.database.ServerValue.TIMESTAMP, lastLogin:null};
				usersFolder.child(userid).update(record);
			},
			loginUser: function(user){
				return auth.$signInWithEmailAndPassword(user.email,user.pwd);
			},
			logout: function(userId){
				return auth.$signOut();
			},
			isUserLoggedIn: function(){
				return auth.$requireSignIn();
			},
			register: function(user){
				return auth.$createUserWithEmailAndPassword(user.email, user.pwd);
			}
		};//return
	}
]);
